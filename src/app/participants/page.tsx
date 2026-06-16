'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

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
                    setError(d?.error || 'Failed to load participants.');
                }
                setLoading(false);
            })
            .catch((err) => {
                setParticipants([]);
                setError('Could not connect to server. Make sure the database is running.');
                setLoading(false);
            });
    }, [search, statusFilter]);

    const age = (dob: string) => {
        const diff = Date.now() - new Date(dob).getTime();
        return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
    };

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Participants</h1>
                    <p className="text-surface-400 mt-1 text-sm">{participants.length} participants enrolled</p>
                </div>
                <Link href="/participants/new" className="btn-primary">
                    + Enroll Participant
                </Link>
            </div>

            {/* Filters */}
            <div className="flex gap-4">
                <input
                    type="text"
                    placeholder="Search by study ID, name..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="input max-w-sm"
                />
                <select
                    value={statusFilter}
                    onChange={e => setStatusFilter(e.target.value)}
                    className="select max-w-xs"
                >
                    <option value="">All Status</option>
                    <option value="SCREENING">Screening</option>
                    <option value="ACTIVE">Active</option>
                    <option value="COMPLETED">Completed</option>
                    <option value="WITHDRAWN">Withdrawn</option>
                    <option value="LOST_TO_FOLLOWUP">Lost to Follow-up</option>
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
                            {search || statusFilter ? 'No participants match your filters.' : 'No participants enrolled yet.'}
                        </p>
                        {!search && !statusFilter && (
                            <Link href="/participants/new" className="btn-primary text-sm">
                                Enroll First Participant
                            </Link>
                        )}
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-surface-700/50 bg-surface-800/50">
                                    <th className="text-left text-xs font-medium text-surface-400 uppercase tracking-wider px-6 py-3">Study ID</th>
                                    <th className="text-left text-xs font-medium text-surface-400 uppercase tracking-wider px-6 py-3">Name</th>
                                    <th className="text-left text-xs font-medium text-surface-400 uppercase tracking-wider px-6 py-3">Sex</th>
                                    <th className="text-left text-xs font-medium text-surface-400 uppercase tracking-wider px-6 py-3">Age</th>
                                    <th className="text-left text-xs font-medium text-surface-400 uppercase tracking-wider px-6 py-3">Arm</th>
                                    <th className="text-left text-xs font-medium text-surface-400 uppercase tracking-wider px-6 py-3">Status</th>
                                    <th className="text-left text-xs font-medium text-surface-400 uppercase tracking-wider px-6 py-3">Visits</th>
                                    <th className="text-left text-xs font-medium text-surface-400 uppercase tracking-wider px-6 py-3">AEs</th>
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
