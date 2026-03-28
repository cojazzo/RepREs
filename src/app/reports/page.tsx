'use client';

import { useState } from 'react';

export default function ReportsPage() {
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

            const blob = new Blob([csvContent], { type: 'text/csv' });
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
        { type: 'participants', label: 'Participants', description: 'All participants with demographics, status, and arm assignment', icon: '👥' },
        { type: 'visits', label: 'Visit Data', description: 'Completed visits with vitals and adherence data', icon: '📅' },
        { type: 'labs', label: 'Laboratory Results', description: 'All lab results with analyte names, values, and reference ranges', icon: '🔬' },
        { type: 'adverse-events', label: 'Adverse Events', description: 'All AEs with severity, relation, outcome, and SAE flag', icon: '⚠️' },
    ];

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Reports & Export</h1>
                    <p className="text-surface-400 mt-1 text-sm">Download study data in CSV format</p>
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
                                            Exporting...
                                        </span>
                                    ) : (
                                        '📥 Download CSV'
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Info */}
            <div className="card bg-surface-800/40">
                <h3 className="text-sm font-medium text-surface-300 mb-2">📋 Export Notes</h3>
                <ul className="text-sm text-surface-400 space-y-1 list-disc list-inside">
                    <li>All exports use blinded group labels (Group A / Group B)</li>
                    <li>Timestamps are in ISO 8601 format</li>
                    <li>CSV files use comma delimiters and UTF-8 encoding</li>
                    <li>For PDF patient summaries, visit a participant detail page</li>
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
