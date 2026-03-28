import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/authOptions';

function canAccessWizard(role: string): boolean {
    return role === 'DATA_ENTRY' || role === 'ADMIN';
}

// GET — Load a full draft visit with all related data
export async function GET(
    req: NextRequest,
    { params }: { params: { visitId: string } }
) {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!canAccessWizard(session.user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const visit = await prisma.visit.findUnique({
        where: { id: params.visitId },
        include: {
            participant: { select: { id: true, studyId: true, firstName: true, lastName: true, sex: true, birthDate: true } },
            visitClinical: true,
            crfLabResults: true,
            visitAdherence: true,
            visitAe: true,
        },
    });

    if (!visit) return NextResponse.json({ error: 'Visit not found' }, { status: 404 });

    return NextResponse.json(visit);
}
