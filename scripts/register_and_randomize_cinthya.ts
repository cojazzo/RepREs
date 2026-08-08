import { PrismaClient, ParticipantStatus, VisitType, ArmLabel, Treatment } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    const firstName = "CINTHYA GETZEMANI";
    const lastName = "BAUTISTA MARQUEZ";
    const curp = "BAMC110812MASTRYA0";
    const chmhId = "2026-06937";
    const phone = "4491371340";
    // Using UTC so it doesn't get messed up by timezone
    const birthDate = new Date("2011-08-12T12:00:00Z");

    const treatment: Treatment = 'PLACEBO';
    const armLabel: ArmLabel = ArmLabel.B;

    console.log("Checking if participant exists...");
    const existing = await prisma.participant.findFirst({
        where: { OR: [{ curp }, { chmhId }] }
    });

    if (existing) {
        console.log(`Participant already exists with studyId: ${existing.studyId}`);
        process.exit(1);
    }

    console.log("Generating next Study ID...");
    const lastParticipant = await prisma.participant.findFirst({
        orderBy: { studyId: 'desc' },
        select: { studyId: true }
    });
    
    let nextNum = 1;
    if (lastParticipant && lastParticipant.studyId.startsWith('REP-')) {
        const lastNum = parseInt(lastParticipant.studyId.replace('REP-', ''), 10);
        if (!isNaN(lastNum)) {
            nextNum = lastNum + 1;
        }
    }
    const studyId = `REP-${String(nextNum).padStart(4, '0')}`;
    console.log(`Assigned Study ID: ${studyId}`);

    console.log("Creating participant and visits...");
    await prisma.$transaction(async (tx) => {
        const participant = await tx.participant.create({
            data: {
                studyId,
                firstName,
                lastName,
                sex: "FEMALE", // Assumed from name
                birthDate,
                curp,
                chmhId,
                phone,
                status: ParticipantStatus.ACTIVE,
                consentDate: new Date(),
                enrolledAt: new Date(),
                screening: {
                    create: {
                        acrOver30: true,
                        acrValue1: 37.7,
                        acrValue2: 86.3,
                        acrValue3: 36.4,
                        informedConsent: true,
                        willingToComply: true,
                        renalImpairment: false,
                        pregnancy: false,
                        knownAllergy: false,
                        activeInfection: false,
                        diabetesMellitus: false,
                        knownGlomerulopathy: false,
                        highRiskCondition: false,
                        eligible: true,
                    }
                }
            }
        });

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

        for (const visitType of [VisitType.BASELINE, VisitType.MONTH_2, VisitType.MONTH_4, VisitType.MONTH_6]) {
            await tx.visit.create({
                data: { participantId: participant.id, visitType },
            });
        }
        
        console.log(`Successfully enrolled ${firstName} ${lastName} into ${treatment}.`);
    });

  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
