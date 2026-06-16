import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const randomizations = await prisma.randomization.findMany({
        include: {
            participant: {
                include: {
                    screening: true
                }
            }
        }
    });

    console.log(`Total randomized participants: ${randomizations.length}`);

    randomizations.forEach(r => {
        const p = r.participant;
        const s = p.screening;
        if (s) {
            const vals = [s.acrValue1, s.acrValue2, s.acrValue3].filter(v => v !== null) as number[];
            const mean = vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
            console.log(`Participant ${p.studyId} | Arm ${r.armLabel} | Stratum ${r.stratum} | ACR vals: ${s.acrValue1}, ${s.acrValue2}, ${s.acrValue3} | Mean: ${mean}`);
        } else {
            console.log(`Participant ${p.studyId} | Arm ${r.armLabel} | No screening data`);
        }
    });
}

main()
    .catch(e => { console.error(e); process.exit(1); })
    .finally(() => prisma.$disconnect());
