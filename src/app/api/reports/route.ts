import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/authOptions';
import { canViewTreatment } from '@/lib/auth';

export async function GET(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type'); // 'participants' | 'visits' | 'labs' | 'adverse-events'
    const showTreatment = canViewTreatment(session.user.role);

    if (type === 'participants') {
        const rawData = await prisma.participant.findMany({
            select: {
                studyId: true,
                firstName: true,
                lastName: true,
                sex: true,
                birthDate: true,
                curp: true,
                chmhId: true,
                status: true,
                phone: true,
                ...(showTreatment ? { randomization: { select: { armLabel: true } } } : {})
            },
            orderBy: { studyId: 'asc' },
        });

        const data = rawData.map((p: any) => ({
            studyId: p.studyId,
            firstName: p.firstName,
            lastName: p.lastName,
            sex: p.sex,
            birthDate: p.birthDate ? p.birthDate.toISOString().split('T')[0] : '',
            curp: p.curp || '',
            chmhId: p.chmhId || '',
            status: p.status,
            ... (showTreatment ? { randomization: p.randomization?.armLabel || 'Not Randomized' } : {}),
            phone: p.phone || ''
        }));

        return NextResponse.json(data);
    }

    if (type === 'visits') {
        const rawData = await prisma.visit.findMany({
            where: { completed: true },
            include: {
                participant: { select: { studyId: true, curp: true, chmhId: true } },
                vitals: true,
                adherence: true,
            },
            orderBy: { visitDate: 'asc' },
        });

        const data = rawData.map((v: any) => ({
            visitType: v.visitType,
            visitDate: v.visitDate ? v.visitDate.toISOString().split('T')[0] : '',
            notes: v.notes || '',
            participant_studyId: v.participant.studyId,
            participant_curp: v.participant.curp || '',
            participant_chmhId: v.participant.chmhId || '',
            vitals_weightKg: v.vitals?.weightKg ?? '',
            vitals_heightCm: v.vitals?.heightCm ?? '',
            vitals_bmi: v.vitals?.bmi ?? '',
            vitals_systolicBp: v.vitals?.systolicBp ?? '',
            vitals_diastolicBp: v.vitals?.diastolicBp ?? '',
            vitals_heartRate: v.vitals?.heartRate ?? '',
            adherence_adherencePercent: v.adherence?.adherencePercent ?? '',
            adherence_missedDoses: v.adherence?.missedDoses ?? '',
            adherence_reasonForNonAdherence: v.adherence?.reasonForNonAdherence || ''
        }));

        return NextResponse.json(data);
    }

    if (type === 'labs') {
        const rawData = await prisma.crfLabResult.findMany({
            include: {
                analyte: true,
                visit: {
                    select: { id: true, visitType: true, visitDate: true, participant: { select: { studyId: true, curp: true, chmhId: true } } },
                },
            },
            orderBy: { createdAt: 'asc' },
        });

        const visitsMap = new Map<string, any>();

        rawData.forEach((l: any) => {
            const visitId = l.visit.id;
            if (!visitsMap.has(visitId)) {
                visitsMap.set(visitId, {
                    participant_studyId: l.visit.participant.studyId,
                    participant_curp: l.visit.participant.curp || '',
                    participant_chmhId: l.visit.participant.chmhId || '',
                    visitType: l.visit.visitType,
                    visitDate: l.visit.visitDate ? l.visit.visitDate.toISOString().split('T')[0] : '',
                });
            }

            const visitData = visitsMap.get(visitId);
            const analyteName = l.analyte?.name || l.analyteCode;
            const unitStr = l.analyte?.unit ? ` (${l.analyte.unit})` : '';
            const columnName = `${analyteName}${unitStr}`;

            visitData[columnName] = l.value || '';
        });

        return NextResponse.json(Array.from(visitsMap.values()));
    }

    if (type === 'adverse-events') {
        const rawData = await prisma.adverseEvent.findMany({
            include: { participant: { select: { studyId: true } } },
            orderBy: { startDate: 'asc' },
        });

        const data = rawData.map((ae: any) => {
            const { id, participantId, createdAt, updatedAt, participant, ...rest } = ae;
            return {
                participant_studyId: participant.studyId,
                ...rest
            };
        });

        return NextResponse.json(data);
    }

    return NextResponse.json({ error: 'type parameter required' }, { status: 400 });
}
