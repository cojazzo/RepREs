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

    
    console.log('🎉 Seeding complete!');
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(async () => { await prisma.$disconnect(); });