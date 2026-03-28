import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    // Find all randomized participants
    const participants = await prisma.participant.findMany({
        where: { status: { not: 'SCREENING' }, randomization: { isNot: null } },
        include: { randomization: true },
        orderBy: { studyId: 'asc' },
    });

    if (participants.length === 0) {
        console.log('No eligible participants found. Seed participants first.');
        return;
    }
    console.log(`Seeding demo labs for ${participants.length} participants...`);

    // Ensure key calculated/derived analytes exist in the catalog
    await prisma.crfLabAnalyte.upsert({ where: { code: 'EGFR' }, update: {}, create: { code: 'EGFR', name: 'eGFR (CKD-EPI)', type: 'Numerico', category: 'Renal', sortOrder: 999 } });
    await prisma.crfLabAnalyte.upsert({ where: { code: 'ACR' }, update: {}, create: { code: 'ACR', name: 'Albumin/Creatinine Ratio', type: 'Numerico', category: 'Renal', sortOrder: 999 } });
    await prisma.crfLabAnalyte.upsert({ where: { code: 'MALB' }, update: {}, create: { code: 'MALB', name: 'Microalbuminuria', type: 'Numerico', category: 'Renal', sortOrder: 999 } });
    await prisma.crfLabAnalyte.upsert({ where: { code: 'CRE_U' }, update: {}, create: { code: 'CRE_U', name: 'Urine Creatinine', type: 'Numerico', category: 'Renal', sortOrder: 999 } });
    await prisma.crfLabAnalyte.upsert({ where: { code: 'CRE_S' }, update: {}, create: { code: 'CRE_S', name: 'Serum Creatinine', type: 'Numerico', category: 'Renal', sortOrder: 999 } });

    // Load all analytes
    const analytes = await prisma.crfLabAnalyte.findMany({ orderBy: { sortOrder: 'asc' } });
    if (analytes.length === 0) {
        console.log('No analytes found. Run seedLabAnalytes first.');
        return;
    }

    // Define 4 visits with dates
    const visitDefs: { visitType: any; dateOffset: number }[] = [
        { visitType: 'BASELINE', dateOffset: 0 },
        { visitType: 'MONTH_2', dateOffset: 60 },
        { visitType: 'MONTH_4', dateOffset: 120 },
        { visitType: 'MONTH_6', dateOffset: 180 },
    ];

    for (const p of participants) {
        console.log(`Processing ${p.studyId} (Arm ${p.randomization?.armLabel})...`);
        const isArmA = p.randomization?.armLabel === 'A';
        const startDate = p.enrolledAt || new Date('2025-01-01');

        // Randomize starting baseline
        const baseACR = 300 + Math.random() * 200; // 300-500
        const baseEGFR = 40 + Math.random() * 20;  // 40-60
        const baseCreU = 100 + Math.random() * 40;
        const baseAlbU = baseACR * (baseCreU / 1000); // Compute roughly matching ALB_U
        const baseCreS = Math.random() > 0.5 ? 1.4 : 1.6;

        for (let i = 0; i < visitDefs.length; i++) {
            const vd = visitDefs[i];
            const vDate = new Date(startDate);
            vDate.setDate(vDate.getDate() + vd.dateOffset + (Math.random() * 10 - 5)); // +/- 5 days jitter

            // Trend modifiers over visits
            let acrMulti = 1;
            let egfrShift = 0;
            if (isArmA) {
                // Group A: improves (ACR drops, eGFR stable/rises)
                acrMulti = 1 - (i * 0.15); // drops ~15% per visit
                egfrShift = i * 2; // +2 per visit
            } else {
                // Group B: degrades (ACR rises, eGFR drops)
                acrMulti = 1 + (i * 0.1); // rises ~10% per visit
                egfrShift = -i * 1.5; // -1.5 per visit
            }

            const currentACR = baseACR * acrMulti;
            const currentEGFR = baseEGFR + egfrShift;
            const currentCreU = baseCreU;
            const currentMalb = currentACR * (currentCreU / 1000);
            const currentCreS = baseCreS - (egfrShift / 50); // rough inverse correlation

            const labValues: Record<string, number> = {
                ACR: currentACR,
                EGFR: currentEGFR,
                EGFR_CALC: currentEGFR,
                CRE_U: currentCreU,
                MALB: currentMalb,
                ALB_U: currentMalb / 10,
                CRE_S: currentCreS,
                // Add some other basic static/random ones so table isn't empty
                WBC: 6.5 + Math.random() * 1.5,
                HGB: 13 + Math.random() * 2,
                PLT: 220 + Math.random() * 50,
                K: 4.0 + Math.random() * 0.8,
            };

            const visit = await prisma.visit.upsert({
                where: { participantId_visitType: { participantId: p.id, visitType: vd.visitType } },
                update: { visitDate: vDate, status: 'SUBMITTED', completed: true },
                create: { participantId: p.id, visitType: vd.visitType, visitDate: vDate, status: 'SUBMITTED', completed: true },
            });

            const pushes = [];
            for (const analyte of analytes) {
                const val = labValues[analyte.code];
                if (val == null) continue;
                pushes.push(prisma.crfLabResult.upsert({
                    where: { visitId_analyteCode: { visitId: visit.id, analyteCode: analyte.code } },
                    update: { value: val.toFixed(1), unit: analyte.unit },
                    create: { visitId: visit.id, analyteCode: analyte.code, value: val.toFixed(1), unit: analyte.unit },
                }));
            }
            await Promise.all(pushes);
        }
    }

    console.log('\n✅ Demo lab data seeded successfully for all randomized participants!');
}

main()
    .catch(e => { console.error(e); process.exit(1); })
    .finally(() => prisma.$disconnect());
