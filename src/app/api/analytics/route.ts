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
        where: { analyteCode: { in: ['ACR', 'EGFR', 'EGFR_CALC', 'CRE_S', 'ALB_U', 'MALB', 'CRE_U'] } },
        include: { 
            visit: { 
                select: { 
                    visitType: true, 
                    participantId: true,
                    participant: { select: { birthDate: true, sex: true } }
                } 
            } 
        }
    });

    const armAIdsSet = new Set(armAIds);
    const armBIdsSet = new Set(armBIds);
    const visitsOrder = ['BASELINE', 'MONTH_2', 'MONTH_4', 'MONTH_6'];
    const trends: Record<string, any> = { ACR: [], EGFR: [] };

    const visitDataByArmAndType: Record<string, Record<string, { armA: number[], armB: number[] }>> = { ACR: {}, EGFR: {} };
    visitsOrder.forEach(vt => {
        visitDataByArmAndType['ACR'][vt] = { armA: [], armB: [] };
        visitDataByArmAndType['EGFR'][vt] = { armA: [], armB: [] };
    });

    const resultsByVisit = new Map<string, any[]>();
    labResults.forEach((r: any) => {
        const key = `${r.visit.participantId}_${r.visit.visitType}`;
        if (!resultsByVisit.has(key)) resultsByVisit.set(key, []);
        resultsByVisit.get(key)!.push(r);
    });

    resultsByVisit.forEach((results, key) => {
        const first = results[0];
        const pId = first.visit.participantId;
        const vt = first.visit.visitType;
        const pAge = first.visit.participant.birthDate ? Math.floor((Date.now() - new Date(first.visit.participant.birthDate).getTime()) / 31557600000) : 50;
        const pSex = first.visit.participant.sex;

        const isArmA = armAIdsSet.has(pId);
        const isArmB = armBIdsSet.has(pId);
        if (!isArmA && !isArmB) return;

        // eGFR
        let egfr = results.find(r => r.analyteCode === 'EGFR' || r.analyteCode === 'EGFR_CALC')?.value;
        if (!egfr) {
            const creS = results.find(r => r.analyteCode === 'CRE_S');
            if (creS?.value) {
                const scr = parseFloat(creS.value);
                if (!isNaN(scr) && scr > 0) {
                    const kappa = pSex === 'Female' ? 0.7 : 0.9;
                    const alpha = pSex === 'Female' ? -0.241 : -0.302;
                    let val = 142 * Math.pow(Math.min(scr / kappa, 1), alpha) * Math.pow(Math.max(scr / kappa, 1), -1.200) * Math.pow(0.9938, pAge);
                    if (pSex === 'Female') val *= 1.012;
                    egfr = val;
                }
            }
        } else { egfr = parseFloat(egfr); }

        if (egfr && !isNaN(parseFloat(egfr as string))) {
            const val = parseFloat(egfr as string);
            if (visitDataByArmAndType['EGFR'][vt]) {
                if (isArmA) visitDataByArmAndType['EGFR'][vt].armA.push(val);
                if (isArmB) visitDataByArmAndType['EGFR'][vt].armB.push(val);
            }
        }

        // ACR
        let acr = results.find(r => r.analyteCode === 'ACR')?.value;
        if (!acr) {
            const albU = results.find(r => r.analyteCode === 'ALB_U');
            const malb = results.find(r => r.analyteCode === 'MALB');
            const creU = results.find(r => r.analyteCode === 'CRE_U');
            if (creU?.value) {
                const creUVal = parseFloat(creU.value);
                const albVal = albU?.value ? parseFloat(albU.value) * 10 : (malb?.value ? parseFloat(malb.value) : NaN);
                if (!isNaN(albVal) && creUVal > 0) {
                    acr = (albVal / (creUVal * 10)) * 1000;
                }
            }
        } else { acr = parseFloat(acr); }

        if (acr && !isNaN(parseFloat(acr as string))) {
            const val = parseFloat(acr as string);
            if (visitDataByArmAndType['ACR'][vt]) {
                if (isArmA) visitDataByArmAndType['ACR'][vt].armA.push(val);
                if (isArmB) visitDataByArmAndType['ACR'][vt].armB.push(val);
            }
        }
    });

    ['ACR', 'EGFR'].forEach(baseCode => {
        trends[baseCode] = visitsOrder.map(vt => {
            const vData = visitDataByArmAndType[baseCode][vt];
            return {
                name: vt.replace('_', ' '),
                GroupA: vData.armA.length ? Math.round((vData.armA.reduce((a, b) => a + b, 0) / vData.armA.length) * 10) / 10 : null,
                GroupB: vData.armB.length ? Math.round((vData.armB.reduce((a, b) => a + b, 0) / vData.armB.length) * 10) / 10 : null,
            };
        });
    });

    // Add Enrollment ACR from ScreeningChecklist
    const screenings = await prisma.screeningChecklist.findMany({
        where: { participantId: { in: [...armAIds, ...armBIds] } },
        select: { participantId: true, acrValue1: true, acrValue2: true, acrValue3: true }
    });

    const screeningAcrByArm = { armA: [] as number[], armB: [] as number[] };
    screenings.forEach(s => {
        const vals = [s.acrValue1, s.acrValue2, s.acrValue3].filter(v => v !== null) as number[];
        if (vals.length > 0) {
            const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
            if (armAIdsSet.has(s.participantId)) screeningAcrByArm.armA.push(mean);
            else if (armBIdsSet.has(s.participantId)) screeningAcrByArm.armB.push(mean);
        }
    });

    trends['ACR'].unshift({
        name: 'ENROLLMENT',
        GroupA: screeningAcrByArm.armA.length ? Math.round((screeningAcrByArm.armA.reduce((a, b) => a + b, 0) / screeningAcrByArm.armA.length) * 10) / 10 : null,
        GroupB: screeningAcrByArm.armB.length ? Math.round((screeningAcrByArm.armB.reduce((a, b) => a + b, 0) / screeningAcrByArm.armB.length) * 10) / 10 : null,
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
