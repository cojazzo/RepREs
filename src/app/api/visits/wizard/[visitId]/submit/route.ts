import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/authOptions';
import { createAuditLog } from '@/lib/audit';

function canAccessWizard(role: string): boolean {
    return role === 'DATA_ENTRY' || role === 'ADMIN';
}

// POST — Submit the visit (DRAFT -> SUBMITTED)
export async function POST(
    req: NextRequest,
    { params }: { params: { visitId: string } }
) {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!canAccessWizard(session.user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const visit = await prisma.visit.findUnique({ where: { id: params.visitId } });
    if (!visit) return NextResponse.json({ error: 'Visit not found' }, { status: 404 });

    if (visit.status === 'SUBMITTED') {
        return NextResponse.json({ error: 'Visit already submitted' }, { status: 400 });
    }

    await prisma.visit.update({
        where: { id: params.visitId },
        data: {
            status: 'SUBMITTED',
            completed: true,
            visitDate: new Date(),
        },
    });

    await createAuditLog({
        userId: session.user.id,
        action: 'SUBMIT_VISIT',
        entity: 'Visit',
        entityId: params.visitId,
        newValue: JSON.stringify({ status: 'SUBMITTED' }),
    });

    return NextResponse.json({ success: true });
}
