import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/authOptions';
import { canCreateQueries, canRespondQueries } from '@/lib/auth';
import { createAuditLog } from '@/lib/audit';

export async function GET(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');

    const where: any = {};
    if (status) where.status = status;

    const queries = await prisma.dataQuery.findMany({
        where,
        include: {
            creator: { select: { name: true, role: true } },
            responder: { select: { name: true, role: true } },
        },
        orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(queries);
}

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!canCreateQueries(session.user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json();

    const query = await prisma.dataQuery.create({
        data: {
            creatorId: session.user.id,
            entity: body.entity,
            entityId: body.entityId,
            field: body.field,
            queryText: body.queryText,
            priority: body.priority || 'NORMAL',
        },
    });

    await createAuditLog({
        userId: session.user.id,
        action: 'CREATE',
        entity: 'DataQuery',
        entityId: query.id,
        newValue: JSON.stringify({ queryText: query.queryText }),
    });

    return NextResponse.json(query, { status: 201 });
}

export async function PATCH(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { id, responseText, status } = body;

    if (status === 'RESPONDED' && !canRespondQueries(session.user.role)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (status === 'RESOLVED' && !canCreateQueries(session.user.role)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const query = await prisma.dataQuery.update({
        where: { id },
        data: {
            status: status || undefined,
            responseText: responseText || undefined,
            responderId: status === 'RESPONDED' ? session.user.id : undefined,
            resolvedAt: status === 'RESOLVED' ? new Date() : undefined,
        },
    });

    await createAuditLog({
        userId: session.user.id,
        action: 'UPDATE',
        entity: 'DataQuery',
        entityId: id,
        newValue: JSON.stringify({ status: query.status }),
    });

    return NextResponse.json(query);
}
