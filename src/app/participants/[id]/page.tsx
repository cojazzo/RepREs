'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useSession } from 'next-auth/react';

interface ParticipantDetail {
    id: string; studyId: string; firstName: string; lastName: string; sex: string; birthDate: string;
    curp?: string; chmhId?: string; status: string; consentDate: string; enrolledAt: string;
    randomization?: { armLabel: string; treatment?: string; randomizedAt: string };
    visits: any[]; adverseEvents: any[]; dispensations: any[];
}

interface Analyte {
    id: string; code: string; name: string; type: string; unit: string | null; category: string | null; sortOrder: number;
}

const VISIT_LABELS: Record<string, string> = { BASELINE: 'V0 · Baseline', MONTH_2: 'V1 · Month 2', MONTH_4: 'V2 · Month 4', MONTH_6: 'V3 · Month 6' };
const STATUS_BADGES: Record<string, string> = { ACTIVE: 'badge-success', COMPLETED: 'badge-info', WITHDRAWN: 'badge-warning', LOST_TO_FOLLOWUP: 'badge-danger', SCREENING: 'badge-neutral' };

// Adherence & AE coded value labels
const ADH_LABELS: Record<number, string> = { 1: 'Good', 2: 'Fair', 3: 'Poor', 4: 'Non-adherent' };
const MOTIVO_LABELS: Record<number, string> = { 1: 'Side effects', 2: 'Forgot', 3: 'No access', 4: 'Felt better', 5: 'Other' };
const SEV_LABELS: Record<number, string> = { 1: 'Mild', 2: 'Moderate', 3: 'Severe' };
const REL_LABELS: Record<number, string> = { 1: 'Unrelated', 2: 'Unlikely', 3: 'Possible', 4: 'Probable', 5: 'Definite' };

