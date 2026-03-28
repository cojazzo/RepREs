import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/authOptions';
import { canViewPharmacy } from '@/lib/auth';
import { createAuditLog } from '@/lib/audit';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!canViewPharmacy(session.user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json();
    const data: Record<string, any> = {};

    if (body.tabletsReturned != null) data.tabletsReturned = body.tabletsReturned;
    if (body.notes !== undefined) data.notes = body.notes;

    // Auto-calculate adherence if we have returned count
    if (data.tabletsReturned != null) {
        const disp = await prisma.dispensation.findUnique({ where: { id: params.id } });
        if (disp && disp.tabletsDispensed > 0) {
            data.adherenceByPillCount = parseFloat(
                (((disp.tabletsDispensed - data.tabletsReturned) / disp.tabletsDispensed) * 100).toFixed(1)
            );
        }
    }

    const updated = await prisma.dispensation.update({
        where: { id: params.id },
        data,
    });

    await createAuditLog({
        userId: session.user.id,
        action: 'UPDATE',
        entity: 'Dispensation',
        entityId: params.id,
        newValue: JSON.stringify(data),
    });

    return NextResponse.json(updated);
}
