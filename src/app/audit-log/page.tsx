'use client';

import { useEffect, useState } from 'react';

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
                    <h1 className="page-title">Audit Trail</h1>
                    <p className="text-surface-400 mt-1 text-sm">Complete log of all data changes with user and timestamp</p>
                </div>
            </div>

            {/* Filter */}
            <div className="flex gap-4">
                <select className="select max-w-xs" value={entityFilter} onChange={e => { setEntityFilter(e.target.value); setPage(1); }}>
                    <option value="">All Entities</option>
                    <option value="Participant">Participant</option>
                    <option value="Visit">Visit</option>
                    <option value="LabResult">Lab Result</option>
                    <option value="AdverseEvent">Adverse Event</option>
                    <option value="Dispensation">Dispensation</option>
                    <option value="DataQuery">Data Query</option>
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
                                    <th className="text-left text-xs font-medium text-surface-400 uppercase tracking-wider px-6 py-3">Timestamp</th>
                                    <th className="text-left text-xs font-medium text-surface-400 uppercase tracking-wider px-6 py-3">User</th>
                                    <th className="text-left text-xs font-medium text-surface-400 uppercase tracking-wider px-6 py-3">Action</th>
                                    <th className="text-left text-xs font-medium text-surface-400 uppercase tracking-wider px-6 py-3">Entity</th>
                                    <th className="text-left text-xs font-medium text-surface-400 uppercase tracking-wider px-6 py-3">Entity ID</th>
                                    <th className="text-left text-xs font-medium text-surface-400 uppercase tracking-wider px-6 py-3">Details</th>
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
                        <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="btn-ghost text-sm">← Prev</button>
                        <span className="text-sm text-surface-400">Page {page} of {totalPages}</span>
                        <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="btn-ghost text-sm">Next →</button>
                    </div>
                )}
            </div>
        </div>
    );
}
