'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend } from 'recharts';

interface DashboardData {
    recruitment: {
        total: number; active: number; completed: number; withdrawn: number;
        lost: number; screening: number; armA: number; armB: number; targetPerArm: number;
    };
    visits: {
        total: number; completed: number; missing: number; completionRate: number;
        byType: { visitType: string; total: number; completed: number; rate: number }[];
    };
    adverseEvents: {
        total: number; saes: number;
        bySeverity: { severity: string; count: number }[];
        byArm: { A: number; B: number };
        recent: { id: string; studyId: string; description: string; severity: string; isSAE: boolean; createdAt: string }[];
    };
    trends: {
        ACR: { name: string; GroupA: number | null; GroupB: number | null }[];
        EGFR: { name: string; GroupA: number | null; GroupB: number | null }[];
    };
}

const COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];
const SEVERITY_COLORS: Record<string, string> = { MILD: '#22c55e', MODERATE: '#f59e0b', SEVERE: '#ef4444' };

export default function DashboardPage() {
    const { data: session } = useSession();
    const isAdmin = session?.user?.role === 'ADMIN';
    const isPharma = session?.user?.role === 'PHARMACY';
    const canViewTreatment = isAdmin || isPharma;

    const [data, setData] = useState<DashboardData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch('/api/analytics')
            .then(r => r.json())
            .then(d => { setData(d); setLoading(false); })
            .catch(() => setLoading(false));
    }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full" />
            </div>
        );
    }

    if (!data) return <div className="text-surface-400">Failed to load dashboard data.</div>;

    const enrolledTotal = data.recruitment.armA + data.recruitment.armB;
    const recruitmentPercent = Math.round((enrolledTotal / (data.recruitment.targetPerArm * 2)) * 100);

    const statusData = [
        { name: 'Active', value: data.recruitment.active, color: '#22c55e' },
        { name: 'Completed', value: data.recruitment.completed, color: '#3b82f6' },
        { name: 'Withdrawn', value: data.recruitment.withdrawn, color: '#f59e0b' },
        { name: 'Lost', value: data.recruitment.lost, color: '#ef4444' },
        { name: 'Screening', value: data.recruitment.screening, color: '#8b5cf6' },
    ].filter(d => d.value > 0);

    const visitData = data.visits.byType.map(v => ({
        name: v.visitType.replace('_', ' '),
        Completed: v.completed,
        Pending: v.total - v.completed,
        Rate: v.rate,
    }));

    const armComparison = [
        { name: 'Group A', AEs: data.adverseEvents.byArm.A, Enrolled: data.recruitment.armA },
        { name: 'Group B', AEs: data.adverseEvents.byArm.B, Enrolled: data.recruitment.armB },
    ];

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Dashboard</h1>
                    <p className="text-surface-400 mt-1 text-sm">Real-time trial overview • Dapagliflozin 10mg vs Placebo</p>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard label="Total Enrolled" value={enrolledTotal} sub={`${recruitmentPercent}% of target`}
                    gradient="from-primary-600 to-primary-400" icon="👥" />
                <StatCard label="Visit Completion" value={`${data.visits.completionRate}%`}
                    sub={`${data.visits.completed}/${data.visits.total} visits`}
                    gradient="from-emerald-600 to-emerald-400" icon="✅" />
                <StatCard label="Adverse Events" value={data.adverseEvents.total}
                    sub={`${data.adverseEvents.saes} SAE${data.adverseEvents.saes !== 1 ? 's' : ''}`}
                    gradient="from-amber-600 to-amber-400" icon="⚠️"
                    alert={data.adverseEvents.saes > 0} />
                <StatCard label="Missing Data" value={data.visits.missing}
                    sub="Incomplete visits"
                    gradient="from-red-600 to-red-400" icon="📋" />
            </div>

            {/* Recruitment Progress (Blinded) */}
            {canViewTreatment && (
                <div className="card">
                    <h2 className="section-title">Recruitment Progress (By Arm)</h2>
                    <div className="grid grid-cols-2 gap-6">
                        <div>
                            <div className="flex justify-between text-sm mb-2">
                                <span className="text-surface-400">Group A</span>
                                <span className="text-primary-400 font-medium">{data.recruitment.armA} / {data.recruitment.targetPerArm}</span>
                            </div>
                            <div className="h-3 bg-surface-700 rounded-full overflow-hidden">
                                <div className="h-full bg-gradient-to-r from-primary-600 to-primary-400 rounded-full transition-all duration-1000"
                                    style={{ width: `${Math.min((data.recruitment.armA / data.recruitment.targetPerArm) * 100, 100)}%` }} />
                            </div>
                        </div>
                        <div>
                            <div className="flex justify-between text-sm mb-2">
                                <span className="text-surface-400">Group B</span>
                                <span className="text-accent-400 font-medium">{data.recruitment.armB} / {data.recruitment.targetPerArm}</span>
                            </div>
                            <div className="h-3 bg-surface-700 rounded-full overflow-hidden">
                                <div className="h-full bg-gradient-to-r from-accent-600 to-accent-400 rounded-full transition-all duration-1000"
                                    style={{ width: `${Math.min((data.recruitment.armB / data.recruitment.targetPerArm) * 100, 100)}%` }} />
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Participant Status */}
                <div className="card">
                    <h2 className="section-title">Participant Status</h2>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie data={statusData} cx="50%" cy="50%" innerRadius={60} outerRadius={90}
                                    dataKey="value" paddingAngle={4}>
                                    {statusData.map((entry, i) => (
                                        <Cell key={i} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#e2e8f0' }} />
                                <Legend iconType="circle" wrapperStyle={{ color: '#94a3b8', fontSize: '12px' }} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Visit Completion */}
                <div className="card">
                    <h2 className="section-title">Visit Completion by Timepoint</h2>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={visitData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                                <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} />
                                <YAxis stroke="#94a3b8" fontSize={12} />
                                <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#e2e8f0' }} />
                                <Bar dataKey="Completed" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="Pending" fill="#475569" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* AE Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* AE by Severity */}
                <div className="card">
                    <h2 className="section-title">AE Severity Distribution</h2>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={data.adverseEvents.bySeverity.map(s => ({ name: s.severity, count: s.count }))} layout="vertical">
                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                                <XAxis type="number" stroke="#94a3b8" fontSize={12} />
                                <YAxis type="category" dataKey="name" stroke="#94a3b8" fontSize={12} width={80} />
                                <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#e2e8f0' }} />
                                <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                                    {data.adverseEvents.bySeverity.map((entry, i) => (
                                        <Cell key={i} fill={SEVERITY_COLORS[entry.severity] || COLORS[i]} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Arm Comparison */}
                {canViewTreatment ? (
                    <div className="card">
                        <h2 className="section-title">Blinded Group Comparison (A vs B)</h2>
                        <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={armComparison}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                                    <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} />
                                    <YAxis stroke="#94a3b8" fontSize={12} />
                                    <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#e2e8f0' }} />
                                    <Legend wrapperStyle={{ color: '#94a3b8', fontSize: '12px' }} />
                                    <Bar dataKey="Enrolled" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                                    <Bar dataKey="AEs" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                ) : <div />}
            </div>

            {/* Clinical Trends Section */}
            {canViewTreatment && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* ACR Trend */}
                    <div className="card">
                        <h2 className="section-title">ACR Trend (A vs B)</h2>
                        <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={data.trends.ACR}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                                    <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} />
                                    <YAxis stroke="#94a3b8" fontSize={12} />
                                    <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#e2e8f0' }} />
                                    <Legend wrapperStyle={{ color: '#94a3b8', fontSize: '12px' }} />
                                    <Line type="monotone" name="Group A" dataKey="GroupA" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} connectNulls />
                                    <Line type="monotone" name="Group B" dataKey="GroupB" stroke="#f59e0b" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} connectNulls />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* eGFR Trend */}
                    <div className="card">
                        <h2 className="section-title">eGFR Trend (A vs B)</h2>
                        <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={data.trends.EGFR}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                                    <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} />
                                    <YAxis stroke="#94a3b8" fontSize={12} />
                                    <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#e2e8f0' }} />
                                    <Legend wrapperStyle={{ color: '#94a3b8', fontSize: '12px' }} />
                                    <Line type="monotone" name="Group A" dataKey="GroupA" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} connectNulls />
                                    <Line type="monotone" name="Group B" dataKey="GroupB" stroke="#f59e0b" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} connectNulls />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>
            )}

            {/* Recent SAEs */}
            {data.adverseEvents.recent.some(ae => ae.isSAE) && (
                <div className="card border-red-500/30">
                    <h2 className="section-title text-red-400">⚠️ Recent SAE Alerts</h2>
                    <div className="space-y-2">
                        {data.adverseEvents.recent.filter(ae => ae.isSAE).map(ae => (
                            <div key={ae.id} className="flex items-center gap-4 p-3 rounded-lg bg-red-500/5 border border-red-500/10">
                                <span className="badge-danger">SAE</span>
                                <span className="text-sm text-surface-200">{ae.studyId}</span>
                                <span className="text-sm text-surface-400">{ae.description}</span>
                                <span className="text-xs text-surface-500 ml-auto">{new Date(ae.createdAt).toLocaleDateString()}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

function StatCard({ label, value, sub, gradient, icon, alert }: {
    label: string; value: string | number; sub: string;
    gradient: string; icon: string; alert?: boolean;
}) {
    return (
        <div className={`card-hover relative overflow-hidden ${alert ? 'border-red-500/30' : ''}`}>
            <div className={`absolute top-0 right-0 w-24 h-24 bg-gradient-to-br ${gradient} opacity-10 rounded-full -translate-y-8 translate-x-8`} />
            <div className="flex items-start justify-between">
                <div>
                    <p className="text-sm text-surface-400">{label}</p>
                    <p className="text-3xl font-bold text-white mt-1">{value}</p>
                    <p className="text-xs text-surface-500 mt-1">{sub}</p>
                </div>
                <span className="text-2xl">{icon}</span>
            </div>
            {alert && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-red-500 to-transparent animate-pulse-subtle" />
            )}
        </div>
    );
}
