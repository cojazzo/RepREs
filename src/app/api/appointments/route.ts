import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/authOptions';
import { canEdit } from '@/lib/auth';
import { createAuditLog } from '@/lib/audit';
import { AppointmentStatus, Prisma } from '@prisma/client';

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status') as AppointmentStatus | null;
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  const participantId = searchParams.get('participantId');
  const today = searchParams.get('today') === 'true';
  const overdue = searchParams.get('overdue') === 'true';

  const where: Prisma.AppointmentWhereInput = {};

  if (status) {
    where.status = status;
  }

  if (participantId) {
    where.participantId = participantId;
  }

  if (today) {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);
    
    where.scheduledDate = {
      gte: startOfDay,
      lte: endOfDay,
    };
  } else if (overdue) {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    
    where.status = 'SCHEDULED';
    where.scheduledDate = {
      lt: startOfDay,
    };
  } else if (from || to) {
    where.scheduledDate = {};
    if (from) where.scheduledDate.gte = new Date(from);
    if (to) {
        const toDate = new Date(to);
        toDate.setHours(23, 59, 59, 999);
        where.scheduledDate.lte = toDate;
    }
  }

  try {
    const appointments = await prisma.appointment.findMany({
      where,
      include: {
        participant: {
          select: {
            studyId: true,
            firstName: true,
            lastName: true,
            phone: true,
            status: true,
          }
        },
        visit: {
          select: {
            visitType: true,
          }
        },
        _count: {
          select: {
            contactAttempts: true
          }
        }
      },
      orderBy: {
        scheduledDate: 'asc',
      },
    });

    return NextResponse.json(appointments);
  } catch (error) {
    console.error('Error fetching appointments:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!canEdit(session.user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const body = await request.json();
    const { participantId, visitId, visitType, scheduledDate, status, notes } = body;

    if (!participantId || !scheduledDate) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    let resolvedVisitId = visitId;

    // If visitType is provided, find the existing Visit record
    if (visitType && !resolvedVisitId) {
      const existingVisit = await prisma.visit.findUnique({
        where: { participantId_visitType: { participantId, visitType } },
        include: { appointment: true }
      });

      if (existingVisit) {
        resolvedVisitId = existingVisit.id;

        // Check for conflicts
        if (existingVisit.appointment) {
          if (existingVisit.appointment.status === 'SCHEDULED' || existingVisit.appointment.status === 'COMPLETED') {
             return NextResponse.json({ 
               error: `There is already an active appointment for ${visitType}. Please reschedule or edit the existing one.` 
             }, { status: 409 });
          } else {
            // It's MISSED, CANCELLED, etc. We "steal" the visitId by unlinking it from the old appointment.
            await prisma.appointment.update({
              where: { id: existingVisit.appointment.id },
              data: { visitId: null }
            });
          }
        }
      } else {
        // Fallback: create the Visit if it somehow doesn't exist
        const newVisit = await prisma.visit.create({
          data: {
            participantId,
            visitType,
            completed: false
          }
        });
        resolvedVisitId = newVisit.id;
      }
    }

    const appointmentStatus = status === 'COMPLETED' ? 'COMPLETED' : 'SCHEDULED';

    // Transaction for atomic appointment creation & visit sync if completed
    const appointment = await prisma.$transaction(async (tx) => {
      const newApp = await tx.appointment.create({
        data: {
          participantId,
          visitId: resolvedVisitId || null,
          scheduledDate: new Date(scheduledDate),
          notes: notes || null,
          status: appointmentStatus,
        },
      });

      if (appointmentStatus === 'COMPLETED' && resolvedVisitId) {
        await tx.visit.update({
          where: { id: resolvedVisitId },
          data: {
            completed: true,
            visitDate: new Date(scheduledDate)
          }
        });
      }

      return newApp;
    });

    await createAuditLog({
      action: 'CREATE',
      entity: 'Appointment',
      entityId: appointment.id,
      newValue: `Created appointment for participant ${participantId} (${appointmentStatus})`,
      userId: session.user.id,
    });

    return NextResponse.json(appointment, { status: 201 });
  } catch (error) {
    console.error('Error creating appointment:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
