import { PrismaClient, Role, ParticipantStatus, VisitType, ArmLabel, Treatment, AESeverity, AERelation, AEOutcome } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Seeding database...');

    // --- Users ---
    const adminPw = await bcrypt.hash('Admin123!', 12);

    const admin = await prisma.user.upsert({
        where: { email: 'admin@demo.com' },
        update: {},
        create: {
            email: 'admin@demo.com',
            name: 'Admin User',
            passwordHash: adminPw,
            role: Role.ADMIN,
        },
    });

    const pharmacy = await prisma.user.upsert({
        where: { email: 'pharmacy@demo.com' },
        update: {},
        create: {
            email: 'pharmacy@demo.com',
            name: 'Pharmacy User',
            passwordHash: adminPw,
            role: Role.PHARMACY,
        },
    });

    const dataEntry = await prisma.user.upsert({
        where: { email: 'data@demo.com' },
        update: {},
        create: {
            email: 'data@demo.com',
            name: 'Data Entry User',
            passwordHash: adminPw,
            role: Role.DATA_ENTRY,
        },
    });

    const investigator = await prisma.user.upsert({
        where: { email: 'investigator@demo.com' },
        update: {},
        create: {
            email: 'investigator@demo.com',
            name: 'Dr. Investigator',
            passwordHash: adminPw,
            role: Role.INVESTIGATOR,
        },
    });

    const monitor = await prisma.user.upsert({
        where: { email: 'monitor@demo.com' },
        update: {},
        create: {
            email: 'monitor@demo.com',
            name: 'Monitor User',
            passwordHash: adminPw,
            role: Role.MONITOR,
        },
    });

    console.log('✅ Users created');

    // --- Analyte Catalog ---
    const analytes = [
        { name: 'Serum Creatinine', code: 'SCR', unit: 'mg/dL', refMin: 0.6, refMax: 1.2, category: 'Renal', isComputed: false },
        { name: 'eGFR (CKD-EPI)', code: 'EGFR', unit: 'mL/min/1.73m²', refMin: 60, refMax: 120, category: 'Renal', isComputed: true },
        { name: 'BUN/Urea', code: 'BUN', unit: 'mg/dL', refMin: 7, refMax: 20, category: 'Renal', isComputed: false },
        { name: 'Urine Albumin', code: 'UALB', unit: 'mg/L', refMin: 0, refMax: 30, category: 'Renal', isComputed: false },
        { name: 'Urine Creatinine', code: 'UCR', unit: 'mg/dL', refMin: 20, refMax: 275, category: 'Renal', isComputed: false },
        { name: 'ACR', code: 'ACR', unit: 'mg/g', refMin: 0, refMax: 30, category: 'Renal', isComputed: true },
        { name: 'HbA1c', code: 'HBA1C', unit: '%', refMin: 4.0, refMax: 5.6, category: 'Metabolic', isComputed: false },
        { name: 'Fasting Glucose', code: 'FBG', unit: 'mg/dL', refMin: 70, refMax: 100, category: 'Metabolic', isComputed: false },
        { name: 'Potassium', code: 'K', unit: 'mEq/L', refMin: 3.5, refMax: 5.0, category: 'Electrolytes', isComputed: false },
        { name: 'Sodium', code: 'NA', unit: 'mEq/L', refMin: 136, refMax: 145, category: 'Electrolytes', isComputed: false },
    ];

    for (const a of analytes) {
        await prisma.analyteCatalog.upsert({
            where: { code: a.code },
            update: {},
            create: a,
        });
    }
    console.log('✅ Analyte catalog created');

    // --- Study Config ---
    const configs = [
        { key: 'TARGET_PER_ARM', value: '100', description: 'Target participants per arm' },
        { key: 'STUDY_DRUG', value: 'Dapagliflozin 10mg', description: 'Active treatment name' },
        { key: 'BLOCK_SIZES', value: '4,6', description: 'Randomization block sizes (comma-separated)' },
        { key: 'STUDY_DURATION_MONTHS', value: '6', description: 'Study duration in months' },
    ];

    for (const c of configs) {
        await prisma.studyConfig.upsert({
            where: { key: c.key },
            update: {},
            create: { ...c, updatedAt: new Date() },
        });
    }
    console.log('✅ Study config created');

    // --- Demo Participants ---
    const firstNames = ['James', 'Maria', 'Robert', 'Linda', 'Michael', 'Patricia', 'William', 'Jennifer', 'David', 'Elizabeth',
        'Richard', 'Barbara', 'Joseph', 'Susan', 'Thomas', 'Jessica', 'Charles', 'Sarah', 'Daniel', 'Karen'];
    const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez',
        'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin'];

    let blockId = 1;
    let blockSize = 4;
    let sequenceInBlock = 0;
    const blockAssignments: ArmLabel[] = [];

    function generateBlock(size: number): ArmLabel[] {
        const half = size / 2;
        const block: ArmLabel[] = [];
        for (let i = 0; i < half; i++) block.push(ArmLabel.A);
        for (let i = 0; i < half; i++) block.push(ArmLabel.B);
        // Fisher-Yates shuffle
        for (let i = block.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [block[i], block[j]] = [block[j], block[i]];
        }
        return block;
    }

    for (let i = 0; i < 20; i++) {
        if (sequenceInBlock >= blockSize) {
            blockId++;
            blockSize = [4, 6][Math.floor(Math.random() * 2)];
            sequenceInBlock = 0;
            blockAssignments.length = 0;
        }

        if (blockAssignments.length === 0) {
            blockAssignments.push(...generateBlock(blockSize));
        }

        const armLabel = blockAssignments[sequenceInBlock];
        const treatment = armLabel === ArmLabel.A ? Treatment.DAPAGLIFLOZIN_10MG : Treatment.PLACEBO;
        const sex = i % 2 === 0 ? 'Male' : 'Female';
        const birthYear = 1950 + Math.floor(Math.random() * 40);
        const birthMonth = Math.floor(Math.random() * 12);
        const birthDay = 1 + Math.floor(Math.random() * 28);
        const studyId = `REP-${String(i + 1).padStart(4, '0')}`;

        const status: ParticipantStatus = i < 16 ? ParticipantStatus.ACTIVE :
            i === 16 ? ParticipantStatus.WITHDRAWN :
                i === 17 ? ParticipantStatus.COMPLETED :
                    i === 18 ? ParticipantStatus.LOST_TO_FOLLOWUP : ParticipantStatus.SCREENING;

        const participant = await prisma.participant.upsert({
            where: { studyId },
            update: {},
            create: {
                studyId,
                firstName: firstNames[i],
                lastName: lastNames[i],
                sex,
                birthDate: new Date(birthYear, birthMonth, birthDay),
                status,
                consentDate: new Date(2025, 0, 10 + i),
                enrolledAt: status !== ParticipantStatus.SCREENING ? new Date(2025, 0, 12 + i) : undefined,
            },
        });

        // Screening
        await prisma.screeningChecklist.upsert({
            where: { participantId: participant.id },
            update: {},
            create: {
                participantId: participant.id,
                acrOver30: true,
                informedConsent: true,
                willingToComply: true,
                renalImpairment: false,
                diabetesMellitus: false,
                knownGlomerulopathy: false,
                highRiskCondition: false,
                pregnancy: false,
                knownAllergy: false,
                activeInfection: false,
                eligible: status !== ParticipantStatus.SCREENING,
            },
        });

        // Randomization (only for enrolled)
        if (status !== ParticipantStatus.SCREENING) {
            await prisma.randomization.upsert({
                where: { participantId: participant.id },
                update: {},
                create: {
                    participantId: participant.id,
                    armLabel,
                    treatment,
                    blockId,
                    blockSize,
                    sequenceInBlock,
                },
            });
            sequenceInBlock++;
        }

        // Visits with data
        const visitTypes = [VisitType.BASELINE, VisitType.MONTH_2, VisitType.MONTH_4, VisitType.MONTH_6];
        const completedVisits = status === ParticipantStatus.COMPLETED ? 4 :
            status === ParticipantStatus.WITHDRAWN ? Math.min(i % 3 + 1, 4) :
                status === ParticipantStatus.ACTIVE ? Math.min(Math.floor(Math.random() * 3) + 1, 4) : 0;

        for (let v = 0; v < visitTypes.length; v++) {
            if (status === ParticipantStatus.SCREENING) continue;

            const isCompleted = v < completedVisits;
            const visitDate = isCompleted ? new Date(2025, v * 2, 15 + i) : undefined;

            const visit = await prisma.visit.upsert({
                where: { participantId_visitType: { participantId: participant.id, visitType: visitTypes[v] } },
                update: {},
                create: {
                    participantId: participant.id,
                    visitType: visitTypes[v],
                    visitDate,
                    completed: isCompleted,
                },
            });

            if (isCompleted) {
                const baseWeight = 70 + Math.random() * 30;
                const height = 155 + Math.random() * 35;
                const bmi = baseWeight / Math.pow(height / 100, 2);

                // Vitals
                await prisma.vitals.upsert({
                    where: { visitId: visit.id },
                    update: {},
                    create: {
                        visitId: visit.id,
                        weightKg: Math.round(baseWeight * 10) / 10,
                        heightCm: Math.round(height * 10) / 10,
                        bmi: Math.round(bmi * 10) / 10,
                        systolicBp: 110 + Math.floor(Math.random() * 40),
                        diastolicBp: 65 + Math.floor(Math.random() * 25),
                        heartRate: 60 + Math.floor(Math.random() * 30),
                    },
                });

                // Clinical Assessment
                await prisma.clinicalAssessment.upsert({
                    where: { visitId: visit.id },
                    update: {},
                    create: {
                        visitId: visit.id,
                        symptoms: JSON.stringify(v === 0 ? ['Fatigue', 'Polyuria'] : v === 1 ? ['Mild dizziness'] : []),
                        physicalExamNotes: 'Within normal limits',
                        continuationCriteria: true,
                    },
                });

                // Adherence
                await prisma.adherence.upsert({
                    where: { visitId: visit.id },
                    update: {},
                    create: {
                        visitId: visit.id,
                        adherencePercent: 85 + Math.random() * 15,
                        missedDoses: Math.floor(Math.random() * 5),
                        reasonForNonAdherence: Math.random() > 0.7 ? 'Forgot to take medication' : null,
                    },
                });

                // Lab Results
                const scrValue = 0.7 + Math.random() * 0.8;
                const age = new Date().getFullYear() - birthYear;
                const kappa = sex === 'Female' ? 0.7 : 0.9;
                const alpha = sex === 'Female' ? -0.241 : -0.302;
                const eGFR = 142 * Math.pow(Math.min(scrValue / kappa, 1), alpha) * Math.pow(Math.max(scrValue / kappa, 1), -1.200) * Math.pow(0.9938, age) * (sex === 'Female' ? 1.012 : 1);
                const urineAlb = 10 + Math.random() * 50;
                const urineCr = 50 + Math.random() * 150;
                const acr = (urineAlb / urineCr) * 1000;

                const analyteList = await prisma.analyteCatalog.findMany();
                const analyteMap: Record<string, string> = {};
                analyteList.forEach((a: any) => { analyteMap[a.code] = a.id; });

                const labData = [
                    { analyteId: analyteMap['SCR'], value: Math.round(scrValue * 100) / 100, unit: 'mg/dL' },
                    { analyteId: analyteMap['EGFR'], value: Math.round(eGFR * 10) / 10, unit: 'mL/min/1.73m²' },
                    { analyteId: analyteMap['BUN'], value: Math.round((10 + Math.random() * 15) * 10) / 10, unit: 'mg/dL' },
                    { analyteId: analyteMap['UALB'], value: Math.round(urineAlb * 10) / 10, unit: 'mg/L' },
                    { analyteId: analyteMap['UCR'], value: Math.round(urineCr * 10) / 10, unit: 'mg/dL' },
                    { analyteId: analyteMap['ACR'], value: Math.round(acr * 10) / 10, unit: 'mg/g' },
                ];

                for (const lab of labData) {
                    const cat = analyteList.find((a: any) => a.id === lab.analyteId);
                    await prisma.labResult.upsert({
                        where: { visitId_analyteId: { visitId: visit.id, analyteId: lab.analyteId } },
                        update: {},
                        create: {
                            visitId: visit.id,
                            analyteId: lab.analyteId,
                            value: lab.value,
                            unit: lab.unit,
                            referenceMin: cat?.refMin,
                            referenceMax: cat?.refMax,
                            isAbnormal: cat ? (lab.value < (cat.refMin ?? 0) || lab.value > (cat.refMax ?? 999)) : false,
                        },
                    });
                }
            }
        }

        // Adverse Events for some participants
        if (i < 8 && status !== ParticipantStatus.SCREENING) {
            await prisma.adverseEvent.create({
                data: {
                    participantId: participant.id,
                    visitType: VisitType.MONTH_2,
                    description: ['Headache', 'Nausea', 'Dizziness', 'Urinary tract infection', 'Hypotension', 'Fatigue', 'Back pain', 'Genital infection'][i],
                    startDate: new Date(2025, 2, 10 + i),
                    endDate: i < 5 ? new Date(2025, 2, 15 + i) : undefined,
                    severity: i < 3 ? AESeverity.MILD : i < 6 ? AESeverity.MODERATE : AESeverity.SEVERE,
                    relation: i < 2 ? AERelation.UNRELATED : i < 5 ? AERelation.POSSIBLE : AERelation.PROBABLE,
                    outcome: i < 5 ? AEOutcome.RECOVERED : i < 7 ? AEOutcome.RECOVERING : AEOutcome.NOT_RECOVERED,
                    isSAE: i >= 6,
                    saeDetails: i >= 6 ? 'Requires extended monitoring' : undefined,
                    actionTaken: i >= 6 ? 'Dose reduction' : 'None',
                },
            });
        }

        // Dispensation for enrolled
        if (status !== ParticipantStatus.SCREENING) {
            await prisma.dispensation.create({
                data: {
                    participantId: participant.id,
                    visitType: VisitType.BASELINE,
                    lotNumber: `LOT-2025-${String(Math.floor(Math.random() * 100)).padStart(3, '0')}`,
                    tabletsDispensed: 60,
                    tabletsReturned: Math.floor(Math.random() * 5),
                    adherenceByPillCount: 90 + Math.random() * 10,
                    dispensedDate: new Date(2025, 0, 15 + i),
                },
            });
        }
    }

    console.log('✅ Participants and visit data created');
    console.log('🎉 Seeding complete!');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
