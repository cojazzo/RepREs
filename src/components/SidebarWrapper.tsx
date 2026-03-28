'use client';

import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Sidebar from './Sidebar';

export default function SidebarWrapper({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const { status } = useSession();
    const isLoginPage = pathname === '/login';
    const isAuthenticated = status === 'authenticated';

    if (isLoginPage || !isAuthenticated) {
        return <>{children}</>;
    }

    return (
        <div className="flex">
            <Sidebar />
            <main className="ml-64 flex-1 min-h-screen p-8">
                {children}
            </main>
        </div>
    );
}
