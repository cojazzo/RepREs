'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useWizard } from '../layout';

interface Analyte {
    id: string;
    code: string;
    name: string;
    type: string;
    unit: string | null;
    coding: string | null;
    category: string | null;
    sortOrder: number;
}

const CATEGORY_ORDER = [
    'CBC', 'Chemistry', 'Lipids', 'Complements', 'Electrolytes',
    'Special Chemistry', 'Urinalysis', 'Urine Electrolytes',
    'Albumin/Creatinine', 'Endocrine/Vit D',
];

export default function LabsPage() {
    const router = useRouter();
    const { visitId, participantId, participant, visitData } = useWizard();

    const [analytes, setAnalytes] = useState<Analyte[]>([]);
    const [values, setValues] = useState<Record<string, string>>({});
    const [search, setSearch] = useState('');
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(true);

    // Load analyte catalog
    useEffect(() => {
        fetch('/api/lab-analytes')
            .then(r => r.json())
            .then(data => {
                setAnalytes(data);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, []);

    // Load existing lab results if resuming draft
    useEffect(() => {
        if (visitData?.crfLabResults?.length) {
            const existing: Record<string, string> = {};
            visitData.crfLabResults.forEach((r: any) => {
                existing[r.analyteCode] = r.value ?? '';
            });
            setValues(existing);
        }
    }, [visitData]);

    // Auto-calculate ACR and eGFR
    useEffect(() => {
        const newValues = { ...values };
        let changed = false;

        // ACR = (ALB_U mg/dL * 1000) / CRE_U mg/dL → result in mg/g
        // Or MALB (mg/L) / CRE_U (mg/dL) * 1000
        const albU = parseFloat(values['ALB_U'] || '');
        const malb = parseFloat(values['MALB'] || '');
        const creU = parseFloat(values['CRE_U'] || '');
        if (creU > 0) {
            const albumin = !isNaN(albU) ? albU * 10 : (!isNaN(malb) ? malb : NaN); // convert mg/dL to mg/L if needed
            if (!isNaN(albumin)) {
                const acr = (albumin / (creU * 10)) * 1000; // CRE_U in mg/dL → mg/L
                newValues['ACR'] = acr.toFixed(1);
                changed = true;
            }
        }

        // eGFR (CKD-EPI 2021)
        const creS = parseFloat(values['CRE_S'] || '');
        if (!isNaN(creS) && creS > 0 && participant) {
            const age = participant.birthDate
                ? Math.floor((Date.now() - new Date(participant.birthDate).getTime()) / (1000 * 60 * 60 * 24 * 365.25))
                : null;
            const sex = participant.sex;
            if (age && sex) {
                const kappa = sex === 'Female' ? 0.7 : 0.9;
                const alpha = sex === 'Female' ? -0.241 : -0.302;
                let eGFR = 142 * Math.pow(Math.min(creS / kappa, 1), alpha) * Math.pow(Math.max(creS / kappa, 1), -1.200) * Math.pow(0.9938, age);
                if (sex === 'Female') eGFR *= 1.012;
                newValues['EGFR_CALC'] = eGFR.toFixed(1);
                changed = true;
            }
        }

        if (changed) setValues(newValues);
    }, [values['ALB_U'], values['MALB'], values['CRE_U'], values['CRE_S'], participant]);

    // Group analytes by category
    const grouped = useMemo(() => {
        const groups: Record<string, Analyte[]> = {};
        const cbcKeepCodes = new Set(['WBC', 'NEU_PCT', 'LINF_PCT', 'MONO_PCT', 'EOS_PCT', 'BASO_PCT', 'HGB', 'HTO', 'PLT']);

        analytes.forEach(a => {
            const cat = a.category || 'Other';
            if (cat === 'CBC' && !cbcKeepCodes.has(a.code)) return; // Exclude unwanted CBC codes

            if (!groups[cat]) groups[cat] = [];
            groups[cat].push(a);
        });
        return groups;
    }, [analytes]);

    const filteredGroups = useMemo(() => {
        if (!search.trim()) return grouped;
        const q = search.toLowerCase();
        const result: Record<string, Analyte[]> = {};
        for (const [cat, list] of Object.entries(grouped)) {
            const filtered = list.filter(a =>
                a.name.toLowerCase().includes(q) || a.code.toLowerCase().includes(q)
            );
            if (filtered.length > 0) result[cat] = filtered;
        }
        return result;
    }, [grouped, search]);

    const sortedCategories = Object.keys(filteredGroups).sort((a, b) => {
        const ai = CATEGORY_ORDER.indexOf(a);
        const bi = CATEGORY_ORDER.indexOf(b);
        return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
    });

    const toggleCollapse = (cat: string) => {
        setCollapsedGroups(prev => {
            const next = new Set(prev);
            next.has(cat) ? next.delete(cat) : next.add(cat);
            return next;
        });
    };

    const parseCoding = (coding: string): { value: string; label: string }[] => {
        return coding.split(',').map(item => {
            const [val, label] = item.trim().split('=');
            return { value: val, label: label || val };
        });
    };

    const handleValueChange = (code: string, value: string) => {
        setValues(prev => ({ ...prev, [code]: value }));
        setSaved(false);
    };

    const saveDraft = async () => {
        if (!visitId) return;
        setSaving(true);
        const results = Object.entries(values)
            .filter(([, v]) => v !== '' && v !== undefined)
            .map(([analyteCode, value]) => {
                const a = analytes.find(x => x.code === analyteCode);
                return { analyteCode, value, unit: a?.unit || null };
            });

        await fetch(`/api/visits/wizard/${visitId}/labs`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ results }),
        });
        setSaving(false);
        setSaved(true);
    };

    const handleBack = async () => {
        await saveDraft();
        router.push(`/participants/${participantId}/visits/new/clinical`);
    };

    const handleNext = async () => {
        await saveDraft();
        router.push(`/participants/${participantId}/visits/new/adverse-events`);
    };

    const filledCount = Object.values(values).filter(v => v !== '' && v !== undefined).length;

    if (loading) {
        return (
            <div className="card flex items-center justify-center h-64">
                <div className="animate-spin w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full" />
            </div>
        );
    }

    return (
        <div className="space-y-4 animate-slide-up">
            {/* Header */}
            <div className="card">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="section-title mb-0">Step 2 — Laboratory Results</h2>
                    <div className="flex items-center gap-3">
                        <span className="text-xs text-surface-400">{filledCount}/{analytes.length} filled</span>
                        {saved && <span className="badge-success">✓ Saved</span>}
                    </div>
                </div>
                <div className="relative">
                    <input
                        type="text"
                        className="input pl-10"
                        placeholder="Search analytes by name or code..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400">🔍</span>
                </div>

                {/* Auto-calculated values */}
                {(values['ACR'] || values['EGFR_CALC']) && (
                    <div className="mt-4 p-3 rounded-lg bg-primary-500/10 border border-primary-500/20">
                        <p className="text-xs font-semibold text-primary-400 mb-2 uppercase tracking-wider">Auto-Calculated</p>
                        <div className="flex gap-6">
                            {values['ACR'] && (
                                <div>
                                    <span className="text-xs text-surface-400">ACR:</span>
                                    <span className="ml-2 text-sm text-white font-medium">{values['ACR']} mg/g</span>
                                </div>
                            )}
                            {values['EGFR_CALC'] && (
                                <div>
                                    <span className="text-xs text-surface-400">eGFR (CKD-EPI):</span>
                                    <span className="ml-2 text-sm text-white font-medium">{values['EGFR_CALC']} mL/min/1.73m²</span>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Analyte Groups */}
            {sortedCategories.map(category => {
                const list = filteredGroups[category];
                const isCollapsed = collapsedGroups.has(category);
                const filledInGroup = list.filter(a => values[a.code] && values[a.code] !== '').length;

                return (
                    <div key={category} className="card">
                        <button
                            onClick={() => toggleCollapse(category)}
                            className="w-full flex items-center justify-between text-left"
                        >
                            <div className="flex items-center gap-2">
                                <span className="text-lg">{isCollapsed ? '▸' : '▾'}</span>
                                <h3 className="text-sm font-semibold text-surface-200 uppercase tracking-wider">{category}</h3>
                                <span className="text-xs text-surface-500">({filledInGroup}/{list.length})</span>
                            </div>
                        </button>

                        {!isCollapsed && (
                            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                {list.map(analyte => (
                                    <div key={analyte.code} className="flex flex-col gap-1">
                                        <label className="text-xs font-medium text-surface-400 truncate" title={`${analyte.name} (${analyte.code})`}>
                                            {analyte.name}
                                            {analyte.unit && <span className="text-surface-500 ml-1">({analyte.unit})</span>}
                                        </label>

                                        {analyte.type === 'Numerico' && (
                                            <input
                                                type="number"
                                                step="any"
                                                className="input py-1.5 text-sm"
                                                placeholder={analyte.code}
                                                value={values[analyte.code] ?? ''}
                                                onChange={e => handleValueChange(analyte.code, e.target.value)}
                                            />
                                        )}

                                        {analyte.type === 'Binaria' && analyte.coding && (
                                            <div className="flex gap-1">
                                                {parseCoding(analyte.coding).map(opt => (
                                                    <button
                                                        key={opt.value}
                                                        className={`flex-1 px-2 py-1.5 rounded-lg text-xs font-medium transition-all border
                                                            ${values[analyte.code] === opt.value
                                                                ? opt.value === '1'
                                                                    ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                                                                    : 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                                                                : 'bg-surface-700/30 border-surface-600/30 text-surface-400 hover:bg-surface-600/50'
                                                            }`}
                                                        onClick={() => handleValueChange(analyte.code, opt.value)}
                                                    >
                                                        {opt.label}
                                                    </button>
                                                ))}
                                            </div>
                                        )}

                                        {analyte.type === 'Categorica' && analyte.coding && (
                                            <select
                                                className="select py-1.5 text-sm"
                                                value={values[analyte.code] ?? ''}
                                                onChange={e => handleValueChange(analyte.code, e.target.value)}
                                            >
                                                <option value="">— Select —</option>
                                                {parseCoding(analyte.coding).map(opt => (
                                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                                ))}
                                            </select>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                );
            })}

            {/* Actions */}
            <div className="card">
                <div className="flex items-center justify-between">
                    <button onClick={handleBack} className="btn-ghost">
                        ← Back: Clinical
                    </button>
                    <div className="flex items-center gap-3">
                        <button onClick={saveDraft} disabled={saving || !visitId} className="btn-secondary">
                            {saving ? 'Saving...' : '💾 Save Draft'}
                        </button>
                        <button onClick={handleNext} disabled={!visitId} className="btn-primary">
                            Next: Adverse Events →
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
