const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function backfillAppointments() {
    try {
        const participants = await prisma.participant.findMany({
            where: { status: 'ACTIVE' },
            include: { visits: { include: { appointment: true } } }
        });

        console.log(`Found ${participants.length} active participants.`);

        let createdCount = 0;

        for (const p of participants) {
            if (!p.enrolledAt) continue;

            const now = new Date(p.enrolledAt);
            const visitSchedule = {
                BASELINE: now,
                MONTH_2: new Date(now.getFullYear(), now.getMonth() + 2, now.getDate()),
                MONTH_4: new Date(now.getFullYear(), now.getMonth() + 4, now.getDate()),
                MONTH_6: new Date(now.getFullYear(), now.getMonth() + 6, now.getDate()),
            };

            for (const [vType, schedDate] of Object.entries(visitSchedule)) {
                let visit = p.visits.find(v => v.visitType === vType);
                if (!visit) {
                    visit = await prisma.visit.create({
                        data: { participantId: p.id, visitType: vType }
                    });
                }

                const existingAppt = await prisma.appointment.findFirst({
                    where: { participantId: p.id, visitId: visit.id }
                });

                if (!existingAppt) {
                    await prisma.appointment.create({
                        data: {
                            participantId: p.id,
                            visitId: visit.id,
                            scheduledDate: schedDate,
                            status: 'SCHEDULED'
                        }
                    });
                    createdCount++;
                }
            }
        }

        console.log(`Successfully generated ${createdCount} missing appointments for older participants.`);
    } catch (e) {
        console.error("Error backfilling:", e);
    } finally {
        await prisma.$disconnect();
    }
}

backfillAppointments();
