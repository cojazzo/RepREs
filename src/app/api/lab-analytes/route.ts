import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/authOptions';
import { createAuditLog } from '@/lib/audit';

export async function GET() {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const analytes = await prisma.crfLabAnalyte.findMany({
        orderBy: { sortOrder: 'asc' },
    });

    return NextResponse.json(analytes);
}
