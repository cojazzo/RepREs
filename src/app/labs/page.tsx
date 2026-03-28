'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import * as XLSX from 'xlsx';

// ─── Types ───
interface Visit { visitId: string; visitType: string; visitDate: string | null }
interface Analyte { code: string; name: string; category: string | null; type: string; unit: string | null; coding: string | null }
interface ResultEntry { visitId: string; value: string | null; unit: string | null }
interface ComputedPoint { visitId: string; value: number }
interface Participant { id: string; studyId: string; firstName: string; lastName: string; status: string }

interface LabsSummary {
    participant: { id: string; studyId: string; firstName: string; lastName: string; sex: string; birthDate: string };
    visits: Visit[];
    analytes: Analyte[];
    results: Record<string, ResultEntry[]>;
    computed: { eGFR: ComputedPoint[]; ACR: ComputedPoint[] };
}

const VISIT_LABELS: Record<string, string> = {
    BASELINE: 'V0 · Baseline', MONTH_2: 'V1 · Month 2', MONTH_4: 'V2 · Month 4', MONTH_6: 'V3 · Month 6',
};
const VISIT_SHORT: Record<string, string> = {
    BASELINE: 'V0', MONTH_2: 'V1', MONTH_4: 'V2', MONTH_6: 'V3',
};
const KIDNEY_CODES = new Set(['ACR', 'CRE_S', 'ALB_U', 'CRE_U', 'MALB', 'CISTC']);
const TOOLTIP_STYLE = { backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#e2e8f0' };

export default function LabsPage() {
    // ─── Participant selector state ───
    const [participants, setParticipants] = useState<Participant[]>([]);
    const [participantSearch, setParticipantSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [selectedId, setSelectedId] = useState('');
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [loadingList, setLoadingList] = useState(true);

    // ─── Labs summary state ───
    const [data, setData] = useState<LabsSummary | null>(null);
    const [loadingSummary, setLoadingSummary] = useState(false);
    const [search, setSearch] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('');
    const [selectedAnalyte, setSelectedAnalyte] = useState('');
    const [activeTab, setActiveTab] = useState<'kidney' | 'other' | 'table'>('kidney');

    // ─── Load participants ───
    useEffect(() => {
        fetch('/api/participants')
            .then(r => r.json())
            .then(d => { setParticipants(d); setLoadingList(false); })
            .catch(() => setLoadingList(false));
    }, []);

    // ─── Load labs summary when participant is selected ───
    useEffect(() => {
        if (!selectedId) { setData(null); return; }
        setLoadingSummary(true);
        fetch(`/api/participants/${selectedId}/labs/summary`)
            .then(r => r.json())
            .then(d => { setData(d); setLoadingSummary(false); })
            .catch(() => setLoadingSummary(false));
    }, [selectedId]);

    // ─── Filtered participants ───
    const filteredParticipants = useMemo(() => {
        let list = participants;
        if (statusFilter) list = list.filter(p => p.status === statusFilter);
        if (participantSearch.trim()) {
            const q = participantSearch.toLowerCase();
            list = list.filter(p =>
                p.studyId.toLowerCase().includes(q) ||
                p.firstName.toLowerCase().includes(q) ||
                p.lastName.toLowerCase().includes(q)
            );
        }
        return list;
    }, [participants, participantSearch, statusFilter]);

    // ─── Labs derived data ───
    const categories = useMemo(() => {
        if (!data) return [];
        return Array.from(new Set(data.analytes.map(a => a.category || 'Other'))).sort();
    }, [data]);

    const filteredAnalytes = useMemo(() => {
        if (!data) return [];
        let list = data.analytes;

        // Filter out unwanted CBC codes globally
        const cbcKeepCodes = new Set(['WBC', 'NEU_PCT', 'LINF_PCT', 'MONO_PCT', 'EOS_PCT', 'BASO_PCT', 'HGB', 'HTO', 'PLT']);
        list = list.filter(a => {
            const cat = a.category || 'Other';
            if (cat === 'CBC') return cbcKeepCodes.has(a.code);
            return true;
        });

        if (search.trim()) {
            const q = search.toLowerCase();
            list = list.filter(a => a.name.toLowerCase().includes(q) || a.code.toLowerCase().includes(q));
        }
        if (categoryFilter) list = list.filter(a => (a.category || 'Other') === categoryFilter);
        return list;
    }, [data, search, categoryFilter]);

    const kidneyAnalytes = useMemo(() => filteredAnalytes.filter(a => KIDNEY_CODES.has(a.code)), [filteredAnalytes]);
    const otherAnalytes = useMemo(() => filteredAnalytes.filter(a => !KIDNEY_CODES.has(a.code)), [filteredAnalytes]);
    const numericOtherAnalytes = useMemo(() => otherAnalytes.filter(a => a.type === 'Numerico'), [otherAnalytes]);

    // ─── Chart helpers ───
    const buildChartData = useCallback((series: ComputedPoint[]) => {
        if (!data) return [];
        return data.visits.map(v => {
            const pt = series.find(s => s.visitId === v.visitId);
            const label = VISIT_SHORT[v.visitType] || v.visitType;
            const date = v.visitDate ? new Date(v.visitDate).toLocaleDateString() : '';
            return { name: `${label}\n${date}`, value: pt?.value ?? null, visitLabel: VISIT_LABELS[v.visitType] || v.visitType, date };
        });
    }, [data]);

    const buildAnalyteChartData = useCallback((code: string) => {
        if (!data) return [];
        const entries = data.results[code] || [];
        return data.visits.map(v => {
            const entry = entries.find(e => e.visitId === v.visitId);
            const label = VISIT_SHORT[v.visitType] || v.visitType;
            const date = v.visitDate ? new Date(v.visitDate).toLocaleDateString() : '';
            const numVal = entry?.value ? parseFloat(entry.value) : null;
            return { name: `${label}\n${date}`, value: !isNaN(numVal as number) ? numVal : null, visitLabel: VISIT_LABELS[v.visitType] || v.visitType, date };
        });
    }, [data]);

    const getCellValue = useCallback((code: string, visitId: string) => {
        if (!data) return null;
        return (data.results[code] || []).find(e => e.visitId === visitId)?.value ?? null;
    }, [data]);

    const getCellUnit = useCallback((code: string, visitId: string) => {
        if (!data) return null;
        return (data.results[code] || []).find(e => e.visitId === visitId)?.unit ?? null;
    }, [data]);

    const getChangeFromBaseline = useCallback((code: string) => {
        if (!data || data.visits.length < 2) return null;
        const entries = data.results[code] || [];
        const baseline = entries.find(e => e.visitId === data.visits[0].visitId);
        const latest = entries.find(e => e.visitId === data.visits[data.visits.length - 1].visitId);
        if (!baseline?.value || !latest?.value) return null;
        const bv = parseFloat(baseline.value), lv = parseFloat(latest.value);
        if (isNaN(bv) || isNaN(lv) || bv === 0) return null;
        return { abs: Math.round((lv - bv) * 100) / 100, pct: Math.round(((lv - bv) / bv) * 1000) / 10 };
    }, [data]);

    // ─── Export ───
    const exportData = useCallback((format: 'csv' | 'xlsx') => {
        if (!data) return;
        const header = ['Analyte', 'Code', 'Category', 'Unit', ...data.visits.map(v => {
            const label = VISIT_SHORT[v.visitType] || v.visitType;
            const date = v.visitDate ? new Date(v.visitDate).toLocaleDateString() : '';
            return `${label} (${date})`;
        })];
        const rows = data.analytes.map(a => {
            const row = [a.name, a.code, a.category || '', a.unit || ''];
            data.visits.forEach(v => row.push(getCellValue(a.code, v.visitId) ?? ''));
            return row;
        });
        // Computed rows at top
        const eGFRRow = ['eGFR (CKD-EPI)', 'EGFR_CALC', 'Computed', 'mL/min/1.73m²'];
        data.visits.forEach(v => { const pt = data.computed.eGFR.find(e => e.visitId === v.visitId); eGFRRow.push(pt ? String(pt.value) : ''); });
        rows.unshift(eGFRRow);
        const acrRow = ['ACR (Computed)', 'ACR_CALC', 'Computed', 'mg/g'];
        data.visits.forEach(v => { const pt = data.computed.ACR.find(e => e.visitId === v.visitId); acrRow.push(pt ? String(pt.value) : ''); });
        rows.unshift(acrRow);

        if (format === 'csv') {
            const csv = [header, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a'); a.href = url; a.download = `labs_${data.participant.studyId}.csv`; a.click();
            URL.revokeObjectURL(url);
        } else {
            const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Labs Summary');
            XLSX.writeFile(wb, `labs_${data.participant.studyId}.xlsx`);
        }
    }, [data, getCellValue]);

    const selectedAnalyteObj = data?.analytes.find(a => a.code === selectedAnalyte);

    // ─── Render ───
    return (
        <div className="space-y-6 animate-fade-in">
            {/* ═══════ PAGE HEADER ═══════ */}
            <div className="page-header">
                <div>
                    <h1 className="page-title">Laboratory Results</h1>
                    <p className="text-surface-400 mt-1 text-sm">Longitudinal lab comparison across visits per participant</p>
                </div>
                {data && (
                    <div className="flex items-center gap-2">
                        <button onClick={() => exportData('csv')} className="btn-secondary text-sm">📥 CSV</button>
                        <button onClick={() => exportData('xlsx')} className="btn-secondary text-sm">📥 Excel</button>
                    </div>
                )}
            </div>

            {/* ═══════ PARTICIPANT SELECTOR ═══════ */}
            <div className="card">
                <label className="label mb-1">Select Participant</label>
                <div className="relative z-10">
                    <div className="flex gap-3">
                        <div className="flex-1 relative">
                            <input
                                type="text"
                                className="input"
                                placeholder="🔍 Search by ID, name..."
                                value={participantSearch}
                                onChange={e => { setParticipantSearch(e.target.value); setDropdownOpen(true); }}
                                onFocus={() => setDropdownOpen(true)}
                            />
                            {/* Dropdown */}
                            {dropdownOpen && (
                                <>
                                    <div className="fixed inset-0 z-40" onClick={() => setDropdownOpen(false)} />
                                    <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-surface-800 border border-surface-600/50 rounded-xl shadow-2xl shadow-black/40 max-h-64 overflow-y-auto">
                                        {loadingList ? (
                                            <div className="flex justify-center py-4"><div className="animate-spin w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full" /></div>
                                        ) : filteredParticipants.length === 0 ? (
                                            <p className="text-surface-500 text-sm text-center py-4">No participants found</p>
                                        ) : (
                                            filteredParticipants.map(p => (
                                                <button
                                                    key={p.id}
                                                    onClick={() => { setSelectedId(p.id); setDropdownOpen(false); setParticipantSearch(`${p.studyId} — ${p.lastName}, ${p.firstName}`); }}
                                                    className={`w-full text-left px-4 py-2.5 flex items-center justify-between transition-colors
                                                        ${selectedId === p.id ? 'bg-primary-500/15 text-primary-400' : 'text-surface-200 hover:bg-surface-700/60'}`}
                                                >
                                                    <div>
                                                        <span className="font-semibold text-sm">{p.studyId}</span>
                                                        <span className="text-surface-400 text-sm ml-2">{p.lastName}, {p.firstName}</span>
                                                    </div>
                                                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${p.status === 'ACTIVE' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-surface-600/40 text-surface-400'}`}>
                                                        {p.status}
                                                    </span>
                                                </button>
                                            ))
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                        <select className="select max-w-[160px]" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                            <option value="">All Statuses</option>
                            <option value="ACTIVE">Active</option>
                            <option value="COMPLETED">Completed</option>
                            <option value="SCREENING">Screening</option>
                            <option value="WITHDRAWN">Withdrawn</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* ═══════ NO SELECTION PLACEHOLDER ═══════ */}
            {!selectedId && (
                <div className="card text-center py-16">
                    <div className="text-4xl mb-3">🔬</div>
                    <p className="text-surface-400">Select a participant above to view their longitudinal lab summary</p>
                </div>
            )}

            {/* ═══════ LOADING ═══════ */}
            {selectedId && loadingSummary && (
                <div className="card flex items-center justify-center py-16">
                    <div className="animate-spin w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full" />
                </div>
            )}

            {/* ═══════ LABS SUMMARY ═══════ */}
            {data && !loadingSummary && (
                <>
                    {/* Patient info bar */}
                    <div className="flex items-center justify-between px-1">
                        <p className="text-sm text-surface-300">
                            <span className="font-semibold text-white">{data.participant.studyId}</span>
                            {' — '}{data.participant.lastName}, {data.participant.firstName}
                            {' · '}{data.visits.length} submitted visit{data.visits.length !== 1 ? 's' : ''}
                        </p>
                    </div>

                    {/* Section Tabs */}
                    <div className="flex gap-1 bg-surface-800/60 p-1 rounded-xl w-fit">
                        {([['kidney', '🫘 Kidney Trends'], ['other', '📊 Other Labs'], ['table', '📋 Pivot Table']] as const).map(([tab, label]) => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === tab
                                    ? 'bg-primary-500/15 text-primary-400 shadow-sm'
                                    : 'text-surface-400 hover:text-surface-200 hover:bg-surface-700/50'
                                    }`}
                            >
                                {label}
                            </button>
                        ))}
                    </div>

                    {/* ═══ KIDNEY TRENDS ═══ */}
                    {activeTab === 'kidney' && (
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                {/* ACR */}
                                <div className="card">
                                    <div className="flex items-center justify-between mb-4">
                                        <h2 className="section-title mb-0">ACR Trend</h2>
                                        <span className="text-xs text-surface-500">mg/g</span>
                                    </div>
                                    {data.computed.ACR.length > 0 ? (
                                        <div className="h-56">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <LineChart data={buildChartData(data.computed.ACR)}>
                                                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                                                    <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} />
                                                    <YAxis stroke="#94a3b8" fontSize={11} />
                                                    <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => [`${v} mg/g`, 'ACR']}
                                                        labelFormatter={(_, payload) => payload?.[0]?.payload?.visitLabel || ''} />
                                                    <ReferenceLine y={30} stroke="#f59e0b" strokeDasharray="3 3" label={{ value: 'A2', position: 'right', fill: '#f59e0b', fontSize: 10 }} />
                                                    <ReferenceLine y={300} stroke="#ef4444" strokeDasharray="3 3" label={{ value: 'A3', position: 'right', fill: '#ef4444', fontSize: 10 }} />
                                                    <Line type="monotone" dataKey="value" stroke="#f59e0b" strokeWidth={2.5} dot={{ fill: '#f59e0b', r: 5, strokeWidth: 2, stroke: '#1e293b' }} connectNulls />
                                                </LineChart>
                                            </ResponsiveContainer>
                                        </div>
                                    ) : <p className="text-surface-500 text-sm py-8 text-center">No ACR data available</p>}
                                </div>
                                {/* eGFR */}
                                <div className="card">
                                    <div className="flex items-center justify-between mb-4">
                                        <h2 className="section-title mb-0">eGFR Trend</h2>
                                        <span className="text-xs text-surface-500">mL/min/1.73m²</span>
                                    </div>
                                    {data.computed.eGFR.length > 0 ? (
                                        <div className="h-56">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <LineChart data={buildChartData(data.computed.eGFR)}>
                                                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                                                    <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} />
                                                    <YAxis stroke="#94a3b8" fontSize={11} domain={[0, 'auto']} />
                                                    <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => [`${v} mL/min/1.73m²`, 'eGFR']}
                                                        labelFormatter={(_, payload) => payload?.[0]?.payload?.visitLabel || ''} />
                                                    <ReferenceLine y={90} stroke="#22c55e" strokeDasharray="3 3" label={{ value: 'G1', position: 'right', fill: '#22c55e', fontSize: 10 }} />
                                                    <ReferenceLine y={60} stroke="#f59e0b" strokeDasharray="3 3" label={{ value: 'G3a', position: 'right', fill: '#f59e0b', fontSize: 10 }} />
                                                    <ReferenceLine y={30} stroke="#ef4444" strokeDasharray="3 3" label={{ value: 'G4', position: 'right', fill: '#ef4444', fontSize: 10 }} />
                                                    <Line type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={2.5} dot={{ fill: '#3b82f6', r: 5, strokeWidth: 2, stroke: '#1e293b' }} connectNulls />
                                                </LineChart>
                                            </ResponsiveContainer>
                                        </div>
                                    ) : <p className="text-surface-500 text-sm py-8 text-center">No eGFR data — enter serum creatinine to compute</p>}
                                </div>
                            </div>
                            <div className="card">
                                <h2 className="section-title">Kidney-Relevant Labs</h2>
                                <PivotTable analytes={kidneyAnalytes} visits={data.visits} getCellValue={getCellValue} getCellUnit={getCellUnit} computed={data.computed} />
                            </div>
                        </div>
                    )}

                    {/* ═══ OTHER LABS ═══ */}
                    {activeTab === 'other' && (
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            <div className="card lg:col-span-1">
                                <h3 className="section-title">Select Analyte</h3>
                                <input type="text" className="input mb-3" placeholder="Search analytes..." value={search} onChange={e => setSearch(e.target.value)} />
                                <div className="space-y-1 max-h-96 overflow-y-auto pr-1">
                                    {numericOtherAnalytes.map(a => {
                                        const change = getChangeFromBaseline(a.code);
                                        return (
                                            <button key={a.code} onClick={() => setSelectedAnalyte(a.code)}
                                                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all ${selectedAnalyte === a.code
                                                    ? 'bg-primary-500/15 text-primary-400 border border-primary-500/30'
                                                    : 'text-surface-300 hover:bg-surface-700/50 border border-transparent'}`}>
                                                <span className="font-medium">{a.name}</span>
                                                <div className="flex items-center gap-2 mt-0.5">
                                                    <span className="text-xs text-surface-500">{a.code}</span>
                                                    {a.unit && <span className="text-xs text-surface-500">· {a.unit}</span>}
                                                    {change && (
                                                        <span className={`text-xs font-medium ${change.abs >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                                            {change.abs >= 0 ? '↑' : '↓'}{Math.abs(change.pct)}%
                                                        </span>
                                                    )}
                                                </div>
                                            </button>
                                        );
                                    })}
                                    {numericOtherAnalytes.length === 0 && <p className="text-surface-500 text-sm text-center py-4">No numeric analytes match</p>}
                                </div>
                            </div>
                            <div className="card lg:col-span-2">
                                {selectedAnalyte && selectedAnalyteObj ? (
                                    <>
                                        <div className="flex items-center justify-between mb-4">
                                            <h3 className="section-title mb-0">{selectedAnalyteObj.name} Trend</h3>
                                            <span className="text-xs text-surface-500">{selectedAnalyteObj.unit || ''}</span>
                                        </div>
                                        {(() => {
                                            const c = getChangeFromBaseline(selectedAnalyte); return c ? (
                                                <div className="flex items-center gap-4 mb-4">
                                                    <span className={`text-sm font-semibold ${c.abs >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{c.abs >= 0 ? '+' : ''}{c.abs} ({c.abs >= 0 ? '+' : ''}{c.pct}%)</span>
                                                    <span className="text-xs text-surface-500">from baseline</span>
                                                </div>) : null;
                                        })()}
                                        <div className="h-64">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <LineChart data={buildAnalyteChartData(selectedAnalyte)}>
                                                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                                                    <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} />
                                                    <YAxis stroke="#94a3b8" fontSize={11} />
                                                    <Tooltip contentStyle={TOOLTIP_STYLE}
                                                        formatter={(v: number) => [`${v} ${selectedAnalyteObj.unit || ''}`, selectedAnalyteObj.name]}
                                                        labelFormatter={(_, payload) => payload?.[0]?.payload?.visitLabel || ''} />
                                                    <Line type="monotone" dataKey="value" stroke="#8b5cf6" strokeWidth={2.5}
                                                        dot={{ fill: '#8b5cf6', r: 5, strokeWidth: 2, stroke: '#1e293b' }} connectNulls />
                                                </LineChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </>
                                ) : (
                                    <div className="flex items-center justify-center h-64 text-surface-500">
                                        <p>Select an analyte from the list to view its trend</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* ═══ PIVOT TABLE ═══ */}
                    {activeTab === 'table' && (
                        <div className="space-y-4">
                            <div className="card">
                                <div className="flex flex-wrap gap-3">
                                    <div className="flex-1 min-w-[200px]">
                                        <input type="text" className="input" placeholder="Search analytes by name or code..." value={search} onChange={e => setSearch(e.target.value)} />
                                    </div>
                                    <select className="select max-w-xs" value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
                                        <option value="">All Categories</option>
                                        {categories.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                </div>
                            </div>
                            {kidneyAnalytes.length > 0 && (
                                <div className="card">
                                    <h2 className="section-title">🫘 Kidney Relevant</h2>
                                    <PivotTable analytes={kidneyAnalytes} visits={data.visits} getCellValue={getCellValue} getCellUnit={getCellUnit} computed={data.computed} />
                                </div>
                            )}
                            {otherAnalytes.length > 0 && (
                                <div className="card">
                                    <h2 className="section-title">🔬 Other Labs</h2>
                                    <PivotTable analytes={otherAnalytes} visits={data.visits} getCellValue={getCellValue} getCellUnit={getCellUnit} />
                                </div>
                            )}
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

// ─── Pivot Table ───
function PivotTable({ analytes, visits, getCellValue, getCellUnit, computed }: {
    analytes: Analyte[]; visits: Visit[];
    getCellValue: (code: string, visitId: string) => string | null;
    getCellUnit: (code: string, visitId: string) => string | null;
    computed?: { eGFR: ComputedPoint[]; ACR: ComputedPoint[] };
}) {
    return (
        <div className="overflow-x-auto -mx-6 px-6">
            <table className="w-full min-w-[600px]">
                <thead>
                    <tr className="border-b border-surface-700/50">
                        <th className="text-left text-xs font-semibold text-surface-300 px-3 py-2 sticky left-0 bg-surface-800/90 backdrop-blur-sm z-10 min-w-[180px]">Analyte</th>
                        {visits.map(v => (
                            <th key={v.visitId} className="text-center text-xs font-medium text-surface-400 px-3 py-2 min-w-[100px]">
                                <div>{VISIT_SHORT[v.visitType] || v.visitType}</div>
                                <div className="text-[10px] text-surface-500">{v.visitDate ? new Date(v.visitDate).toLocaleDateString() : '—'}</div>
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {computed?.eGFR && computed.eGFR.length > 0 && (
                        <tr className="border-b border-surface-700/30 bg-primary-500/5">
                            <td className="px-3 py-2 sticky left-0 bg-primary-500/5 backdrop-blur-sm z-10">
                                <span className="text-sm font-medium text-primary-400">eGFR (CKD-EPI)</span>
                                <span className="text-xs text-surface-500 ml-1">mL/min/1.73m²</span>
                            </td>
                            {visits.map(v => {
                                const pt = computed!.eGFR.find(e => e.visitId === v.visitId);
                                return <td key={v.visitId} className="text-center px-3 py-2">{pt ? <span className="text-sm font-medium text-white">{pt.value}</span> : <span className="text-surface-600">—</span>}</td>;
                            })}
                        </tr>
                    )}
                    {computed?.ACR && computed.ACR.length > 0 && (
                        <tr className="border-b border-surface-700/30 bg-primary-500/5">
                            <td className="px-3 py-2 sticky left-0 bg-primary-500/5 backdrop-blur-sm z-10">
                                <span className="text-sm font-medium text-primary-400">ACR (Computed)</span>
                                <span className="text-xs text-surface-500 ml-1">mg/g</span>
                            </td>
                            {visits.map(v => {
                                const pt = computed!.ACR.find(e => e.visitId === v.visitId);
                                return <td key={v.visitId} className="text-center px-3 py-2">{pt ? <span className="text-sm font-medium text-white">{pt.value}</span> : <span className="text-surface-600">—</span>}</td>;
                            })}
                        </tr>
                    )}
                    {analytes.map(a => (
                        <tr key={a.code} className="border-b border-surface-700/30 hover:bg-surface-700/20 transition-colors">
                            <td className="px-3 py-2 sticky left-0 bg-surface-800/90 backdrop-blur-sm z-10">
                                <div className="text-sm text-surface-200">{a.name}</div>
                                <div className="text-[10px] text-surface-500">{a.code}{a.unit ? ` · ${a.unit}` : ''}</div>
                            </td>
                            {visits.map(v => {
                                const val = getCellValue(a.code, v.visitId);
                                const unit = getCellUnit(a.code, v.visitId);
                                return (
                                    <td key={v.visitId} className="text-center px-3 py-2">
                                        {val != null ? (
                                            <div>
                                                <span className="text-sm font-medium text-white">{val}</span>
                                                {unit && unit !== a.unit && <span className="text-[10px] text-amber-400 ml-1" title="Unit differs">⚠</span>}
                                            </div>
                                        ) : <span className="text-surface-600">—</span>}
                                    </td>
                                );
                            })}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
