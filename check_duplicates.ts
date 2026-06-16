import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const p1 = await prisma.participant.findFirst({
        where: { studyId: { equals: 'REP-0003', mode: 'insensitive' } },
        include: {
            screening: true,
            randomization: true,
            visits: true,
            adverseEvents: true,
            dispensations: true,
        }
    });

    const p2 = await prisma.participant.findFirst({
        where: { studyId: { equals: 'REP-0021', mode: 'insensitive' } },
        include: {
            screening: true,
            randomization: true,
            visits: true,
            adverseEvents: true,
            dispensations: true,
        }
    });

    console.log("=== REP-0003 ===");
    console.log(JSON.stringify(p1, null, 2));
    
    console.log("\n=== REP-0021 ===");
    console.log(JSON.stringify(p2, null, 2));
}

main().finally(() => prisma.$disconnect());
