'use client';

import { useEffect, useState } from 'react';
import { useLanguage } from '@/lib/i18n/LanguageContext';

interface AE {
    id: string;
    description: string;
    severity: string;
    relation: string;
    outcome: string;
    isSAE: boolean;
    startDate: string;
    endDate?: string;
    saeDetails?: string;
    visitType?: string;
    symptoms?: string[];
    source?: 'standalone' | 'visit';
    observaciones?: string;
    participant: { studyId: string; firstName: string; lastName: string };
}

const VISIT_LABELS: Record<string, string> = { BASELINE: 'Baseline', MONTH_2: 'Month 2', MONTH_4: 'Month 4', MONTH_6: 'Month 6' };

export default function AdverseEventsPage() {
    const { t } = useLanguage();
    const [aes, setAes] = useState<AE[]>([]);
    const [loading, setLoading] = useState(true);
    const [saeOnly, setSaeOnly] = useState(false);
    const [severityFilter, setSeverityFilter] = useState('');

    useEffect(() => {
        setLoading(true);
        const params = new URLSearchParams();
        if (saeOnly) params.set('saeOnly', 'true');
        if (severityFilter) params.set('severity', severityFilter);

        fetch(`/api/adverse-events?${params}`)
            .then(r => r.json())
            .then(d => { setAes(Array.isArray(d) ? d : []); setLoading(false); })
            .catch(() => setLoading(false));
    }, [saeOnly, severityFilter]);

    const saeCount = aes.filter(ae => ae.isSAE).length;
    const visitAeCount = aes.filter(ae => ae.source === 'visit').length;

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="page-header">
                <div>
                    <h1 className="page-title">{t('ae.title')}</h1>
                    <p className="text-surface-400 mt-1 text-sm">
                        {aes.length} {t('ae.subtitle_total')} • {saeCount} {t('ae.subtitle_saes')} • {visitAeCount} {t('ae.subtitle_crf')}
                    </p>
                </div>
            </div>

            {/* Filters */}
            <div className="flex gap-4 items-center">
                <select className="select max-w-xs" value={severityFilter} onChange={e => setSeverityFilter(e.target.value)}>
                    <option value="">{t('ae.filter.all')}</option>
                    <option value="MILD">{t('ae.filter.mild')}</option>
                    <option value="MODERATE">{t('ae.filter.moderate')}</option>
                    <option value="SEVERE">{t('ae.filter.severe')}</option>
                </select>
                <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={saeOnly} onChange={e => setSaeOnly(e.target.checked)} className="w-4 h-4 rounded" />
                    <span className="text-sm text-surface-300">{t('ae.filter.sae_only')}</span>
                </label>
            </div>

            {/* SAE Alert Banner */}
            {saeCount > 0 && !saeOnly && (
                <div className="p-4 rounded-xl bg-red-500/5 border border-red-500/20 flex items-center gap-3">
                    <span className="text-xl">🚨</span>
                    <div>
                        <p className="text-red-400 font-medium">{t('ae.sae_banner.title')}</p>
                        <p className="text-sm text-surface-400">{saeCount} {t('ae.sae_banner.desc')}</p>
                    </div>
                </div>
            )}

            {/* Table */}
            <div className="card p-0 overflow-hidden">
                {loading ? (
                    <div className="flex items-center justify-center h-32">
                        <div className="animate-spin w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full" />
                    </div>
                ) : aes.length === 0 ? (
                    <div className="text-center py-12 text-surface-500">{t('ae.empty')}</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-surface-700/50 bg-surface-800/50">
                                    <th className="text-left text-xs font-medium text-surface-400 uppercase tracking-wider px-6 py-3">{t('ae.col.study_id')}</th>
                                    <th className="text-left text-xs font-medium text-surface-400 uppercase tracking-wider px-6 py-3">{t('ae.col.description')}</th>
                                    <th className="text-left text-xs font-medium text-surface-400 uppercase tracking-wider px-6 py-3">{t('ae.col.visit')}</th>
                                    <th className="text-left text-xs font-medium text-surface-400 uppercase tracking-wider px-6 py-3">{t('ae.col.severity')}</th>
                                    <th className="text-left text-xs font-medium text-surface-400 uppercase tracking-wider px-6 py-3">{t('ae.col.relation')}</th>
                                    <th className="text-left text-xs font-medium text-surface-400 uppercase tracking-wider px-6 py-3">{t('ae.col.outcome')}</th>
                                    <th className="text-left text-xs font-medium text-surface-400 uppercase tracking-wider px-6 py-3">{t('ae.col.sae')}</th>
                                    <th className="text-left text-xs font-medium text-surface-400 uppercase tracking-wider px-6 py-3">{t('ae.col.date')}</th>
                                    <th className="text-left text-xs font-medium text-surface-400 uppercase tracking-wider px-6 py-3">{t('ae.col.source')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {aes.map(ae => (
                                    <tr key={ae.id} className={`table-row ${ae.isSAE ? 'bg-red-500/5' : ''}`}>
                                        <td className="px-6 py-4 text-sm font-medium text-primary-400">{ae.participant.studyId}</td>
                                        <td className="px-6 py-4">
                                            <p className="text-sm text-surface-200">{ae.description}</p>
                                            {ae.symptoms && ae.symptoms.length > 0 && (
                                                <div className="flex flex-wrap gap-1 mt-1">
                                                    {ae.symptoms.map(s => (
                                                        <span key={s} className="text-[10px] bg-amber-500/15 text-amber-400 px-1.5 py-0.5 rounded">{s}</span>
                                                    ))}
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-surface-400">{ae.visitType ? (VISIT_LABELS[ae.visitType] || ae.visitType.replace('_', ' ')) : '—'}</td>
                                        <td className="px-6 py-4">
                                            <span className={ae.severity === 'SEVERE' ? 'badge-danger' : ae.severity === 'MODERATE' ? 'badge-warning' : 'badge-success'}>
                                                {ae.severity}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-surface-300">{ae.relation?.replace('_', ' ') || '—'}</td>
                                        <td className="px-6 py-4 text-sm text-surface-300">{ae.outcome?.replace('_', ' ') || '—'}</td>
                                        <td className="px-6 py-4">{ae.isSAE ? <span className="badge-danger">SAE</span> : '—'}</td>
                                        <td className="px-6 py-4 text-sm text-surface-400">{new Date(ae.startDate).toLocaleDateString()}</td>
                                        <td className="px-6 py-4">
                                            <span className={`text-[10px] px-2 py-0.5 rounded-full ${ae.source === 'visit'
                                                ? 'bg-blue-500/15 text-blue-400' : 'bg-surface-500/15 text-surface-400'}`}>
                                                {ae.source === 'visit' ? t('ae.source.crf') : t('ae.source.manual')}
                                            </span>
                                        </td>
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
