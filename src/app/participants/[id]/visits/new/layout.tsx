'use client';

import React, { useEffect, useState, createContext, useContext } from 'react';
import { useParams, usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useLanguage } from '@/lib/i18n/LanguageContext';

interface WizardContextType {
    visitId: string | null;
    participantId: string;
    participant: any;
    setVisitId: (id: string) => void;
    visitData: any;
    setVisitData: (data: any) => void;
}

const WizardContext = createContext<WizardContextType | null>(null);
export const useWizard = () => {
    const ctx = useContext(WizardContext);
    if (!ctx) throw new Error('useWizard must be used within WizardProvider');
    return ctx;
};

export default function WizardLayout({ children }: { children: React.ReactNode }) {
    const params = useParams();
    const pathname = usePathname();
    const router = useRouter();
    const { t } = useLanguage();
    const participantId = params.id as string;

    const [visitId, setVisitId] = useState<string | null>(null);
    const [participant, setParticipant] = useState<any>(null);
    const [visitData, setVisitData] = useState<any>(null);
    const [visitType, setVisitType] = useState('');
    const [showTypeSelector, setShowTypeSelector] = useState(true);
    const [loading, setLoading] = useState(true);

    const STEPS = [
        { id: 'clinical', label: t('visit.step.clinical'), icon: '🩺', path: 'clinical' },
        { id: 'labs', label: t('visit.step.labs'), icon: '🔬', path: 'labs' },
        { id: 'adverse-events', label: t('visit.step.ae'), icon: '⚠️', path: 'adverse-events' },
    ];

    // Load participant info
    useEffect(() => {
        fetch(`/api/participants/${participantId}`)
            .then(r => r.json())
            .then(data => {
                setParticipant(data);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, [participantId]);

    // Determine current step from path
    const currentStepPath = pathname?.split('/').pop() || '';
    const currentStepIndex = STEPS.findIndex(s => s.path === currentStepPath);

    const createDraftVisit = async () => {
        if (!visitType) return;
        const res = await fetch('/api/visits/wizard', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ participantId, visitType }),
        });
        const data = await res.json();
        if (data.visitId) {
            setVisitId(data.visitId);
            setShowTypeSelector(false);

            // Load existing data if resuming a draft
            if (data.existing) {
                const draftRes = await fetch(`/api/visits/wizard/${data.visitId}`);
                const draftData = await draftRes.json();
                setVisitData(draftData);
            }

            router.push(`/participants/${participantId}/visits/new/clinical`);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full" />
            </div>
        );
    }

    const age = participant?.birthDate
        ? Math.floor((Date.now() - new Date(participant.birthDate).getTime()) / (1000 * 60 * 60 * 24 * 365.25))
        : null;

    return (
        <WizardContext.Provider value={{ visitId, participantId, participant, setVisitId, visitData, setVisitData }}>
            <div className="space-y-6 animate-fade-in">
                {/* Header */}
                <div className="page-header">
                    <div className="flex items-center gap-4">
                        <button onClick={() => router.push(`/participants/${participantId}`)} className="btn-ghost text-sm">
                            {t('visit.back_to_patient')}
                        </button>
                        <div>
                            <h1 className="page-title">{t('visit.add_visit')}</h1>
                            {participant && (
                                <p className="text-surface-400 mt-1 text-sm">
                                    {participant.studyId} — {participant.lastName}, {participant.firstName}
                                    {age !== null && ` • ${t('common.age')} ${age}`}
                                </p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Visit Type Selector */}
                {showTypeSelector && currentStepIndex < 0 && (
                    <div className="card max-w-lg mx-auto">
                        <h2 className="section-title">{t('visit.select_type.title')}</h2>
                        <div className="space-y-4">
                            <select
                                className="select w-full"
                                value={visitType}
                                onChange={e => setVisitType(e.target.value)}
                            >
                                <option value="">{t('visit.select_type.placeholder')}</option>
                                <option value="BASELINE">{t('visit.type.baseline')}</option>
                                <option value="MONTH_2">{t('visit.type.month2')}</option>
                                <option value="MONTH_4">{t('visit.type.month4')}</option>
                                <option value="MONTH_6">{t('visit.type.month6')}</option>
                            </select>
                            <button
                                onClick={createDraftVisit}
                                disabled={!visitType}
                                className="btn-primary w-full"
                            >
                                {t('visit.btn.start_wizard')}
                            </button>
                        </div>
                    </div>
                )}

                {/* Stepper */}
                {(currentStepIndex >= 0 || !showTypeSelector) && (
                    <>
                        <div className="flex items-center justify-center gap-2">
                            {STEPS.map((step, i) => {
                                const isActive = i === currentStepIndex;
                                const isCompleted = i < currentStepIndex;
                                return (
                                    <React.Fragment key={step.id}>
                                        {i > 0 && (
                                            <div className={`h-0.5 w-12 transition-colors duration-300 ${isCompleted ? 'bg-primary-500' : 'bg-surface-600'}`} />
                                        )}
                                        <div
                                            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300
                                                ${isActive
                                                    ? 'bg-primary-500/15 text-primary-400 border border-primary-500/30 shadow-lg shadow-primary-500/10'
                                                    : isCompleted
                                                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                                        : 'bg-surface-700/30 text-surface-400 border border-surface-600/30'
                                                }`}
                                        >
                                            <span>{isCompleted ? '✓' : step.icon}</span>
                                            <span className="hidden sm:inline">{step.label}</span>
                                            <span className="sm:hidden">{t('visit.step')} {i + 1}</span>
                                        </div>
                                    </React.Fragment>
                                );
                            })}
                        </div>

                        {/* Step Content */}
                        <div className="max-w-4xl mx-auto">
                            {children}
                        </div>
                    </>
                )}
            </div>
        </WizardContext.Provider>
    );
}
