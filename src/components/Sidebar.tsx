'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { Role } from '@prisma/client';

const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: '📊', roles: null },
    { name: 'Participants', href: '/participants', icon: '👥', roles: null },
    { name: 'Adverse Events', href: '/adverse-events', icon: '⚠️', roles: null },
    { name: 'Labs', href: '/labs', icon: '🔬', roles: null },
    { name: 'Pharmacy', href: '/pharmacy', icon: '💊', roles: [Role.ADMIN, Role.PHARMACY] as Role[] },
    { name: 'Data Queries', href: '/queries', icon: '❓', roles: [Role.ADMIN, Role.MONITOR, Role.DATA_ENTRY, Role.INVESTIGATOR] as Role[] },
    { name: 'Audit Log', href: '/audit-log', icon: '📋', roles: [Role.ADMIN, Role.MONITOR] as Role[] },
    { name: 'Reports', href: '/reports', icon: '📄', roles: null },
    { name: 'Users', href: '/admin/users', icon: '⚙️', roles: [Role.ADMIN] as Role[] },
];

export default function Sidebar() {
    const pathname = usePathname();
    const { data: session } = useSession();
    const userRole = session?.user?.role;

    const filteredNav = navigation.filter(item => {
        if (!item.roles) return true;
        return userRole && item.roles.includes(userRole);
    });

    return (
        <aside className="fixed left-0 top-0 z-40 h-screen w-64 bg-surface-900/95 backdrop-blur-xl border-r border-surface-700/50 flex flex-col">
            {/* Logo  */}
            <div className="p-6 border-b border-surface-700/50">
                <Link href="/dashboard" className="flex items-center gap-3 group">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center shadow-lg shadow-primary-500/25 group-hover:shadow-primary-500/40 transition-shadow">
                        <span className="text-white font-bold text-lg">R</span>
                    </div>
                    <div>
                        <h1 className="text-lg font-bold text-white tracking-tight">RepREs</h1>
                        <p className="text-[10px] text-surface-400 uppercase tracking-wider">Clinical Trial</p>
                    </div>
                </Link>
            </div>

            {/* Navigation */}
            <nav className="flex-1 overflow-y-auto py-4 px-3">
                <ul className="space-y-1">
                    {filteredNav.map((item) => {
                        const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
                        return (
                            <li key={item.name}>
                                <Link
                                    href={item.href}
                                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group
                    ${isActive
                                            ? 'bg-primary-500/15 text-primary-400 shadow-sm'
                                            : 'text-surface-400 hover:text-white hover:bg-surface-700/50'
                                        }`}
                                >
                                    <span className={`text-lg transition-transform duration-200 ${isActive ? 'scale-110' : 'group-hover:scale-110'}`}>
                                        {item.icon}
                                    </span>
                                    {item.name}
                                    {isActive && (
                                        <div className="ml-auto w-1.5 h-1.5 rounded-full bg-primary-400 animate-pulse-subtle" />
                                    )}
                                </Link>
                            </li>
                        );
                    })}
                </ul>
            </nav>

            {/* User Info */}
            {session?.user && (
                <div className="p-4 border-t border-surface-700/50">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary-600 to-primary-400 flex items-center justify-center">
                            <span className="text-white text-sm font-bold">
                                {session.user.name?.charAt(0).toUpperCase()}
                            </span>
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-surface-200 truncate">{session.user.name}</p>
                            <p className="text-xs text-surface-500 truncate">{session.user.role.replace('_', ' ')}</p>
                        </div>
                    </div>
                    <button
                        onClick={async () => {
                            await signOut({ redirect: false });
                            window.location.href = '/login';
                        }}
                        className="w-full text-left px-3 py-2 rounded-lg text-sm text-surface-400 hover:text-red-400 hover:bg-red-500/10 transition-all duration-200"
                    >
                        ← Sign Out
                    </button>
                </div>
            )}
        </aside>
    );
}
