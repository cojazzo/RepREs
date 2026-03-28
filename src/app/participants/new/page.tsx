'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function EnrollParticipantPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [form, setForm] = useState({
        firstName: '', lastName: '', sex: 'Male', birthDate: '', curp: '', chmhId: '', phone: '',
    });
    const [screening, setScreening] = useState({
        acrOver30: false, acrValue1: '', acrValue2: '', informedConsent: false, willingToComply: false,
        renalImpairment: false, pregnancy: false, knownAllergy: false, activeInfection: false,
        diabetesMellitus: false, knownGlomerulopathy: false, highRiskCondition: false,
    });

    const inclusionMet = screening.acrOver30 && screening.informedConsent && screening.willingToComply;
    const exclusionMet = !screening.renalImpairment && !screening.pregnancy && !screening.knownAllergy
        && !screening.activeInfection && !screening.diabetesMellitus && !screening.knownGlomerulopathy
        && !screening.highRiskCondition;
    const eligible = inclusionMet && exclusionMet;

    const handleSubmit = async (enroll: boolean) => {
        setLoading(true);
        setError('');

        try {
            const res = await fetch('/api/participants', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...form,
                    screening: {
                        ...screening,
                        acrValue1: screening.acrValue1 ? Number(screening.acrValue1) : null,
                        acrValue2: screening.acrValue2 ? Number(screening.acrValue2) : null,
                    },
                    enroll
                }),
            });

            if (!res.ok) throw new Error('Failed to save');
            const data = await res.json();
            router.push(`/participants/${data.id}`);
        } catch (e: any) {
            setError(e.message || 'An error occurred');
            setLoading(false);
        }
    };

    return (
        <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Enroll New Participant</h1>
                    <p className="text-surface-400 mt-1 text-sm">Complete screening checklist and demographics</p>
                </div>
            </div>

            {/* Demographics */}
            <div className="card">
                <h2 className="section-title">Demographics</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="label">First Name *</label>
                        <input className="input" value={form.firstName} onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))} required />
                    </div>
                    <div>
                        <label className="label">Last Name *</label>
                        <input className="input" value={form.lastName} onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))} required />
                    </div>
                    <div>
                        <label className="label">Sex *</label>
                        <select className="select" value={form.sex} onChange={e => setForm(f => ({ ...f, sex: e.target.value }))}>
                            <option value="Male">Male</option>
                            <option value="Female">Female</option>
                        </select>
                    </div>
                    <div>
                        <label className="label">Date of Birth *</label>
                        <input type="date" className="input" value={form.birthDate} onChange={e => setForm(f => ({ ...f, birthDate: e.target.value }))} required />
                    </div>
                    <div>
                        <label className="label">CURP</label>
                        <input className="input" placeholder="18-character CURP" maxLength={18} value={form.curp} onChange={e => setForm(f => ({ ...f, curp: e.target.value.toUpperCase() }))} />
                    </div>
                    <div>
                        <label className="label">CHMH ID</label>
                        <input className="input" placeholder="Hospital ID number" value={form.chmhId} onChange={e => setForm(f => ({ ...f, chmhId: e.target.value }))} />
                    </div>
                    <div>
                        <label className="label">Telephone Number</label>
                        <input type="tel" className="input" placeholder="e.g. +52 55 1234 5678" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
                    </div>
                </div>
            </div>

            {/* Screening Checklist */}
            <div className="card">
                <h2 className="section-title">Screening Checklist</h2>

                <div className="mb-6">
                    <h3 className="text-sm font-medium text-surface-300 mb-3 uppercase tracking-wider">Inclusion Criteria (all must be checked)</h3>
                    <div className="space-y-3">
                        {[
                            { key: 'acrOver30', label: 'ACR > 30 mg/g confirmed on 2 separate occasions' },
                            { key: 'informedConsent', label: 'Informed consent obtained and documented' },
                            { key: 'willingToComply', label: 'Willing and able to comply with study procedures' },
                        ].map(({ key, label }) => (
                            <div key={key}>
                                <label className="flex items-center gap-3 p-3 rounded-lg bg-surface-700/30 hover:bg-surface-700/50 transition-colors cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={(screening as any)[key]}
                                        onChange={e => setScreening(s => ({ ...s, [key]: e.target.checked }))}
                                        className="w-4 h-4 rounded border-surface-500 text-primary-500 focus:ring-primary-500/50"
                                    />
                                    <span className="text-sm text-surface-200">{label}</span>
                                    {(screening as any)[key] && <span className="ml-auto text-emerald-400 text-xs">✓ Met</span>}
                                </label>
                                {key === 'acrOver30' && (screening as any)[key] && (
                                    <div className="ml-8 grid grid-cols-2 gap-4 mt-2 mb-2">
                                        <input
                                            type="number"
                                            className="input text-sm"
                                            placeholder="ACR test 1 (mg/g)"
                                            value={screening.acrValue1}
                                            onChange={e => setScreening(s => ({ ...s, acrValue1: e.target.value }))}
                                        />
                                        <input
                                            type="number"
                                            className="input text-sm"
                                            placeholder="ACR test 2 (mg/g)"
                                            value={screening.acrValue2}
                                            onChange={e => setScreening(s => ({ ...s, acrValue2: e.target.value }))}
                                        />
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                <div>
                    <h3 className="text-sm font-medium text-surface-300 mb-3 uppercase tracking-wider">Exclusion Criteria (none should be checked)</h3>
                    <div className="space-y-3">
                        {[
                            { key: 'renalImpairment', label: 'eGFR < 60 mL/min/1.73m²' },
                            { key: 'diabetesMellitus', label: 'Diagnosis of Diabetes Mellitus' },
                            { key: 'knownGlomerulopathy', label: 'Known glomerulopathy' },
                            { key: 'pregnancy', label: 'Pregnancy or planning to become pregnant' },
                            { key: 'knownAllergy', label: 'Known allergy to study drug or excipients' },
                            { key: 'activeInfection', label: 'Active or recurrent genital/urinary infection' },
                            { key: 'highRiskCondition', label: 'Another medical condition the researcher considers high risk' },
                        ].map(({ key, label }) => (
                            <label key={key} className="flex items-center gap-3 p-3 rounded-lg bg-surface-700/30 hover:bg-surface-700/50 transition-colors cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={(screening as any)[key]}
                                    onChange={e => setScreening(s => ({ ...s, [key]: e.target.checked }))}
                                    className="w-4 h-4 rounded border-surface-500 text-red-500 focus:ring-red-500/50"
                                />
                                <span className="text-sm text-surface-200">{label}</span>
                                {(screening as any)[key] && <span className="ml-auto text-red-400 text-xs">⚠ Excluded</span>}
                            </label>
                        ))}
                    </div>
                </div>

                {/* Eligibility Status */}
                <div className={`mt-6 p-4 rounded-lg border ${eligible ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-red-500/5 border-red-500/20'}`}>
                    <div className="flex items-center gap-2">
                        <span className={`text-lg ${eligible ? 'text-emerald-400' : 'text-red-400'}`}>{eligible ? '✅' : '❌'}</span>
                        <span className={`font-medium ${eligible ? 'text-emerald-400' : 'text-red-400'}`}>
                            {eligible ? 'Participant is ELIGIBLE for enrollment' : 'Participant is NOT ELIGIBLE'}
                        </span>
                    </div>
                </div>
            </div>

            {error && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{error}</div>
            )}

            {/* Actions */}
            <div className="flex gap-3 justify-end">
                <button onClick={() => router.back()} className="btn-secondary">Cancel</button>
                <button
                    onClick={() => handleSubmit(false)}
                    disabled={loading || !form.firstName || !form.lastName || !form.birthDate}
                    className="btn-secondary"
                >
                    Save as Screening
                </button>
                <button
                    onClick={() => handleSubmit(true)}
                    disabled={loading || !eligible || !form.firstName || !form.lastName || !form.birthDate}
                    className="btn-primary"
                >
                    {loading ? 'Processing...' : 'Enroll & Randomize'}
                </button>
            </div>
        </div>
    );
}
