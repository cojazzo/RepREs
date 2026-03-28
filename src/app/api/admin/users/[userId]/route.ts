import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/authOptions';
import { canManageUsers } from '@/lib/auth';
import { createAuditLog } from '@/lib/audit';
import bcrypt from 'bcryptjs';

export async function PATCH(req: NextRequest, { params }: { params: { userId: string } }) {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!canManageUsers(session.user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json();
    const data: Record<string, any> = {};

    // Update active status
    if (typeof body.active === 'boolean') data.active = body.active;

    // Update role
    if (body.role) data.role = body.role;

    // Update name
    if (body.name) data.name = body.name;

    // Update password (hash it)
    if (body.password && body.password.length >= 6) {
        data.passwordHash = await bcrypt.hash(body.password, 12);
    }

    if (Object.keys(data).length === 0) {
        return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    const user = await prisma.user.update({
        where: { id: params.userId },
        data,
        select: { id: true, email: true, name: true, role: true, active: true },
    });

    // Audit the change
    await createAuditLog({
        userId: session.user.id,
        action: 'UPDATE',
        entity: 'User',
        entityId: params.userId,
        newValue: JSON.stringify({ ...body, password: body.password ? '[REDACTED]' : undefined }),
    });

    return NextResponse.json(user);
}
