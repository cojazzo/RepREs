import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/authOptions';
import { canEdit } from '@/lib/auth';
import { createAuditLog } from '@/lib/audit';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!canEdit(session.user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const body = await request.json();
    const { newDate, notes } = body;

    if (!newDate) {
      return NextResponse.json({ error: 'Missing newDate' }, { status: 400 });
    }

    const currentAppointment = await prisma.appointment.findUnique({
      where: { id: params.id },
    });

    if (!currentAppointment) {
      return NextResponse.json({ error: 'Appointment not found' }, { status: 404 });
    }

    const result = await prisma.$transaction(async (tx) => {
      // Create new appointment
      const newAppointment = await tx.appointment.create({
        data: {
          participantId: currentAppointment.participantId,
          visitId: currentAppointment.visitId,
          scheduledDate: new Date(newDate),
          status: 'SCHEDULED',
          notes: notes || currentAppointment.notes,
          rescheduledFromId: currentAppointment.id,
        },
      });

      // Update old appointment
      await tx.appointment.update({
        where: { id: currentAppointment.id },
        data: {
          status: 'RESCHEDULED',
          visitId: null, // Move visit to the new appointment
        },
      });

      return newAppointment;
    });

    await createAuditLog({
      action: 'UPDATE',
      entity: 'Appointment',
      entityId: params.id,
      newValue: `Rescheduled appointment to ${newDate}`,
      userId: session.user.id,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error('Error rescheduling appointment:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
