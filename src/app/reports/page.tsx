'use client';

import { useState } from 'react';
import { useLanguage } from '@/lib/i18n/LanguageContext';

export default function ReportsPage() {
    const { t } = useLanguage();
    const [exporting, setExporting] = useState('');

    const exportCSV = async (type: string) => {
        setExporting(type);
        try {
            const res = await fetch(`/api/reports?type=${type}`);
            const data = await res.json();
            if (!Array.isArray(data) || data.length === 0) {
                alert('No data to export');
                setExporting('');
                return;
            }

            // Flatten and create CSV
            const flatData = data.map((row: any) => flattenObject(row));
            const headers = [...new Set(flatData.flatMap((r: any) => Object.keys(r)))];
            const csvContent = [
                headers.join(','),
                ...flatData.map((row: any) =>
                    headers.map(h => {
                        const val = row[h] ?? '';
                        const str = String(val);
                        return str.includes(',') || str.includes('"') || str.includes('\n')
                            ? `"${str.replace(/"/g, '""')}"`
                            : str;
                    }).join(',')
                ),
            ].join('\n');

            const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `repres_${type}_${new Date().toISOString().slice(0, 10)}.csv`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (e) {
            console.error(e);
        }
        setExporting('');
    };

    const reportTypes = [
        { type: 'participants', label: t('reports.type.participants'), description: t('reports.type.participants_desc'), icon: '👥' },
        { type: 'visits', label: t('reports.type.visits'), description: t('reports.type.visits_desc'), icon: '📅' },
        { type: 'labs', label: t('reports.type.labs'), description: t('reports.type.labs_desc'), icon: '🔬' },
        { type: 'adverse-events', label: t('reports.type.ae'), description: t('reports.type.ae_desc'), icon: '⚠️' },
    ];

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex items-center gap-4 mb-6">
                <div className="p-3 bg-primary-500/20 rounded-xl text-primary-400">📄</div>
                <div>
                    <h2 className="text-xl font-bold text-white">{t('nav.reports')}</h2>
                    <p className="text-surface-400 mt-1 text-sm">{t('reports.download_csv_desc')}</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {reportTypes.map(rt => (
                    <div key={rt.type} className="card-hover">
                        <div className="flex items-start gap-4">
                            <div className="text-3xl">{rt.icon}</div>
                            <div className="flex-1">
                                <h3 className="text-lg font-semibold text-white mb-1">{rt.label}</h3>
                                <p className="text-sm text-surface-400 mb-4">{rt.description}</p>
                                <button
                                    onClick={() => exportCSV(rt.type)}
                                    disabled={exporting === rt.type}
                                    className="btn-primary text-sm"
                                >
                                    {exporting === rt.type ? (
                                        <span className="flex items-center gap-2">
                                            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                            </svg>
                                            ⏳ {t('common.exporting')}
                                        </span>
                                    ) : (
                                        `📥 ${t('reports.download_csv')}`
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Info */}
            <div className="card bg-surface-800/40">
                <h3 className="text-sm font-medium text-surface-300 mb-2">📋 {t('reports.notes.title')}</h3>
                <ul className="text-sm text-surface-400 space-y-1 list-disc list-inside">
                    <li>{t('reports.notes.blinded')}</li>
                    <li>{t('reports.notes.timestamps')}</li>
                    <li>{t('reports.notes.csv')}</li>
                    <li>{t('reports.notes.pdf')}</li>
                </ul>
            </div>
        </div>
    );
}

function flattenObject(obj: any, prefix = ''): Record<string, any> {
    const result: Record<string, any> = {};
    for (const key of Object.keys(obj)) {
        const value = obj[key];
        const newKey = prefix ? `${prefix}_${key}` : key;
        if (value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
            Object.assign(result, flattenObject(value, newKey));
        } else if (Array.isArray(value)) {
            result[newKey] = JSON.stringify(value);
        } else {
            result[newKey] = value;
        }
    }
    return result;
}
