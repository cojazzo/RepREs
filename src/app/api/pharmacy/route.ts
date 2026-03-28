import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/authOptions';
import { canViewPharmacy } from '@/lib/auth';
import { createAuditLog } from '@/lib/audit';

export async function GET(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!canViewPharmacy(session.user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const dispensations = await prisma.dispensation.findMany({
        include: {
            participant: {
                include: {
                    randomization: { select: { treatment: true, armLabel: true } },
                },
            },
        },
        orderBy: { dispensedDate: 'desc' },
    });

    return NextResponse.json(dispensations);
}

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!canViewPharmacy(session.user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json();

    const dispensation = await prisma.dispensation.create({
        data: {
            participantId: body.participantId,
            visitType: body.visitType,
            lotNumber: body.lotNumber,
            tabletsDispensed: body.tabletsDispensed,
            tabletsReturned: body.tabletsReturned ?? null,
            adherenceByPillCount: body.adherenceByPillCount ?? null,
            notes: body.notes ?? null,
        },
    });

    await createAuditLog({
        userId: session.user.id,
        action: 'DISPENSE',
        entity: 'Dispensation',
        entityId: dispensation.id,
        newValue: JSON.stringify({ lotNumber: dispensation.lotNumber, tabletsDispensed: dispensation.tabletsDispensed }),
    });

    return NextResponse.json(dispensation, { status: 201 });
}
