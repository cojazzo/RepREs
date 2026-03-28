import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/authOptions';
import { createAuditLog } from '@/lib/audit';
import { calculateBMI } from '@/lib/calculations';

function canAccessWizard(role: string): boolean {
    return role === 'DATA_ENTRY' || role === 'ADMIN';
}

// PUT — Save Step 1 clinical data
export async function PUT(
    req: NextRequest,
    { params }: { params: { visitId: string } }
) {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!canAccessWizard(session.user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const visit = await prisma.visit.findUnique({ where: { id: params.visitId } });
    if (!visit) return NextResponse.json({ error: 'Visit not found' }, { status: 404 });

    const body = await req.json();
    const { bpSys, bpDia, weightKg, heightCm, waistCm, hrBpm, godet, notes } = body;

    const bmi = weightKg && heightCm ? calculateBMI(weightKg, heightCm) : null;

    await prisma.visitClinical.upsert({
        where: { visitId: params.visitId },
        update: { bpSys, bpDia, weightKg, heightCm, bmi, waistCm, hrBpm, godet, notes },
        create: { visitId: params.visitId, bpSys, bpDia, weightKg, heightCm, bmi, waistCm, hrBpm, godet, notes },
    });

    await createAuditLog({
        userId: session.user.id,
        action: 'SAVE_CLINICAL_DATA',
        entity: 'VisitClinical',
        entityId: params.visitId,
        newValue: JSON.stringify(body),
    });

    return NextResponse.json({ success: true });
}
