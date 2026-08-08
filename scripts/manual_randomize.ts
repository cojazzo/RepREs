import { PrismaClient, ArmLabel, Treatment, ParticipantStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length !== 2) {
    console.log("Usage: npx ts-node scripts/manual_randomize.ts <studyId> <PLACEBO|DAPAGLIFLOZIN_10MG>");
    process.exit(1);
  }

  const studyId = args[0];
  const treatmentArg = args[1].toUpperCase();

  if (treatmentArg !== 'PLACEBO' && treatmentArg !== 'DAPAGLIFLOZIN_10MG') {
    console.error("Invalid treatment. Use 'PLACEBO' or 'DAPAGLIFLOZIN_10MG'.");
    process.exit(1);
  }

  const treatment = treatmentArg as Treatment;
  const armLabel = treatment === 'PLACEBO' ? ArmLabel.B : ArmLabel.A; // Adjust arm label if A is Placebo in your study protocol

  try {
    const participant = await prisma.participant.findUnique({
      where: { studyId },
      include: { randomization: true }
    });

    if (!participant) {
      console.error(`Participant with study ID ${studyId} not found.`);
      process.exit(1);
    }

    if (participant.randomization) {
      console.error(`Participant ${studyId} is already randomized.`);
      process.exit(1);
    }

    console.log(`Manually randomizing ${studyId} to ${treatment}...`);

    await prisma.$transaction(async (tx) => {
      await tx.randomization.create({
        data: {
          participantId: participant.id,
          armLabel,
          treatment,
          stratum: "MANUAL",
          blockId: 0,
          blockSize: 0,
          sequenceInBlock: 0,
          randomizedAt: new Date(),
        }
      });

      await tx.participant.update({
        where: { id: participant.id },
        data: { 
          status: ParticipantStatus.ACTIVE,
          enrolledAt: new Date()
        }
      });
    });

    console.log(`Successfully enrolled participant ${studyId} into ${treatment}.`);
  } catch (error) {
    console.error("Error during manual randomization:", error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
