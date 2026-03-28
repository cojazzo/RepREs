import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/authOptions';
import { canEdit } from '@/lib/auth';
import { createAuditLog } from '@/lib/audit';
import { calculateBMI } from '@/lib/calculations';

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!canEdit(session.user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json();
    const { visitId, vitals, clinicalAssessment, adherence, concomitantMeds, completed } = body;

    const visit = await prisma.visit.findUnique({ where: { id: visitId } });
    if (!visit) return NextResponse.json({ error: 'Visit not found' }, { status: 404 });

    // Update visit
    await prisma.visit.update({
        where: { id: visitId },
        data: {
            visitDate: new Date(),
            completed: completed ?? true,
        },
    });

    // Vitals
    if (vitals) {
        const bmi = vitals.weightKg && vitals.heightCm ? calculateBMI(vitals.weightKg, vitals.heightCm) : null;
        await prisma.vitals.upsert({
            where: { visitId },
            update: { ...vitals, bmi },
            create: { visitId, ...vitals, bmi },
        });
    }

    // Clinical Assessment
    if (clinicalAssessment) {
        await prisma.clinicalAssessment.upsert({
            where: { visitId },
            update: clinicalAssessment,
            create: { visitId, ...clinicalAssessment },
        });
    }

    // Adherence
    if (adherence) {
        await prisma.adherence.upsert({
            where: { visitId },
            update: adherence,
            create: { visitId, ...adherence },
        });
    }

    // Concomitant Medications
    if (concomitantMeds && Array.isArray(concomitantMeds)) {
        await prisma.concomitantMed.deleteMany({ where: { visitId } });
        for (const med of concomitantMeds) {
            await prisma.concomitantMed.create({
                data: { visitId, ...med },
            });
        }
    }

    await createAuditLog({
        userId: session.user.id,
        action: 'UPDATE_VISIT',
        entity: 'Visit',
        entityId: visitId,
        newValue: JSON.stringify({ completed: true }),
    });

    return NextResponse.json({ success: true });
}
