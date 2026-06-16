import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    // Let's find the large batch of demo data by looking for a time window where many EGFR were inserted
    const demoEGFRs = await prisma.crfLabResult.findMany({
        where: { analyteCode: 'CRE_S' },
        orderBy: { createdAt: 'desc' },
        take: 100
    });

    if (demoEGFRs.length === 0) {
        console.log("No demo EGFR records found.");
        return;
    }

    // Assume the most recent bulk insertion of EGFR is the demo run
    const demoTime = demoEGFRs[0].createdAt;
    
    // Define a 5-minute window around that time
    const startTime = new Date(demoTime.getTime() - 5 * 60 * 1000);
    const endTime = new Date(demoTime.getTime() + 5 * 60 * 1000);

    const deleted = await prisma.crfLabResult.deleteMany({
        where: {
            createdAt: {
                gte: startTime,
                lte: endTime
            }
        }
    });

    console.log(`Deleted ${deleted.count} fake lab results created around ${demoTime.toISOString()}`);
}

main()
    .catch(e => { console.error(e); process.exit(1); })
    .finally(() => prisma.$disconnect());
