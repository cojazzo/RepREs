import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const studyId = 'REP-0003';
    
    const participant = await prisma.participant.findFirst({
        where: { studyId: { equals: studyId, mode: 'insensitive' } }
    });

    if (!participant) {
        console.log(`Participant ${studyId} not found.`);
        return;
    }

    console.log(`Found ${studyId} (ID: ${participant.id}). Deleting related records first...`);

    // Clean up visit sub-records
    await prisma.visitAe.deleteMany({ where: { visit: { participantId: participant.id } } }).catch(() => {});
    await prisma.visitAdherence.deleteMany({ where: { visit: { participantId: participant.id } } }).catch(() => {});
    await prisma.visitClinical.deleteMany({ where: { visit: { participantId: participant.id } } }).catch(() => {});
    await prisma.crfLabResult.deleteMany({ where: { visit: { participantId: participant.id } } }).catch(() => {});
    await prisma.vitals.deleteMany({ where: { visit: { participantId: participant.id } } }).catch(() => {});
    await prisma.clinicalAssessment.deleteMany({ where: { visit: { participantId: participant.id } } }).catch(() => {});
    await prisma.adherence.deleteMany({ where: { visit: { participantId: participant.id } } }).catch(() => {});

    // Clean up top-level related records
    await prisma.visit.deleteMany({ where: { participantId: participant.id } }).catch(() => {});
    await prisma.dispensation.deleteMany({ where: { participantId: participant.id } }).catch(() => {});
    await prisma.adverseEvent.deleteMany({ where: { participantId: participant.id } }).catch(() => {});
    await prisma.screeningChecklist.deleteMany({ where: { participantId: participant.id } }).catch(() => {});
    await prisma.randomization.deleteMany({ where: { participantId: participant.id } }).catch(() => {});

    // Finally delete the participant
    await prisma.participant.delete({ where: { id: participant.id } });

    console.log(`Successfully deleted ${studyId} and all associated records.`);
}

main()
    .catch(e => { console.error(e); process.exit(1); })
    .finally(() => prisma.$disconnect());