export default function ParticipantDetailPage() {
    const params = useParams();
    const router = useRouter();
    const { data: session } = useSession();
    const isAdmin = session?.user?.role === 'ADMIN';

    const [participant, setParticipant] = useState<ParticipantDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [statusUpdate, setStatusUpdate] = useState('');
    const [expandedVisit, setExpandedVisit] = useState<string | null>(null);
    const [editingVisit, setEditingVisit] = useState<string | null>(null);
    const [editData, setEditData] = useState<any>({});
    const [saving, setSaving] = useState(false);
    const [analytes, setAnalytes] = useState<Analyte[]>([]);

    useEffect(() => {
        fetch('/api/lab-analytes')
            .then(r => r.json())
            .then(data => {
                const cbcKeepCodes = new Set(['WBC', 'NEU_PCT', 'LINF_PCT', 'MONO_PCT', 'EOS_PCT', 'BASO_PCT', 'HGB', 'HTO', 'PLT']);
                const filtered = data.filter((a: any) => {
                    if (a.category === 'CBC' && !cbcKeepCodes.has(a.code)) return false;
                    return true;
                });
                setAnalytes(filtered);
            })
            .catch(console.error);
    }, []);

    const reload = useCallback(() => {
        fetch(`/api/participants/${params.id}`)
            .then(r => r.json())
            .then(d => { setParticipant(d); setStatusUpdate(d.status); setLoading(false); })
            .catch(() => setLoading(false));
    }, [params.id]);

    useEffect(() => { reload(); }, [reload]);

    const updateStatus = async () => {
        await fetch(`/api/participants/${params.id}`, {
            method: 'PATCH', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: statusUpdate }),
        });
        setParticipant(p => p ? { ...p, status: statusUpdate } : p);
    };

    // Start editing a visit — populate editData from current values
    const startEdit = (visit: any) => {
        const c = visit.visitClinical || {};
        setEditData({
            clinical: {
                bpSys: c.bpSys ?? '', bpDia: c.bpDia ?? '', weightKg: c.weightKg ?? '', heightCm: c.heightCm ?? '',
                waistCm: c.waistCm ?? '', hrBpm: c.hrBpm ?? '', godet: c.godet ?? 0, notes: c.notes ?? '',
            },
            labs: Object.fromEntries((visit.crfLabResults || []).map((r: any) => [r.analyteCode, r.value ?? ''])),
        });
        setEditingVisit(visit.id);
    };

    // Save edited visit data
    const saveEdit = async (visit: any) => {
        setSaving(true);
        const c = editData.clinical;
        const bmi = c.weightKg && c.heightCm
            ? parseFloat((c.weightKg / Math.pow(c.heightCm / 100, 2)).toFixed(1))
            : null;

        // Save clinical
        await fetch(`/api/visits/wizard/${visit.id}/clinical`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...c, bmi }),
        });

        // Save labs
        const labEntries = Object.entries(editData.labs).filter(([, v]) => v !== '' && v != null)
            .map(([code, value]) => ({ analyteCode: code, value: String(value), unit: null }));
        if (labEntries.length >= 0) { // always save to overwrite empty ones with blank
            await fetch(`/api/visits/wizard/${visit.id}/labs`, {
                method: 'PUT', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ results: labEntries }),
            });
        }

        setSaving(false);
        setEditingVisit(null);
        reload();
    };

    if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full" /></div>;
    if (!participant) return <div className="text-surface-400">Participant not found.</div>;

    const age = Math.floor((Date.now() - new Date(participant.birthDate).getTime()) / (1000 * 60 * 60 * 24 * 365.25));

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="page-header">
                <div className="flex items-center gap-4">
                    <button onClick={() => router.back()} className="btn-ghost text-sm">← Back</button>
                    <div>
                        <h1 className="page-title">{participant.studyId}</h1>
                        <p className="text-surface-400 mt-1 text-sm">{participant.lastName}, {participant.firstName} • {participant.sex} • Age {age}</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <span className={STATUS_BADGES[participant.status] || 'badge-neutral'}>{participant.status.replace('_', ' ')}</span>
                    {participant.randomization && (
                        <span className="badge-info">
                            Group {participant.randomization.armLabel}
                            {participant.randomization.treatment && ` — ${participant.randomization.treatment.replace('_', ' ')}`}
                        </span>
                    )}
                    <Link href={`/participants/${participant.id}/visits/new`} className="btn-primary text-sm">➕ Add Visit</Link>
                </div>
            </div>

            {/* Info Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                <div className="card">
                    <h3 className="text-sm font-medium text-surface-400 mb-2">Consent Date</h3>
                    <p className="text-lg text-white">{participant.consentDate ? new Date(participant.consentDate).toLocaleDateString() : '—'}</p>
                </div>
                <div className="card">
                    <h3 className="text-sm font-medium text-surface-400 mb-2">Enrolled</h3>
                    <p className="text-lg text-white">{participant.enrolledAt ? new Date(participant.enrolledAt).toLocaleDateString() : '—'}</p>
                </div>
                <div className="card">
                    <h3 className="text-sm font-medium text-surface-400 mb-2">CURP</h3>
                    <p className="text-lg text-white">{participant.curp || '—'}</p>
                </div>
                <div className="card">
                    <h3 className="text-sm font-medium text-surface-400 mb-2">CHMH ID</h3>
                    <p className="text-lg text-white">{participant.chmhId || '—'}</p>
                </div>
            </div>

            {/* Status Update */}
            {isAdmin && (
                <div className="card">
                    <h2 className="section-title">Update Status</h2>
                    <div className="flex gap-3">
                        <select className="select max-w-xs" value={statusUpdate} onChange={e => setStatusUpdate(e.target.value)}>
                            <option value="SCREENING">Screening</option>
                            <option value="ACTIVE">Active</option>
                            <option value="COMPLETED">Completed</option>
                            <option value="WITHDRAWN">Withdrawn</option>
                            <option value="LOST_TO_FOLLOWUP">Lost to Follow-up</option>
                        </select>
                        <button onClick={updateStatus} className="btn-primary">Update Status</button>
                    </div>
                </div>
            )}

            {/* ═══════ VISIT TIMELINE ═══════ */}
            <div>
                <h2 className="section-title mb-4">Visit Timeline</h2>
                <div className="space-y-4">
                    {participant.visits.map((visit: any) => {
                        const isExpanded = expandedVisit === visit.id;
                        const isEditing = editingVisit === visit.id;
                        const clinical = visit.visitClinical || visit.vitals || {};
                        const labsData = visit.crfLabResults || visit.labResults || [];
                        const labMap = Object.fromEntries(labsData.map((r: any) => [r.analyteCode, r]));
                        const labCount = labsData.length;
                        const hasData = Object.keys(clinical).length > 2 || labCount > 0;

                        return (
                            <div key={visit.id} className={`card transition-all duration-300 ${isExpanded ? 'ring-1 ring-primary-500/30' : ''}`}>
                                {/* Visit Header — always visible */}
                                <button
                                    onClick={() => setExpandedVisit(isExpanded ? null : visit.id)}
                                    className="w-full flex items-center justify-between text-left"
                                >
                                    <div className="flex items-center gap-3">
                                        <span className={`w-3 h-3 rounded-full ${visit.completed || visit.status === 'SUBMITTED' ? 'bg-emerald-400' : 'bg-surface-500'}`} />
                                        <div>
                                            <span className="text-sm font-semibold text-white">{VISIT_LABELS[visit.visitType] || visit.visitType}</span>
                                            <span className="text-xs text-surface-500 ml-3">
                                                {visit.visitDate ? new Date(visit.visitDate).toLocaleDateString() : 'Pending'}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        {/* Quick metrics in collapsed row */}
                                        {clinical.bpSys && (
                                            <span className="text-xs text-surface-400 hidden sm:inline">BP {clinical.bpSys}/{clinical.bpDia}</span>
                                        )}
                                        {(clinical.weightKg || clinical.weight) && (
                                            <span className="text-xs text-surface-400 hidden md:inline">{clinical.weightKg || clinical.weight} kg</span>
                                        )}
                                        {labCount > 0 && (
                                            <span className="text-xs bg-primary-500/15 text-primary-400 px-2 py-0.5 rounded-full hidden md:inline">{labCount} labs</span>
                                        )}
                                        <span className={`text-xs px-2 py-0.5 rounded-full ${visit.completed || visit.status === 'SUBMITTED'
                                            ? 'bg-emerald-500/15 text-emerald-400' : 'bg-surface-600/40 text-surface-400'}`}>
                                            {visit.status === 'SUBMITTED' ? 'Submitted' : visit.completed ? 'Complete' : 'Draft'}
                                        </span>
                                        <span className={`text-surface-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`}>▼</span>
                                    </div>
                                </button>

                                {/* Expanded Content */}
                                {isExpanded && (
                                    <div className="mt-4 pt-4 border-t border-surface-700/50 space-y-5">
                                        {/* Admin Edit Toggle */}
                                        {isAdmin && hasData && (
                                            <div className="flex justify-end">
                                                {isEditing ? (
                                                    <div className="flex gap-2">
                                                        <button onClick={() => setEditingVisit(null)} className="btn-ghost text-sm">Cancel</button>
                                                        <button onClick={() => saveEdit(visit)} disabled={saving} className="btn-primary text-sm">
                                                            {saving ? 'Saving...' : '💾 Save Changes'}
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <button onClick={() => startEdit(visit)} className="btn-secondary text-sm">✏️ Edit</button>
                                                )}
                                            </div>
                                        )}

                                        {!hasData && <p className="text-surface-500 text-sm text-center py-4">No data entered for this visit yet</p>}

                                        {/* ── CLINICAL ── */}
                                        {(clinical.bpSys || clinical.systolicBp || clinical.weightKg || clinical.weight) && (
                                            <div>
                                                <h3 className="text-xs font-semibold text-surface-400 uppercase tracking-wider mb-2">Clinical</h3>
                                                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                                                    <Metric label="BP (sys/dia)" value={isEditing ? undefined : `${clinical.bpSys || clinical.systolicBp || '—'}/${clinical.bpDia || clinical.diastolicBp || '—'}`}
                                                        editMode={isEditing} editNode={isEditing ? (
                                                            <div className="flex gap-1">
                                                                <input type="number" className="input text-xs w-16" value={editData.clinical?.bpSys ?? ''} onChange={e => setEditData((d: any) => ({ ...d, clinical: { ...d.clinical, bpSys: e.target.value ? Number(e.target.value) : '' } }))} />
                                                                <span className="text-surface-500">/</span>
                                                                <input type="number" className="input text-xs w-16" value={editData.clinical?.bpDia ?? ''} onChange={e => setEditData((d: any) => ({ ...d, clinical: { ...d.clinical, bpDia: e.target.value ? Number(e.target.value) : '' } }))} />
                                                            </div>
                                                        ) : undefined} unit="mmHg" />
                                                    <Metric label="Weight" value={isEditing ? undefined : (clinical.weightKg || clinical.weight || '—')}
                                                        editMode={isEditing} editNode={isEditing ? (
                                                            <input type="number" step="0.1" className="input text-xs" value={editData.clinical?.weightKg ?? ''} onChange={e => setEditData((d: any) => ({ ...d, clinical: { ...d.clinical, weightKg: e.target.value ? Number(e.target.value) : '' } }))} />
                                                        ) : undefined} unit="kg" />
                                                    <Metric label="Height" value={isEditing ? undefined : (clinical.heightCm || clinical.height || '—')}
                                                        editMode={isEditing} editNode={isEditing ? (
                                                            <input type="number" step="0.1" className="input text-xs" value={editData.clinical?.heightCm ?? ''} onChange={e => setEditData((d: any) => ({ ...d, clinical: { ...d.clinical, heightCm: e.target.value ? Number(e.target.value) : '' } }))} />
                                                        ) : undefined} unit="cm" />
                                                    <Metric label="BMI" value={
                                                        isEditing
                                                            ? (editData.clinical?.weightKg && editData.clinical?.heightCm
                                                                ? (editData.clinical.weightKg / Math.pow(editData.clinical.heightCm / 100, 2)).toFixed(1) : '—')
                                                            : (clinical.bmi || (clinical.weightKg && clinical.heightCm
                                                                ? (clinical.weightKg / Math.pow(clinical.heightCm / 100, 2)).toFixed(1) : '—'))
                                                    } unit="kg/m²" />
                                                    <Metric label="Heart Rate" value={isEditing ? undefined : (clinical.hrBpm || clinical.heartRate || '—')}
                                                        editMode={isEditing} editNode={isEditing ? (
                                                            <input type="number" className="input text-xs" value={editData.clinical?.hrBpm ?? ''} onChange={e => setEditData((d: any) => ({ ...d, clinical: { ...d.clinical, hrBpm: e.target.value ? Number(e.target.value) : '' } }))} />
                                                        ) : undefined} unit="bpm" />
                                                    <Metric label="Waist" value={isEditing ? undefined : (clinical.waistCm || '—')}
                                                        editMode={isEditing} editNode={isEditing ? (
                                                            <input type="number" step="0.1" className="input text-xs" value={editData.clinical?.waistCm ?? ''} onChange={e => setEditData((d: any) => ({ ...d, clinical: { ...d.clinical, waistCm: e.target.value ? Number(e.target.value) : '' } }))} />
                                                        ) : undefined} unit="cm" />
                                                </div>
                                            </div>
                                        )}

                                        {/* ── LABS ── */}
                                        {analytes.length > 0 && (
                                            <div>
                                                <h3 className="text-xs font-semibold text-surface-400 uppercase tracking-wider mb-2">
                                                    Lab Results <span className="text-surface-500 font-normal">({labCount} filled)</span>
                                                </h3>
                                                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                                                    {analytes.map(a => {
                                                        const lr = labMap[a.code];
                                                        return (
                                                            <div key={a.code} className="flex flex-col bg-surface-700/30 rounded-lg px-3 py-2">
                                                                <span className="text-xs text-surface-400 truncate mb-1" title={a.name}>{a.name}</span>
                                                                <div className="flex items-center justify-between">
                                                                    <span className="text-[10px] text-surface-500">{a.code}</span>
                                                                    {isEditing ? (
                                                                        <input type="text" className="input text-xs w-20 text-right"
                                                                            value={editData.labs?.[a.code] ?? ''}
                                                                            onChange={e => setEditData((d: any) => ({
                                                                                ...d, labs: { ...d.labs, [a.code]: e.target.value }
                                                                            }))} />
                                                                    ) : (
                                                                        <span className="text-sm font-medium text-white">
                                                                            {lr?.value ?? '—'}
                                                                            {a.unit && lr?.value && <span className="text-[10px] text-surface-500 ml-1">{a.unit}</span>}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Adverse Events Table */}
            {participant.adverseEvents.length > 0 && (
                <div className="card">
                    <h2 className="section-title">Adverse Events ({participant.adverseEvents.length})</h2>
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-surface-700/50">
                                    <th className="text-left text-xs font-medium text-surface-400 px-4 py-2">Description</th>
                                    <th className="text-left text-xs font-medium text-surface-400 px-4 py-2">Severity</th>
                                    <th className="text-left text-xs font-medium text-surface-400 px-4 py-2">Relation</th>
                                    <th className="text-left text-xs font-medium text-surface-400 px-4 py-2">Outcome</th>
                                    <th className="text-left text-xs font-medium text-surface-400 px-4 py-2">SAE</th>
                                    <th className="text-left text-xs font-medium text-surface-400 px-4 py-2">Start Date</th>
                                </tr>
                            </thead>
                            <tbody>
                                {participant.adverseEvents.map((ae: any) => (
                                    <tr key={ae.id} className="table-row">
                                        <td className="px-4 py-3 text-sm text-surface-200">{ae.description}</td>
                                        <td className="px-4 py-3"><span className={ae.severity === 'SEVERE' ? 'badge-danger' : ae.severity === 'MODERATE' ? 'badge-warning' : 'badge-success'}>{ae.severity}</span></td>
                                        <td className="px-4 py-3 text-sm text-surface-300">{ae.relation}</td>
                                        <td className="px-4 py-3 text-sm text-surface-300">{ae.outcome}</td>
                                        <td className="px-4 py-3">{ae.isSAE ? <span className="badge-danger">SAE</span> : '—'}</td>
                                        <td className="px-4 py-3 text-sm text-surface-400">{new Date(ae.startDate).toLocaleDateString()}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── Metric Display Sub-component ───
function Metric({ label, value, unit, editMode, editNode }: {
    label: string; value?: any; unit?: string; editMode?: boolean; editNode?: React.ReactNode;
}) {
    return (
        <div className="bg-surface-700/20 rounded-lg px-3 py-2">
            <div className="text-[10px] text-surface-500 uppercase tracking-wider mb-0.5">{label}</div>
            {editMode && editNode ? (
                editNode
            ) : (
                <div className="text-sm font-medium text-white">
                    {value ?? '—'}
                    {unit && value && value !== '—' && <span className="text-[10px] text-surface-500 ml-1">{unit}</span>}
                </div>
            )}
        </div>
    );
}
