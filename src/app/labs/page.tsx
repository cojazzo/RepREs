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

interface QueueItem {
    id: string;
    file: File;
    status: 'PENDING' | 'EXTRACTING' | 'AWAITING_REVIEW' | 'SAVING' | 'SAVED' | 'ERROR';
    error?: string;
    extractedData?: any;
    suggestedParticipant?: any;
    selectedParticipantId?: string;
    visitType: string;
}

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

    // ─── AI PDF Extractor state ───
    const [pdfFile, setPdfFile] = useState<File | null>(null);
    const [extracting, setExtracting] = useState(false);
    const [extractedData, setExtractedData] = useState<any>(null);
    const [extractError, setExtractError] = useState<string | null>(null);
    const [pdfVisitType, setPdfVisitType] = useState('BASELINE');
    const [savingLabs, setSavingLabs] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
    const [suggestedParticipant, setSuggestedParticipant] = useState<any>(null);

    // ─── Bulk Extractor state ───
    const [extractorMode, setExtractorMode] = useState<'single' | 'bulk'>('single');
    const [bulkQueue, setBulkQueue] = useState<QueueItem[]>([]);
    const [isProcessingQueue, setIsProcessingQueue] = useState(false);

    // Initialize PDF.js worker
    useEffect(() => {
        const initPdfWorker = async () => {
            const pdfjsLib = await import('pdfjs-dist');
            pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
        };
        initPdfWorker();
    }, []);

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

    // ─── Bulk Queue Processor ───
    useEffect(() => {
        if (!isProcessingQueue) return;
        const processNext = async () => {
            const nextIndex = bulkQueue.findIndex(q => q.status === 'PENDING');
            if (nextIndex === -1) {
                setIsProcessingQueue(false);
                return;
            }
            
            // Mark as extracting
            setBulkQueue(prev => {
                const newQ = [...prev];
                newQ[nextIndex] = { ...newQ[nextIndex], status: 'EXTRACTING' };
                return newQ;
            });

            const item = bulkQueue[nextIndex];
            
            try {
                const pdfjsLib = await import('pdfjs-dist');
                const arrayBuffer = await item.file.arrayBuffer();
                const pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
                
                let fullText = '';
                for (let i = 1; i <= pdfDoc.numPages; i++) {
                    const page = await pdfDoc.getPage(i);
                    const textContent = await page.getTextContent();
                    const pageText = textContent.items.map((it: any) => it.str).join(' ');
                    fullText += pageText + '\\n';
                }

                const res = await fetch('/api/extract-labs', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ text: fullText })
                });

                const apiData = await res.json();
                if (!res.ok) throw new Error(apiData.error || 'Failed to extract data');
                
                let match = null;
                const chmhIdObj = apiData.extractedData["No. de expediente"] || apiData.extractedData["No. de Expediente"];
                if (chmhIdObj && chmhIdObj.value) {
                   const rawId = String(chmhIdObj.value).replace(/\\s+/g, '');
                   const chmhId = rawId.replace(/^(\\d{4})(\\d{5})$/, '$1-$2');
                   match = participants.find(p => p.chmhId === chmhId || p.studyId === chmhId || p.chmhId === rawId);
                }
                
                if (!match) {
                    const nameObj = apiData.extractedData["Paciente (Nombre completo)"];
                    if (nameObj && nameObj.value) {
                        const extractedName = String(nameObj.value).toLowerCase();
                        match = participants.find(p => {
                            const fullName = `${p.firstName} ${p.lastName}`.toLowerCase();
                            return extractedName.includes(p.lastName.toLowerCase()) || fullName.includes(extractedName);
                        });
                    }
                }

                setBulkQueue(prev => {
                    const newQ = [...prev];
                    newQ[nextIndex] = {
                        ...newQ[nextIndex],
                        status: 'AWAITING_REVIEW',
                        extractedData: apiData.extractedData,
                        suggestedParticipant: match,
                        selectedParticipantId: match ? match.id : undefined
                    };
                    return newQ;
                });
            } catch (err: any) {
                setBulkQueue(prev => {
                    const newQ = [...prev];
                    newQ[nextIndex] = { ...newQ[nextIndex], status: 'ERROR', error: err.message };
                    return newQ;
                });
            }
        };
        processNext();
    }, [isProcessingQueue, bulkQueue, participants]);

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
        const eGFRRow = ['eGFR (CKD-EPI)', 'EGFR', 'Computed', 'mL/min/1.73m²'];
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

    // ─── AI Extractor Handlers ───
    const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return;
        const file = e.target.files[0];
        setPdfFile(file);
        setExtracting(true);
        setExtractError(null);
        setExtractedData(null);
        setSaveSuccess(null);
        setSuggestedParticipant(null);

        try {
            const pdfjsLib = await import('pdfjs-dist');
            const arrayBuffer = await file.arrayBuffer();
            const pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
            
            let fullText = '';
            for (let i = 1; i <= pdfDoc.numPages; i++) {
                const page = await pdfDoc.getPage(i);
                const textContent = await page.getTextContent();
                const pageText = textContent.items.map((item: any) => item.str).join(' ');
                fullText += pageText + '\\n';
            }

            const res = await fetch('/api/extract-labs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: fullText })
            });

            const apiData = await res.json();
            if (!res.ok) throw new Error(apiData.error || 'Failed to extract data');
            
            setExtractedData(apiData.extractedData);

            // Suggest participant based on CHMH ID
            const chmhIdObj = apiData.extractedData["No. de expediente"] || apiData.extractedData["No. de Expediente"];
            let match = null;
            if (chmhIdObj && chmhIdObj.value) {
               // Strip all internal spaces to handle formatting quirks like "2026- 07955"
               const rawId = String(chmhIdObj.value).replace(/\s+/g, '');
               const chmhId = rawId.replace(/^(\d{4})(\d{5})$/, '$1-$2');
               match = participants.find(p => p.chmhId === chmhId || p.studyId === chmhId || p.chmhId === rawId);
            }
            
            // If no ID match, try fuzzy name match
            if (!match) {
                const nameObj = apiData.extractedData["Paciente (Nombre completo)"];
                if (nameObj && nameObj.value) {
                    const extractedName = String(nameObj.value).toLowerCase();
                    match = participants.find(p => {
                        const fullName = `${p.firstName} ${p.lastName}`.toLowerCase();
                        return extractedName.includes(p.lastName.toLowerCase()) || fullName.includes(extractedName);
                    });
                }
            }

            if (match) {
                setSuggestedParticipant(match);
            }
        } catch (err: any) {
            setExtractError(err.message);
        } finally {
            setExtracting(false);
        }
    };

    const handleBulkUploadDrop = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return;
        const newItems: QueueItem[] = Array.from(e.target.files).map(f => ({
            id: Math.random().toString(36).substring(7),
            file: f,
            status: 'PENDING',
            visitType: 'BASELINE'
        }));
        setBulkQueue(prev => [...prev, ...newItems]);
        setIsProcessingQueue(true);
    };

    const handleSaveBulkItem = async (index: number) => {
        const item = bulkQueue[index];
        if (!item.extractedData || !item.selectedParticipantId) return;
        
        setBulkQueue(prev => {
            const newQ = [...prev];
            newQ[index] = { ...newQ[index], status: 'SAVING' };
            return newQ;
        });

        try {
            const res = await fetch('/api/save-extracted-labs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    extractedData: item.extractedData,
                    visitType: item.visitType,
                    participantId: item.selectedParticipantId
                })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed');
            
            setBulkQueue(prev => {
                const newQ = [...prev];
                newQ[index] = { ...newQ[index], status: 'SAVED' };
                return newQ;
            });
            
            if (selectedId === item.selectedParticipantId) {
                setSelectedId(''); setTimeout(() => setSelectedId(item.selectedParticipantId!), 100);
            }
        } catch (err: any) {
             setBulkQueue(prev => {
                const newQ = [...prev];
                newQ[index] = { ...newQ[index], status: 'ERROR', error: err.message };
                return newQ;
            });
        }
    };

    const handleSaveToProfile = async () => {
        if (!extractedData) return;
        setSavingLabs(true);
        setExtractError(null);
        try {
            const res = await fetch('/api/save-extracted-labs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    extractedData,
                    visitType: pdfVisitType,
                    participantId: selectedId
                })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to save to database');
            
            setSaveSuccess(data.message);
            
            // Reload participant labs to update charts!
            if (data.participantId) {
                setSelectedId(''); // reset and force reload
                setTimeout(() => setSelectedId(data.participantId), 100);
            }
        } catch (err: any) {
            setExtractError(err.message);
        } finally {
            setSavingLabs(false);
        }
    };

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

            {/* ═══════ AI PDF EXTRACTOR ═══════ */}
            <div className="card relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
                    <span className="text-8xl">🤖</span>
                </div>
                
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-6 border-b border-surface-700/50 pb-4 relative z-10">
                    <div>
                        <h2 className="section-title flex items-center gap-2 mb-1">
                            <span className="text-xl">📄</span> AI Lab Extractor
                        </h2>
                        <p className="text-sm text-surface-400">Extract labs automatically using Llama 3.</p>
                    </div>
                    
                    <div className="flex bg-surface-800/80 p-1 rounded-xl border border-surface-600/30 mt-4 md:mt-0">
                        <button 
                            onClick={() => setExtractorMode('single')}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${extractorMode === 'single' ? 'bg-primary-500 text-white shadow-md shadow-primary-500/20' : 'text-surface-400 hover:text-white hover:bg-surface-700'}`}
                        >
                            Single Upload
                        </button>
                        <button 
                            onClick={() => setExtractorMode('bulk')}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${extractorMode === 'bulk' ? 'bg-primary-500 text-white shadow-md shadow-primary-500/20' : 'text-surface-400 hover:text-white hover:bg-surface-700'}`}
                        >
                            Bulk Queue
                        </button>
                    </div>
                </div>
                
                {extractorMode === 'single' ? (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 relative z-10">
                    <div className="col-span-1 space-y-4">
                        <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-primary-500/30 border-dashed rounded-xl cursor-pointer bg-primary-500/5 hover:bg-primary-500/10 transition-colors">
                            <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                <p className="mb-2 text-sm text-primary-400 font-semibold">{extracting ? 'Extracting with Llama 3...' : 'Click to upload PDF'}</p>
                            </div>
                            <input type="file" className="hidden" accept=".pdf" onChange={handlePdfUpload} disabled={extracting} />
                        </label>
                        
                        {extractError && <div className="text-red-400 text-sm bg-red-400/10 p-3 rounded-lg">{extractError}</div>}
                        {saveSuccess && <div className="text-emerald-400 text-sm bg-emerald-400/10 p-3 rounded-lg">{saveSuccess}</div>}
                        
                        {suggestedParticipant && suggestedParticipant.id !== selectedId && (
                            <div className="bg-primary-500/10 border border-primary-500/30 p-3 rounded-xl mb-4 flex flex-col gap-2 text-sm animate-fade-in">
                                <p className="text-primary-400">
                                    <strong>💡 AI Match:</strong> Found <em>{suggestedParticipant.lastName}, {suggestedParticipant.firstName}</em> ({suggestedParticipant.chmhId})
                                </p>
                                <button 
                                    className="btn-outline-primary py-1.5 px-3 text-xs w-full font-semibold"
                                    onClick={() => {
                                        setSelectedId(suggestedParticipant.id);
                                        setParticipantSearch(`${suggestedParticipant.studyId} — ${suggestedParticipant.lastName}, ${suggestedParticipant.firstName}`);
                                    }}
                                >
                                    Click to Select This Patient
                                </button>
                            </div>
                        )}

                        {extractedData && (
                            <div className="bg-surface-800 p-4 rounded-xl border border-surface-600">
                                <label className="label mb-1">Assign to Visit</label>
                                <select className="select w-full mb-4" value={pdfVisitType} onChange={e => setPdfVisitType(e.target.value)}>
                                    <option value="BASELINE">V0 · Baseline</option>
                                    <option value="MONTH_2">V1 · Month 2</option>
                                    <option value="MONTH_4">V2 · Month 4</option>
                                    <option value="MONTH_6">V3 · Month 6</option>
                                </select>
                                <button 
                                    onClick={handleSaveToProfile} 
                                    disabled={savingLabs || !selectedId}
                                    className={`w-full shadow-lg transition-all ${
                                        !selectedId 
                                        ? 'bg-surface-700 text-surface-400 cursor-not-allowed py-2 px-4 rounded-xl' 
                                        : 'btn-primary shadow-primary-500/20'
                                    }`}
                                >
                                    {savingLabs ? 'Saving...' : !selectedId ? '⚠️ Select a Patient First' : '💾 Save to Selected Patient'}
                                </button>
                            </div>
                        )}
                    </div>
                    
                    <div className="col-span-2">
                        {extracting ? (
                            <div className="h-full min-h-[200px] flex flex-col items-center justify-center bg-surface-800 rounded-xl border border-surface-700/50">
                                <div className="animate-spin w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full mb-4" />
                                <p className="text-surface-400 animate-pulse">Running exhaustive extraction...</p>
                            </div>
                        ) : extractedData ? (
                            <div className="bg-surface-800 rounded-xl border border-surface-700/50 max-h-80 overflow-y-auto">
                                <table className="w-full text-sm">
                                    <thead className="bg-surface-800/90 sticky top-0 backdrop-blur-sm z-10 border-b border-surface-700">
                                        <tr>
                                            <th className="text-left px-4 py-3 font-medium text-surface-300">Target Field</th>
                                            <th className="text-right px-4 py-3 font-medium text-surface-300">Extracted Value</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-surface-700/50">
                                        {Object.entries(extractedData).map(([key, val]: any) => (
                                            <tr key={key} className="hover:bg-surface-700/30">
                                                <td className="px-4 py-2 text-surface-300">{key}</td>
                                                <td className="px-4 py-2 text-right">
                                                    <span className="text-white font-medium">{val?.value}</span>
                                                    <span className="text-surface-500 ml-2 text-xs">{val?.unit || ''}</span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="h-full min-h-[200px] flex flex-col items-center justify-center bg-surface-800/50 rounded-xl border border-surface-700/30 text-surface-500 border-dashed">
                                <span className="text-3xl mb-2 opacity-50">📋</span>
                                <p>Extracted data will appear here</p>
                            </div>
                        )}
                    </div>
                    </div>
                ) : (
                    <div className="relative z-10">
                        <div className="mb-6 flex gap-4 items-center">
                            <label className="btn-primary py-2 px-6 shadow-lg shadow-primary-500/20 cursor-pointer flex-shrink-0">
                                <span>➕ Select PDFs</span>
                                <input type="file" className="hidden" multiple accept=".pdf" onChange={handleBulkUploadDrop} />
                            </label>
                            <p className="text-sm text-surface-400">Select multiple PDF files. They will be processed one by one automatically.</p>
                        </div>
                        
                        {bulkQueue.length > 0 ? (
                            <div className="bg-surface-800/50 border border-surface-700/50 rounded-xl overflow-hidden">
                                <table className="w-full text-sm">
                                    <thead className="bg-surface-800 border-b border-surface-700/50 text-surface-300">
                                        <tr>
                                            <th className="px-4 py-3 text-left font-medium">File Name</th>
                                            <th className="px-4 py-3 text-left font-medium">Status</th>
                                            <th className="px-4 py-3 text-left font-medium">Extracted Match</th>
                                            <th className="px-4 py-3 text-left font-medium">Visit</th>
                                            <th className="px-4 py-3 text-right font-medium">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-surface-700/30">
                                        {bulkQueue.map((item, i) => (
                                            <tr key={item.id} className="hover:bg-surface-700/20 transition-colors">
                                                <td className="px-4 py-3 font-medium max-w-[200px] truncate" title={item.file.name}>
                                                    {item.file.name}
                                                </td>
                                                <td className="px-4 py-3">
                                                    {item.status === 'PENDING' && <span className="text-surface-400">⏳ Pending</span>}
                                                    {item.status === 'EXTRACTING' && <span className="text-primary-400 flex items-center gap-2"><div className="animate-spin w-3 h-3 border-2 border-primary-500 border-t-transparent rounded-full" /> Extracting...</span>}
                                                    {item.status === 'AWAITING_REVIEW' && <span className="text-amber-400">👀 Awaiting Review</span>}
                                                    {item.status === 'SAVING' && <span className="text-emerald-400">💾 Saving...</span>}
                                                    {item.status === 'SAVED' && <span className="text-emerald-500">✅ Saved</span>}
                                                    {item.status === 'ERROR' && <span className="text-red-400" title={item.error}>❌ Error</span>}
                                                </td>
                                                <td className="px-4 py-3">
                                                    {item.suggestedParticipant ? (
                                                        <div>
                                                            <div className="font-semibold">{item.suggestedParticipant.lastName}, {item.suggestedParticipant.firstName}</div>
                                                            <div className="text-xs text-surface-400">{item.suggestedParticipant.chmhId}</div>
                                                        </div>
                                                    ) : item.status === 'AWAITING_REVIEW' ? (
                                                        <span className="text-surface-500 italic">No match found</span>
                                                    ) : <span className="text-surface-600">—</span>}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <select 
                                                        className="select py-1 px-2 text-xs bg-surface-900 border-surface-600"
                                                        value={item.visitType}
                                                        onChange={(e) => {
                                                            const newQ = [...bulkQueue];
                                                            newQ[i].visitType = e.target.value;
                                                            setBulkQueue(newQ);
                                                        }}
                                                        disabled={item.status === 'SAVED' || item.status === 'SAVING'}
                                                    >
                                                        <option value="BASELINE">V0 · Baseline</option>
                                                        <option value="MONTH_2">V1 · Month 2</option>
                                                        <option value="MONTH_4">V2 · Month 4</option>
                                                        <option value="MONTH_6">V3 · Month 6</option>
                                                    </select>
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    {item.status === 'AWAITING_REVIEW' && item.selectedParticipantId && (
                                                        <button 
                                                            onClick={() => handleSaveBulkItem(i)}
                                                            className="btn-outline-emerald py-1 px-3 text-xs"
                                                        >
                                                            Approve & Save
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-16 border-2 border-dashed border-surface-700/50 rounded-xl bg-surface-800/30">
                                <span className="text-4xl mb-4">📂</span>
                                <h3 className="text-lg font-medium text-surface-300 mb-1">Queue is empty</h3>
                                <p className="text-surface-500 text-sm">Select multiple PDFs to begin sequential extraction.</p>
                            </div>
                        )}
                    </div>
                )}
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
