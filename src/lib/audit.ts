import { prisma } from './prisma';

export async function createAuditLog(params: {
    userId: string;
    action: string;
    entity: string;
    entityId: string;
    field?: string;
    oldValue?: string;
    newValue?: string;
}) {
    await prisma.auditLog.create({
        data: {
            userId: params.userId,
            action: params.action,
            entity: params.entity,
            entityId: params.entityId,
            field: params.field ?? null,
            oldValue: params.oldValue ?? null,
            newValue: params.newValue ?? null,
        },
    });
}
