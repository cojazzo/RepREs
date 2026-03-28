'use client';

import { useState } from 'react';
import { signIn, getCsrfToken } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        // Force refresh the CSRF token to avoid stale token after sign-out
        await getCsrfToken();

        const result = await signIn('credentials', {
            email,
            password,
            redirect: false,
        });

        if (result?.error) {
            setError('Invalid email or password');
            setLoading(false);
        } else {
            router.push('/dashboard');
            router.refresh();
        }
    };

    const demoUsers = [
        { email: 'admin@demo.com', role: 'Admin', color: 'from-purple-500 to-indigo-500' },
        { email: 'pharmacy@demo.com', role: 'Pharmacy', color: 'from-emerald-500 to-teal-500' },
        { email: 'data@demo.com', role: 'Data Entry', color: 'from-amber-500 to-orange-500' },
    ];

    return (
        <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
            {/* Background */}
            <div className="absolute inset-0 bg-gradient-to-br from-surface-950 via-primary-950/50 to-surface-950" />
            <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary-500/10 rounded-full blur-3xl animate-pulse-subtle" />
            <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent-500/10 rounded-full blur-3xl animate-pulse-subtle" style={{ animationDelay: '1s' }} />

            <div className="relative z-10 w-full max-w-md mx-4">
                {/* Logo */}
                <div className="text-center mb-8 animate-fade-in">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-500 to-accent-500 shadow-2xl shadow-primary-500/30 mb-4">
                        <span className="text-white font-bold text-2xl">R</span>
                    </div>
                    <h1 className="text-3xl font-bold text-white mb-2">RepREs</h1>
                    <p className="text-surface-400 text-sm">Clinical Trial Management System</p>
                    <p className="text-surface-500 text-xs mt-1">Dapagliflozin 10mg vs Placebo • Double-Blind RCT</p>
                </div>

                {/* Login Card */}
                <div className="card animate-slide-up">
                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div>
                            <label htmlFor="email" className="label">Email Address</label>
                            <input
                                id="email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="input"
                                placeholder="you@example.com"
                                required
                            />
                        </div>
                        <div>
                            <label htmlFor="password" className="label">Password</label>
                            <input
                                id="password"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="input"
                                placeholder="••••••••"
                                required
                            />
                        </div>

                        {error && (
                            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="btn-primary w-full"
                        >
                            {loading ? (
                                <span className="flex items-center gap-2">
                                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                    </svg>
                                    Signing in...
                                </span>
                            ) : (
                                'Sign In'
                            )}
                        </button>
                    </form>

                    {/* Demo Users */}
                    <div className="mt-6 pt-6 border-t border-surface-700/50">
                        <p className="text-xs text-surface-500 mb-3 text-center uppercase tracking-wider">Quick Access — Demo Users</p>
                        <div className="space-y-2">
                            {demoUsers.map((user) => (
                                <button
                                    key={user.email}
                                    onClick={() => {
                                        setEmail(user.email);
                                        setPassword('Admin123!');
                                    }}
                                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg bg-surface-700/30 hover:bg-surface-700/60 transition-all duration-200 group"
                                >
                                    <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${user.color} flex items-center justify-center`}>
                                        <span className="text-white text-xs font-bold">{user.role[0]}</span>
                                    </div>
                                    <div className="text-left">
                                        <p className="text-sm text-surface-300 group-hover:text-white transition-colors">{user.email}</p>
                                        <p className="text-xs text-surface-500">{user.role}</p>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
