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
    const appointment = await prisma.appointment.findUnique({
      where: { id: params.id },
      include: {
        participant: true,
        visit: true,
        contactAttempts: {
          orderBy: { attemptDate: 'desc' }
        },
        rescheduledFrom: true,
        rescheduledTo: true,
      },
    });

    if (!appointment) {
      return NextResponse.json({ error: 'Appointment not found' }, { status: 404 });
    }

    return NextResponse.json(appointment);
  } catch (error) {
    console.error('Error fetching appointment:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!canEdit(session.user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const body = await request.json();
    const { status, completedAt, cancelReason, scheduledDate, notes } = body;

    const updateData: any = {};
    if (status) updateData.status = status;
    if (completedAt) updateData.completedAt = new Date(completedAt);
    if (cancelReason !== undefined) updateData.cancelReason = cancelReason;
    if (scheduledDate) updateData.scheduledDate = new Date(scheduledDate);
    if (notes !== undefined) updateData.notes = notes;

    if (status === 'CANCELLED') {
        updateData.cancelledAt = new Date();
    } else if (status === 'COMPLETED' && !completedAt) {
        updateData.completedAt = new Date();
    }

    const appointment = await prisma.appointment.update({
      where: { id: params.id },
      data: updateData,
      include: { visit: true }
    });

    // Sync with Visit if it's completed
    if (status === 'COMPLETED' && appointment.visitId) {
        await prisma.visit.update({
            where: { id: appointment.visitId },
            data: { 
                completed: true, 
                visitDate: updateData.completedAt || new Date()
            }
        });
    }

    await createAuditLog({
      action: 'UPDATE',
      entity: 'Appointment',
      entityId: appointment.id,
      newValue: `Updated appointment status/details`,
      userId: session.user.id,
    });

    return NextResponse.json(appointment);
  } catch (error) {
    console.error('Error updating appointment:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const appointment = await prisma.appointment.delete({
      where: { id: params.id },
    });

    await createAuditLog({
      action: 'DELETE',
      entity: 'Appointment',
      entityId: appointment.id,
      newValue: `Deleted appointment ${appointment.id}`,
      userId: session.user.id,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting appointment:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
