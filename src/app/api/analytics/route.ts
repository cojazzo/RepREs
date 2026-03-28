import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/authOptions';
import { canViewTreatment } from '@/lib/auth';

export async function GET() {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const showTreatment = canViewTreatment(session.user.role);

    const [
        totalParticipants,
        activeParticipants,
        completedParticipants,
        withdrawnParticipants,
        lostParticipants,
        screeningParticipants,
        armACounts,
        armBCounts,
        totalAEs,
        totalSAEs,
        totalVisits,
        completedVisits,
        recentAEs,
        visitsByType,
    ] = await Promise.all([
        prisma.participant.count(),
        prisma.participant.count({ where: { status: 'ACTIVE' } }),
        prisma.participant.count({ where: { status: 'COMPLETED' } }),
        prisma.participant.count({ where: { status: 'WITHDRAWN' } }),
        prisma.participant.count({ where: { status: 'LOST_TO_FOLLOWUP' } }),
        prisma.participant.count({ where: { status: 'SCREENING' } }),
        prisma.randomization.count({ where: { armLabel: 'A' } }),
        prisma.randomization.count({ where: { armLabel: 'B' } }),
        prisma.adverseEvent.count(),
        prisma.adverseEvent.count({ where: { isSAE: true } }),
        prisma.visit.count(),
        prisma.visit.count({ where: { completed: true } }),
        prisma.adverseEvent.findMany({
            take: 5,
            orderBy: { createdAt: 'desc' },
            include: { participant: { select: { studyId: true } } },
        }),
        prisma.visit.groupBy({
            by: ['visitType'],
            _count: { _all: true },
            where: { completed: true },
        }),
    ]);

    // Missing data: visits that exist but are not completed
    const missingVisits = totalVisits - completedVisits;

    // Visit completion by type
    const visitCompletionByType = await Promise.all(
        ['BASELINE', 'MONTH_2', 'MONTH_4', 'MONTH_6'].map(async (vt) => {
            const total = await prisma.visit.count({ where: { visitType: vt as any } });
            const completed = await prisma.visit.count({ where: { visitType: vt as any, completed: true } });
            return { visitType: vt, total, completed, rate: total > 0 ? Math.round((completed / total) * 100) : 0 };
        })
    );

    // AE severity breakdown
    const aeSeverity = await prisma.adverseEvent.groupBy({
        by: ['severity'],
        _count: { _all: true },
    });

    // Group A vs B trends (blinded labels only)
    const armAParticipants = await prisma.randomization.findMany({
        where: { armLabel: 'A' },
        select: { participantId: true },
    });
    const armBParticipants = await prisma.randomization.findMany({
        where: { armLabel: 'B' },
        select: { participantId: true },
    });

    const armAIds = armAParticipants.map((r: any) => r.participantId);
    const armBIds = armBParticipants.map((r: any) => r.participantId);

    const armAAEs = await prisma.adverseEvent.count({ where: { participantId: { in: armAIds } } });
    const armBAEs = await prisma.adverseEvent.count({ where: { participantId: { in: armBIds } } });

    // --- Lab Trends (ACR and eGFR) ---
    const labResults = await prisma.crfLabResult.findMany({
        where: { analyteCode: { in: ['ACR', 'EGFR', 'EGFR_CALC'] } },
        include: { visit: { select: { visitType: true, participantId: true } } }
    });

    const armAIdsSet = new Set(armAIds);
    const armBIdsSet = new Set(armBIds);
    const visitsOrder = ['BASELINE', 'MONTH_2', 'MONTH_4', 'MONTH_6'];
    const trends: Record<string, any> = { ACR: [], EGFR: [] };

    ['ACR', 'EGFR'].forEach(baseCode => {
        const visitData = visitsOrder.map(vt => ({ name: vt, armA: [] as number[], armB: [] as number[] }));

        labResults.filter((r: any) => (r.analyteCode === baseCode || (baseCode === 'EGFR' && r.analyteCode === 'EGFR_CALC')) && r.value != null).forEach((r: any) => {
            const val = parseFloat(r.value!);
            if (isNaN(val)) return;
            const vt = r.visit.visitType;
            const pId = r.visit.participantId;

            const vData = visitData.find(v => v.name === vt);
            if (!vData) return;

            if (armAIdsSet.has(pId)) vData.armA.push(val);
            else if (armBIdsSet.has(pId)) vData.armB.push(val);
        });

        trends[baseCode] = visitData.map(v => ({
            name: v.name.replace('_', ' '),
            GroupA: v.armA.length ? Math.round((v.armA.reduce((a, b) => a + b, 0) / v.armA.length) * 10) / 10 : null,
            GroupB: v.armB.length ? Math.round((v.armB.reduce((a, b) => a + b, 0) / v.armB.length) * 10) / 10 : null,
        }));
    });

    const targetPerArm = 100;
    const config = await prisma.studyConfig.findUnique({ where: { key: 'TARGET_PER_ARM' } });
    const target = config ? parseInt(config.value) : targetPerArm;

    return NextResponse.json({
        recruitment: {
            total: totalParticipants,
            active: activeParticipants,
            completed: completedParticipants,
            withdrawn: withdrawnParticipants,
            lost: lostParticipants,
            screening: screeningParticipants,
            armA: showTreatment ? armACounts : 0,
            armB: showTreatment ? armBCounts : 0,
            targetPerArm: target,
        },
        visits: {
            total: totalVisits,
            completed: completedVisits,
            missing: missingVisits,
            completionRate: totalVisits > 0 ? Math.round((completedVisits / totalVisits) * 100) : 0,
            byType: visitCompletionByType,
        },
        trends: showTreatment ? trends : { ACR: [], EGFR: [] },
        adverseEvents: {
            total: totalAEs,
            saes: totalSAEs,
            bySeverity: aeSeverity.map((s: any) => ({ severity: s.severity, count: s._count._all })),
            byArm: showTreatment ? { A: armAAEs, B: armBAEs } : { A: 0, B: 0 },
            recent: recentAEs.map((ae: any) => ({
                id: ae.id,
                studyId: ae.participant.studyId,
                description: ae.description,
                severity: ae.severity,
                isSAE: ae.isSAE,
                createdAt: ae.createdAt,
            })),
        },
    });
}
