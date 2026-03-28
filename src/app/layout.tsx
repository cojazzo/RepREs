import type { Metadata } from 'next';
import './globals.css';
import Providers from './providers';
import SidebarWrapper from '@/components/SidebarWrapper';

export const metadata: Metadata = {
    title: 'RepREs Clinical Trial Management',
    description: 'Double-blind randomized clinical trial management system for dapagliflozin 10mg vs placebo',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en" className="dark">
            <body className="min-h-screen">
                <Providers>
                    <SidebarWrapper>
                        {children}
                    </SidebarWrapper>
                </Providers>
            </body>
        </html>
    );
}
