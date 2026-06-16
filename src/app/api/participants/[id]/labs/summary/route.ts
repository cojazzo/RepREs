import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/authOptions';

export async function GET(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const participantId = params.id;

    // Single optimized query: participant + visits + CRF lab results + analyte catalog
    const [participant, visits, analytes] = await Promise.all([
        prisma.participant.findUnique({
            where: { id: participantId },
            select: { id: true, studyId: true, firstName: true, lastName: true, sex: true, birthDate: true },
        }),
        prisma.visit.findMany({
            where: { 
                participantId, 
                status: { in: ['DRAFT', 'SUBMITTED'] } 
            },
            select: { id: true, visitType: true, visitDate: true },
            orderBy: { visitDate: 'asc' },
        }),
        prisma.crfLabAnalyte.findMany({
            orderBy: { sortOrder: 'asc' },
        }),
    ]);

    if (!participant) return NextResponse.json({ error: 'Participant not found' }, { status: 404 });

    const visitIds = visits.map(v => v.id);

    // Fetch all CRF lab results for these visits in one query
    const labResults = visitIds.length > 0
        ? await prisma.crfLabResult.findMany({
            where: { visitId: { in: visitIds } },
            select: { visitId: true, analyteCode: true, value: true, unit: true },
        })
        : [];

    // Build results map: analyteCode -> [{ visitId, value, unit }]
    const results: Record<string, { visitId: string; value: string | null; unit: string | null }[]> = {};
    for (const lr of labResults) {
        if (!results[lr.analyteCode]) results[lr.analyteCode] = [];
        results[lr.analyteCode].push({
            visitId: lr.visitId,
            value: lr.value,
            unit: lr.unit,
        });
    }

    // Compute eGFR and ACR series on the fly
    const age = participant.birthDate
        ? Math.floor((Date.now() - new Date(participant.birthDate).getTime()) / (1000 * 60 * 60 * 24 * 365.25))
        : null;
    const sex = participant.sex; // "Male" or "Female"

    const computed: {
        eGFR: { visitId: string; value: number }[];
        ACR: { visitId: string; value: number }[];
    } = { eGFR: [], ACR: [] };

    for (const visit of visits) {
        // eGFR from serum creatinine
        const creS = labResults.find(r => r.visitId === visit.id && r.analyteCode === 'CRE_S');
        if (creS?.value && age && sex) {
            const scr = parseFloat(creS.value);
            if (!isNaN(scr) && scr > 0) {
                const kappa = sex === 'Female' ? 0.7 : 0.9;
                const alpha = sex === 'Female' ? -0.241 : -0.302;
                let eGFR = 142 * Math.pow(Math.min(scr / kappa, 1), alpha) * Math.pow(Math.max(scr / kappa, 1), -1.200) * Math.pow(0.9938, age);
                if (sex === 'Female') eGFR *= 1.012;
                computed.eGFR.push({ visitId: visit.id, value: Math.round(eGFR * 10) / 10 });
            }
        }

        // ACR from urine albumin + urine creatinine
        const albU = labResults.find(r => r.visitId === visit.id && r.analyteCode === 'ALB_U');
        const malb = labResults.find(r => r.visitId === visit.id && r.analyteCode === 'MALB');
        const creU = labResults.find(r => r.visitId === visit.id && r.analyteCode === 'CRE_U');
        if (creU?.value) {
            const creUVal = parseFloat(creU.value);
            if (creUVal > 0) {
                // ALB_U is in mg/dL, MALB is in mg/L
                const albVal = albU?.value ? parseFloat(albU.value) * 10 : (malb?.value ? parseFloat(malb.value) : NaN);
                if (!isNaN(albVal)) {
                    const acr = (albVal / (creUVal * 10)) * 1000;
                    computed.ACR.push({ visitId: visit.id, value: Math.round(acr * 10) / 10 });
                }
            }
        }

        // Also check if ACR was stored directly
        if (computed.ACR.findIndex(a => a.visitId === visit.id) === -1) {
            const acrStored = labResults.find(r => r.visitId === visit.id && r.analyteCode === 'ACR');
            if (acrStored?.value) {
                const v = parseFloat(acrStored.value);
                if (!isNaN(v)) computed.ACR.push({ visitId: visit.id, value: v });
            }
        }
    }

    return NextResponse.json({
        participant: {
            id: participant.id,
            studyId: participant.studyId,
            firstName: participant.firstName,
            lastName: participant.lastName,
            sex: participant.sex,
            birthDate: participant.birthDate,
        },
        visits: visits.map(v => ({ visitId: v.id, visitType: v.visitType, visitDate: v.visitDate })),
        analytes: analytes.map(a => ({
            code: a.code,
            name: a.name,
            category: a.category,
            type: a.type,
            unit: a.unit,
            coding: a.coding,
        })),
        results,
        computed,
    });
}
