import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/authOptions';
import { Role } from '@prisma/client';

export async function getSession() {
    return await getServerSession(authOptions);
}

export async function getCurrentUser() {
    const session = await getSession();
    return session?.user ?? null;
}

export function canViewTreatment(role: Role): boolean {
    return role === Role.ADMIN || role === Role.PHARMACY;
}

export function canEdit(role: Role): boolean {
    const allowed: readonly Role[] = [Role.ADMIN, Role.INVESTIGATOR, Role.DATA_ENTRY, Role.PHARMACY];
    return allowed.includes(role);
}

export function canManageUsers(role: Role): boolean {
    return role === Role.ADMIN;
}

export function canCreateQueries(role: Role): boolean {
    const allowed: readonly Role[] = [Role.ADMIN, Role.MONITOR];
    return allowed.includes(role);
}

export function canRespondQueries(role: Role): boolean {
    const allowed: readonly Role[] = [Role.ADMIN, Role.DATA_ENTRY, Role.INVESTIGATOR];
    return allowed.includes(role);
}

export function canViewPharmacy(role: Role): boolean {
    const allowed: readonly Role[] = [Role.ADMIN, Role.PHARMACY];
    return allowed.includes(role);
}

export const ROLE_LABELS: Record<Role, string> = {
    ADMIN: 'Administrator',
    INVESTIGATOR: 'Investigator',
    DATA_ENTRY: 'Data Entry',
    MONITOR: 'Monitor',
    PHARMACY: 'Pharmacy',
    READ_ONLY: 'Read Only',
};

