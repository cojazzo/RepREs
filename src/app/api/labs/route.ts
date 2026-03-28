import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/authOptions';
import { canEdit } from '@/lib/auth';
import { createAuditLog } from '@/lib/audit';
import { calculateEGFR, calculateACR, calculateAge } from '@/lib/calculations';

export async function GET(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const visitId = searchParams.get('visitId');
    const participantId = searchParams.get('participantId');

    if (visitId) {
        const labs = await prisma.labResult.findMany({
            where: { visitId },
            include: { analyte: true },
        });
        return NextResponse.json(labs);
    }

    if (participantId) {
        const labs = await prisma.labResult.findMany({
            where: { visit: { participantId } },
            include: { analyte: true, visit: { select: { visitType: true, visitDate: true } } },
            orderBy: { visit: { visitType: 'asc' } },
        });
        return NextResponse.json(labs);
    }

    return NextResponse.json({ error: 'visitId or participantId required' }, { status: 400 });
}

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!canEdit(session.user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json();
    const { visitId, results } = body; // results: Array<{ analyteId, value }>

    const visit = await prisma.visit.findUnique({
        where: { id: visitId },
        include: { participant: true },
    });
    if (!visit) return NextResponse.json({ error: 'Visit not found' }, { status: 404 });

    const participant = visit.participant;
    const age = calculateAge(participant.birthDate);
    const sex = participant.sex as 'Male' | 'Female';

    // Process results, auto-calculate eGFR and ACR
    const savedResults = [];
    let scrValue: number | null = null;
    let uAlbValue: number | null = null;
    let uCrValue: number | null = null;

    // First pass: find base values
    for (const r of results) {
        const analyte = await prisma.analyteCatalog.findUnique({ where: { id: r.analyteId } });
        if (!analyte) continue;
        if (analyte.code === 'SCR') scrValue = r.value;
        if (analyte.code === 'UALB') uAlbValue = r.value;
        if (analyte.code === 'UCR') uCrValue = r.value;
    }

    // Second pass: save all including computed
    for (const r of results) {
        const analyte = await prisma.analyteCatalog.findUnique({ where: { id: r.analyteId } });
        if (!analyte) continue;

        let value = r.value;

        // Auto-calculate computed values
        if (analyte.code === 'EGFR' && scrValue !== null) {
            value = calculateEGFR(scrValue, age, sex);
        }
        if (analyte.code === 'ACR' && uAlbValue !== null && uCrValue !== null) {
            value = calculateACR(uAlbValue, uCrValue);
        }

        const isAbnormal = analyte.refMin !== null && analyte.refMax !== null
            ? (value < analyte.refMin || value > analyte.refMax)
            : false;

        const result = await prisma.labResult.upsert({
            where: { visitId_analyteId: { visitId, analyteId: r.analyteId } },
            update: { value, isAbnormal, unit: analyte.unit },
            create: {
                visitId,
                analyteId: r.analyteId,
                value,
                unit: analyte.unit,
                referenceMin: analyte.refMin,
                referenceMax: analyte.refMax,
                isAbnormal,
            },
        });
        savedResults.push(result);
    }

    await createAuditLog({
        userId: session.user.id,
        action: 'UPDATE_LABS',
        entity: 'LabResult',
        entityId: visitId,
        newValue: JSON.stringify(savedResults.map(r => ({ id: r.id, value: r.value }))),
    });

    return NextResponse.json(savedResults);
}
