import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/authOptions';
import { createAuditLog } from '@/lib/audit';

function canAccessWizard(role: string): boolean {
    return role === 'DATA_ENTRY' || role === 'ADMIN';
}

// PUT — Save Step 2 lab results
export async function PUT(
    req: NextRequest,
    { params }: { params: { visitId: string } }
) {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!canAccessWizard(session.user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const visit = await prisma.visit.findUnique({ where: { id: params.visitId } });
    if (!visit) return NextResponse.json({ error: 'Visit not found' }, { status: 404 });

    const { results } = await req.json(); // Array of { analyteCode, value, unit }

    if (!Array.isArray(results)) {
        return NextResponse.json({ error: 'results must be an array' }, { status: 400 });
    }

    // Upsert each result
    for (const r of results) {
        if (!r.analyteCode || r.value === undefined || r.value === null || r.value === '') continue;
        await prisma.crfLabResult.upsert({
            where: { visitId_analyteCode: { visitId: params.visitId, analyteCode: r.analyteCode } },
            update: { value: String(r.value), unit: r.unit || null },
            create: { visitId: params.visitId, analyteCode: r.analyteCode, value: String(r.value), unit: r.unit || null },
        });
    }

    await createAuditLog({
        userId: session.user.id,
        action: 'SAVE_LAB_RESULTS',
        entity: 'CrfLabResult',
        entityId: params.visitId,
        newValue: JSON.stringify({ count: results.length }),
    });

    return NextResponse.json({ success: true });
}
