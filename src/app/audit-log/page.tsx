'use client';

import { useEffect, useState } from 'react';
import { useLanguage } from '@/lib/i18n/LanguageContext';

interface AuditEntry {
    id: string;
    action: string;
    entity: string;
    entityId: string;
    field?: string;
    oldValue?: string;
    newValue?: string;
    createdAt: string;
    user: { name: string; email: string; role: string };
}

export default function AuditLogPage() {
    const { t } = useLanguage();
    const [logs, setLogs] = useState<AuditEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [entityFilter, setEntityFilter] = useState('');

    useEffect(() => {
        const params = new URLSearchParams({ page: page.toString(), limit: '25' });
        if (entityFilter) params.set('entity', entityFilter);

        fetch(`/api/audit?${params}`)
            .then(r => r.json())
            .then(d => { setLogs(d.logs); setTotalPages(d.totalPages); setLoading(false); })
            .catch(() => setLoading(false));
    }, [page, entityFilter]);

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="page-header">
                <div>
                    <h1 className="page-title">{t('audit.title')}</h1>
                    <p className="text-surface-400 mt-1 text-sm">{t('audit.subtitle')}</p>
                </div>
            </div>

            {/* Filter */}
            <div className="flex gap-4">
                <select className="select max-w-xs" value={entityFilter} onChange={e => { setEntityFilter(e.target.value); setPage(1); }}>
                    <option value="">{t('audit.filter.all_entities') as any}</option>
                    <option value="Participant">{t('audit.filter.participant')}</option>
                    <option value="Visit">{t('audit.filter.visit')}</option>
                    <option value="LabResult">{t('audit.filter.lab')}</option>
                    <option value="AdverseEvent">{t('audit.filter.ae')}</option>
                    <option value="Dispensation">{t('audit.filter.dispensation')}</option>
                    <option value="DataQuery">{t('audit.filter.query')}</option>
                </select>
            </div>

            {/* Table */}
            <div className="card p-0 overflow-hidden">
                {loading ? (
                    <div className="flex items-center justify-center h-32">
                        <div className="animate-spin w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full" />
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-surface-700/50 bg-surface-800/50">
                                    <th className="text-left text-xs font-medium text-surface-400 uppercase tracking-wider px-6 py-3">{t('audit.col.timestamp')}</th>
                                    <th className="text-left text-xs font-medium text-surface-400 uppercase tracking-wider px-6 py-3">{t('audit.col.user')}</th>
                                    <th className="text-left text-xs font-medium text-surface-400 uppercase tracking-wider px-6 py-3">{t('audit.col.action')}</th>
                                    <th className="text-left text-xs font-medium text-surface-400 uppercase tracking-wider px-6 py-3">{t('audit.col.entity')}</th>
                                    <th className="text-left text-xs font-medium text-surface-400 uppercase tracking-wider px-6 py-3">{t('audit.col.entity_id')}</th>
                                    <th className="text-left text-xs font-medium text-surface-400 uppercase tracking-wider px-6 py-3">{t('audit.col.details')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {logs.map(log => (
                                    <tr key={log.id} className="table-row">
                                        <td className="px-6 py-3 text-xs text-surface-400 font-mono whitespace-nowrap">{new Date(log.createdAt).toLocaleString()}</td>
                                        <td className="px-6 py-3">
                                            <div className="text-sm text-surface-200">{log.user.name}</div>
                                            <div className="text-xs text-surface-500">{log.user.role}</div>
                                        </td>
                                        <td className="px-6 py-3"><span className="badge-info">{log.action}</span></td>
                                        <td className="px-6 py-3 text-sm text-surface-300">{log.entity}</td>
                                        <td className="px-6 py-3 text-xs text-surface-400 font-mono">{log.entityId.substring(0, 8)}...</td>
                                        <td className="px-6 py-3 text-xs text-surface-400 max-w-xs truncate">
                                            {log.newValue ? log.newValue.substring(0, 100) : '—'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="flex items-center justify-center gap-2 p-4 border-t border-surface-700/50">
                        <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="btn-ghost text-sm">← {t('common.prev')}</button>
                        <span className="text-sm text-surface-400">Page {page} of {totalPages}</span>
                        <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="btn-ghost text-sm">{t('common.next_page')} →</button>
                    </div>
                )}
            </div>
        </div>
    );
}
