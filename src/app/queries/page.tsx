'use client';

import { useEffect, useState } from 'react';

interface Query {
    id: string;
    entity: string;
    entityId: string;
    field: string;
    queryText: string;
    responseText?: string;
    status: string;
    priority: string;
    createdAt: string;
    resolvedAt?: string;
    creator: { name: string; role: string };
    responder?: { name: string; role: string };
}

const STATUS_BADGE: Record<string, string> = {
    OPEN: 'badge-warning',
    RESPONDED: 'badge-info',
    RESOLVED: 'badge-success',
};

export default function QueriesPage() {
    const [queries, setQueries] = useState<Query[]>([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState('');
    const [showNew, setShowNew] = useState(false);
    const [newQuery, setNewQuery] = useState({ entity: '', entityId: '', field: '', queryText: '', priority: 'NORMAL' });
    const [responseModal, setResponseModal] = useState<Query | null>(null);
    const [responseText, setResponseText] = useState('');

    const fetchQueries = () => {
        const params = new URLSearchParams();
        if (statusFilter) params.set('status', statusFilter);
        fetch(`/api/queries?${params}`)
            .then(r => r.json())
            .then(d => { setQueries(d); setLoading(false); })
            .catch(() => setLoading(false));
    };

    useEffect(() => { fetchQueries(); }, [statusFilter]);

    const createQuery = async () => {
        await fetch('/api/queries', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newQuery),
        });
        setShowNew(false);
        setNewQuery({ entity: '', entityId: '', field: '', queryText: '', priority: 'NORMAL' });
        fetchQueries();
    };

    const respondToQuery = async (id: string) => {
        await fetch('/api/queries', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, responseText, status: 'RESPONDED' }),
        });
        setResponseModal(null);
        setResponseText('');
        fetchQueries();
    };

    const resolveQuery = async (id: string) => {
        await fetch('/api/queries', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, status: 'RESOLVED' }),
        });
        fetchQueries();
    };

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Data Queries</h1>
                    <p className="text-surface-400 mt-1 text-sm">Monitor queries workflow: Open → Responded → Resolved</p>
                </div>
                <button onClick={() => setShowNew(true)} className="btn-primary">+ New Query</button>
            </div>

            {/* Filter */}
            <div className="flex gap-4">
                <select className="select max-w-xs" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                    <option value="">All Status</option>
                    <option value="OPEN">Open</option>
                    <option value="RESPONDED">Responded</option>
                    <option value="RESOLVED">Resolved</option>
                </select>
                <div className="flex items-center gap-4 text-sm text-surface-400">
                    <span>Open: {queries.filter(q => q.status === 'OPEN').length}</span>
                    <span>Responded: {queries.filter(q => q.status === 'RESPONDED').length}</span>
                    <span>Resolved: {queries.filter(q => q.status === 'RESOLVED').length}</span>
                </div>
            </div>

            {/* New Query Form */}
            {showNew && (
                <div className="card border-primary-500/30">
                    <h2 className="section-title">New Data Query</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                        <div>
                            <label className="label">Entity</label>
                            <input className="input" placeholder="e.g. Participant, Visit..."
                                value={newQuery.entity} onChange={e => setNewQuery(q => ({ ...q, entity: e.target.value }))} />
                        </div>
                        <div>
                            <label className="label">Entity ID / Study ID</label>
                            <input className="input" placeholder="e.g. REP-0001"
                                value={newQuery.entityId} onChange={e => setNewQuery(q => ({ ...q, entityId: e.target.value }))} />
                        </div>
                        <div>
                            <label className="label">Field</label>
                            <input className="input" placeholder="e.g. systolicBp"
                                value={newQuery.field} onChange={e => setNewQuery(q => ({ ...q, field: e.target.value }))} />
                        </div>
                    </div>
                    <div className="mb-4">
                        <label className="label">Query Text</label>
                        <textarea className="input min-h-[80px]" placeholder="Describe the data query..."
                            value={newQuery.queryText} onChange={e => setNewQuery(q => ({ ...q, queryText: e.target.value }))} />
                    </div>
                    <div className="flex gap-3 justify-end">
                        <button onClick={() => setShowNew(false)} className="btn-secondary">Cancel</button>
                        <button onClick={createQuery} className="btn-primary" disabled={!newQuery.queryText}>Submit Query</button>
                    </div>
                </div>
            )}

            {/* Query List */}
            <div className="space-y-3">
                {loading ? (
                    <div className="flex items-center justify-center h-32">
                        <div className="animate-spin w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full" />
                    </div>
                ) : queries.length === 0 ? (
                    <div className="card text-center text-surface-400 py-12">No queries found.</div>
                ) : (
                    queries.map(q => (
                        <div key={q.id} className={`card ${q.status === 'OPEN' ? 'border-amber-500/20' : q.status === 'RESPONDED' ? 'border-blue-500/20' : 'border-emerald-500/20'}`}>
                            <div className="flex items-start justify-between mb-3">
                                <div className="flex items-center gap-3">
                                    <span className={STATUS_BADGE[q.status]}>{q.status}</span>
                                    <span className="text-sm text-surface-400">{q.entity} / {q.entityId}</span>
                                    <span className="text-xs text-surface-500">Field: {q.field}</span>
                                </div>
                                <span className="text-xs text-surface-500">{new Date(q.createdAt).toLocaleString()}</span>
                            </div>
                            <p className="text-sm text-surface-200 mb-2"><strong>Query:</strong> {q.queryText}</p>
                            <p className="text-xs text-surface-500 mb-2">Created by: {q.creator.name} ({q.creator.role})</p>

                            {q.responseText && (
                                <div className="p-3 rounded-lg bg-surface-700/30 mt-2">
                                    <p className="text-sm text-surface-200"><strong>Response:</strong> {q.responseText}</p>
                                    {q.responder && <p className="text-xs text-surface-500 mt-1">Responded by: {q.responder.name}</p>}
                                </div>
                            )}

                            <div className="flex gap-2 mt-3">
                                {q.status === 'OPEN' && (
                                    <button onClick={() => { setResponseModal(q); setResponseText(''); }} className="btn-secondary text-sm py-1.5">
                                        Respond
                                    </button>
                                )}
                                {q.status === 'RESPONDED' && (
                                    <button onClick={() => resolveQuery(q.id)} className="btn-primary text-sm py-1.5">
                                        Resolve
                                    </button>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Response Modal */}
            {responseModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="card max-w-lg w-full mx-4">
                        <h2 className="section-title">Respond to Query</h2>
                        <p className="text-sm text-surface-400 mb-4">{responseModal.queryText}</p>
                        <textarea className="input min-h-[100px] mb-4" placeholder="Enter your response..."
                            value={responseText} onChange={e => setResponseText(e.target.value)} />
                        <div className="flex gap-3 justify-end">
                            <button onClick={() => setResponseModal(null)} className="btn-secondary">Cancel</button>
                            <button onClick={() => respondToQuery(responseModal.id)} className="btn-primary" disabled={!responseText}>Submit Response</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
