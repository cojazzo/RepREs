'use client';

import { useEffect, useState } from 'react';
import { useLanguage } from '@/lib/i18n/LanguageContext';

interface User {
    id: string; email: string; name: string; role: string; active: boolean; createdAt: string;
}

const ROLE_COLORS: Record<string, string> = {
    ADMIN: 'bg-red-500/15 text-red-400',
    INVESTIGATOR: 'bg-blue-500/15 text-blue-400',
    DATA_ENTRY: 'bg-emerald-500/15 text-emerald-400',
    MONITOR: 'bg-amber-500/15 text-amber-400',
    PHARMACY: 'bg-purple-500/15 text-purple-400',
    READ_ONLY: 'bg-surface-500/15 text-surface-400',
};

export default function AdminUsersPage() {
    const { t } = useLanguage();
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const ROLE_OPTIONS = [
        { value: 'ADMIN', label: t('admin.role.admin') },
        { value: 'INVESTIGATOR', label: t('admin.role.investigator') as any },
        { value: 'DATA_ENTRY', label: t('admin.role.data_entry') as any },
        { value: 'MONITOR', label: t('admin.role.monitor') },
        { value: 'PHARMACY', label: t('admin.role.pharmacy') },
        { value: 'READ_ONLY', label: t('admin.role.read_only') as any },
    ];

    // Create user
    const [showNew, setShowNew] = useState(false);
    const [newUser, setNewUser] = useState({ email: '', name: '', password: '', role: 'DATA_ENTRY' });

    // Edit modal
    const [editUser, setEditUser] = useState<User | null>(null);
    const [editForm, setEditForm] = useState({ name: '', role: '', password: '', confirmPassword: '', active: true });
    const [saving, setSaving] = useState(false);
    const [saveMsg, setSaveMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

    const fetchUsers = () => {
        fetch('/api/admin/users')
            .then(r => {
                if (r.status === 403) { setError(t('common.access_restricted')); setLoading(false); return []; }
                return r.json();
            })
            .then(d => { if (Array.isArray(d)) setUsers(d); setLoading(false); })
            .catch(() => { setError('Failed to load'); setLoading(false); });
    };

    useEffect(() => { fetchUsers(); }, []);

    // Create
    const createUser = async () => {
        await fetch('/api/admin/users', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newUser),
        });
        setShowNew(false); setNewUser({ email: '', name: '', password: '', role: 'DATA_ENTRY' }); fetchUsers();
    };

    // Open edit modal
    const openEdit = (user: User) => {
        setEditUser(user);
        setEditForm({ name: user.name, role: user.role, password: '', confirmPassword: '', active: user.active });
        setSaveMsg(null);
    };

    // Save edit
    const handleSave = async () => {
        if (!editUser) return;
        if (editForm.password && editForm.password.length < 6) {
            setSaveMsg({ type: 'err', text: t('admin.edit.pwd_min') }); return;
        }
        if (editForm.password && editForm.password !== editForm.confirmPassword) {
            setSaveMsg({ type: 'err', text: t('admin.edit.pwd_match') }); return;
        }
        setSaving(true); setSaveMsg(null);
        const body: Record<string, any> = { name: editForm.name, role: editForm.role, active: editForm.active };
        if (editForm.password) body.password = editForm.password;

        const res = await fetch(`/api/admin/users/${editUser.id}`, {
            method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
        });
        setSaving(false);
        if (res.ok) {
            setSaveMsg({ type: 'ok', text: t('admin.edit.success') });
            fetchUsers();
            setTimeout(() => setEditUser(null), 800);
        } else {
            const err = await res.json().catch(() => ({}));
            setSaveMsg({ type: 'err', text: err.error || 'Failed to update user' });
        }
    };

    // Quick toggle active
    const toggleActive = async (user: User) => {
        await fetch(`/api/admin/users/${user.id}`, {
            method: 'PATCH', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ active: !user.active }),
        });
        fetchUsers();
    };

    if (error) {
        return (
            <div className="space-y-6 animate-fade-in">
                <h1 className="page-title">{t('admin.title')}</h1>
                <div className="card border-red-500/30 text-center py-12">
                    <p className="text-red-400 text-lg mb-2">🔒 {t('common.access_restricted')}</p>
                    <p className="text-surface-400">{error}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="page-header">
                <div>
                    <h1 className="page-title">{t('admin.title')}</h1>
                    <p className="text-surface-400 mt-1 text-sm">{users.length} {t('admin.subtitle')}</p>
                </div>
                <button onClick={() => setShowNew(true)} className="btn-primary">+ {t('admin.btn.add')}</button>
            </div>

            {/* New User Form */}
            {showNew && (
                <div className="card border-primary-500/30">
                    <h2 className="section-title">{t('admin.create.title')}</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div>
                            <label className="label">{t('admin.create.name')}</label>
                            <input className="input" value={newUser.name} onChange={e => setNewUser(u => ({ ...u, name: e.target.value }))} />
                        </div>
                        <div>
                            <label className="label">{t('admin.create.email')}</label>
                            <input type="email" className="input" value={newUser.email} onChange={e => setNewUser(u => ({ ...u, email: e.target.value }))} />
                        </div>
                        <div>
                            <label className="label">{t('admin.create.password')}</label>
                            <input type="password" className="input" value={newUser.password} onChange={e => setNewUser(u => ({ ...u, password: e.target.value }))} />
                        </div>
                        <div>
                            <label className="label">{t('admin.create.role')}</label>
                            <select className="select" value={newUser.role} onChange={e => setNewUser(u => ({ ...u, role: e.target.value }))}>
                                {ROLE_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                            </select>
                        </div>
                    </div>
                    <div className="flex gap-3 justify-end">
                        <button onClick={() => setShowNew(false)} className="btn-secondary">{t('common.cancel')}</button>
                        <button onClick={createUser} className="btn-primary" disabled={!newUser.email || !newUser.name || !newUser.password}>{t('admin.create.btn')}</button>
                    </div>
                </div>
            )}

            {/* Users Table */}
            <div className="card p-0 overflow-hidden">
                {loading ? (
                    <div className="flex items-center justify-center h-32">
                        <div className="animate-spin w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full" />
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-surface-700/50 bg-surface-800/50">
                                    <th className="text-left text-xs font-medium text-surface-400 uppercase tracking-wider px-6 py-3">{t('admin.col.name')}</th>
                                    <th className="text-left text-xs font-medium text-surface-400 uppercase tracking-wider px-6 py-3">{t('admin.col.email')}</th>
                                    <th className="text-left text-xs font-medium text-surface-400 uppercase tracking-wider px-6 py-3">{t('admin.col.role')}</th>
                                    <th className="text-left text-xs font-medium text-surface-400 uppercase tracking-wider px-6 py-3">{t('admin.col.status')}</th>
                                    <th className="text-left text-xs font-medium text-surface-400 uppercase tracking-wider px-6 py-3">{t('admin.col.created')}</th>
                                    <th className="text-right text-xs font-medium text-surface-400 uppercase tracking-wider px-6 py-3">{t('admin.col.actions')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {users.map(user => (
                                    <tr key={user.id} className={`table-row transition-opacity ${!user.active ? 'opacity-50' : ''}`}>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-600 to-primary-400 flex items-center justify-center shrink-0">
                                                    <span className="text-white text-xs font-bold">{user.name.charAt(0).toUpperCase()}</span>
                                                </div>
                                                <span className="text-sm font-medium text-surface-200">{user.name}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-surface-400">{user.email}</td>
                                        <td className="px-6 py-4">
                                            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${ROLE_COLORS[user.role] || ROLE_COLORS.READ_ONLY}`}>
                                                {ROLE_OPTIONS.find(r => r.value === user.role)?.label || user.role}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <button
                                                onClick={() => toggleActive(user)}
                                                className={`text-xs px-2.5 py-1 rounded-full font-medium cursor-pointer transition-colors ${user.active
                                                    ? 'bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25'
                                                    : 'bg-red-500/15 text-red-400 hover:bg-red-500/25'}`}
                                            >
                                                {user.active ? `● ${t('admin.status.active')}` : `● ${t('admin.status.suspended')}`}
                                            </button>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-surface-500">{new Date(user.createdAt).toLocaleDateString()}</td>
                                        <td className="px-6 py-4 text-right">
                                            <button onClick={() => openEdit(user)} className="text-xs text-primary-400 hover:text-primary-300 font-medium transition-colors">
                                                ✏️ {t('admin.btn.edit')}
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* ═══ Edit User Modal ═══ */}
            {editUser && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setEditUser(null)}>
                    <div
                        className="bg-surface-800 border border-surface-700/50 rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-5 animate-fade-in"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-semibold text-white">{t('admin.edit.title')}</h2>
                            <button onClick={() => setEditUser(null)} className="text-surface-500 hover:text-white text-xl transition-colors">×</button>
                        </div>

                        <p className="text-sm text-surface-400 -mt-3">{editUser.email}</p>

                        {/* Name */}
                        <div>
                            <label className="label">{t('admin.edit.name')}</label>
                            <input className="input" value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} />
                        </div>

                        {/* Role */}
                        <div>
                            <label className="label">{t('admin.edit.role')}</label>
                            <select className="select w-full" value={editForm.role} onChange={e => setEditForm(f => ({ ...f, role: e.target.value }))}>
                                {ROLE_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                            </select>
                        </div>

                        {/* Active toggle */}
                        <div className="flex items-center gap-3">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox" checked={editForm.active}
                                    onChange={e => setEditForm(f => ({ ...f, active: e.target.checked }))}
                                    className="w-4 h-4 rounded"
                                />
                                <span className="text-sm text-surface-200">{t('admin.edit.active')}</span>
                            </label>
                            {!editForm.active && (
                                <span className="text-[10px] bg-red-500/15 text-red-400 px-2 py-0.5 rounded-full">{t('admin.edit.suspended_msg')}</span>
                            )}
                        </div>

                        {/* Password change */}
                        <div className="border-t border-surface-700/50 pt-4">
                            <label className="label">
                                {t('admin.edit.new_pwd')} <span className="text-surface-500 font-normal">({t('admin.edit.pwd_hint')})</span>
                            </label>
                            <input
                                type="password" className="input" placeholder={t('admin.edit.pwd_min')}
                                value={editForm.password} onChange={e => setEditForm(f => ({ ...f, password: e.target.value }))}
                            />
                        </div>
                        {editForm.password && (
                            <div>
                                <label className="label">{t('admin.edit.confirm_pwd')}</label>
                                <input
                                    type="password" className="input" placeholder={t('admin.edit.confirm_pwd')}
                                    value={editForm.confirmPassword}
                                    onChange={e => setEditForm(f => ({ ...f, confirmPassword: e.target.value }))}
                                />
                                {editForm.confirmPassword && editForm.password !== editForm.confirmPassword && (
                                    <p className="text-xs text-red-400 mt-1">{t('admin.edit.pwd_match')}</p>
                                )}
                            </div>
                        )}

                        {/* Messages */}
                        {saveMsg && (
                            <div className={`text-sm px-3 py-2 rounded-lg ${saveMsg.type === 'ok' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>
                                {saveMsg.text}
                            </div>
                        )}

                        {/* Actions */}
                        <div className="flex gap-3 justify-end pt-2">
                            <button onClick={() => setEditUser(null)} className="btn-ghost">{t('common.cancel')}</button>
                            <button onClick={handleSave} disabled={saving} className="btn-primary">
                                {saving ? t('common.saving') : t('admin.edit.save')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
