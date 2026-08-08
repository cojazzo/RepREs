'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useWizard } from '../layout';
import { useLanguage } from '@/lib/i18n/LanguageContext';

export default function AdverseEventsPage() {
    const router = useRouter();
    const { t } = useLanguage();
    const { visitId, participantId, visitData } = useWizard();

    const APEGO_OPTIONS = [
        { value: 0, label: t('visit_ae.adherence.never') },
        { value: 1, label: t('visit_ae.adherence.rarely') },
        { value: 2, label: t('visit_ae.adherence.sometimes') },
        { value: 3, label: t('visit_ae.adherence.almost_always') },
        { value: 4, label: t('visit_ae.adherence.always') },
    ];

    const MOTIVO_OPTIONS = [
        { value: 1, label: t('visit_ae.motivo.forgetfulness') },
        { value: 2, label: t('visit_ae.motivo.adverse_effects') },
        { value: 3, label: t('visit_ae.motivo.unavailability') },
        { value: 4, label: t('visit_ae.motivo.own_decision') },
        { value: 5, label: t('visit_ae.motivo.medical_indication') },
        { value: 6, label: t('visit_ae.motivo.other') },
    ];

    const SYMPTOMS = [
        { key: 'eaMareo', label: t('visit_ae.symptom.dizziness') },
        { key: 'eaGi', label: t('visit_ae.symptom.nausea') },
        { key: 'eaDolorAbd', label: t('visit_ae.symptom.abdominal_pain') },
        { key: 'eaApetito', label: t('visit_ae.symptom.appetite') },
        { key: 'eaFatiga', label: t('visit_ae.symptom.fatigue') },
        { key: 'eaDolorRenal', label: t('visit_ae.symptom.renal_pain') },
        { key: 'eaEdema', label: t('visit_ae.symptom.edema') },
        { key: 'eaOliguria', label: t('visit_ae.symptom.oliguria') },
        { key: 'eaEspuma', label: t('visit_ae.symptom.foamy_urine') },
        { key: 'eaIvu', label: t('visit_ae.symptom.uti') },
        { key: 'eaAmputacion', label: t('visit_ae.symptom.amputation') },
        { key: 'eaMicosis', label: t('visit_ae.symptom.mycosis') },
    ];

    const SEVERITY_OPTIONS = [
        { value: 1, label: t('visit_ae.severity.mild') },
        { value: 2, label: t('visit_ae.severity.moderate') },
        { value: 3, label: t('visit_ae.severity.severe') },
    ];

    const RELATION_OPTIONS = [
        { value: 1, label: t('visit_ae.relation.unrelated') },
        { value: 2, label: t('visit_ae.relation.possible') },
        { value: 3, label: t('visit_ae.relation.probable') },
        { value: 4, label: t('visit_ae.relation.definite') },
    ];

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

    const BinaryToggle = ({ value, onChange, yesLabel = t('common.yes'), noLabel = t('common.no') }: {
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
                <h2 className="text-xl font-bold text-white mb-2">{t('visit_ae.success')}</h2>
                <p className="text-surface-400">{t('visit_ae.redirecting')}</p>
            </div>
        );
    }

    return (
        <div className="space-y-4 animate-slide-up">
            <div className="flex items-center justify-between">
                <h2 className="section-title">{t('visit_ae.title')}</h2>
                {saved && <span className="badge-success">{t('common.saved')}</span>}
            </div>

            {/* Adherence Section */}
            <div className="card">
                <h3 className="text-sm font-semibold text-surface-300 mb-4 uppercase tracking-wider">{t('visit_ae.section.adherence')}</h3>
                <div className="space-y-4">
                    <div>
                        <label className="label">{t('visit_ae.adherence.taken')}</label>
                        <select className="select" value={adherence.apegoGlobal ?? ''} onChange={e => handleAdherenceChange('apegoGlobal', e.target.value ? Number(e.target.value) : null)}>
                            <option value="">{t('common.select')}</option>
                            {APEGO_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="label">{t('visit_ae.adherence.forgotten')}</label>
                            <input type="number" className="input" min="0" placeholder="0"
                                value={adherence.dosisOlvidadas7d} onChange={e => handleAdherenceChange('dosisOlvidadas7d', e.target.value)} />
                        </div>
                    </div>
                </div>
            </div>

            {/* General AE Questions */}
            <div className="card">
                <h3 className="text-sm font-semibold text-surface-300 mb-4 uppercase tracking-wider">{t('visit_ae.section.general')}</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                        <label className="label">{t('visit_ae.general.new_symptom')}</label>
                        <BinaryToggle value={ae.eaNuevo} onChange={v => handleAeChange('eaNuevo', v)} />
                    </div>
                    <div>
                        <label className="label">{t('visit_ae.general.medical_attention')}</label>
                        <BinaryToggle value={ae.eaAtencion} onChange={v => handleAeChange('eaAtencion', v)} />
                    </div>
                    <div>
                        <label className="label">{t('visit_ae.general.stopped')}</label>
                        <BinaryToggle value={ae.eaSuspension} onChange={v => handleAeChange('eaSuspension', v)} />
                    </div>
                </div>
            </div>

            {/* Symptoms Checklist */}
            <div className="card">
                <h3 className="text-sm font-semibold text-surface-300 mb-4 uppercase tracking-wider">{t('visit_ae.section.symptoms')}</h3>
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
                <h3 className="text-sm font-semibold text-surface-300 mb-4 uppercase tracking-wider">{t('visit_ae.section.classification')}</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                        <label className="label">{t('visit_ae.classification.severity')}</label>
                        <select className="select" value={ae.eaSeveridad ?? ''} onChange={e => handleAeChange('eaSeveridad', e.target.value ? Number(e.target.value) : null)}>
                            <option value="">{t('common.select')}</option>
                            {SEVERITY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="label">{t('visit_ae.classification.relation')}</label>
                        <select className="select" value={ae.eaRelacion ?? ''} onChange={e => handleAeChange('eaRelacion', e.target.value ? Number(e.target.value) : null)}>
                            <option value="">{t('common.select')}</option>
                            {RELATION_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="label">{t('visit_ae.classification.hospitalization')}</label>
                        <BinaryToggle value={ae.eaHosp} onChange={v => handleAeChange('eaHosp', v)} />
                    </div>
                </div>
            </div>

            {/* Free Text */}
            <div className="card">
                <h3 className="text-sm font-semibold text-surface-300 mb-4 uppercase tracking-wider">{t('visit_ae.section.notes')}</h3>
                <div className="space-y-4">
                    <div>
                        <label className="label">{t('visit_ae.notes.description')}</label>
                        <textarea className="input min-h-[60px] resize-y" placeholder={t('visit_ae.notes.desc_placeholder')}
                            value={ae.eaDesc} onChange={e => handleAeChange('eaDesc', e.target.value)} />
                    </div>
                    <div>
                        <label className="label">{t('visit_ae.notes.observations')}</label>
                        <textarea className="input min-h-[60px] resize-y" placeholder={t('visit_ae.notes.obs_placeholder')}
                            value={ae.observaciones} onChange={e => handleAeChange('observaciones', e.target.value)} />
                    </div>
                </div>
            </div>

            {/* Actions */}
            <div className="card">
                <div className="flex items-center justify-between">
                    <button onClick={handleBack} className="btn-ghost">
                        {t('visit_ae.btn.back')}
                    </button>
                    <div className="flex items-center gap-3">
                        <button onClick={saveDraft} disabled={saving || !visitId} className="btn-secondary">
                            {saving ? 'Saving...' : t('visit_ae.btn.save')}
                        </button>
                        <button onClick={handleSubmitVisit} disabled={submitting || !visitId} className="btn-primary bg-gradient-to-r from-emerald-600 to-emerald-500 shadow-emerald-500/25 hover:from-emerald-500 hover:to-emerald-400">
                            {submitting ? 'Submitting...' : t('visit_ae.btn.submit')}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
