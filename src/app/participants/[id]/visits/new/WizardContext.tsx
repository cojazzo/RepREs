'use client';

import { createContext, useContext } from 'react';

export interface WizardContextType {
    visitId: string | null;
    participantId: string;
    participant: any;
    setVisitId: (id: string) => void;
    visitData: any;
    setVisitData: (data: any) => void;
}

export const WizardContext = createContext<WizardContextType | null>(null);

export const useWizard = () => {
    const ctx = useContext(WizardContext);
    if (!ctx) throw new Error('useWizard must be used within WizardProvider');
    return ctx;
};
