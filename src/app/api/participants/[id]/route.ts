import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/authOptions';
import { canViewTreatment, canEdit } from '@/lib/auth';
import { createAuditLog } from '@/lib/audit';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const showTreatment = canViewTreatment(session.user.role);

    const participant = await prisma.participant.findUnique({
        where: { id: params.id },
        include: {
            screening: true,
            ...(showTreatment ? { randomization: true } : {}),
            visits: {
                include: {
                    vitals: true,
                    clinicalAssessment: true,
                    adherence: true,
                    labResults: { include: { analyte: true } },
                    concomitantMeds: true,
                    visitClinical: true,
                    crfLabResults: { include: { analyte: true } },
                    visitAdherence: true,
                    visitAe: true,
                },
                orderBy: { visitType: 'asc' },
            },
            adverseEvents: { orderBy: { startDate: 'desc' } },
            dispensations: { orderBy: { dispensedDate: 'desc' } },
        },
    });

    if (!participant) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    return NextResponse.json(participant);
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!canEdit(session.user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json();

    const participant = await prisma.participant.update({
        where: { id: params.id },
        data: body,
    });

    await createAuditLog({
        userId: session.user.id,
        action: 'UPDATE',
        entity: 'Participant',
        entityId: params.id,
        newValue: JSON.stringify(body),
    });

    return NextResponse.json(participant);
}
