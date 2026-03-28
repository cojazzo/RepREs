const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function run() {
    // Update ALL visits that have any CRF lab results to SUBMITTED
    const withLabs = await p.visit.findMany({
        where: { crfLabResults: { some: {} } },
        select: { id: true, participantId: true, visitType: true, status: true, participant: { select: { studyId: true } } },
    });

    console.log('Visits with CRF lab results:');
    for (const v of withLabs) {
        console.log(' ', v.participant.studyId, v.visitType, 'status=' + v.status, 'id=' + v.id);
    }

    if (withLabs.length === 0) {
        console.log('  NONE FOUND! The seed script may not have run properly.');
        await p.$disconnect();
        return;
    }

    // Force update them all to SUBMITTED
    const ids = withLabs.map(v => v.id);
    const result = await p.visit.updateMany({
        where: { id: { in: ids } },
        data: { status: 'SUBMITTED', completed: true },
    });
    console.log('\nUpdated', result.count, 'visits to SUBMITTED');

    // Verify
    for (const v of withLabs) {
        const count = await p.crfLabResult.count({ where: { visitId: v.id } });
        console.log(' ', v.participant.studyId, v.visitType, '→ SUBMITTED,', count, 'lab results');
    }

    await p.$disconnect();
}
run();
