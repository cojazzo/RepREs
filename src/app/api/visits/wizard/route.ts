import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/authOptions';
import { createAuditLog } from '@/lib/audit';

function canAccessWizard(role: string): boolean {
    return role === 'DATA_ENTRY' || role === 'ADMIN';
}

// POST — Create a draft visit
export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!canAccessWizard(session.user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { participantId, visitType } = await req.json();

    if (!participantId || !visitType) {
        return NextResponse.json({ error: 'participantId and visitType are required' }, { status: 400 });
    }

    // Check if visit already exists for this participant+type
    const existing = await prisma.visit.findUnique({
        where: { participantId_visitType: { participantId, visitType } },
    });

    if (existing) {
        return NextResponse.json({ visitId: existing.id, existing: true });
    }

    const visit = await prisma.visit.create({
        data: {
            participantId,
            visitType,
            status: 'DRAFT',
        },
    });

    await createAuditLog({
        userId: session.user.id,
        action: 'CREATE_DRAFT_VISIT',
        entity: 'Visit',
        entityId: visit.id,
        newValue: JSON.stringify({ participantId, visitType }),
    });

    return NextResponse.json({ visitId: visit.id, existing: false });
}
