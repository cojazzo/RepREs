import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/authOptions';
import { createAuditLog } from '@/lib/audit';
import { canViewTreatment, canEdit } from '@/lib/auth';
import { assignRandomization } from '@/lib/randomize';
import { ParticipantStatus, VisitType } from '@prisma/client';

export async function GET(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const showTreatment = canViewTreatment(session.user.role);

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const search = searchParams.get('search');

    const where: any = {};
    if (status) where.status = status;
    if (search) {
        where.OR = [
            { studyId: { contains: search, mode: 'insensitive' } },
            { firstName: { contains: search, mode: 'insensitive' } },
            { lastName: { contains: search, mode: 'insensitive' } },
        ];
    }

    const participants = await prisma.participant.findMany({
        where,
        include: {
            ...(showTreatment ? { randomization: true } : {}),
            _count: {
                select: { visits: { where: { completed: true } }, adverseEvents: true },
            },
        },
        orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(participants);
}

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!canEdit(session.user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json();
    const { firstName, lastName, sex, birthDate, curp, chmhId, phone, screening, enroll } = body;

    // Check for duplicates
    const orConditions: any[] = [
        {
            AND: [
                { firstName: { equals: firstName, mode: 'insensitive' } },
                { lastName: { equals: lastName, mode: 'insensitive' } },
                { birthDate: new Date(birthDate) }
            ]
        }
    ];
    if (curp) orConditions.push({ curp: { equals: curp, mode: 'insensitive' } });
    if (chmhId) orConditions.push({ chmhId: { equals: chmhId, mode: 'insensitive' } });

    const existing = await prisma.participant.findFirst({
        where: { OR: orConditions }
    });

    if (existing) {
        let duplicateField = 'Name and Date of Birth';
        if (curp && existing.curp?.toUpperCase() === curp.toUpperCase()) duplicateField = 'CURP';
        else if (chmhId && existing.chmhId?.toUpperCase() === chmhId.toUpperCase()) duplicateField = 'CHMH ID';

        return NextResponse.json({ error: `A participant with this ${duplicateField} already exists (${existing.studyId}).` }, { status: 409 });
    }

    // Generate study ID safely based on the highest existing ID, not count
    const lastParticipant = await prisma.participant.findFirst({
        orderBy: { studyId: 'desc' },
        select: { studyId: true }
    });
    
    let nextNum = 1;
    if (lastParticipant && lastParticipant.studyId.startsWith('REP-')) {
        const lastNum = parseInt(lastParticipant.studyId.replace('REP-', ''), 10);
        if (!isNaN(lastNum)) {
            nextNum = lastNum + 1;
        }
    }
    const studyId = `REP-${String(nextNum).padStart(4, '0')}`;

    const participant = await prisma.participant.create({
        data: {
            studyId,
            firstName,
            lastName,
            sex,
            birthDate: new Date(birthDate),
            curp: curp || null,
            chmhId: chmhId || null,
            phone: phone || null,
            status: enroll ? ParticipantStatus.ACTIVE : ParticipantStatus.SCREENING,
            consentDate: new Date(),
            enrolledAt: enroll ? new Date() : null,
            screening: screening ? {
                create: {
                    acrOver30: screening.acrOver30 ?? false,
                    acrValue1: screening.acrValue1 ?? null,
                    acrValue2: screening.acrValue2 ?? null,
                    acrValue3: screening.acrValue3 ?? null,
                    informedConsent: screening.informedConsent ?? false,
                    willingToComply: screening.willingToComply ?? false,
                    renalImpairment: screening.renalImpairment ?? false,
                    pregnancy: screening.pregnancy ?? false,
                    knownAllergy: screening.knownAllergy ?? false,
                    activeInfection: screening.activeInfection ?? false,
                    diabetesMellitus: screening.diabetesMellitus ?? false,
                    knownGlomerulopathy: screening.knownGlomerulopathy ?? false,
                    highRiskCondition: screening.highRiskCondition ?? false,
                    eligible: enroll ?? false,
                },
            } : undefined,
        },
    });

    // If enrolling, randomize and create visits
    if (enroll) {
        const randomization = await assignRandomization(participant.id);

        // Create scheduled visits
        for (const visitType of [VisitType.BASELINE, VisitType.MONTH_2, VisitType.MONTH_4, VisitType.MONTH_6]) {
            await prisma.visit.create({
                data: { participantId: participant.id, visitType },
            });
        }

        await createAuditLog({
            userId: session.user.id,
            action: 'ENROLL',
            entity: 'Participant',
            entityId: participant.id,
            newValue: JSON.stringify({ studyId, arm: randomization.armLabel }),
        });
    } else {
        await createAuditLog({
            userId: session.user.id,
            action: 'CREATE',
            entity: 'Participant',
            entityId: participant.id,
            newValue: JSON.stringify({ studyId }),
        });
    }

    return NextResponse.json(participant, { status: 201 });
}
