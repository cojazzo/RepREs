import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/authOptions';
import { createAuditLog } from '@/lib/audit';

function canAccessWizard(role: string): boolean {
    return role === 'DATA_ENTRY' || role === 'ADMIN';
}

// PUT — Save Step 3 adherence + adverse events
export async function PUT(
    req: NextRequest,
    { params }: { params: { visitId: string } }
) {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!canAccessWizard(session.user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const visit = await prisma.visit.findUnique({ where: { id: params.visitId } });
    if (!visit) return NextResponse.json({ error: 'Visit not found' }, { status: 404 });

    const { adherence, adverseEvents } = await req.json();

    // Save adherence
    if (adherence) {
        await prisma.visitAdherence.upsert({
            where: { visitId: params.visitId },
            update: adherence,
            create: { visitId: params.visitId, ...adherence },
        });
    }

    // Save adverse events
    if (adverseEvents) {
        await prisma.visitAe.upsert({
            where: { visitId: params.visitId },
            update: adverseEvents,
            create: { visitId: params.visitId, ...adverseEvents },
        });
    }

    await createAuditLog({
        userId: session.user.id,
        action: 'SAVE_AE_ADHERENCE',
        entity: 'VisitAe',
        entityId: params.visitId,
        newValue: JSON.stringify({ hasAdherence: !!adherence, hasAE: !!adverseEvents }),
    });

    return NextResponse.json({ success: true });
}
