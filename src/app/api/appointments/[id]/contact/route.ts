import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/authOptions';
import { canEdit } from '@/lib/auth';
import { createAuditLog } from '@/lib/audit';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const contacts = await prisma.contactAttempt.findMany({
      where: { appointmentId: params.id },
      orderBy: { attemptDate: 'desc' },
    });

    return NextResponse.json(contacts);
  } catch (error) {
    console.error('Error fetching contact attempts:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!canEdit(session.user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const body = await request.json();
    const { method, result, notes } = body;

    if (!method || !result) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const contact = await prisma.contactAttempt.create({
      data: {
        appointmentId: params.id,
        method,
        result,
        notes: notes || null,
        contactedBy: session.user.id,
      },
    });

    await createAuditLog({
      action: 'CREATE',
      entity: 'ContactAttempt',
      entityId: contact.id,
      newValue: `Created contact attempt for appointment ${params.id}`,
      userId: session.user.id,
    });

    return NextResponse.json(contact, { status: 201 });
  } catch (error) {
    console.error('Error creating contact attempt:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
