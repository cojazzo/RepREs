'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useLanguage } from '@/lib/i18n/LanguageContext';

interface Participant {
    id: string;
    studyId: string;
    firstName: string;
    lastName: string;
    sex: string;
    birthDate: string;
    status: string;
    enrolledAt: string;
    randomization?: { armLabel: string; treatment?: string };
    _count: { visits: number; adverseEvents: number };
}

const STATUS_BADGES: Record<string, string> = {
    ACTIVE: 'badge-success',
    COMPLETED: 'badge-info',
    WITHDRAWN: 'badge-warning',
    LOST_TO_FOLLOWUP: 'badge-danger',
    SCREENING: 'badge-neutral',
};

export default function ParticipantsPage() {
    const { t } = useLanguage();
    const [participants, setParticipants] = useState<Participant[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('');

    useEffect(() => {
        setLoading(true);
        setError(null);
        const params = new URLSearchParams();
        if (search) params.set('search', search);
        if (statusFilter) params.set('status', statusFilter);

        fetch(`/api/participants?${params}`)
            .then(r => r.json())
            .then(d => {
                if (Array.isArray(d)) {
                    setParticipants(d);
                } else {
                    // API returned an error object
                    setParticipants([]);
                    setError(d?.error || t('participants.db_error'));
                }
                setLoading(false);
            })
            .catch((err) => {
                setParticipants([]);
                setError(t('participants.db_error'));
                setLoading(false);
            });
    }, [search, statusFilter, t]);

    const age = (dob: string) => {
        const diff = Date.now() - new Date(dob).getTime();
        return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
    };

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="page-header">
                <div>
                    <h1 className="page-title">{t('participants.title')}</h1>
                    <p className="text-surface-400 mt-1 text-sm">{participants.length} {t('participants.enrolled_count')}</p>
                </div>
                <Link href="/participants/new" className="btn-primary">
                    + {t('participants.enroll_btn')}
                </Link>
            </div>

            {/* Filters */}
            <div className="flex gap-4">
                <input
                    type="text"
                    placeholder={t('participants.search_placeholder')}
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="input max-w-sm"
                />
                <select
                    value={statusFilter}
                    onChange={e => setStatusFilter(e.target.value)}
                    className="select max-w-xs"
                >
                    <option value="">{t('participants.filter.all_status') as any}</option>
                    <option value="SCREENING">{t('participants.filter.screening')}</option>
                    <option value="ACTIVE">{t('participants.filter.active')}</option>
                    <option value="COMPLETED">{t('participants.filter.completed')}</option>
                    <option value="WITHDRAWN">{t('participants.filter.withdrawn')}</option>
                    <option value="LOST_TO_FOLLOWUP">{t('participants.filter.lost')}</option>
                </select>
            </div>

            {/* Error banner */}
            {error && (
                <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                    ⚠️ {error}
                </div>
            )}

            {/* Table */}
            <div className="card p-0 overflow-hidden">
                {loading ? (
                    <div className="flex items-center justify-center h-32">
                        <div className="animate-spin w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full" />
                    </div>
                ) : participants.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-48 text-center gap-3">
                        <div className="text-4xl">👥</div>
                        <p className="text-surface-300 font-medium">
                            {search || statusFilter ? t('participants.empty.no_match') : t('participants.empty.none')}
                        </p>
                        {!search && !statusFilter && (
                            <Link href="/participants/new" className="btn-primary text-sm">
                                {t('participants.empty.enroll_first')}
                            </Link>
                        )}
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-surface-700/50 bg-surface-800/50">
                                    <th className="text-left text-xs font-medium text-surface-400 uppercase tracking-wider px-6 py-3">{t('participants.col.study_id')}</th>
                                    <th className="text-left text-xs font-medium text-surface-400 uppercase tracking-wider px-6 py-3">{t('participants.col.name')}</th>
                                    <th className="text-left text-xs font-medium text-surface-400 uppercase tracking-wider px-6 py-3">{t('participants.col.sex')}</th>
                                    <th className="text-left text-xs font-medium text-surface-400 uppercase tracking-wider px-6 py-3">{t('participants.col.age')}</th>
                                    <th className="text-left text-xs font-medium text-surface-400 uppercase tracking-wider px-6 py-3">{t('participants.col.arm')}</th>
                                    <th className="text-left text-xs font-medium text-surface-400 uppercase tracking-wider px-6 py-3">{t('participants.col.status')}</th>
                                    <th className="text-left text-xs font-medium text-surface-400 uppercase tracking-wider px-6 py-3">{t('participants.col.visits')}</th>
                                    <th className="text-left text-xs font-medium text-surface-400 uppercase tracking-wider px-6 py-3">{t('participants.col.aes')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {participants.map((p) => (
                                    <tr key={p.id} className="table-row">
                                        <td className="px-6 py-4">
                                            <Link href={`/participants/${p.id}`} className="text-primary-400 hover:text-primary-300 font-medium transition-colors">
                                                {p.studyId}
                                            </Link>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-surface-200">{p.lastName}, {p.firstName}</td>
                                        <td className="px-6 py-4 text-sm text-surface-300">{p.sex}</td>
                                        <td className="px-6 py-4 text-sm text-surface-300">{age(p.birthDate)}</td>
                                        <td className="px-6 py-4">
                                            {p.randomization ? (
                                                <span className="badge-info">
                                                    {p.randomization.treatment === 'DAPAGLIFLOZIN_10MG' ? 'Dapagliflozin' :
                                                     p.randomization.treatment === 'PLACEBO' ? 'Placebo' :
                                                     `Group ${p.randomization.armLabel}`}
                                                </span>
                                            ) : <span className="text-surface-500">—</span>}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={STATUS_BADGES[p.status] || 'badge-neutral'}>
                                                {p.status.replace('_', ' ')}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-surface-300">{p._count.visits}/4</td>
                                        <td className="px-6 py-4 text-sm text-surface-300">{p._count.adverseEvents}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
