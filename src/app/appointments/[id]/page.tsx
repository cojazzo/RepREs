'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { format } from 'date-fns';

type AppointmentStatus = 'SCHEDULED' | 'COMPLETED' | 'MISSED' | 'RESCHEDULED' | 'CANCELLED';

interface ContactAttempt {
  id: string;
  date: string;
  method: string;
  result: string;
  notes: string;
  contactedBy: string;
}

interface AppointmentDetail {
  id: string;
  studyId: string;
  participantName: string;
  participantPhone: string;
  visitType: string;
  scheduledDate: string;
  status: AppointmentStatus;
  notes: string;
  completedAt?: string;
  cancelledAt?: string;
  contactAttempts: ContactAttempt[];
  rescheduledToId?: string;
  rescheduledFromId?: string;
}

export default function AppointmentDetailPage() {
  const { t } = useLanguage();
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [appointment, setAppointment] = useState<AppointmentDetail | null>(null);
  const [loading, setLoading] = useState(true);

  const [contactMethod, setContactMethod] = useState('Phone');
  const [contactResult, setContactResult] = useState('Answered');
  const [contactNotes, setContactNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [completedDate, setCompletedDate] = useState(new Date().toISOString().split('T')[0]);

  const fetchAppointment = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/appointments/${id}`);
      if (res.ok) {
        const data = await res.json();
        setAppointment(data);
      }
    } catch (error) {
      console.error('Error fetching appointment details:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) fetchAppointment();
  }, [id]);

  const updateStatus = async (status: AppointmentStatus, completedAt?: string) => {
    try {
      const res = await fetch(`/api/appointments/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, completedAt })
      });
      if (res.ok) {
        fetchAppointment();
      }
    } catch (error) {
      console.error('Error updating status', error);
    }
  };

  const handleAddContact = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      const res = await fetch(`/api/appointments/${id}/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          method: contactMethod,
          result: contactResult,
          notes: contactNotes
        })
      });
      if (res.ok) {
        setContactNotes('');
        fetchAppointment();
      }
    } catch (error) {
      console.error('Error adding contact attempt', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center p-12">
        <div className="animate-spin w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!appointment) {
    return <div className="text-center text-surface-400 p-12">Appointment not found</div>;
  }

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

  return (
    <div className="space-y-6 animate-fade-in max-w-5xl mx-auto">
      <div className="flex items-center gap-4 mb-4">
        <Link href="/appointments" className="text-surface-400 hover:text-surface-200">
          ← Back to Appointments
        </Link>
      </div>

      <div className="page-header flex justify-between items-start">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="page-title m-0">{appointment.studyId} - {appointment.visitType}</h1>
            <span className={`px-3 py-1 text-sm rounded-full ${getStatusBadge(appointment.status)}`}>
              {appointment.status}
            </span>
          </div>
          <p className="text-surface-400 text-lg">{appointment.participantName}</p>
        </div>
        
        <div className="flex gap-2">
          {appointment.status === 'SCHEDULED' && (
            <>
              <button className="btn-primary" onClick={() => setShowCompleteModal(true)}>Complete</button>
              <button className="px-4 py-2 bg-yellow-500/10 text-yellow-500 rounded hover:bg-yellow-500/20" onClick={() => {/* Handle Reschedule Modal */}}>Reschedule</button>
              <button className="px-4 py-2 bg-surface-700 text-surface-300 rounded hover:bg-surface-600" onClick={() => updateStatus('CANCELLED')}>Cancel</button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card p-6">
          <h2 className="section-title mb-4">Appointment Details</h2>
          <div className="space-y-4">
            <div>
              <div className="text-sm text-surface-400">Scheduled Date</div>
              <div className="text-surface-100">{format(new Date(appointment.scheduledDate), 'PPpp')}</div>
            </div>
            <div>
              <div className="text-sm text-surface-400">Visit Type</div>
              <div className="text-surface-100">{appointment.visitType}</div>
            </div>
            <div>
              <div className="text-sm text-surface-400">Notes</div>
              <div className="text-surface-100 whitespace-pre-wrap">{appointment.notes || '-'}</div>
            </div>
            {appointment.completedAt && (
              <div>
                <div className="text-sm text-surface-400">Completed At</div>
                <div className="text-surface-100">{format(new Date(appointment.completedAt), 'PPpp')}</div>
              </div>
            )}
          </div>
        </div>

        <div className="card p-6">
          <h2 className="section-title mb-4">Participant Info</h2>
          <div className="space-y-4">
            <div>
              <div className="text-sm text-surface-400">Study ID</div>
              <Link href={`/participants/${appointment.studyId}`} className="text-primary-400 hover:underline">
                {appointment.studyId}
              </Link>
            </div>
            <div>
              <div className="text-sm text-surface-400">Name</div>
              <div className="text-surface-100">{appointment.participantName}</div>
            </div>
            <div>
              <div className="text-sm text-surface-400">Phone</div>
              <div className="text-surface-100">{appointment.participantPhone || '-'}</div>
            </div>
          </div>
        </div>
      </div>

      {appointment.rescheduledFromId || appointment.rescheduledToId ? (
        <div className="card p-6">
          <h2 className="section-title mb-4">Reschedule History</h2>
          <div className="flex gap-4 items-center">
             {appointment.rescheduledFromId && (
                <Link href={`/appointments/${appointment.rescheduledFromId}`} className="text-surface-400 hover:text-primary-400 text-sm">
                  ← View Previous
                </Link>
             )}
             {appointment.rescheduledToId && (
                <Link href={`/appointments/${appointment.rescheduledToId}`} className="text-surface-400 hover:text-primary-400 text-sm">
                  View Next →
                </Link>
             )}
          </div>
        </div>
      ) : null}

      <div className="card p-6">
        <h2 className="section-title mb-4">Contact Attempts</h2>
        
        <form onSubmit={handleAddContact} className="bg-surface-800/50 p-4 rounded-lg border border-surface-700/50 mb-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-surface-400 mb-1">Method</label>
              <select className="select w-full" value={contactMethod} onChange={e => setContactMethod(e.target.value)}>
                <option value="Phone">Phone</option>
                <option value="WhatsApp">WhatsApp</option>
                <option value="Email">Email</option>
                <option value="In Person">In Person</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-surface-400 mb-1">Result</label>
              <select className="select w-full" value={contactResult} onChange={e => setContactResult(e.target.value)}>
                <option value="Answered">Answered</option>
                <option value="No Answer">No Answer</option>
                <option value="Wrong Number">Wrong Number</option>
                <option value="Voicemail">Voicemail</option>
                <option value="Refused">Refused</option>
                <option value="Unreachable">Unreachable</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm text-surface-400 mb-1">Notes</label>
            <textarea className="input w-full min-h-[80px]" value={contactNotes} onChange={e => setContactNotes(e.target.value)} placeholder="Add any details about the contact attempt..." />
          </div>
          <button type="submit" className="btn-primary" disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : 'Add Contact Attempt'}
          </button>
        </form>

        <div className="space-y-4">
          {appointment.contactAttempts?.length > 0 ? (
            appointment.contactAttempts.map(attempt => (
              <div key={attempt.id} className="border-l-2 border-primary-500/50 pl-4 py-2">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-surface-200">{attempt.method}</span>
                  <span className="text-surface-500">•</span>
                  <span className="text-sm text-surface-400">{format(new Date(attempt.date), 'PP p')}</span>
                  <span className="px-2 py-0.5 text-xs bg-surface-700 text-surface-300 rounded ml-2">{attempt.result}</span>
                </div>
                <div className="text-surface-300 text-sm mt-1">{attempt.notes}</div>
                <div className="text-surface-500 text-xs mt-2">By: {attempt.contactedBy}</div>
              </div>
            ))
          ) : (
            <p className="text-surface-400 italic">No contact attempts recorded yet.</p>
          )}
        </div>
      </div>

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
                onClick={() => setShowCompleteModal(false)}
              >
                Cancel
              </button>
              <button
                className="btn-primary"
                onClick={() => {
                  setShowCompleteModal(false);
                  updateStatus('COMPLETED', completedDate);
                }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
