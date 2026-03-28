import { PrismaClient } from '@prisma/client';
import * as xlsx from 'xlsx';
import * as path from 'path';

const prisma = new PrismaClient();

// Category assignments by analyte code
const CATEGORY_MAP: Record<string, string> = {
    // CBC
    WBC: 'CBC', NEU_ABS: 'CBC', LINF_ABS: 'CBC', MONO_ABS: 'CBC', EOS_ABS: 'CBC', BASO_ABS: 'CBC',
    NEU_PCT: 'CBC', LINF_PCT: 'CBC', MONO_PCT: 'CBC', EOS_PCT: 'CBC', BASO_PCT: 'CBC',
    RBC: 'CBC', HGB: 'CBC', HTO: 'CBC', VCM: 'CBC', HCM: 'CBC', CMHC: 'CBC', RDW: 'CBC',
    PLT: 'CBC', VPM: 'CBC',
    // Chemistry
    GLUC: 'Chemistry', BUN: 'Chemistry', UREA: 'Chemistry', CRE_S: 'Chemistry',
    AC_UR: 'Chemistry', ALB_S: 'Chemistry',
    // Lipids
    COL_T: 'Lipids', TG: 'Lipids', HDL: 'Lipids', LDL: 'Lipids', IA: 'Lipids',
    // Complements
    C3: 'Complements', C4: 'Complements',
    // Electrolytes
    NA_S: 'Electrolytes', K_S: 'Electrolytes', CL_S: 'Electrolytes',
    P: 'Electrolytes', MG: 'Electrolytes', CA: 'Electrolytes',
    // Special Chemistry
    CISTC: 'Special Chemistry',
    // Urinalysis
    GE: 'Urinalysis', PH_U: 'Urinalysis', PROT_TIRA: 'Urinalysis',
    GLU_U: 'Urinalysis', HEM_U: 'Urinalysis', NIT_U: 'Urinalysis',
    LEU_U: 'Urinalysis', BACT_U: 'Urinalysis',
    // Urine Electrolytes
    NA_U: 'Urine Electrolytes', K_U: 'Urine Electrolytes', CL_U: 'Urine Electrolytes',
    // Albumin/Creatinine
    CRE_U: 'Albumin/Creatinine', MALB: 'Albumin/Creatinine',
    ALB_U: 'Albumin/Creatinine', ACR: 'Albumin/Creatinine',
    // Endocrine/Vit D
    INS: 'Endocrine/Vit D', VITD: 'Endocrine/Vit D',
};

const SKIP_CODES = new Set(['ID', 'EDAD', 'SEXO']);

async function main() {
    console.log('🧪 Seeding CRF lab analytes...');

    // Try to read from Downloads first, then fallback to local copy
    const possiblePaths = [
        path.join(process.env.USERPROFILE || '', 'Downloads', 'CRF_Laboratorios_Basal.xlsx'),
        path.join(__dirname, 'CRF_Laboratorios_Basal.xlsx'),
    ];

    let wb: xlsx.WorkBook | null = null;
    let usedPath = '';
    for (const p of possiblePaths) {
        try {
            wb = xlsx.readFile(p);
            usedPath = p;
            break;
        } catch { /* try next */ }
    }

    if (!wb) {
        console.error('❌ Could not find CRF_Laboratorios_Basal.xlsx');
        process.exit(1);
    }

    console.log(`📂 Reading from: ${usedPath}`);
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = xlsx.utils.sheet_to_json<string[]>(ws, { header: 1 });

    // Skip header row
    let sortOrder = 0;
    for (let i = 1; i < rows.length; i++) {
        const [name, code, type, unit, coding] = rows[i];
        if (!code || SKIP_CODES.has(code)) continue;

        sortOrder++;
        const category = CATEGORY_MAP[code] || 'Other';

        await prisma.crfLabAnalyte.upsert({
            where: { code },
            update: { name, type, unit: unit || null, coding: coding || null, category, sortOrder },
            create: { code, name, type, unit: unit || null, coding: coding || null, category, sortOrder },
        });

        console.log(`  ✅ ${code} — ${name} [${category}]`);
    }

    console.log(`\n🎉 Seeded ${sortOrder} lab analytes!`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
