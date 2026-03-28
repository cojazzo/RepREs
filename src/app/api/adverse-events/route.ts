import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/authOptions';
import { canEdit } from '@/lib/auth';
import { createAuditLog } from '@/lib/audit';

const SEV_MAP: Record<number, string> = { 1: 'MILD', 2: 'MODERATE', 3: 'SEVERE' };
const REL_MAP: Record<number, string> = { 1: 'UNRELATED', 2: 'UNLIKELY', 3: 'POSSIBLE', 4: 'PROBABLE', 5: 'DEFINITE' };

const SYMPTOM_LABELS: Record<string, string> = {
    eaMareo: 'Dizziness', eaGi: 'GI symptoms', eaDolorAbd: 'Abdominal pain',
    eaApetito: 'Appetite change', eaFatiga: 'Fatigue', eaDolorRenal: 'Renal pain',
    eaEdema: 'Edema', eaOliguria: 'Oliguria', eaEspuma: 'Foamy urine', eaIvu: 'UTI',
};

export async function GET(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const participantId = searchParams.get('participantId');
    const severity = searchParams.get('severity');
    const saeOnly = searchParams.get('saeOnly') === 'true';

    // 1) Standalone AdverseEvent records
    const aeWhere: any = {};
    if (participantId) aeWhere.participantId = participantId;
    if (severity) aeWhere.severity = severity;
    if (saeOnly) aeWhere.isSAE = true;

    const standaloneAes = await prisma.adverseEvent.findMany({
        where: aeWhere,
        include: { participant: { select: { studyId: true, firstName: true, lastName: true } } },
        orderBy: { createdAt: 'desc' },
    });

    // 2) Visit-linked VisitAe records (from the wizard)
    const visitAeWhere: any = {};
    if (participantId) visitAeWhere.visit = { participantId };

    const visitAes = await prisma.visitAe.findMany({
        where: visitAeWhere,
        include: {
            visit: {
                include: {
                    participant: { select: { studyId: true, firstName: true, lastName: true } },
                },
            },
        },
        orderBy: { createdAt: 'desc' },
    });

    // 3) Transform VisitAe records into the same shape
    const transformedVisitAes = visitAes
        .filter(vae => vae.eaNuevo === 1 || Object.keys(SYMPTOM_LABELS).some(k => (vae as any)[k] === 1))
        .map(vae => {
            // Build symptoms list
            const symptoms = Object.entries(SYMPTOM_LABELS)
                .filter(([key]) => (vae as any)[key] === 1)
                .map(([, label]) => label);

            const description = vae.eaDesc || symptoms.join(', ') || 'Adverse event reported';
            const severityStr = vae.eaSeveridad != null ? SEV_MAP[vae.eaSeveridad] || 'UNKNOWN' : 'UNKNOWN';
            const relation = vae.eaRelacion != null ? REL_MAP[vae.eaRelacion] || 'UNKNOWN' : 'UNKNOWN';

            // Filter by severity if requested
            if (severity && severityStr !== severity) return null;
            // Filter by SAE if requested
            const isSAE = vae.eaHosp === 1;
            if (saeOnly && !isSAE) return null;

            return {
                id: `vae-${vae.id}`,
                description,
                severity: severityStr,
                relation,
                outcome: vae.eaSuspension === 1 ? 'TREATMENT_SUSPENDED' : 'ONGOING',
                isSAE,
                startDate: vae.createdAt,
                endDate: null,
                saeDetails: null,
                visitType: vae.visit.visitType,
                symptoms,
                source: 'visit' as const,
                observaciones: vae.observaciones,
                participant: vae.visit.participant,
            };
        })
        .filter(Boolean);

    // 4) Merge and sort by date
    const standaloneFormatted = standaloneAes.map(ae => ({
        ...ae,
        symptoms: [] as string[],
        source: 'standalone' as const,
        observaciones: null as string | null,
    }));

    const all = [...standaloneFormatted, ...transformedVisitAes].sort((a, b) => {
        const da = new Date(a!.startDate).getTime();
        const db = new Date(b!.startDate).getTime();
        return db - da;
    });

    return NextResponse.json(all);
}

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!canEdit(session.user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json();

    const ae = await prisma.adverseEvent.create({
        data: {
            participantId: body.participantId,
            visitType: body.visitType || null,
            description: body.description,
            startDate: new Date(body.startDate),
            endDate: body.endDate ? new Date(body.endDate) : null,
            severity: body.severity,
            relation: body.relation,
            outcome: body.outcome,
            isSAE: body.isSAE ?? false,
            saeDetails: body.saeDetails || null,
            actionTaken: body.actionTaken || null,
        },
    });

    await createAuditLog({
        userId: session.user.id,
        action: 'CREATE',
        entity: 'AdverseEvent',
        entityId: ae.id,
        newValue: JSON.stringify({ description: ae.description, severity: ae.severity, isSAE: ae.isSAE }),
    });

    return NextResponse.json(ae, { status: 201 });
}
