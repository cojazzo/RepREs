'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useLanguage } from '@/lib/i18n/LanguageContext';

export default function VisitCRFPage() {
    const params = useParams();
    const router = useRouter();
    const { t } = useLanguage();
    const participantId = params.id as string;
    const visitType = params.visitType as string;

    const VISIT_LABELS: Record<string, string> = {
        BASELINE: t('visit.type.baseline') as any,
        MONTH_2: t('visit.type.month2') as any,
        MONTH_4: t('visit.type.month4') as any,
        MONTH_6: t('visit.type.month6') as any,
    };

    const [participant, setParticipant] = useState<any>(null);
    const [visit, setVisit] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [vitals, setVitals] = useState({
        weightKg: '', heightCm: '', systolicBp: '', diastolicBp: '', heartRate: '',
    });
    const [assessment, setAssessment] = useState({
        symptoms: '', physicalExamNotes: '', continuationCriteria: true, continuationNotes: '',
    });
    const [adherence, setAdherence] = useState({
        adherencePercent: '', missedDoses: '', reasonForNonAdherence: '',
    });

    useEffect(() => {
        fetch(`/api/participants/${participantId}`)
            .then(r => r.json())
            .then(data => {
                setParticipant(data);
                const v = data.visits?.find((v: any) => v.visitType === visitType);
                if (v) {
                    setVisit(v);
                    if (v.vitals) {
                        setVitals({
                            weightKg: v.vitals.weightKg?.toString() || '',
                            heightCm: v.vitals.heightCm?.toString() || '',
                            systolicBp: v.vitals.systolicBp?.toString() || '',
                            diastolicBp: v.vitals.diastolicBp?.toString() || '',
                            heartRate: v.vitals.heartRate?.toString() || '',
                        });
                    }
                    if (v.clinicalAssessment) {
                        setAssessment({
                            symptoms: v.clinicalAssessment.symptoms || '',
                            physicalExamNotes: v.clinicalAssessment.physicalExamNotes || '',
                            continuationCriteria: v.clinicalAssessment.continuationCriteria ?? true,
                            continuationNotes: v.clinicalAssessment.continuationNotes || '',
                        });
                    }
                    if (v.adherence) {
                        setAdherence({
                            adherencePercent: v.adherence.adherencePercent?.toString() || '',
                            missedDoses: v.adherence.missedDoses?.toString() || '',
                            reasonForNonAdherence: v.adherence.reasonForNonAdherence || '',
                        });
                    }
                }
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, [participantId, visitType]);

    const handleSave = async () => {
        setSaving(true);
        const bmi = vitals.weightKg && vitals.heightCm
            ? Math.round((parseFloat(vitals.weightKg) / Math.pow(parseFloat(vitals.heightCm) / 100, 2)) * 10) / 10
            : null;

        await fetch('/api/visits', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                visitId: visit.id,
                completed: true,
                vitals: {
                    weightKg: vitals.weightKg ? parseFloat(vitals.weightKg) : null,
                    heightCm: vitals.heightCm ? parseFloat(vitals.heightCm) : null,
                    bmi,
                    systolicBp: vitals.systolicBp ? parseInt(vitals.systolicBp) : null,
                    diastolicBp: vitals.diastolicBp ? parseInt(vitals.diastolicBp) : null,
                    heartRate: vitals.heartRate ? parseInt(vitals.heartRate) : null,
                },
                clinicalAssessment: {
                    symptoms: assessment.symptoms,
                    physicalExamNotes: assessment.physicalExamNotes,
                    continuationCriteria: assessment.continuationCriteria,
                    continuationNotes: assessment.continuationNotes,
                },
                adherence: {
                    adherencePercent: adherence.adherencePercent ? parseFloat(adherence.adherencePercent) : null,
                    missedDoses: adherence.missedDoses ? parseInt(adherence.missedDoses) : null,
                    reasonForNonAdherence: adherence.reasonForNonAdherence || null,
                },
            }),
        });

        setSaving(false);
        router.push(`/participants/${participantId}`);
    };

    if (loading) {
        return <div className="flex items-center justify-center h-64"><div className="animate-spin w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full" /></div>;
    }

    if (!visit) return <div className="text-surface-400">{t('visit_detail.not_found') as any}</div>;

    return (
        <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
            <div className="page-header">
                <div className="flex items-center gap-4">
                    <button onClick={() => router.back()} className="btn-ghost text-sm">← {t('common.back')}</button>
                    <div>
                        <h1 className="page-title">{VISIT_LABELS[visitType] || visitType} {t('visit_detail.title_suffix') as any}</h1>
                        <p className="text-surface-400 mt-1 text-sm">{participant?.studyId} — {participant?.lastName}, {participant?.firstName}</p>
                    </div>
                </div>
                {visit.completed && <span className="badge-success">{t('visit_detail.completed') as any}</span>}
            </div>

            {/* Vitals */}
            <div className="card">
                <h2 className="section-title">{t('visit_detail.section.vitals') as any}</h2>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div>
                        <label className="label">{t('visit_detail.vitals.weight') as any}</label>
                        <input type="number" step="0.1" className="input" value={vitals.weightKg} onChange={e => setVitals(v => ({ ...v, weightKg: e.target.value }))} />
                    </div>
                    <div>
                        <label className="label">{t('visit_detail.vitals.height') as any}</label>
                        <input type="number" step="0.1" className="input" value={vitals.heightCm} onChange={e => setVitals(v => ({ ...v, heightCm: e.target.value }))} />
                    </div>
                    <div>
                        <label className="label">{t('visit_detail.vitals.bmi') as any}</label>
                        <div className="input bg-surface-700/50 text-surface-300">
                            {vitals.weightKg && vitals.heightCm
                                ? (parseFloat(vitals.weightKg) / Math.pow(parseFloat(vitals.heightCm) / 100, 2)).toFixed(1)
                                : '—'}
                        </div>
                    </div>
                    <div>
                        <label className="label">{t('visit_detail.vitals.systolic') as any}</label>
                        <input type="number" className="input" value={vitals.systolicBp} onChange={e => setVitals(v => ({ ...v, systolicBp: e.target.value }))} />
                    </div>
                    <div>
                        <label className="label">{t('visit_detail.vitals.diastolic') as any}</label>
                        <input type="number" className="input" value={vitals.diastolicBp} onChange={e => setVitals(v => ({ ...v, diastolicBp: e.target.value }))} />
                    </div>
                    <div>
                        <label className="label">{t('visit_detail.vitals.hr') as any}</label>
                        <input type="number" className="input" value={vitals.heartRate} onChange={e => setVitals(v => ({ ...v, heartRate: e.target.value }))} />
                    </div>
                </div>
            </div>

            {/* Clinical Assessment */}
            <div className="card">
                <h2 className="section-title">{t('visit_detail.section.clinical') as any}</h2>
                <div className="space-y-4">
                    <div>
                        <label className="label">{t('visit_detail.clinical.symptoms') as any}</label>
                        <textarea className="input min-h-[80px]" placeholder={t('visit_detail.clinical.symptom_placeholder') as any}
                            value={assessment.symptoms} onChange={e => setAssessment(a => ({ ...a, symptoms: e.target.value }))} />
                    </div>
                    <div>
                        <label className="label">{t('visit_detail.clinical.exam') as any}</label>
                        <textarea className="input min-h-[80px]" placeholder={t('visit_detail.clinical.exam_placeholder') as any}
                            value={assessment.physicalExamNotes} onChange={e => setAssessment(a => ({ ...a, physicalExamNotes: e.target.value }))} />
                    </div>
                    <div className="flex items-center gap-3">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={assessment.continuationCriteria}
                                onChange={e => setAssessment(a => ({ ...a, continuationCriteria: e.target.checked }))}
                                className="w-4 h-4 rounded" />
                            <span className="text-sm text-surface-200">{t('visit_detail.clinical.continuation') as any}</span>
                        </label>
                    </div>
                    {!assessment.continuationCriteria && (
                        <div>
                            <label className="label">{t('visit_detail.clinical.discontinuation') as any}</label>
                            <textarea className="input" placeholder={t('visit_detail.clinical.discontinuation_placeholder') as any}
                                value={assessment.continuationNotes} onChange={e => setAssessment(a => ({ ...a, continuationNotes: e.target.value }))} />
                        </div>
                    )}
                </div>
            </div>

            {/* Adherence */}
            <div className="card">
                <h2 className="section-title">{t('visit_detail.section.adherence') as any}</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label className="label">{t('visit_detail.adherence.percent') as any}</label>
                        <input type="number" step="0.1" min="0" max="100" className="input"
                            value={adherence.adherencePercent} onChange={e => setAdherence(a => ({ ...a, adherencePercent: e.target.value }))} />
                    </div>
                    <div>
                        <label className="label">{t('visit_detail.adherence.missed') as any}</label>
                        <input type="number" min="0" className="input"
                            value={adherence.missedDoses} onChange={e => setAdherence(a => ({ ...a, missedDoses: e.target.value }))} />
                    </div>
                    <div>
                        <label className="label">{t('visit_detail.adherence.reason') as any}</label>
                        <input className="input" placeholder={t('visit_detail.adherence.reason_placeholder') as any}
                            value={adherence.reasonForNonAdherence} onChange={e => setAdherence(a => ({ ...a, reasonForNonAdherence: e.target.value }))} />
                    </div>
                </div>
            </div>

            {/* Save */}
            <div className="flex gap-3 justify-end">
                <button onClick={() => router.back()} className="btn-secondary">{t('common.cancel')}</button>
                <button onClick={handleSave} disabled={saving} className="btn-primary">
                    {saving ? t('common.saving') : t('visit_detail.btn.save') as any}
                </button>
            </div>
        </div>
    );
}
