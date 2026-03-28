'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useWizard } from '../layout';

const APEGO_OPTIONS = [
    { value: 0, label: 'Nunca / Never' },
    { value: 1, label: 'Rara vez / Rarely' },
    { value: 2, label: 'A veces / Sometimes' },
    { value: 3, label: 'Casi siempre / Almost always' },
    { value: 4, label: 'Siempre / Always' },
];

const MOTIVO_OPTIONS = [
    { value: 1, label: 'Forgetfulness' },
    { value: 2, label: 'Adverse effects' },
    { value: 3, label: 'Drug unavailability' },
    { value: 4, label: 'Own decision' },
    { value: 5, label: 'Medical indication' },
    { value: 6, label: 'Other' },
];

const SYMPTOMS = [
    { key: 'eaMareo', label: 'Dizziness' },
    { key: 'eaGi', label: 'Nausea/Vomiting' },
    { key: 'eaDolorAbd', label: 'Abdominal pain' },
    { key: 'eaApetito', label: 'Decreased appetite' },
    { key: 'eaFatiga', label: 'Weakness/Fatigue' },
    { key: 'eaDolorRenal', label: 'Lumbar/Renal pain' },
    { key: 'eaEdema', label: 'Leg edema' },
    { key: 'eaOliguria', label: 'Decreased urine output' },
    { key: 'eaEspuma', label: 'Increased foamy urine' },
    { key: 'eaIvu', label: 'Diagnosed UTI' },
    { key: 'eaAmputacion', label: 'Amputation of a limb' },
    { key: 'eaMicosis', label: 'Mycosis' },
];

const SEVERITY_OPTIONS = [
    { value: 1, label: 'Mild' },
    { value: 2, label: 'Moderate' },
    { value: 3, label: 'Severe' },
];

const RELATION_OPTIONS = [
    { value: 1, label: 'Not related' },
    { value: 2, label: 'Possible' },
    { value: 3, label: 'Probable' },
    { value: 4, label: 'Definite' },
];

