import { PrismaClient, VisitType, VisitStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log("Fetching all MONTH_2 (V1) visits...");
    const v1Visits = await prisma.visit.findMany({
        where: { visitType: VisitType.MONTH_2 }
    });

    console.log(`Found ${v1Visits.length} V1 visits. Clearing data...`);

    const visitIds = v1Visits.map(v => v.id);

    if (visitIds.length === 0) {
        console.log("No V1 visits found.");
        return;
    }

    // Delete related records
    const tx = [
        prisma.visitAe.deleteMany({ where: { visitId: { in: visitIds } } }),
        prisma.visitAdherence.deleteMany({ where: { visitId: { in: visitIds } } }),
        prisma.visitClinical.deleteMany({ where: { visitId: { in: visitIds } } }),
        prisma.crfLabResult.deleteMany({ where: { visitId: { in: visitIds } } }),
        prisma.vitals.deleteMany({ where: { visitId: { in: visitIds } } }),
        prisma.clinicalAssessment.deleteMany({ where: { visitId: { in: visitIds } } }),
        prisma.adherence.deleteMany({ where: { visitId: { in: visitIds } } }),
        prisma.labResult.deleteMany({ where: { visitId: { in: visitIds } } }),
        prisma.concomitantMed.deleteMany({ where: { visitId: { in: visitIds } } }),

        // Update the visit records to DRAFT and completed = false
        prisma.visit.updateMany({
            where: { id: { in: visitIds } },
            data: {
                completed: false,
                status: VisitStatus.DRAFT,
                visitDate: null,
                notes: null
            }
        })
    ];

    await prisma.$transaction(tx);

    console.log("Successfully cleared V1 (Mes 2) data and reset visits to DRAFT state.");
}

main()
    .catch(e => { console.error(e); process.exit(1); })
    .finally(async () => {
        await prisma.$disconnect();
    });
