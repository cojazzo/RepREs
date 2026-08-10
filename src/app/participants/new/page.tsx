'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/lib/i18n/LanguageContext';

export default function EnrollParticipantPage() {
    const router = useRouter();
    const { t } = useLanguage();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [form, setForm] = useState({
        firstName: '', lastName: '', sex: 'Male', birthDate: '', curp: '', chmhId: '', phone: '',
        enrollmentDate: new Date().toISOString().split('T')[0]
    });
    const [screening, setScreening] = useState({
        acrOver30: false, acrValue1: '', acrValue2: '', acrValue3: '', informedConsent: false, willingToComply: false,
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
                        acrValue3: screening.acrValue3 ? Number(screening.acrValue3) : null,
                    },
                    enroll
                }),
            });

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || 'Failed to save');
            }
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
                    <h1 className="page-title">{t('enroll.title')}</h1>
                    <p className="text-surface-400 mt-1 text-sm">{t('enroll.subtitle')}</p>
                </div>
            </div>

            {/* Demographics */}
            <div className="card">
                <h2 className="section-title">{t('enroll.section.demographics')}</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="label">{t('enroll.field.first_name')}</label>
                        <input className="input" value={form.firstName} onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))} required />
                    </div>
                    <div>
                        <label className="label">{t('enroll.field.last_name')}</label>
                        <input className="input" value={form.lastName} onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))} required />
                    </div>
                    <div>
                        <label className="label">{t('enroll.field.sex')}</label>
                        <select className="select" value={form.sex} onChange={e => setForm(f => ({ ...f, sex: e.target.value }))}>
                            <option value="Male">{t('enroll.sex.male')}</option>
                            <option value="Female">{t('enroll.sex.female')}</option>
                        </select>
                    </div>
                    <div>
                        <label className="label">{t('enroll.field.dob')}</label>
                        <input type="date" className="input" value={form.birthDate} onChange={e => setForm(f => ({ ...f, birthDate: e.target.value }))} required />
                    </div>
                    <div>
                        <label className="label">{t('enroll.field.curp')}</label>
                        <input className="input" placeholder={t('enroll.placeholder.curp')} maxLength={18} value={form.curp} onChange={e => setForm(f => ({ ...f, curp: e.target.value.toUpperCase() }))} />
                    </div>
                    <div>
                        <label className="label">{t('enroll.field.chmh_id')}</label>
                        <input className="input" placeholder={t('enroll.placeholder.chmh')} value={form.chmhId} onChange={e => setForm(f => ({ ...f, chmhId: e.target.value }))} />
                    </div>
                    <div>
                        <label className="label">{t('enroll.field.phone')}</label>
                        <input type="tel" className="input" placeholder={t('enroll.placeholder.phone')} value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
                    </div>
                    <div>
                        <label className="label">Fecha de Visita Baseline</label>
                        <input type="date" className="input" value={form.enrollmentDate} onChange={e => setForm(f => ({ ...f, enrollmentDate: e.target.value }))} required />
                    </div>
                </div>
            </div>

            {/* Screening Checklist */}
            <div className="card">
                <h2 className="section-title">{t('enroll.section.screening')}</h2>

                <div className="mb-6">
                    <h3 className="text-sm font-medium text-surface-300 mb-3 uppercase tracking-wider">{t('enroll.inclusion.title')}</h3>
                    <div className="space-y-3">
                        {[
                            { key: 'acrOver30', label: t('enroll.inclusion.acr') },
                            { key: 'informedConsent', label: t('enroll.inclusion.consent') },
                            { key: 'willingToComply', label: t('enroll.inclusion.comply') },
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
                                    {(screening as any)[key] && <span className="ml-auto text-emerald-400 text-xs">{t('enroll.badge.met')}</span>}
                                </label>
                                {key === 'acrOver30' && (screening as any)[key] && (
                                    <div className="ml-8 grid grid-cols-1 sm:grid-cols-3 gap-4 mt-2 mb-2">
                                        <input
                                            type="number"
                                            className="input text-sm"
                                            placeholder={t('enroll.inclusion.acr1')}
                                            value={screening.acrValue1}
                                            onChange={e => setScreening(s => ({ ...s, acrValue1: e.target.value }))}
                                        />
                                        <input
                                            type="number"
                                            className="input text-sm"
                                            placeholder={t('enroll.inclusion.acr2')}
                                            value={screening.acrValue2}
                                            onChange={e => setScreening(s => ({ ...s, acrValue2: e.target.value }))}
                                        />
                                        <input
                                            type="number"
                                            className="input text-sm"
                                            placeholder={t('enroll.inclusion.acr3')}
                                            value={screening.acrValue3}
                                            onChange={e => setScreening(s => ({ ...s, acrValue3: e.target.value }))}
                                        />
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                <div>
                    <h3 className="text-sm font-medium text-surface-300 mb-3 uppercase tracking-wider">{t('enroll.exclusion.title')}</h3>
                    <div className="space-y-3">
                        {[
                            { key: 'renalImpairment', label: t('enroll.exclusion.egfr') },
                            { key: 'diabetesMellitus', label: t('enroll.exclusion.diabetes') },
                            { key: 'knownGlomerulopathy', label: t('enroll.exclusion.glomerulopathy') },
                            { key: 'pregnancy', label: t('enroll.exclusion.pregnancy') },
                            { key: 'knownAllergy', label: t('enroll.exclusion.allergy') },
                            { key: 'activeInfection', label: t('enroll.exclusion.infection') },
                            { key: 'highRiskCondition', label: t('enroll.exclusion.high_risk') },
                        ].map(({ key, label }) => (
                            <label key={key} className="flex items-center gap-3 p-3 rounded-lg bg-surface-700/30 hover:bg-surface-700/50 transition-colors cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={(screening as any)[key]}
                                    onChange={e => setScreening(s => ({ ...s, [key]: e.target.checked }))}
                                    className="w-4 h-4 rounded border-surface-500 text-red-500 focus:ring-red-500/50"
                                />
                                <span className="text-sm text-surface-200">{label}</span>
                                {(screening as any)[key] && <span className="ml-auto text-red-400 text-xs">{t('enroll.badge.excluded')}</span>}
                            </label>
                        ))}
                    </div>
                </div>

                {/* Eligibility Status */}
                <div className={`mt-6 p-4 rounded-lg border ${eligible ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-red-500/5 border-red-500/20'}`}>
                    <div className="flex items-center gap-2">
                        <span className={`text-lg ${eligible ? 'text-emerald-400' : 'text-red-400'}`}>{eligible ? '✅' : '❌'}</span>
                        <span className={`font-medium ${eligible ? 'text-emerald-400' : 'text-red-400'}`}>
                            {eligible ? t('enroll.eligible') : t('enroll.not_eligible')}
                        </span>
                    </div>
                </div>
            </div>

            {error && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{error}</div>
            )}

            {/* Actions */}
            <div className="flex gap-3 justify-end">
                <button onClick={() => router.back()} className="btn-secondary">{t('common.cancel')}</button>
                <button
                    onClick={() => handleSubmit(false)}
                    disabled={loading || !form.firstName || !form.lastName || !form.birthDate}
                    className="btn-secondary"
                >
                    {t('enroll.btn.save_screening')}
                </button>
                <button
                    onClick={() => handleSubmit(true)}
                    disabled={loading || !eligible || !form.firstName || !form.lastName || !form.birthDate}
                    className="btn-primary"
                >
                    {loading ? t('enroll.btn.processing') : t('enroll.btn.enroll')}
                </button>
            </div>
        </div>
    );
}
