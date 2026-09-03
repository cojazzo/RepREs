'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { useSession } from 'next-auth/react';
import { Calendar, dateFnsLocalizer, Views } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay, isPast, isToday, isThisWeek, addDays } from 'date-fns';
import { es, enUS } from 'date-fns/locale';
import 'react-big-calendar/lib/css/react-big-calendar.css';

// Types
type AppointmentStatus = 'SCHEDULED' | 'COMPLETED' | 'MISSED' | 'RESCHEDULED' | 'CANCELLED';

interface Appointment {
  id: string;
  studyId: string;
  participantName: string;
  visitType: string;
  scheduledDate: string;
  status: AppointmentStatus;
  contactAttempts: any[];
}

export default function AppointmentsPage() {
  const { t, language } = useLanguage();
  const { data: session } = useSession();
  const router = useRouter();

  const [view, setView] = useState<'table' | 'calendar'>('table');
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [completingAppointmentId, setCompletingAppointmentId] = useState<string | null>(null);
  const [completedDate, setCompletedDate] = useState(new Date().toISOString().split('T')[0]);

  // New Appointment Modal State
  const [showNewModal, setShowNewModal] = useState(false);
  const [participants, setParticipants] = useState<any[]>([]);
  const [newAppt, setNewAppt] = useState({
    participantId: '',
    visitType: 'BASELINE',
    scheduledDate: new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16),
    isCompleted: false,
    notes: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newApptError, setNewApptError] = useState('');

  const fetchAppointments = useCallback(async () => {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams();
      if (search) queryParams.append('search', search);
      if (statusFilter) queryParams.append('status', statusFilter);
      if (dateFrom) queryParams.append('dateFrom', dateFrom);
      if (dateTo) queryParams.append('dateTo', dateTo);

      const res = await fetch(`/api/appointments?${queryParams.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setAppointments(data);
      } else {
        setAppointments([]);
      }
    } catch (error) {
      console.error('Error fetching appointments:', error);
      setAppointments([]);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, dateFrom, dateTo]);

  useEffect(() => {
    if (showNewModal && participants.length === 0) {
      fetch('/api/participants')
        .then(res => res.json())
        .then(data => setParticipants(data))
        .catch(console.error);
    }
  }, [showNewModal, participants.length]);

  useEffect(() => {
    fetchAppointments();
  }, [fetchAppointments]);

  // Actions
  const handleExport = async () => {
    // Export logic
    const queryParams = new URLSearchParams();
    if (search) queryParams.append('search', search);
    if (statusFilter) queryParams.append('status', statusFilter);
    if (dateFrom) queryParams.append('dateFrom', dateFrom);
    if (dateTo) queryParams.append('dateTo', dateTo);
    
    window.location.href = `/api/appointments/export?${queryParams.toString()}`;
  };

  const handleCreateAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAppt.participantId) {
      setNewApptError('Please select a participant');
      return;
    }
    
    setIsSubmitting(true);
    setNewApptError('');
    
    try {
      const res = await fetch('/api/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          participantId: newAppt.participantId,
          visitType: newAppt.visitType,
          scheduledDate: newAppt.scheduledDate,
          status: newAppt.isCompleted ? 'COMPLETED' : 'SCHEDULED',
          notes: newAppt.notes
        })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create appointment');
      }

      setShowNewModal(false);
      fetchAppointments();
      // Reset form
      setNewAppt({
        participantId: '',
        visitType: 'BASELINE',
        scheduledDate: new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16),
        isCompleted: false,
        notes: ''
      });
    } catch (err: any) {
      setNewApptError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateStatus = async (id: string, status: AppointmentStatus, completedAt?: string) => {
    try {
      const res = await fetch(`/api/appointments/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, completedAt })
      });
      if (res.ok) {
        fetchAppointments();
      }
    } catch (error) {
      console.error('Error updating status', error);
    }
  };

  // Badges
  const getStatusBadge = (status: AppointmentStatus) => {
    switch (status) {
      case 'SCHEDULED': return 'badge-info';
      case 'COMPLETED': return 'badge-success';
      case 'MISSED': return 'badge-danger';
      case 'RESCHEDULED': return 'badge-warning';
      case 'CANCELLED': return 'badge-neutral';
      default: return 'badge-neutral';
    }
  };

  // Calendar config
  const locales = {
    'en': enUS,
    'es': es,
  };
  
  const localizer = dateFnsLocalizer({
    format,
    parse,
    startOfWeek,
    getDay,
    locales,
  });

  const calendarEvents = appointments.map(app => ({
    id: app.id,
    title: `${app.studyId} - ${app.visitType}`,
    start: new Date(app.scheduledDate),
    end: new Date(new Date(app.scheduledDate).getTime() + 60 * 60 * 1000), // 1 hr default
    status: app.status,
    resource: app
  }));

  const eventPropGetter = (event: any) => {
    let backgroundColor = '#374151'; // neutral
    if (event.status === 'SCHEDULED') backgroundColor = '#3b82f6';
    if (event.status === 'COMPLETED') backgroundColor = '#10b981';
    if (event.status === 'MISSED') backgroundColor = '#ef4444';
    if (event.status === 'RESCHEDULED') backgroundColor = '#f59e0b';
    
    return { style: { backgroundColor, color: '#fff', border: 'none', borderRadius: '4px' } };
  };

  const overdueAlarms = appointments.filter(a => a.status === 'MISSED' || (a.status === 'SCHEDULED' && isPast(addDays(new Date(a.scheduledDate), 7))));
  const gracePeriodAppointments = appointments.filter(a => a.status === 'SCHEDULED' && isPast(new Date(a.scheduledDate)) && !isPast(addDays(new Date(a.scheduledDate), 7)));

  return (
    <div className="space-y-6">
      <div className="page-header flex justify-between items-center">
        <div>
          <h1 className="page-title">{t('appointments.title') || 'Appointments'}</h1>
          <p className="text-surface-400">{appointments.length} appointments found</p>
        </div>
        <div className="flex gap-2">
          <button 
            className={`px-4 py-2 rounded-md ${view === 'table' ? 'bg-primary-600 text-white' : 'bg-surface-700 text-surface-200'}`}
            onClick={() => setView('table')}
          >
            Table
          </button>
          <button 
            className={`px-4 py-2 rounded-md ${view === 'calendar' ? 'bg-primary-600 text-white' : 'bg-surface-700 text-surface-200'}`}
            onClick={() => setView('calendar')}
          >
            Calendar
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {overdueAlarms.length > 0 && (
          <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-4">
            <h3 className="text-red-400 font-bold mb-2">🚨 Alertas: Fuera de ventana (> 7 días)</h3>
            <ul className="space-y-1">
              {overdueAlarms.slice(0, 5).map(app => (
                <li key={app.id} className="text-sm text-red-200/80 flex justify-between">
                  <span><Link href={`/appointments/${app.id}`} className="hover:underline">{app.studyId} - {app.visitType}</Link></span>
                  <span>{format(new Date(app.scheduledDate), 'MMM d, yyyy')} ({app.contactAttempts?.length || 0} attempts)</span>
                </li>
              ))}
              {overdueAlarms.length > 5 && <li className="text-xs text-red-400/60 pt-2">+ {overdueAlarms.length - 5} más...</li>}
            </ul>
          </div>
        )}

        {gracePeriodAppointments.length > 0 && (
          <div className="bg-yellow-500/10 border border-yellow-500/50 rounded-lg p-4">
            <h3 className="text-yellow-400 font-bold mb-2">⚠️ Ventana Activa (En periodo de gracia de 7 días)</h3>
            <ul className="space-y-1">
              {gracePeriodAppointments.slice(0, 5).map(app => (
                <li key={app.id} className="text-sm text-yellow-200/80 flex justify-between">
                  <span><Link href={`/appointments/${app.id}`} className="hover:underline">{app.studyId} - {app.visitType}</Link></span>
                  <span>{format(new Date(app.scheduledDate), 'MMM d, yyyy')}</span>
                </li>
              ))}
              {gracePeriodAppointments.length > 5 && <li className="text-xs text-yellow-400/60 pt-2">+ {gracePeriodAppointments.length - 5} más...</li>}
            </ul>
          </div>
        )}
      </div>

      <div className="card p-4 flex flex-wrap gap-4 items-end">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-sm text-surface-400 mb-1">Search</label>
          <input 
            type="text" 
            className="input w-full" 
            placeholder="Study ID or Name..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="w-48">
          <label className="block text-sm text-surface-400 mb-1">Status</label>
          <select className="select w-full" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All</option>
            <option value="SCHEDULED">Scheduled</option>
            <option value="COMPLETED">Completed</option>
            <option value="MISSED">Missed</option>
            <option value="RESCHEDULED">Rescheduled</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>
        <div className="w-40">
          <label className="block text-sm text-surface-400 mb-1">From</label>
          <input type="date" className="input w-full" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        </div>
        <div className="w-40">
          <label className="block text-sm text-surface-400 mb-1">To</label>
          <input type="date" className="input w-full" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </div>
        <div className="flex gap-2">
          <button className="px-3 py-2 bg-surface-700 hover:bg-surface-600 rounded text-sm text-surface-200" onClick={() => { setDateFrom(format(new Date(), 'yyyy-MM-dd')); setDateTo(format(new Date(), 'yyyy-MM-dd')); }}>Today</button>
          <button className="px-3 py-2 bg-surface-700 hover:bg-surface-600 rounded text-sm text-surface-200" onClick={() => { setDateFrom(format(new Date(), 'yyyy-MM-dd')); setDateTo(format(addDays(new Date(), 7), 'yyyy-MM-dd')); }}>This Week</button>
          <button className="btn-primary" onClick={handleExport}>Export</button>
          <button className="btn-primary bg-green-600 hover:bg-green-700 border-none" onClick={() => setShowNewModal(true)}>+ New Appointment</button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center p-12">
          <div className="animate-spin w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full" />
        </div>
      ) : view === 'table' ? (
        <div className="card p-0 overflow-hidden">
          <table className="w-full">
            <thead className="border-b border-surface-700/50 bg-surface-800/50">
              <tr>
                <th className="text-left text-xs font-medium text-surface-400 uppercase tracking-wider px-6 py-3">Participant</th>
                <th className="text-left text-xs font-medium text-surface-400 uppercase tracking-wider px-6 py-3">Visit Type</th>
                <th className="text-left text-xs font-medium text-surface-400 uppercase tracking-wider px-6 py-3">Date</th>
                <th className="text-left text-xs font-medium text-surface-400 uppercase tracking-wider px-6 py-3">Status</th>
                <th className="text-left text-xs font-medium text-surface-400 uppercase tracking-wider px-6 py-3">Attempts</th>
                <th className="text-right text-xs font-medium text-surface-400 uppercase tracking-wider px-6 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-700/50">
              {appointments.map(app => (
                <tr key={app.id} className="table-row hover:bg-surface-800/50">
                  <td className="px-6 py-4">
                    <Link href={`/participants/${app.studyId}`} className="text-primary-400 hover:underline">
                      {app.studyId}
                    </Link>
                    <div className="text-sm text-surface-400">{app.participantName}</div>
                  </td>
                  <td className="px-6 py-4 text-surface-200">{app.visitType}</td>
                  <td className="px-6 py-4 text-surface-200">{format(new Date(app.scheduledDate), 'MMM d, yyyy h:mm a')}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 text-xs rounded-full ${getStatusBadge(app.status)}`}>{app.status}</span>
                  </td>
                  <td className="px-6 py-4 text-surface-200">📞 {app.contactAttempts?.length || 0}</td>
                  <td className="px-6 py-4 text-right flex gap-2 justify-end">
                    {app.status === 'SCHEDULED' && (
                      <button onClick={() => { setCompletingAppointmentId(app.id); setShowCompleteModal(true); }} className="p-1 text-green-400 hover:bg-green-400/10 rounded" title="Complete">✓</button>
                    )}
                    <Link href={`/appointments/${app.id}`} className="p-1 text-blue-400 hover:bg-blue-400/10 rounded" title="View Details">👁</Link>
                  </td>
                </tr>
              ))}
              {appointments.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-surface-400">No appointments found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="card p-4 h-[600px]">
          <Calendar
            localizer={localizer}
            events={calendarEvents}
            startAccessor="start"
            endAccessor="end"
            eventPropGetter={eventPropGetter}
            culture={language || 'en'}
            onSelectEvent={(e) => router.push(`/appointments/${e.id}`)}
          />
          <style jsx global>{`
            .rbc-calendar { background: transparent; color: #e5e7eb; }
            .rbc-toolbar button { color: #e5e7eb; border-color: #374151; }
            .rbc-toolbar button:hover, .rbc-toolbar button:active { background: #374151; color: #fff; }
            .rbc-toolbar button.rbc-active { background: #4b5563; color: #fff; }
            .rbc-header { border-color: #374151; padding: 8px; font-weight: 500; text-transform: uppercase; font-size: 0.75rem; color: #9ca3af; }
            .rbc-today { background: rgba(59, 130, 246, 0.1); }
            .rbc-off-range-bg { background: rgba(17, 24, 39, 0.5); }
            .rbc-month-view, .rbc-time-view { border-color: #374151; }
            .rbc-day-bg, .rbc-month-row, .rbc-time-header-content { border-color: #374151; }
            .rbc-time-content { border-color: #374151; }
            .rbc-timeslot-group { border-color: #374151; }
            .rbc-event { padding: 2px 6px; font-size: 0.8rem; }
            .rbc-date-cell { padding: 4px; }
          `}</style>
        </div>
      )}

      {showCompleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-surface-800 p-6 rounded-xl border border-surface-700 w-full max-w-md">
            <h3 className="text-xl font-bold mb-4">Complete Appointment</h3>
            <p className="text-surface-300 text-sm mb-4">
              Please enter the date this appointment was actually completed. This allows recording past visits accurately.
            </p>
            <div className="mb-6">
              <label className="block text-sm text-surface-400 mb-1">Completion Date</label>
              <input
                type="date"
                className="input w-full"
                value={completedDate}
                onChange={e => setCompletedDate(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-3">
              <button
                className="btn-secondary"
                onClick={() => {
                  setShowCompleteModal(false);
                  setCompletingAppointmentId(null);
                }}
              >
                Cancel
              </button>
              <button
                className="btn-primary"
                onClick={() => {
                  if (completingAppointmentId) {
                    updateStatus(completingAppointmentId, 'COMPLETED', completedDate);
                  }
                  setShowCompleteModal(false);
                  setCompletingAppointmentId(null);
                }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {showNewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-surface-800 p-6 rounded-xl border border-surface-700 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold mb-4">New Appointment</h3>
            {newApptError && <div className="mb-4 text-red-400 bg-red-400/10 p-3 rounded text-sm">{newApptError}</div>}
            
            <form onSubmit={handleCreateAppointment}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-surface-400 mb-1">Participant</label>
                  <select 
                    className="select w-full" 
                    value={newAppt.participantId}
                    onChange={(e) => setNewAppt({ ...newAppt, participantId: e.target.value })}
                    required
                  >
                    <option value="">Select a participant...</option>
                    {participants.map(p => (
                      <option key={p.id} value={p.id}>{p.studyId} - {p.firstName} {p.lastName}</option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm text-surface-400 mb-1">Visit Type</label>
                  <select 
                    className="select w-full" 
                    value={newAppt.visitType}
                    onChange={(e) => setNewAppt({ ...newAppt, visitType: e.target.value })}
                  >
                    <option value="BASELINE">Baseline</option>
                    <option value="MONTH_2">Month 2</option>
                    <option value="MONTH_4">Month 4</option>
                    <option value="MONTH_6">Month 6</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm text-surface-400 mb-1">Date & Time</label>
                  <input
                    type="datetime-local"
                    className="input w-full"
                    value={newAppt.scheduledDate}
                    onChange={(e) => setNewAppt({ ...newAppt, scheduledDate: e.target.value })}
                    required
                  />
                </div>

                <div className="flex items-center gap-3 bg-surface-700/50 p-3 rounded-lg border border-surface-600">
                  <input
                    type="checkbox"
                    id="isCompleted"
                    className="w-4 h-4 rounded bg-surface-900 border-surface-600 text-primary-500 focus:ring-primary-500 focus:ring-offset-surface-800"
                    checked={newAppt.isCompleted}
                    onChange={(e) => setNewAppt({ ...newAppt, isCompleted: e.target.checked })}
                  />
                  <label htmlFor="isCompleted" className="text-sm font-medium text-surface-200 select-none">
                    Mark as Completed
                    <span className="block text-xs text-surface-400 font-normal mt-0.5">
                      Select this if the visit already happened.
                    </span>
                  </label>
                </div>

                <div>
                  <label className="block text-sm text-surface-400 mb-1">Notes (Optional)</label>
                  <textarea
                    className="input w-full min-h-[80px] py-2"
                    value={newAppt.notes}
                    onChange={(e) => setNewAppt({ ...newAppt, notes: e.target.value })}
                    placeholder="Any relevant details..."
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-surface-700">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowNewModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Saving...' : 'Save Appointment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