export default function AdverseEventsPage() {
    const router = useRouter();
    const { visitId, participantId, visitData } = useWizard();

    const [saving, setSaving] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [saved, setSaved] = useState(false);
    const [submitted, setSubmitted] = useState(false);

    // Adherence form
    const [adherence, setAdherence] = useState({
        apegoGlobal: null as number | null,
        dosisOlvidadas7d: '' as string | number,
    });

    // AE form
    const [ae, setAe] = useState({
        eaNuevo: null as number | null,
        eaAtencion: null as number | null,
        eaSuspension: null as number | null,
        eaMareo: 0, eaGi: 0, eaDolorAbd: 0,
        eaApetito: 0, eaFatiga: 0, eaDolorRenal: 0, eaEdema: 0,
        eaOliguria: 0, eaEspuma: 0, eaIvu: 0, eaAmputacion: 0, eaMicosis: 0,
        eaSeveridad: null as number | null,
        eaRelacion: null as number | null,
        eaHosp: null as number | null,
        eaDesc: '',
        observaciones: '',
    });

    // Load existing data if resuming draft
    useEffect(() => {
        if (visitData?.visitAdherence) {
            const va = visitData.visitAdherence;
            setAdherence({
                apegoGlobal: va.apegoGlobal,
                dosisOlvidadas7d: va.dosisOlvidadas7d ?? '',
            });
        }
        if (visitData?.visitAe) {
            const va = visitData.visitAe;
            setAe(prev => ({ ...prev, ...va }));
        }
    }, [visitData]);

    const handleAdherenceChange = (field: string, value: any) => {
        setAdherence(prev => ({ ...prev, [field]: value }));
        setSaved(false);
    };

    const handleAeChange = (field: string, value: any) => {
        setAe(prev => ({ ...prev, [field]: value }));
        setSaved(false);
    };

    const toggleSymptom = (key: string) => {
        setAe(prev => ({ ...prev, [key]: (prev as any)[key] === 1 ? 0 : 1 }));
        setSaved(false);
    };

    const saveDraft = async () => {
        if (!visitId) return;
        setSaving(true);
        await fetch(`/api/visits/wizard/${visitId}/adverse-events`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                adherence: {
                    apegoGlobal: adherence.apegoGlobal,
                    dosisOlvidadas7d: adherence.dosisOlvidadas7d !== '' ? Number(adherence.dosisOlvidadas7d) : null,
                },
                adverseEvents: {
                    eaNuevo: ae.eaNuevo,
                    eaAtencion: ae.eaAtencion,
                    eaSuspension: ae.eaSuspension,
                    eaMareo: ae.eaMareo, eaGi: ae.eaGi, eaDolorAbd: ae.eaDolorAbd,
                    eaApetito: ae.eaApetito, eaFatiga: ae.eaFatiga, eaDolorRenal: ae.eaDolorRenal,
                    eaEdema: ae.eaEdema, eaOliguria: ae.eaOliguria, eaEspuma: ae.eaEspuma, eaIvu: ae.eaIvu,
                    eaAmputacion: ae.eaAmputacion, eaMicosis: ae.eaMicosis,
                    eaSeveridad: ae.eaSeveridad,
                    eaRelacion: ae.eaRelacion,
                    eaHosp: ae.eaHosp,
                    eaDesc: ae.eaDesc || null,
                    observaciones: ae.observaciones || null,
                },
            }),
        });
        setSaving(false);
        setSaved(true);
    };

    const handleSubmitVisit = async () => {
        if (!visitId) return;
        setSubmitting(true);
        await saveDraft();
        const res = await fetch(`/api/visits/wizard/${visitId}/submit`, { method: 'POST' });
        setSubmitting(false);
        if (res.ok) {
            setSubmitted(true);
            setTimeout(() => {
                router.push(`/participants/${participantId}`);
            }, 1500);
        }
    };

    const handleBack = async () => {
        await saveDraft();
        router.push(`/participants/${participantId}/visits/new/labs`);
    };

    const BinaryToggle = ({ value, onChange, yesLabel = 'Yes', noLabel = 'No' }: {
        value: number | null; onChange: (v: number) => void; yesLabel?: string; noLabel?: string;
    }) => (
        <div className="flex gap-1">
            <button
                className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all
                    ${value === 0 ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300' : 'bg-surface-700/30 border-surface-600/30 text-surface-400 hover:bg-surface-600/50'}`}
                onClick={() => onChange(0)}
            >{noLabel}</button>
            <button
                className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all
                    ${value === 1 ? 'bg-amber-500/20 border-amber-500/40 text-amber-300' : 'bg-surface-700/30 border-surface-600/30 text-surface-400 hover:bg-surface-600/50'}`}
                onClick={() => onChange(1)}
            >{yesLabel}</button>
        </div>
    );

    if (submitted) {
        return (
            <div className="card text-center py-12 animate-fade-in">
                <div className="text-5xl mb-4">✅</div>
                <h2 className="text-xl font-bold text-white mb-2">Visit Submitted Successfully</h2>
                <p className="text-surface-400">Redirecting to patient profile...</p>
            </div>
        );
    }

    return (
        <div className="space-y-4 animate-slide-up">
            <div className="flex items-center justify-between">
                <h2 className="section-title">Step 3 — Adverse Events & Adherence</h2>
                {saved && <span className="badge-success">✓ Saved</span>}
            </div>

            {/* Adherence Section */}
            <div className="card">
                <h3 className="text-sm font-semibold text-surface-300 mb-4 uppercase tracking-wider">💊 Medication Adherence</h3>
                <div className="space-y-4">
                    <div>
                        <label className="label">Has taken medication as indicated?</label>
                        <select className="select" value={adherence.apegoGlobal ?? ''} onChange={e => handleAdherenceChange('apegoGlobal', e.target.value ? Number(e.target.value) : null)}>
                            <option value="">— Select —</option>
                            {APEGO_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="label">Doses forgotten in last 7 days</label>
                            <input type="number" className="input" min="0" placeholder="0"
                                value={adherence.dosisOlvidadas7d} onChange={e => handleAdherenceChange('dosisOlvidadas7d', e.target.value)} />
                        </div>
                    </div>
                </div>
            </div>

            {/* General AE Questions */}
            <div className="card">
                <h3 className="text-sm font-semibold text-surface-300 mb-4 uppercase tracking-wider">⚠️ General</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                        <label className="label">Any new symptom since last visit?</label>
                        <BinaryToggle value={ae.eaNuevo} onChange={v => handleAeChange('eaNuevo', v)} />
                    </div>
                    <div>
                        <label className="label">Required medical attention?</label>
                        <BinaryToggle value={ae.eaAtencion} onChange={v => handleAeChange('eaAtencion', v)} />
                    </div>
                    <div>
                        <label className="label">Stopped treatment due to discomfort?</label>
                        <BinaryToggle value={ae.eaSuspension} onChange={v => handleAeChange('eaSuspension', v)} />
                    </div>
                </div>
            </div>

            {/* Symptoms Checklist */}
            <div className="card">
                <h3 className="text-sm font-semibold text-surface-300 mb-4 uppercase tracking-wider">🩹 Symptoms Checklist</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                    {SYMPTOMS.map(symptom => (
                        <button
                            key={symptom.key}
                            onClick={() => toggleSymptom(symptom.key)}
                            className={`px-3 py-2.5 rounded-lg text-xs font-medium border transition-all text-left
                                ${(ae as any)[symptom.key] === 1
                                    ? 'bg-red-500/15 border-red-500/30 text-red-300'
                                    : 'bg-surface-700/30 border-surface-600/30 text-surface-400 hover:bg-surface-600/40'
                                }`}
                        >
                            <span className="mr-1">{(ae as any)[symptom.key] === 1 ? '☑' : '☐'}</span>
                            {symptom.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* AE Classification */}
            <div className="card">
                <h3 className="text-sm font-semibold text-surface-300 mb-4 uppercase tracking-wider">📋 AE Classification</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                        <label className="label">Severity</label>
                        <select className="select" value={ae.eaSeveridad ?? ''} onChange={e => handleAeChange('eaSeveridad', e.target.value ? Number(e.target.value) : null)}>
                            <option value="">— Select —</option>
                            {SEVERITY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="label">Relationship to drug</label>
                        <select className="select" value={ae.eaRelacion ?? ''} onChange={e => handleAeChange('eaRelacion', e.target.value ? Number(e.target.value) : null)}>
                            <option value="">— Select —</option>
                            {RELATION_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="label">Required hospitalization?</label>
                        <BinaryToggle value={ae.eaHosp} onChange={v => handleAeChange('eaHosp', v)} />
                    </div>
                </div>
            </div>

            {/* Free Text */}
            <div className="card">
                <h3 className="text-sm font-semibold text-surface-300 mb-4 uppercase tracking-wider">📝 Notes</h3>
                <div className="space-y-4">
                    <div>
                        <label className="label">AE Description</label>
                        <textarea className="input min-h-[60px] resize-y" placeholder="Describe the adverse event..."
                            value={ae.eaDesc} onChange={e => handleAeChange('eaDesc', e.target.value)} />
                    </div>
                    <div>
                        <label className="label">Clinical Observations</label>
                        <textarea className="input min-h-[60px] resize-y" placeholder="Additional observations..."
                            value={ae.observaciones} onChange={e => handleAeChange('observaciones', e.target.value)} />
                    </div>
                </div>
            </div>

            {/* Actions */}
            <div className="card">
                <div className="flex items-center justify-between">
                    <button onClick={handleBack} className="btn-ghost">
                        ← Back: Labs
                    </button>
                    <div className="flex items-center gap-3">
                        <button onClick={saveDraft} disabled={saving || !visitId} className="btn-secondary">
                            {saving ? 'Saving...' : '💾 Save Draft'}
                        </button>
                        <button onClick={handleSubmitVisit} disabled={submitting || !visitId} className="btn-primary bg-gradient-to-r from-emerald-600 to-emerald-500 shadow-emerald-500/25 hover:from-emerald-500 hover:to-emerald-400">
                            {submitting ? 'Submitting...' : '✓ Submit Visit'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
