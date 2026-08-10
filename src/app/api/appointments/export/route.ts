import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/authOptions';
import * as xlsx from 'xlsx';
import { AppointmentStatus, Prisma } from '@prisma/client';

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return new NextResponse('Unauthorized', { status: 401 });

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status') as AppointmentStatus | null;
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  const overdue = searchParams.get('overdue') === 'true';

  const where: Prisma.AppointmentWhereInput = {};

  if (status) {
    where.status = status;
  }

  if (overdue) {
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
        participant: true,
        visit: true,
        contactAttempts: {
          orderBy: { attemptDate: 'desc' },
          take: 1,
        },
        _count: {
          select: { contactAttempts: true }
        }
      },
      orderBy: {
        scheduledDate: 'asc',
      },
    });

    const data = appointments.map((apt) => {
      const lastContact = apt.contactAttempts[0];
      return {
        'Study ID': apt.participant?.studyId || '',
        'Patient Name': `${apt.participant?.firstName || ''} ${apt.participant?.lastName || ''}`.trim(),
        'Visit Type': apt.visit?.visitType || '',
        'Scheduled Date': apt.scheduledDate.toISOString().split('T')[0],
        'Status': apt.status,
        'Contact Attempts': apt._count.contactAttempts,
        'Last Contact Date': lastContact?.attemptDate ? lastContact.attemptDate.toISOString().split('T')[0] : '',
        'Last Contact Result': lastContact ? lastContact.result : '',
        'Notes': apt.notes || '',
      };
    });

    const worksheet = xlsx.utils.json_to_sheet(data);
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, 'Appointments');

    const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    const headers = new Headers();
    headers.set('Content-Disposition', 'attachment; filename="appointments_report.xlsx"');
    headers.set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

    return new NextResponse(buffer, {
      status: 200,
      headers,
    });
  } catch (error) {
    console.error('Error exporting appointments:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
