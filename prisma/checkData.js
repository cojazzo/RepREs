// Simulate what the frontend does: call the labs summary API
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function run() {
    // Find the first active participant (same as the API would)
    const participant = await p.participant.findFirst({
        where: { status: { not: 'SCREENING' } },
        orderBy: { studyId: 'asc' },
        select: { id: true, studyId: true, sex: true, birthDate: true },
    });

    if (!participant) { console.log('No participant found'); return; }
    console.log('Testing for:', participant.studyId, 'id=' + participant.id);

    // Replicate the exact API query
    const visits = await p.visit.findMany({
        where: { participantId: participant.id, status: 'SUBMITTED' },
        select: { id: true, visitType: true, visitDate: true },
        orderBy: { visitDate: 'asc' },
    });
    console.log('SUBMITTED visits:', visits.length);
    visits.forEach(v => console.log('  ' + v.visitType + ' id=' + v.id));

    if (visits.length === 0) {
        console.log('NO SUBMITTED VISITS for this participant!');
        // Check if lab results exist on ANY visit for this participant
        const anyVisits = await p.visit.findMany({
            where: { participantId: participant.id },
            select: { id: true, visitType: true, status: true, _count: { select: { crfLabResults: true } } },
        });
        console.log('All visits for this participant:');
        anyVisits.forEach(v => console.log('  ' + v.visitType + ' status=' + v.status + ' labs=' + v._count.crfLabResults));
        await p.$disconnect();
        return;
    }

    const visitIds = visits.map(v => v.id);
    const labResults = await p.crfLabResult.findMany({
        where: { visitId: { in: visitIds } },
        select: { visitId: true, analyteCode: true, value: true, unit: true },
    });
    console.log('Lab results found:', labResults.length);
    // Show first 5
    labResults.slice(0, 5).forEach(r => console.log('  ' + r.analyteCode + '=' + r.value + ' ' + r.unit));

    await p.$disconnect();
}
run();
