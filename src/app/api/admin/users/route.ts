import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/authOptions';
import { canManageUsers } from '@/lib/auth';
import bcrypt from 'bcryptjs';

export async function GET() {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!canManageUsers(session.user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const users = await prisma.user.findMany({
        select: { id: true, email: true, name: true, role: true, active: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(users);
}

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!canManageUsers(session.user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json();
    const passwordHash = await bcrypt.hash(body.password, 12);

    const user = await prisma.user.create({
        data: {
            email: body.email,
            name: body.name,
            passwordHash,
            role: body.role,
        },
        select: { id: true, email: true, name: true, role: true, active: true },
    });

    return NextResponse.json(user, { status: 201 });
}
