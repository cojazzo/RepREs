'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useWizard } from '../layout';

const GODET_OPTIONS = [
    { value: 0, label: 'None (0)' },
    { value: 1, label: '+ (1)' },
    { value: 2, label: '++ (2)' },
    { value: 3, label: '+++ (3)' },
    { value: 4, label: '++++ (4)' },
];

export default function ClinicalDataPage() {
    const router = useRouter();
    const params = useParams();
    const { visitId, participantId, visitData } = useWizard();

    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [form, setForm] = useState({
        bpSys: '' as string | number,
        bpDia: '' as string | number,
        weightKg: '' as string | number,
        heightCm: '' as string | number,
        waistCm: '' as string | number,
        hrBpm: '' as string | number,
        godet: 0,
        notes: '',
    });

    // Load existing data if resuming a draft
    useEffect(() => {
        if (visitData?.visitClinical) {
            const vc = visitData.visitClinical;
            setForm({
                bpSys: vc.bpSys ?? '',
                bpDia: vc.bpDia ?? '',
                weightKg: vc.weightKg ?? '',
                heightCm: vc.heightCm ?? '',
                waistCm: vc.waistCm ?? '',
                hrBpm: vc.hrBpm ?? '',
                godet: vc.godet ?? 0,
                notes: vc.notes ?? '',
            });
        }
    }, [visitData]);

    const bmi = form.weightKg && form.heightCm
        ? (Number(form.weightKg) / Math.pow(Number(form.heightCm) / 100, 2)).toFixed(1)
        : null;

    const handleChange = (field: string, value: string | number) => {
        setForm(prev => ({ ...prev, [field]: value }));
        setSaved(false);
    };

    const saveDraft = async () => {
        if (!visitId) return;
        setSaving(true);
        await fetch(`/api/visits/wizard/${visitId}/clinical`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                bpSys: form.bpSys ? Number(form.bpSys) : null,
                bpDia: form.bpDia ? Number(form.bpDia) : null,
                weightKg: form.weightKg ? Number(form.weightKg) : null,
                heightCm: form.heightCm ? Number(form.heightCm) : null,
                waistCm: form.waistCm ? Number(form.waistCm) : null,
                hrBpm: form.hrBpm ? Number(form.hrBpm) : null,
                godet: form.godet,
                notes: form.notes || null,
            }),
        });
        setSaving(false);
        setSaved(true);
    };

    const handleNext = async () => {
        await saveDraft();
        router.push(`/participants/${participantId}/visits/new/labs`);
    };

    return (
        <div className="card animate-slide-up">
            <div className="flex items-center justify-between mb-6">
                <h2 className="section-title mb-0">Step 1 — Clinical Data</h2>
                {saved && <span className="badge-success">✓ Saved</span>}
            </div>

            <div className="space-y-6">
                {/* Blood Pressure */}
                <div>
                    <h3 className="text-sm font-semibold text-surface-300 mb-3 uppercase tracking-wider">Blood Pressure</h3>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="label">Systolic (mmHg)</label>
                            <input
                                type="number"
                                className="input"
                                placeholder="120"
                                min="60" max="260"
                                value={form.bpSys}
                                onChange={e => handleChange('bpSys', e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="label">Diastolic (mmHg)</label>
                            <input
                                type="number"
                                className="input"
                                placeholder="80"
                                min="30" max="160"
                                value={form.bpDia}
                                onChange={e => handleChange('bpDia', e.target.value)}
                            />
                        </div>
                    </div>
                </div>

                {/* Anthropometrics */}
                <div>
                    <h3 className="text-sm font-semibold text-surface-300 mb-3 uppercase tracking-wider">Anthropometrics</h3>
                    <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                        <div>
                            <label className="label">Weight (kg)</label>
                            <input
                                type="number"
                                className="input"
                                placeholder="70.0"
                                step="0.1" min="20" max="300"
                                value={form.weightKg}
                                onChange={e => handleChange('weightKg', e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="label">Height (cm)</label>
                            <input
                                type="number"
                                className="input"
                                placeholder="170"
                                step="0.1" min="50" max="250"
                                value={form.heightCm}
                                onChange={e => handleChange('heightCm', e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="label">BMI (auto)</label>
                            <div className="input bg-surface-700/50 cursor-not-allowed text-surface-300">
                                {bmi ?? '—'}
                            </div>
                        </div>
                    </div>
                    <div className="mt-4">
                        <label className="label">Waist Circumference (cm)</label>
                        <input
                            type="number"
                            className="input max-w-xs"
                            placeholder="90.0"
                            step="0.1" min="40" max="200"
                            value={form.waistCm}
                            onChange={e => handleChange('waistCm', e.target.value)}
                        />
                    </div>
                </div>

                {/* Heart Rate + Godet */}
                <div>
                    <h3 className="text-sm font-semibold text-surface-300 mb-3 uppercase tracking-wider">Other Vitals</h3>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="label">Heart Rate (bpm)</label>
                            <input
                                type="number"
                                className="input"
                                placeholder="72"
                                min="30" max="220"
                                value={form.hrBpm}
                                onChange={e => handleChange('hrBpm', e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="label">Godet Sign (Pitting Edema)</label>
                            <select
                                className="select"
                                value={form.godet}
                                onChange={e => handleChange('godet', Number(e.target.value))}
                            >
                                {GODET_OPTIONS.map(opt => (
                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>

                {/* Notes */}
                <div>
                    <label className="label">Notes (optional)</label>
                    <textarea
                        className="input min-h-[80px] resize-y"
                        placeholder="Additional clinical notes..."
                        value={form.notes}
                        onChange={e => handleChange('notes', e.target.value)}
                    />
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between pt-4 border-t border-surface-700/50">
                    <button onClick={saveDraft} disabled={saving || !visitId} className="btn-secondary">
                        {saving ? 'Saving...' : '💾 Save Draft'}
                    </button>
                    <button onClick={handleNext} disabled={!visitId} className="btn-primary">
                        Next: Labs →
                    </button>
                </div>
            </div>
        </div>
    );
}
