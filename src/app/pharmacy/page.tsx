'use client';

import { useEffect, useState } from 'react';
import { useLanguage } from '@/lib/i18n/LanguageContext';

interface Dispensation {
    id: string; participantId: string; visitType: string; lotNumber: string;
    tabletsDispensed: number; tabletsReturned: number | null; adherenceByPillCount: number | null;
    dispensedDate: string; notes: string | null;
    participant?: { studyId: string; firstName: string; lastName: string; randomization?: { treatment: string; armLabel: string } };
}

export default function PharmacyPage() {
    const { t } = useLanguage();

    const VISIT_LABELS: Record<string, string> = { 
        BASELINE: t('visit.type.baseline'), 
        MONTH_2: t('visit.type.month2'), 
        MONTH_4: t('visit.type.month4'), 
        MONTH_6: t('visit.type.month6') 
    };
    const TREATMENT_LABELS: Record<string, string> = { 
        DAPAGLIFLOZIN_10MG: t('pharmacy.treatment.dapa'), 
        PLACEBO: t('pharmacy.treatment.placebo') 
    };

    const [dispensations, setDispensations] = useState<Dispensation[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // Dispense form
    const [showDispense, setShowDispense] = useState(false);
    const [participants, setParticipants] = useState<any[]>([]);
    const [dispForm, setDispForm] = useState({ participantId: '', visitType: 'BASELINE', lotNumber: '', tabletsDispensed: 60 });
    const [dispensing, setDispensing] = useState(false);

    // Return modal
    const [returnDisp, setReturnDisp] = useState<Dispensation | null>(null);
    const [returnForm, setReturnForm] = useState({ tabletsReturned: 0, notes: '' });
    const [returning, setReturning] = useState(false);

    const fetchData = () => {
        fetch('/api/pharmacy')
            .then(r => {
                if (r.status === 403) { setError(t('common.access_restricted')); setLoading(false); return []; }
                return r.json();
            })
            .then(d => { if (Array.isArray(d)) setDispensations(d); setLoading(false); })
            .catch(() => { setError(t('common.error')); setLoading(false); });
    };

    useEffect(() => { fetchData(); }, []);

    // Load participants list for dispense form
    const openDispense = () => {
        fetch('/api/participants').then(r => r.json()).then(d => {
            if (Array.isArray(d)) setParticipants(d);
        });
        setShowDispense(true);
    };

    // Create dispensation
    const handleDispense = async () => {
        if (!dispForm.participantId || !dispForm.lotNumber) return;
        setDispensing(true);
        await fetch('/api/pharmacy', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dispForm),
        });
        setDispensing(false);
        setShowDispense(false);
        setDispForm({ participantId: '', visitType: 'BASELINE', lotNumber: '', tabletsDispensed: 60 });
        fetchData();
    };

    // Open return modal
    const openReturn = (d: Dispensation) => {
        setReturnDisp(d);
        setReturnForm({ tabletsReturned: d.tabletsReturned ?? 0, notes: d.notes ?? '' });
    };

    // Save return
    const handleReturn = async () => {
        if (!returnDisp) return;
        setReturning(true);
        await fetch(`/api/pharmacy/${returnDisp.id}`, {
            method: 'PATCH', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(returnForm),
        });
        setReturning(false);
        setReturnDisp(null);
        fetchData();
    };

    // Stats
    const totalDispensed = dispensations.reduce((sum, d) => sum + d.tabletsDispensed, 0);
    const totalReturned = dispensations.reduce((sum, d) => sum + (d.tabletsReturned || 0), 0);
    const lotNumbers = [...new Set(dispensations.map(d => d.lotNumber))];
    const pendingReturns = dispensations.filter(d => d.tabletsReturned == null).length;

    if (error) {
        return (
            <div className="space-y-6 animate-fade-in">
                <h1 className="page-title">{t('pharmacy.title')}</h1>
                <div className="card border-red-500/30 text-center py-12">
                    <p className="text-red-400 text-lg mb-2">{t('common.access_restricted')}</p>
                    <p className="text-surface-400">{error}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="page-header">
                <div>
                    <h1 className="page-title">{t('pharmacy.title')}</h1>
                    <p className="text-surface-400 mt-1 text-sm">{t('pharmacy.subtitle')}</p>
                </div>
                <button onClick={openDispense} className="btn-primary">+ {t('pharmacy.btn.dispense')}</button>
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="card">
                    <p className="text-sm text-surface-400">{t('pharmacy.stat.dispensations')}</p>
                    <p className="text-2xl font-bold text-white mt-1">{dispensations.length}</p>
                </div>
                <div className="card">
                    <p className="text-sm text-surface-400">{t('pharmacy.stat.tablets_out')}</p>
                    <p className="text-2xl font-bold text-white mt-1">{totalDispensed}</p>
                </div>
                <div className="card">
                    <p className="text-sm text-surface-400">{t('pharmacy.stat.returned')}</p>
                    <p className="text-2xl font-bold text-white mt-1">{totalReturned}</p>
                </div>
                <div className="card">
                    <p className="text-sm text-surface-400">{t('pharmacy.stat.lots')}</p>
                    <p className="text-2xl font-bold text-white mt-1">{lotNumbers.length}</p>
                </div>
                <div className="card">
                    <p className="text-sm text-surface-400">{t('pharmacy.stat.pending')}</p>
                    <p className="text-2xl font-bold text-amber-400 mt-1">{pendingReturns}</p>
                </div>
            </div>

            {/* Dispensation Records */}
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
                                    <th className="text-left text-xs font-medium text-surface-400 uppercase tracking-wider px-6 py-3">{t('pharmacy.col.study_id')}</th>
                                    <th className="text-left text-xs font-medium text-surface-400 uppercase tracking-wider px-6 py-3">{t('pharmacy.col.treatment')}</th>
                                    <th className="text-left text-xs font-medium text-surface-400 uppercase tracking-wider px-6 py-3">{t('pharmacy.col.visit')}</th>
                                    <th className="text-left text-xs font-medium text-surface-400 uppercase tracking-wider px-6 py-3">{t('pharmacy.col.lot')}</th>
                                    <th className="text-left text-xs font-medium text-surface-400 uppercase tracking-wider px-6 py-3">{t('pharmacy.col.dispensed')}</th>
                                    <th className="text-left text-xs font-medium text-surface-400 uppercase tracking-wider px-6 py-3">{t('pharmacy.col.returned')}</th>
                                    <th className="text-left text-xs font-medium text-surface-400 uppercase tracking-wider px-6 py-3">{t('pharmacy.col.adherence')}</th>
                                    <th className="text-left text-xs font-medium text-surface-400 uppercase tracking-wider px-6 py-3">{t('pharmacy.col.date')}</th>
                                    <th className="text-right text-xs font-medium text-surface-400 uppercase tracking-wider px-6 py-3">{t('pharmacy.col.actions')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {dispensations.map(d => (
                                    <tr key={d.id} className="table-row">
                                        <td className="px-6 py-4 text-sm font-medium text-primary-400">{d.participant?.studyId}</td>
                                        <td className="px-6 py-4">
                                            {d.participant?.randomization?.treatment ? (
                                                <span className={d.participant.randomization.treatment === 'DAPAGLIFLOZIN_10MG' ? 'badge-info' : 'badge-neutral'}>
                                                    {TREATMENT_LABELS[d.participant.randomization.treatment] || d.participant.randomization.treatment}
                                                </span>
                                            ) : '—'}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-surface-300">{VISIT_LABELS[d.visitType] || d.visitType}</td>
                                        <td className="px-6 py-4 text-sm text-surface-400 font-mono">{d.lotNumber}</td>
                                        <td className="px-6 py-4 text-sm text-white font-medium">{d.tabletsDispensed}</td>
                                        <td className="px-6 py-4 text-sm">
                                            {d.tabletsReturned != null ? (
                                                <span className="text-surface-300">{d.tabletsReturned}</span>
                                            ) : (
                                                <span className="text-amber-400/60 text-xs">{t('pharmacy.pending')}</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-sm">
                                            {d.adherenceByPillCount != null
                                                ? <span className={d.adherenceByPillCount >= 80 ? 'text-emerald-400' : 'text-amber-400'}>
                                                    {d.adherenceByPillCount.toFixed(1)}%
                                                </span>
                                                : '—'}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-surface-400">{new Date(d.dispensedDate).toLocaleDateString()}</td>
                                        <td className="px-6 py-4 text-right">
                                            <button onClick={() => openReturn(d)} className="text-xs text-primary-400 hover:text-primary-300 font-medium transition-colors">
                                                {d.tabletsReturned != null ? `✏️ ${t('common.edit')}` : `📦 ${t('pharmacy.btn.record_return')}`}
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                {dispensations.length === 0 && (
                                    <tr><td colSpan={9} className="text-center text-surface-500 py-8">{t('pharmacy.empty')}</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* ═══ Dispense Modal ═══ */}
            {showDispense && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowDispense(false)}>
                    <div className="bg-surface-800 border border-surface-700/50 rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-5 animate-fade-in" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-semibold text-white">💊 {t('pharmacy.modal.new_dispensation')}</h2>
                            <button onClick={() => setShowDispense(false)} className="text-surface-500 hover:text-white text-xl">×</button>
                        </div>
                        <div>
                            <label className="label">{t('pharmacy.modal.dispense.participant')}</label>
                            <select className="select w-full" value={dispForm.participantId} onChange={e => setDispForm(f => ({ ...f, participantId: e.target.value }))}>
                                <option value="">{t('common.select')}...</option>
                                {participants.map((p: any) => <option key={p.id} value={p.id}>{p.studyId} — {p.lastName}, {p.firstName}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="label">{t('pharmacy.modal.dispense.visit')}</label>
                            <select className="select w-full" value={dispForm.visitType} onChange={e => setDispForm(f => ({ ...f, visitType: e.target.value }))}>
                                {Object.entries(VISIT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="label">{t('pharmacy.modal.dispense.lot')}</label>
                            <input className="input" placeholder="e.g. LOT-2025-A001" value={dispForm.lotNumber} onChange={e => setDispForm(f => ({ ...f, lotNumber: e.target.value }))} />
                        </div>
                        <div>
                            <label className="label">{t('pharmacy.modal.dispense.tablets')}</label>
                            <input type="number" className="input" min="1" value={dispForm.tabletsDispensed} onChange={e => setDispForm(f => ({ ...f, tabletsDispensed: parseInt(e.target.value) || 0 }))} />
                        </div>
                        <div className="flex gap-3 justify-end pt-2">
                            <button onClick={() => setShowDispense(false)} className="btn-ghost">{t('common.cancel')}</button>
                            <button onClick={handleDispense} disabled={dispensing || !dispForm.participantId || !dispForm.lotNumber} className="btn-primary">
                                {dispensing ? t('common.saving') : t('pharmacy.btn.dispense')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ═══ Record Return Modal ═══ */}
            {returnDisp && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setReturnDisp(null)}>
                    <div className="bg-surface-800 border border-surface-700/50 rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-5 animate-fade-in" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-semibold text-white">📦 {t('pharmacy.modal.record_return')}</h2>
                            <button onClick={() => setReturnDisp(null)} className="text-surface-500 hover:text-white text-xl">×</button>
                        </div>

                        <div className="bg-surface-700/30 rounded-lg p-3 space-y-1">
                            <p className="text-sm text-surface-200">{returnDisp.participant?.studyId} — {VISIT_LABELS[returnDisp.visitType]}</p>
                            <p className="text-xs text-surface-400">Lot: <span className="font-mono">{returnDisp.lotNumber}</span></p>
                            <p className="text-xs text-surface-400">{t('pharmacy.modal.dispense.tablets')}: <span className="text-white font-medium">{returnDisp.tabletsDispensed} tablets</span></p>
                        </div>

                        <div>
                            <label className="label">{t('pharmacy.modal.return.tablets')}</label>
                            <input type="number" className="input" min="0" max={returnDisp.tabletsDispensed}
                                value={returnForm.tabletsReturned}
                                onChange={e => setReturnForm(f => ({ ...f, tabletsReturned: parseInt(e.target.value) || 0 }))}
                            />
                            {/* Auto-calculated adherence preview */}
                            {returnDisp.tabletsDispensed > 0 && (
                                <div className="mt-2 text-sm">
                                    <span className="text-surface-400">{t('pharmacy.col.adherence')}: </span>
                                    <span className={((returnDisp.tabletsDispensed - returnForm.tabletsReturned) / returnDisp.tabletsDispensed * 100) >= 80 ? 'text-emerald-400 font-medium' : 'text-amber-400 font-medium'}>
                                        {((returnDisp.tabletsDispensed - returnForm.tabletsReturned) / returnDisp.tabletsDispensed * 100).toFixed(1)}%
                                    </span>
                                    <span className="text-surface-500 text-xs ml-2">({returnDisp.tabletsDispensed - returnForm.tabletsReturned} {t('pharmacy.of')} {returnDisp.tabletsDispensed} {t('pharmacy.taken')})</span>
                                </div>
                            )}
                        </div>

                        <div>
                            <label className="label">{t('pharmacy.modal.return.notes')} <span className="text-surface-500 font-normal">({t('common.optional')})</span></label>
                            <textarea className="input min-h-[60px]" placeholder={t('pharmacy.modal.return.notes_placeholder')}
                                value={returnForm.notes} onChange={e => setReturnForm(f => ({ ...f, notes: e.target.value }))} />
                        </div>

                        <div className="flex gap-3 justify-end pt-2">
                            <button onClick={() => setReturnDisp(null)} className="btn-ghost">{t('common.cancel')}</button>
                            <button onClick={handleReturn} disabled={returning} className="btn-primary">
                                {returning ? t('common.saving') : t('pharmacy.modal.return.btn.save')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
