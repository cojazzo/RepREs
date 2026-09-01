'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend, ComposedChart, Area } from 'recharts';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { TranslationKey } from '@/lib/i18n/translations';

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
        ACR: { name: string; GroupA: number | null; GroupB: number | null; SDA: number | null; SDB: number | null; nA: number; nB: number }[];
        EGFR: { name: string; GroupA: number | null; GroupB: number | null; SDA: number | null; SDB: number | null; nA: number; nB: number }[];
    };
    appointments: { todayCount: number; overdueCount: number; recontactPending: { studyId: string; name: string; missedDate: string; attempts: number }[] };
}

const COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];
const SEVERITY_COLORS: Record<string, string> = { MILD: '#22c55e', MODERATE: '#f59e0b', SEVERE: '#ef4444' };

export default function DashboardPage() {
    const { data: session } = useSession();
    const isAdmin = session?.user?.role === 'ADMIN';
    const isPharma = session?.user?.role === 'PHARMACY';
    const canViewTreatment = isAdmin || isPharma;
    
    const { t } = useLanguage();

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

    if (!data) return <div className="text-surface-400">{t('dashboard.error')}</div>;

    const enrolledTotal = data.recruitment.armA + data.recruitment.armB;
    const recruitmentPercent = Math.round((enrolledTotal / (data.recruitment.targetPerArm * 2)) * 100);

    const statusData = [
        { name: t('dashboard.status.active'), value: data.recruitment.active, color: '#22c55e' },
        { name: t('dashboard.status.completed'), value: data.recruitment.completed, color: '#3b82f6' },
        { name: t('dashboard.status.withdrawn'), value: data.recruitment.withdrawn, color: '#f59e0b' },
        { name: t('dashboard.status.lost'), value: data.recruitment.lost, color: '#ef4444' },
        { name: t('dashboard.status.screening'), value: data.recruitment.screening, color: '#8b5cf6' },
    ].filter(d => d.value > 0);

    const visitData = data.visits.byType.map(v => ({
        name: v.visitType.replace('_', ' '),
        completed: v.completed,
        pending: v.total - v.completed,
        Rate: v.rate,
    }));

    const armComparison = [
        { name: t('dashboard.group_a'), AEs: data.adverseEvents.byArm.A, Enrolled: data.recruitment.armA },
        { name: t('dashboard.group_b'), AEs: data.adverseEvents.byArm.B, Enrolled: data.recruitment.armB },
    ];

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="page-header">
                <div>
                    <h1 className="page-title">{t('dashboard.title')}</h1>
                    <p className="text-surface-400 mt-1 text-sm">{t('dashboard.subtitle')}</p>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard label={t('dashboard.stat.appointments_today')} value={data.appointments.todayCount} sub={`${data.appointments.overdueCount} ${t('dashboard.stat.overdue_appointments')}`}
                    gradient="from-cyan-600 to-cyan-400" icon="📅" />
                <StatCard label={t('dashboard.stat.total_enrolled')} value={enrolledTotal} sub={`${recruitmentPercent}% ${t('dashboard.stat.of_target')}`}
                    gradient="from-primary-600 to-primary-400" icon="👥" />
                <StatCard label={t('dashboard.stat.visit_completion')} value={`${data.visits.completionRate}%`}
                    sub={`${data.visits.completed}/${data.visits.total} ${t('dashboard.stat.visits')}`}
                    gradient="from-emerald-600 to-emerald-400" icon="✅" />
                <StatCard label={t('dashboard.stat.adverse_events')} value={data.adverseEvents.total}
                    sub={`${data.adverseEvents.saes} ${t('dashboard.stat.saes')}`}
                    gradient="from-amber-600 to-amber-400" icon="⚠️"
                    alert={data.adverseEvents.saes > 0} />
                <StatCard label={t('dashboard.stat.missing_data')} value={data.visits.missing}
                    sub={t('dashboard.stat.incomplete_visits')}
                    gradient="from-red-600 to-red-400" icon="📋" />
            </div>

            {/* Recruitment Progress (Blinded) */}
            {canViewTreatment && (
                <div className="card">
                    <h2 className="section-title">{t('dashboard.section.recruitment')}</h2>
                    <div className="grid grid-cols-2 gap-6">
                        <div>
                            <div className="flex justify-between text-sm mb-2">
                                <span className="text-surface-400">{t('dashboard.group_a')}</span>
                                <span className="text-primary-400 font-medium">{data.recruitment.armA} / {data.recruitment.targetPerArm}</span>
                            </div>
                            <div className="h-3 bg-surface-700 rounded-full overflow-hidden">
                                <div className="h-full bg-gradient-to-r from-primary-600 to-primary-400 rounded-full transition-all duration-1000"
                                    style={{ width: `${Math.min((data.recruitment.armA / data.recruitment.targetPerArm) * 100, 100)}%` }} />
                            </div>
                        </div>
                        <div>
                            <div className="flex justify-between text-sm mb-2">
                                <span className="text-surface-400">{t('dashboard.group_b')}</span>
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
                    <h2 className="section-title">{t('dashboard.section.participant_status') as any}</h2>
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
                    <h2 className="section-title">{t('dashboard.section.visit_completion') as any}</h2>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={visitData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                                <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} />
                                <YAxis stroke="#94a3b8" fontSize={12} />
                                <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#e2e8f0' }} />
                                <Bar dataKey="completed" name={t('dashboard.visits.completed')} fill="#3b82f6" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="pending" name={t('dashboard.visits.pending')} fill="#475569" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* AE Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* AE by Severity */}
                <div className="card">
                    <h2 className="section-title">{t('dashboard.section.ae_severity')}</h2>
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
                        <h2 className="section-title">{t('dashboard.section.group_comparison') as any}</h2>
                        <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={armComparison}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                                    <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} />
                                    <YAxis stroke="#94a3b8" fontSize={12} />
                                    <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#e2e8f0' }} />
                                    <Legend wrapperStyle={{ color: '#94a3b8', fontSize: '12px' }} />
                                    <Bar dataKey="Enrolled" name={t('dashboard.enrolled')} fill="#3b82f6" radius={[4, 4, 0, 0]} />
                                    <Bar dataKey="AEs" name={t('dashboard.stat.adverse_events')} fill="#f59e0b" radius={[4, 4, 0, 0]} />
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
                        <h2 className="section-title">{t('dashboard.section.acr_trend')}</h2>
                        <TrendChart data={data.trends.ACR} unitLabel="mg/g" t={t} />
                    </div>

                    {/* eGFR Trend */}
                    <div className="card">
                        <h2 className="section-title">{t('dashboard.section.egfr_trend')}</h2>
                        <TrendChart data={data.trends.EGFR} unitLabel="mL/min/1.73m²" t={t} />
                    </div>
                </div>
            )}

            {/* Recent SAEs */}
            {data.adverseEvents.recent.some(ae => ae.isSAE) && (
                <div className="card border-red-500/30">
                    <h2 className="section-title text-red-400">{t('dashboard.section.sae_alerts')}</h2>
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

            {/* Patients to Recontact */}
            {data.appointments.recontactPending.length > 0 && (
                <div className="card border-amber-500/30">
                    <h2 className="section-title text-amber-400">{t('dashboard.section.recontact_alerts')}</h2>
                    <div className="space-y-2">
                        {data.appointments.recontactPending.map((pt, i) => (
                            <div key={i} className="flex items-center gap-4 p-3 rounded-lg bg-amber-500/5 border border-amber-500/10">
                                <span className="badge-warning">MISSED</span>
                                <span className="text-sm text-surface-200">{pt.studyId} - {pt.name}</span>
                                <span className="text-sm text-surface-400">Attempts: {pt.attempts}</span>
                                <span className="text-xs text-surface-500 ml-auto">{new Date(pt.missedDate).toLocaleDateString()}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

type TrendPoint = { name: string; GroupA: number | null; GroupB: number | null; SDA: number | null; SDB: number | null; nA: number; nB: number };

/** Prepara los datos añadiendo los límites superior/inferior para las bandas ±DE */
function prepareTrendData(data: TrendPoint[]) {
    return data.map(d => ({
        ...d,
        bandA: d.GroupA !== null && d.SDA !== null
            ? [Math.max(0, d.GroupA - d.SDA), d.GroupA + d.SDA] as [number, number]
            : null,
        bandB: d.GroupB !== null && d.SDB !== null
            ? [Math.max(0, d.GroupB - d.SDB), d.GroupB + d.SDB] as [number, number]
            : null,
        bandA_lo: d.GroupA !== null && d.SDA !== null ? Math.max(0, d.GroupA - d.SDA) : null,
        bandA_hi: d.GroupA !== null && d.SDA !== null ? d.GroupA + d.SDA : null,
        bandB_lo: d.GroupB !== null && d.SDB !== null ? Math.max(0, d.GroupB - d.SDB) : null,
        bandB_hi: d.GroupB !== null && d.SDB !== null ? d.GroupB + d.SDB : null,
    }));
}

function TrendTooltip({ active, payload, label, unitLabel, t }: { active?: boolean; payload?: any[]; label?: string; unitLabel: string; t: (key: TranslationKey) => string }) {
    if (!active || !payload?.length) return null;
    const raw = payload[0]?.payload as (TrendPoint & { bandA_lo?: number; bandA_hi?: number; bandB_lo?: number; bandB_hi?: number }) | undefined;
    if (!raw) return null;

    const groupALabel = t('dashboard.group_a');
    const groupBLabel = t('dashboard.group_b');
    const sdLabel = t('dashboard.trend.sd');
    const nLabel = t('dashboard.trend.n');

    return (
        <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px', padding: '10px 14px', color: '#e2e8f0', fontSize: '12px', minWidth: '180px' }}>
            <p style={{ fontWeight: 600, marginBottom: 8, color: '#f1f5f9' }}>{label}</p>
            {raw.GroupA !== null && (
                <div style={{ marginBottom: 6 }}>
                    <span style={{ color: '#3b82f6', fontWeight: 600 }}>{groupALabel}</span>
                    <br />
                    <span style={{ color: '#94a3b8' }}>
                        {raw.GroupA} {unitLabel}
                        {raw.SDA !== null && <> ± {raw.SDA} ({sdLabel})</>}
                    </span>
                    <br />
                    <span style={{ color: '#64748b' }}>{nLabel} = {raw.nA}</span>
                </div>
            )}
            {raw.GroupB !== null && (
                <div>
                    <span style={{ color: '#f59e0b', fontWeight: 600 }}>{groupBLabel}</span>
                    <br />
                    <span style={{ color: '#94a3b8' }}>
                        {raw.GroupB} {unitLabel}
                        {raw.SDB !== null && <> ± {raw.SDB} ({sdLabel})</>}
                    </span>
                    <br />
                    <span style={{ color: '#64748b' }}>{nLabel} = {raw.nB}</span>
                </div>
            )}
        </div>
    );
}

function TrendChart({ data, unitLabel, t }: { data: TrendPoint[]; unitLabel: string; t: (key: TranslationKey) => string }) {
    const prepared = prepareTrendData(data);

    return (
        <div>
            <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={prepared}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                        <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} />
                        <YAxis stroke="#94a3b8" fontSize={11} />
                        <Tooltip content={<TrendTooltip unitLabel={unitLabel} t={t} />} />
                        <Legend wrapperStyle={{ color: '#94a3b8', fontSize: '12px' }} />

                        {/* Banda ±DE Grupo A */}
                        <Area
                            type="monotone"
                            dataKey="bandA_hi"
                            stroke="none"
                            fill="#3b82f6"
                            fillOpacity={0.12}
                            legendType="none"
                            name="SD A hi"
                            connectNulls
                            isAnimationActive={false}
                        />
                        <Area
                            type="monotone"
                            dataKey="bandA_lo"
                            stroke="none"
                            fill="#1e293b"
                            fillOpacity={1}
                            legendType="none"
                            name="SD A lo"
                            connectNulls
                            isAnimationActive={false}
                        />

                        {/* Banda ±DE Grupo B */}
                        <Area
                            type="monotone"
                            dataKey="bandB_hi"
                            stroke="none"
                            fill="#f59e0b"
                            fillOpacity={0.12}
                            legendType="none"
                            name="SD B hi"
                            connectNulls
                            isAnimationActive={false}
                        />
                        <Area
                            type="monotone"
                            dataKey="bandB_lo"
                            stroke="none"
                            fill="#1e293b"
                            fillOpacity={1}
                            legendType="none"
                            name="SD B lo"
                            connectNulls
                            isAnimationActive={false}
                        />

                        {/* Líneas de media */}
                        <Line type="monotone" name={t('dashboard.group_a')} dataKey="GroupA" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} connectNulls />
                        <Line type="monotone" name={t('dashboard.group_b')} dataKey="GroupB" stroke="#f59e0b" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} connectNulls />
                    </ComposedChart>
                </ResponsiveContainer>
            </div>
            {/* Fila de N por visita */}
            <div className="flex mt-2 px-1" style={{ paddingLeft: '42px' }}>
                {prepared.map((d, i) => (
                    <div key={i} className="flex-1 text-center">
                        {(d.nA > 0 || d.nB > 0) && (
                            <div className="text-xs text-surface-500 leading-tight">
                                {d.nA > 0 && <span className="text-blue-400/70">A:{d.nA}</span>}
                                {d.nA > 0 && d.nB > 0 && <span className="text-surface-600 mx-0.5">/</span>}
                                {d.nB > 0 && <span className="text-amber-400/70">B:{d.nB}</span>}
                            </div>
                        )}
                    </div>
                ))}
            </div>
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
