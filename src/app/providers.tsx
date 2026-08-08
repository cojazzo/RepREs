'use client';

import { SessionProvider } from 'next-auth/react';
import React from 'react';
import { LanguageProvider } from '@/lib/i18n/LanguageContext';

export default function Providers({ children }: { children: React.ReactNode }) {
    return (
        <SessionProvider>
            <LanguageProvider>
                {children}
            </LanguageProvider>
        </SessionProvider>
    );
}
