import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../services/api';
import Navbar from './Navbar';

// Helper: Get today's local date as YYYY-MM-DD
function getTodayString() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Helper: Format minutes into "hh:mm AM/PM"
function formatMinutesTo12h(hours, minutes) {
  const date = new Date();
  date.setHours(hours, minutes);

  // JavaScript automatically converts to local 12-hour format with AM/PM!
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}
// Helper: Generate slots array between start and end time
function generateTimeSlots(startStr, endStr, durationMinutes, bufferMinutes = 0) {
  if (!startStr || !endStr || !durationMinutes) return [];
  const [sh, sm] = startStr.split(':').map(Number);
  const [eh, em] = endStr.split(':').map(Number);

  let currentMinutes = sh * 60 + (sm || 0);
  const endMinutes = eh * 60 + (em || 0);
  const duration = parseInt(durationMinutes, 10);
  const buffer = parseInt(bufferMinutes, 10) || 0;

  if (currentMinutes >= endMinutes || duration <= 0) return [];

  const slots = [];
  while (currentMinutes + duration <= endMinutes) {
    const slotStartMin = currentMinutes;
    const slotEndMin = currentMinutes + duration;

    const sH = Math.floor(slotStartMin / 60);
    const sM = slotStartMin % 60;
    const eH = Math.floor(slotEndMin / 60);
    const eM = slotEndMin % 60;

    const startTime = formatMinutesTo12h(sH, sM);
    const endTime = formatMinutesTo12h(eH, eM);

    slots.push({
      id: `${startTime}-${endTime}`,
      startTime,
      endTime,
      selected: true,
    });

    currentMinutes = slotEndMin + buffer;
  }
  return slots;
}

export default function DoctorDashboard() {
  const navigate = useNavigate();

  // Doctor & Profile information
  const [doctorUser, setDoctorUser] = useState(null);
  const [doctorProfile, setDoctorProfile] = useState(null);
  const [copiedId, setCopiedId] = useState(false);

  // Approval / rejection verification state
  const [rejectionState, setRejectionState] = useState(null);

  // Slots & Appointments data
  const [mySlots, setMySlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [appointments, setAppointments] = useState([]);
  const [loadingAppointments, setLoadingAppointments] = useState(false);

  // Slot creation mode: 'bulk' or 'single'
  const [creationMode, setCreationMode] = useState('bulk');

  // Bulk generator state
  const [bulkDate, setBulkDate] = useState(getTodayString());
  const [shiftPreset, setShiftPreset] = useState('morning');
  const [bulkStart, setBulkStart] = useState('09:00');
  const [bulkEnd, setBulkEnd] = useState('13:00');
  const [bulkDuration, setBulkDuration] = useState('30');
  const [bulkBuffer, setBulkBuffer] = useState('0');
  const [previewSlots, setPreviewSlots] = useState([]);

  // Single slot state
  const [singleDate, setSingleDate] = useState(getTodayString());
  const [singleStart, setSingleStart] = useState('09:00');
  const [singleEnd, setSingleEnd] = useState('09:30');

  // Operation flags
  const [creatingSlots, setCreatingSlots] = useState(false);
  const [deletingSlotId, setDeletingSlotId] = useState(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  // Slots schedule filters
  const [slotDateFilter, setSlotDateFilter] = useState('all'); // 'all', 'today', 'upcoming', 'custom'
  const [customFilterDate, setCustomFilterDate] = useState(getTodayString());
  const [slotStatusFilter, setSlotStatusFilter] = useState('all'); // 'all', 'available', 'booked'

  // Prescription drawer / modal
  const [selectedAppointmentId, setSelectedAppointmentId] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [medicines, setMedicines] = useState('');
  const [instructions, setInstructions] = useState('');
  const [submittingPrescription, setSubmittingPrescription] = useState(false);
  const [completingAppointmentId, setCompletingAppointmentId] = useState(null);

  // Verify doctor approval on mount & fetch doctor profile
  useEffect(() => {
    let ignore = false;
    API.get('/auth/me')
      .then((res) => {
        if (ignore) return;
        const profile = res.data?.doctorProfile;
        const user = res.data?.user;
        setDoctorUser(user);
        setDoctorProfile(profile);

        if (profile) {
          if (!profile.isApproved && profile.rejectionReason) {
            localStorage.removeItem('token');
            localStorage.removeItem('role');
            setRejectionState({
              reason: profile.rejectionReason,
              name: user?.name || '',
            });
            return;
          }
          if (!profile.isApproved) {
            localStorage.removeItem('token');
            localStorage.removeItem('role');
            navigate('/login', {
              state: { isPending: true, doctorName: user?.name || '' },
            });
            return;
          }
        }
      })
      .catch((err) => {
        if (ignore) return;
        const data = err.response?.data;
        if (data?.isRejected || (data?.rejectionReason && data.rejectionReason.trim())) {
          localStorage.removeItem('token');
          localStorage.removeItem('role');
          setRejectionState({
            reason: data.rejectionReason,
            name: data.doctorName || '',
          });
          return;
        }
        if (data?.isPending) {
          localStorage.removeItem('token');
          localStorage.removeItem('role');
          navigate('/login', {
            state: { isPending: true, doctorName: data.doctorName || '' },
          });
          return;
        }
      });

    return () => {
      ignore = true;
    };
  }, [navigate]);

  // Fetch doctor's slots
  const fetchMySlots = useCallback(async () => {
    setLoadingSlots(true);
    try {
      const response = await API.get('/appointments/my-slots');
      setMySlots(response.data || []);
    } catch (err) {
      console.error('Error fetching doctor slots:', err);
    } finally {
      setLoadingSlots(false);
    }
  }, []);

  // Fetch doctor's booked appointments
  const fetchAppointments = useCallback(async () => {
    setLoadingAppointments(true);
    try {
      const response = await API.get('/appointments/doctor');
      setAppointments(response.data || []);
    } catch (err) {
      console.error('Error fetching appointments:', err);
    } finally {
      setLoadingAppointments(false);
    }
  }, []);

  // Initial data load
  useEffect(() => {
    fetchMySlots();
    fetchAppointments();
  }, [fetchMySlots, fetchAppointments]);

  // Recalculate preview slots whenever bulk parameters change
  useEffect(() => {
    const slots = generateTimeSlots(bulkStart, bulkEnd, bulkDuration, bulkBuffer);
    setPreviewSlots(slots);
  }, [bulkStart, bulkEnd, bulkDuration, bulkBuffer]);

  // Handle shift presets
  const handlePresetSelect = (preset) => {
    setShiftPreset(preset);
    if (preset === 'morning') {
      setBulkStart('09:00');
      setBulkEnd('13:00');
      setBulkDuration('30');
      setBulkBuffer('0');
    } else if (preset === 'afternoon') {
      setBulkStart('14:00');
      setBulkEnd('17:00');
      setBulkDuration('30');
      setBulkBuffer('0');
    } else if (preset === 'evening') {
      setBulkStart('17:30');
      setBulkEnd('20:30');
      setBulkDuration('30');
      setBulkBuffer('0');
    } else if (preset === 'fullday') {
      setBulkStart('09:00');
      setBulkEnd('17:00');
      setBulkDuration('30');
      setBulkBuffer('0');
    }
  };

  // Toggle selection of a single slot in the preview
  const togglePreviewSlot = (id) => {
    setPreviewSlots((prev) =>
      prev.map((slot) => (slot.id === id ? { ...slot, selected: !slot.selected } : slot))
    );
  };

  // Toggle all preview slots
  const toggleAllPreviewSlots = (selectAll) => {
    setPreviewSlots((prev) => prev.map((s) => ({ ...s, selected: selectAll })));
  };

  // Create bulk slots
  const handleCreateBulkSlots = async (e) => {
    e.preventDefault();
    setMessage('');
    setError('');

    const selectedSlots = previewSlots.filter((s) => s.selected);
    if (selectedSlots.length === 0) {
      setError('Please select at least one time slot to create.');
      return;
    }

    if (!bulkDate) {
      setError('Please select a valid date for consultation slots.');
      return;
    }

    setCreatingSlots(true);
    try {
      const response = await API.post('/appointments/slots', {
        date: bulkDate,
        slots: selectedSlots.map((s) => ({
          startTime: s.startTime,
          endTime: s.endTime,
        })),
      });

      setMessage(response.data?.message || `${selectedSlots.length} slots created successfully!`);
      fetchMySlots();
      fetchAppointments();
    } catch (err) {
      console.error('Error creating slots:', err);
      setError(err.response?.data?.message || 'Failed to create slots. Please verify input times.');
    } finally {
      setCreatingSlots(false);
    }
  };

  // Create a single slot
  const handleCreateSingleSlot = async (e) => {
    e.preventDefault();
    setMessage('');
    setError('');

    if (!singleDate) {
      setError('Please select a slot date.');
      return;
    }

    if (singleStart >= singleEnd) {
      setError('End time must be later than start time.');
      return;
    }

    setCreatingSlots(true);
    try {
      const response = await API.post('/appointments/slots', {
        date: singleDate,
        startTime: singleStart,
        endTime: singleEnd,
      });

      setMessage(response.data?.message || 'Availability slot created successfully!');
      fetchMySlots();
      fetchAppointments();
    } catch (err) {
      console.error('Error creating single slot:', err);
      setError(err.response?.data?.message || 'Failed to create slot.');
    } finally {
      setCreatingSlots(false);
    }
  };

  // Delete an unbooked slot
  const handleDeleteSlot = async (slotId) => {
    if (!window.confirm('Are you sure you want to remove this availability slot?')) {
      return;
    }

    setDeletingSlotId(slotId);
    setError('');
    setMessage('');

    try {
      const response = await API.delete(`/appointments/slots/${slotId}`);
      setMessage(response.data?.message || 'Slot deleted successfully.');
      fetchMySlots();
    } catch (err) {
      console.error('Error deleting slot:', err);
      setError(err.response?.data?.message || 'Could not delete slot.');
    } finally {
      setDeletingSlotId(null);
    }
  };

  // Submit Prescription
  const handleAddPrescription = async (e) => {
    e.preventDefault();
    setMessage('');
    setError('');
    setSubmittingPrescription(true);

    try {
      await API.post('/prescriptions', {
        appointmentId: selectedAppointmentId,
        diagnosis,
        medicines,
        instructions,
      });
      setMessage('Digital prescription submitted and assigned to patient successfully!');
      setDiagnosis('');
      setMedicines('');
      setInstructions('');
      setSelectedAppointmentId('');
      fetchAppointments();
      fetchMySlots();
    } catch (err) {
      console.error('Error submitting prescription:', err);
      setError(err.response?.data?.message || 'Failed to submit prescription.');
    } finally {
      setSubmittingPrescription(false);
    }
  };

  // Doctor marks appointment / slot as completed
  const handleCompleteAppointment = async (appointmentId) => {
    if (!appointmentId) return;
    setCompletingAppointmentId(appointmentId);
    setMessage('');
    setError('');

    // Optimistic local state update so UI immediately responds to user's click
    setAppointments((prev) =>
      prev.map((app) => (app.id === appointmentId ? { ...app, status: 'completed' } : app))
    );
    setMySlots((prev) =>
      prev.map((s) => {
        if (s.Appointment && s.Appointment.id === appointmentId) {
          return {
            ...s,
            Appointment: { ...s.Appointment, status: 'completed' },
          };
        }
        return s;
      })
    );

    try {
      const response = await API.put(`/appointments/${appointmentId}/complete`);
      setMessage(response.data?.message || 'Consultation slot successfully confirmed and marked as completed!');
      fetchAppointments();
      fetchMySlots();
    } catch (err) {
      console.error('Error completing appointment:', err);
      setError(err.response?.data?.message || 'Failed to mark appointment as completed.');
      fetchAppointments();
      fetchMySlots();
    } finally {
      setCompletingAppointmentId(null);
    }
  };

  // Copy Doctor ID helper
  const handleCopyDoctorId = () => {
    if (!doctorProfile?.id) return;
    navigator.clipboard.writeText(doctorProfile.id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2200);
  };

  // Filter slots based on user selection
  const filteredSlots = useMemo(() => {
    const today = getTodayString();
    return mySlots.filter((slot) => {
      // Date filter
      if (slotDateFilter === 'today' && slot.date !== today) return false;
      if (slotDateFilter === 'upcoming' && slot.date < today) return false;
      if (slotDateFilter === 'custom' && slot.date !== customFilterDate) return false;

      // Status filter
      if (slotStatusFilter === 'available' && slot.isBooked) return false;
      if (slotStatusFilter === 'booked' && !slot.isBooked) return false;

      return true;
    });
  }, [mySlots, slotDateFilter, customFilterDate, slotStatusFilter]);

  // Statistics calculation
  const stats = useMemo(() => {
    const total = mySlots.length;
    const booked = mySlots.filter((s) => s.isBooked).length;
    const available = total - booked;
    const completed = appointments.filter((a) => a.status === 'completed').length;
    return { total, booked, available, completed };
  }, [mySlots, appointments]);

  // Selected count in preview
  const selectedPreviewCount = previewSlots.filter((s) => s.selected).length;

  // Blocking view if doctor application has been rejected
  if (rejectionState) {
    return (
      <div style={{
        minHeight: '100dvh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg-page)',
        padding: '1.5rem',
        boxSizing: 'border-box',
      }}>
        <div className="auth-card animate-fade-in" style={{
          textAlign: 'center',
          maxWidth: '500px',
          padding: '2.5rem 2rem',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.85)',
          border: '1px solid var(--danger-border)',
          background: 'linear-gradient(180deg, #191426 0%, #101524 100%)',
        }}>
          <div style={{
            width: '72px',
            height: '72px',
            borderRadius: '50%',
            background: 'var(--danger-bg)',
            color: 'var(--danger)',
            border: '2px solid var(--danger-border)',
            margin: '0 auto 1.5rem auto',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            boxShadow: '0 8px 24px rgba(239, 68, 68, 0.25)',
          }}>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
          </div>

          <span style={{
            display: 'inline-block',
            padding: '0.25rem 0.85rem',
            borderRadius: '9999px',
            fontSize: '0.75rem',
            fontWeight: '700',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            background: 'var(--danger-bg)',
            color: '#f87171',
            border: '1px solid var(--danger-border)',
            marginBottom: '0.85rem',
          }}>
            Application Rejected
          </span>

          <h2 style={{ marginBottom: '0.5rem', fontSize: '1.5rem', color: '#f8fafc' }}>
            Doctor Portal Access Restricted
          </h2>

          <p style={{ lineHeight: '1.5', marginBottom: '1.5rem', color: 'var(--text-muted)', fontSize: '0.925rem' }}>
            {rejectionState.name ? `Dr. ${rejectionState.name}, your` : 'Your'} profile application has been rejected by administration. Practice functions and patient records are not accessible.
          </p>

          <div style={{
            padding: '1.15rem',
            background: 'rgba(239, 68, 68, 0.08)',
            border: '1px solid rgba(239, 68, 68, 0.25)',
            borderRadius: 'var(--radius-md)',
            marginBottom: '1.75rem',
            textAlign: 'left',
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.75rem',
              fontWeight: '700',
              color: '#fca5a5',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              marginBottom: '6px',
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              Noted Reason for Rejection:
            </div>
            <div style={{
              fontSize: '1rem',
              color: '#ffffff',
              fontWeight: '600',
              lineHeight: '1.45',
              fontStyle: 'italic',
            }}>
              "{rejectionState.reason || 'Medical credentials could not be verified by the administration.'}"
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <button
              type="button"
              onClick={() => navigate('/register')}
              className="btn btn-primary btn-block"
              style={{ minHeight: '44px' }}
            >
              Re-Register with Verified Documents →
            </button>

            <button
              type="button"
              onClick={() => {
                navigate('/login', {
                  state: {
                    isRejected: true,
                    reason: rejectionState.reason,
                    doctorName: rejectionState.name,
                  },
                });
              }}
              className="btn btn-secondary btn-block"
              style={{ minHeight: '42px' }}
            >
              Return to Login Page
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
      <Navbar portalTitle="Doctor Practice Portal" portalRole="doctor" />

      <main className="page-container animate-fade-in">

        {/* Doctor Profile Banner & ID Sharing Card */}
        <section className="card" style={{
          background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.14) 0%, rgba(139, 92, 246, 0.08) 100%)',
          borderColor: 'rgba(99, 102, 241, 0.28)',
          position: 'relative',
          overflow: 'hidden',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1.25rem' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.35rem' }}>
                <span className="badge badge-primary">Verified Practitioner</span>
                {doctorProfile?.specialization && (
                  <span className="badge badge-success">{doctorProfile.specialization}</span>
                )}
              </div>
              <h2 style={{ margin: 0, fontSize: '1.75rem' }}>
                Dr. {doctorUser?.name || 'Practitioner'}
              </h2>
              <p style={{ marginTop: '0.35rem', marginBottom: '0.85rem', color: 'var(--text-muted)' }}>
                {doctorProfile?.bio || 'Manage consultation hours, create bulk availability slots, and handle appointments.'}
              </p>

              {/* Consultation ID Box */}
              {doctorProfile?.id && (
                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.65rem',
                  padding: '0.45rem 0.85rem',
                  background: 'var(--bg-surface)',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border)',
                  fontSize: '0.85rem',
                }}>
                  <span style={{ color: 'var(--text-dim)', fontWeight: '600' }}>Your Doctor ID:</span>
                  <code style={{ color: 'var(--accent)', fontFamily: 'var(--font-mono)', fontWeight: '600' }}>
                    {doctorProfile.id}
                  </code>
                  <button
                    type="button"
                    onClick={handleCopyDoctorId}
                    className="btn btn-secondary btn-sm"
                    style={{ padding: '0.2rem 0.55rem', fontSize: '0.75rem', height: 'auto', minHeight: 'unset' }}
                    title="Copy Doctor UUID to give to patients"
                  >
                    {copiedId ? '✓ Copied' : 'Copy'}
                  </button>
                </div>
              )}
            </div>

            {/* Fee & Experience Pills */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'flex-end' }}>
              <div style={{
                padding: '0.65rem 1rem',
                borderRadius: 'var(--radius-md)',
                background: 'var(--bg-surface)',
                border: '1px solid var(--border)',
                textAlign: 'right',
              }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Consultation Fee
                </div>
                <div style={{ fontSize: '1.35rem', fontWeight: '700', color: 'var(--success)' }}>
                  ₹{doctorProfile?.consultationFee ? parseFloat(doctorProfile.consultationFee).toFixed(2) : '50.00'}
                </div>
              </div>
            </div>
          </div>

          {/* Quick Metrics Strip */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
            gap: '1rem',
            marginTop: '1.5rem',
            paddingTop: '1.25rem',
            borderTop: '1px solid var(--border)',
          }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', fontWeight: '600', textTransform: 'uppercase' }}>
                Total Slots
              </span>
              <span style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--text-main)' }}>
                {stats.total}
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', fontWeight: '600', textTransform: 'uppercase' }}>
                Available Openings
              </span>
              <span style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--success)' }}>
                {stats.available}
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', fontWeight: '600', textTransform: 'uppercase' }}>
                Booked Appointments
              </span>
              <span style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--primary)' }}>
                {stats.booked}
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', fontWeight: '600', textTransform: 'uppercase' }}>
                Completed Visits
              </span>
              <span style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--accent)' }}>
                {stats.completed}
              </span>
            </div>
          </div>
        </section>

        {/* Global Feedback Banners */}
        {message && (
          <div className="alert alert-success animate-fade-in">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
            <span>{message}</span>
            <button
              type="button"
              onClick={() => setMessage('')}
              style={{ marginLeft: 'auto', background: 'transparent', border: 'none', color: 'currentColor', cursor: 'pointer', fontSize: '1rem' }}
            >
              ✕
            </button>
          </div>
        )}

        {error && (
          <div className="alert alert-error animate-fade-in">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>{error}</span>
            <button
              type="button"
              onClick={() => setError('')}
              style={{ marginLeft: 'auto', background: 'transparent', border: 'none', color: 'currentColor', cursor: 'pointer', fontSize: '1rem' }}
            >
              ✕
            </button>
          </div>
        )}

        {/* SECTION 1: CREATE SLOTS TOOL (Bulk Generator & Single Slot) */}
        <section className="card" style={{ borderColor: 'rgba(99, 102, 241, 0.3)' }}>
          {/* Header & Tabs */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '1rem',
            marginBottom: '1.5rem',
            borderBottom: '1px solid var(--border)',
            paddingBottom: '1rem',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <div style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                background: 'var(--primary-light)',
                color: 'var(--primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                  <line x1="12" y1="14" x2="12" y2="18" />
                  <line x1="10" y1="16" x2="14" y2="16" />
                </svg>
              </div>
              <div>
                <h3 style={{ margin: 0 }}>Create Consultation Slots</h3>
                <p style={{ margin: 0, fontSize: '0.85rem' }}>
                  Generate scheduled openings for patient bookings
                </p>
              </div>
            </div>

            {/* Mode Switcher */}
            <div style={{
              display: 'flex',
              background: 'var(--bg-surface)',
              padding: '4px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border)',
            }}>
              <button
                type="button"
                onClick={() => setCreationMode('bulk')}
                className={`btn btn-sm ${creationMode === 'bulk' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ borderRadius: '6px' }}
              >
                ⚡ Bulk Shift Generator
              </button>
              <button
                type="button"
                onClick={() => setCreationMode('single')}
                className={`btn btn-sm ${creationMode === 'single' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ borderRadius: '6px' }}
              >
                ➕ Single Slot
              </button>
            </div>
          </div>

          {/* MODE A: BULK SHIFT GENERATOR */}
          {creationMode === 'bulk' && (
            <form onSubmit={handleCreateBulkSlots}>
              {/* Presets Bar */}
              <div style={{ marginBottom: '1.25rem' }}>
                <label className="form-label" style={{ marginBottom: '0.5rem', display: 'block' }}>
                  Shift Presets
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {[
                    { id: 'morning', label: '🌅 Morning Shift (09:00 AM - 01:00 PM)' },
                    { id: 'afternoon', label: '☀️ Afternoon Shift (02:00 PM - 05:00 PM)' },
                    { id: 'evening', label: '🌙 Evening Shift (05:30 PM - 08:30 PM)' },
                    { id: 'fullday', label: '🏥 Full Day (09:00 AM - 05:00 PM)' },
                    { id: 'custom', label: '⚙️ Custom Times' },
                  ].map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => handlePresetSelect(preset.id)}
                      className={`btn btn-sm ${shiftPreset === preset.id ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ fontSize: '0.8rem', padding: '0.4rem 0.75rem' }}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Input Grid */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '1rem',
                marginBottom: '1.25rem',
              }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" htmlFor="bulk-date">
                    Consultation Date
                  </label>
                  <input
                    id="bulk-date"
                    type="date"
                    value={bulkDate}
                    min={getTodayString()}
                    onChange={(e) => setBulkDate(e.target.value)}
                    required
                    className="form-input"
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" htmlFor="bulk-start">
                    Shift Start Time
                  </label>
                  <input
                    id="bulk-start"
                    type="time"
                    value={bulkStart}
                    onChange={(e) => {
                      setBulkStart(e.target.value);
                      setShiftPreset('custom');
                    }}
                    required
                    className="form-input"
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" htmlFor="bulk-end">
                    Shift End Time
                  </label>
                  <input
                    id="bulk-end"
                    type="time"
                    value={bulkEnd}
                    onChange={(e) => {
                      setBulkEnd(e.target.value);
                      setShiftPreset('custom');
                    }}
                    required
                    className="form-input"
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" htmlFor="bulk-duration">
                    Slot Duration
                  </label>
                  <select
                    id="bulk-duration"
                    value={bulkDuration}
                    onChange={(e) => {
                      setBulkDuration(e.target.value);
                      setShiftPreset('custom');
                    }}
                    className="form-input"
                  >
                    <option value="15">15 Minutes</option>
                    <option value="20">20 Minutes</option>
                    <option value="30">30 Minutes (Recommended)</option>
                    <option value="45">45 Minutes</option>
                    <option value="60">60 Minutes</option>
                  </select>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" htmlFor="bulk-buffer">
                    Break Between Slots
                  </label>
                  <select
                    id="bulk-buffer"
                    value={bulkBuffer}
                    onChange={(e) => setBulkBuffer(e.target.value)}
                    className="form-input"
                  >
                    <option value="0">0 Minutes (Continuous)</option>
                    <option value="5">5 Minutes Buffer</option>
                    <option value="10">10 Minutes Buffer</option>
                    <option value="15">15 Minutes Buffer</option>
                  </select>
                </div>
              </div>

              {/* Slot Preview & Selection */}
              <div style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                padding: '1.25rem',
                marginBottom: '1.25rem',
              }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '0.75rem',
                  marginBottom: '1rem',
                }}>
                  <div>
                    <span style={{ fontWeight: '600', color: 'var(--text-main)', fontSize: '0.95rem' }}>
                      Generated Slots Preview ({selectedPreviewCount} of {previewSlots.length} selected)
                    </span>
                    <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      Click on any slot to include or exclude it (e.g. for lunch or personal break).
                    </p>
                  </div>

                  {previewSlots.length > 0 && (
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        type="button"
                        onClick={() => toggleAllPreviewSlots(true)}
                        className="btn btn-secondary btn-sm"
                        style={{ fontSize: '0.75rem' }}
                      >
                        Select All
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleAllPreviewSlots(false)}
                        className="btn btn-secondary btn-sm"
                        style={{ fontSize: '0.75rem' }}
                      >
                        Deselect All
                      </button>
                    </div>
                  )}
                </div>

                {previewSlots.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                    Shift start time must be earlier than shift end time to generate slots.
                  </div>
                ) : (
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                    gap: '0.65rem',
                    maxHeight: '260px',
                    overflowY: 'auto',
                    paddingRight: '4px',
                  }}>
                    {previewSlots.map((slot) => (
                      <div
                        key={slot.id}
                        onClick={() => togglePreviewSlot(slot.id)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                          padding: '0.55rem 0.75rem',
                          borderRadius: 'var(--radius-sm)',
                          cursor: 'pointer',
                          userSelect: 'none',
                          border: slot.selected
                            ? '1px solid var(--primary)'
                            : '1px solid var(--border)',
                          background: slot.selected
                            ? 'rgba(99, 102, 241, 0.12)'
                            : 'rgba(255, 255, 255, 0.02)',
                          color: slot.selected ? 'var(--text-main)' : 'var(--text-dim)',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={slot.selected}
                          onChange={() => { }} // handled by parent div click
                          style={{ cursor: 'pointer', accentColor: 'var(--primary)' }}
                        />
                        <span style={{ fontSize: '0.85rem', fontWeight: slot.selected ? '600' : '400' }}>
                          {slot.startTime} - {slot.endTime}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={creatingSlots || selectedPreviewCount === 0}
                className="btn btn-primary btn-block"
                style={{ minHeight: '46px', fontSize: '1rem' }}
              >
                {creatingSlots ? (
                  <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                    <span style={{ display: 'inline-block', width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                    Generating Slots...
                  </span>
                ) : (
                  `⚡ Create ${selectedPreviewCount} Selected Consultation Slots for ${bulkDate}`
                )}
              </button>
            </form>
          )}

          {/* MODE B: SINGLE SLOT CREATOR */}
          {creationMode === 'single' && (
            <form onSubmit={handleCreateSingleSlot}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: '1rem',
                marginBottom: '1.25rem',
              }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" htmlFor="single-date">
                    Consultation Date
                  </label>
                  <input
                    id="single-date"
                    type="date"
                    value={singleDate}
                    min={getTodayString()}
                    onChange={(e) => setSingleDate(e.target.value)}
                    required
                    className="form-input"
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" htmlFor="single-start">
                    Slot Start Time
                  </label>
                  <input
                    id="single-start"
                    type="time"
                    value={singleStart}
                    onChange={(e) => setSingleStart(e.target.value)}
                    required
                    className="form-input"
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" htmlFor="single-end">
                    Slot End Time
                  </label>
                  <input
                    id="single-end"
                    type="time"
                    value={singleEnd}
                    onChange={(e) => setSingleEnd(e.target.value)}
                    required
                    className="form-input"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={creatingSlots}
                className="btn btn-primary btn-block"
                style={{ minHeight: '46px' }}
              >
                {creatingSlots ? 'Creating Slot...' : '➕ Add Single Availability Slot'}
              </button>
            </form>
          )}
        </section>

        {/* SECTION 2: DOCTOR'S SLOTS SCHEDULE & APPOINTMENTS (Two Columns) */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 540px), 1fr))',
          gap: '1.5rem',
          alignItems: 'start',
        }}>

          {/* COLUMN 1: DOCTOR'S SLOTS SCHEDULE */}
          <section className="card">
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '0.75rem',
              marginBottom: '1.25rem',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  background: 'var(--accent-light)',
                  color: 'var(--accent)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                </div>
                <div>
                  <h3 style={{ margin: 0 }}>My Schedule & Slots</h3>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>
                    {filteredSlots.length} {filteredSlots.length === 1 ? 'Slot' : 'Slots'} displayed
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={fetchMySlots}
                disabled={loadingSlots}
                className="btn btn-secondary btn-sm"
                title="Refresh slots list"
              >
                {loadingSlots ? 'Refreshing...' : '↻ Refresh'}
              </button>
            </div>

            {/* Filter Bar */}
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '0.5rem',
              marginBottom: '1rem',
              background: 'var(--bg-surface)',
              padding: '0.75rem',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border)',
              alignItems: 'center',
            }}>
              {/* Date Filter Tabs */}
              <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                {[
                  { id: 'all', label: 'All Dates' },
                  { id: 'today', label: 'Today' },
                  { id: 'upcoming', label: 'Upcoming' },
                  { id: 'custom', label: 'Pick Date' },
                ].map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setSlotDateFilter(f.id)}
                    className={`btn btn-sm ${slotDateFilter === f.id ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem' }}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              {/* Custom Date Input if selected */}
              {slotDateFilter === 'custom' && (
                <input
                  type="date"
                  value={customFilterDate}
                  onChange={(e) => setCustomFilterDate(e.target.value)}
                  className="form-input"
                  style={{ width: 'auto', padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                />
              )}

              {/* Status Filter */}
              <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.35rem' }}>
                {[
                  { id: 'all', label: 'All' },
                  { id: 'available', label: 'Open' },
                  { id: 'booked', label: 'Booked' },
                ].map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSlotStatusFilter(s.id)}
                    className={`btn btn-sm ${slotStatusFilter === s.id ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ fontSize: '0.75rem', padding: '0.25rem 0.55rem' }}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Slot List */}
            {loadingSlots ? (
              <div style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
                Loading consultation schedule...
              </div>
            ) : filteredSlots.length === 0 ? (
              <div style={{
                textAlign: 'center',
                padding: '3rem 1.5rem',
                color: 'var(--text-muted)',
                background: 'var(--bg-surface)',
                borderRadius: 'var(--radius-md)',
                border: '1px dashed var(--border)',
              }}>
                <div style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '50%',
                  background: 'rgba(255, 255, 255, 0.04)',
                  margin: '0 auto 0.75rem auto',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--text-dim)',
                }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                </div>
                <h4 style={{ color: 'var(--text-main)', marginBottom: '0.25rem' }}>No Slots Found</h4>
                <p style={{ margin: 0, fontSize: '0.85rem' }}>
                  {slotDateFilter !== 'all' || slotStatusFilter !== 'all'
                    ? 'No consultation slots match the selected filters.'
                    : 'You haven’t created any availability slots yet. Use the generator above to add slots!'}
                </p>
              </div>
            ) : (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem',
                maxHeight: '560px',
                overflowY: 'auto',
                paddingRight: '4px',
              }}>
                {filteredSlots.map((slot) => {
                  const appointment = slot.Appointment;
                  const patient = appointment?.User;

                  return (
                    <div
                      key={slot.id}
                      style={{
                        padding: '0.85rem 1rem',
                        borderRadius: 'var(--radius-md)',
                        background: 'var(--bg-surface)',
                        border: slot.isBooked
                          ? '1px solid rgba(99, 102, 241, 0.3)'
                          : '1px solid var(--border)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '0.75rem',
                        transition: 'border-color 0.2s ease',
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                          <span style={{ fontWeight: '600', color: 'var(--text-main)', fontSize: '0.95rem' }}>
                            {slot.date}
                          </span>
                          <span style={{
                            fontSize: '0.825rem',
                            padding: '0.15rem 0.45rem',
                            borderRadius: '4px',
                            background: 'rgba(255, 255, 255, 0.06)',
                            color: 'var(--text-muted)',
                            fontFamily: 'var(--font-mono)',
                          }}>
                            {slot.startTime} - {slot.endTime}
                          </span>
                        </div>

                        {slot.isBooked ? (
                          <div style={{ fontSize: '0.825rem', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span>👤 Reserved by:</span>
                            <strong>{patient?.name || 'Booked Patient'}</strong>
                            {patient?.phone && (
                              <span style={{ color: 'var(--text-dim)' }}>({patient.phone})</span>
                            )}
                          </div>
                        ) : (
                          <div style={{ fontSize: '0.8rem', color: 'var(--success)' }}>
                            ● Open for patient booking
                          </div>
                        )}
                      </div>

                      {/* Action buttons */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        {slot.isBooked ? (
                          <>
                            {appointment?.status === 'completed' ? (
                              <span className="badge badge-success">✓ Completed</span>
                            ) : (
                              <>
                                <span className="badge badge-primary">Booked</span>
                                {appointment && (
                                  <button
                                    type="button"
                                    onClick={() => handleCompleteAppointment(appointment.id)}
                                    disabled={completingAppointmentId === appointment.id}
                                    className="btn btn-success btn-sm"
                                    style={{ fontSize: '0.8rem', padding: '0.35rem 0.65rem' }}
                                    title="Confirm that this consultation slot has been completed"
                                  >
                                    {completingAppointmentId === appointment.id ? 'Saving...' : '✓ Mark Completed'}
                                  </button>
                                )}
                              </>
                            )}
                            {appointment && (
                              <button
                                type="button"
                                onClick={() => setSelectedAppointmentId(appointment.id)}
                                className="btn btn-secondary btn-sm"
                                style={{ fontSize: '0.8rem', padding: '0.35rem 0.65rem' }}
                              >
                                Prescribe
                              </button>
                            )}
                          </>
                        ) : (
                          <>
                            <span className="badge badge-success">Available</span>
                            <button
                              type="button"
                              onClick={() => handleDeleteSlot(slot.id)}
                              disabled={deletingSlotId === slot.id}
                              className="btn btn-danger btn-sm"
                              style={{ fontSize: '0.8rem', padding: '0.35rem 0.65rem' }}
                              title="Delete this availability slot"
                            >
                              {deletingSlotId === slot.id ? 'Deleting...' : 'Delete'}
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* COLUMN 2: BOOKED PATIENT APPOINTMENTS & PRESCRIPTION DRAWER */}
          <section className="card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '1.25rem' }}>
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: 'rgba(16, 185, 129, 0.15)',
                color: 'var(--success)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                  <polyline points="10 9 9 9 8 9" />
                </svg>
              </div>
              <div>
                <h3 style={{ margin: 0 }}>Patient Appointments</h3>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>
                  {appointments.length} Consultations Booked
                </span>
              </div>
            </div>

            {loadingAppointments ? (
              <div style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
                Loading appointment records...
              </div>
            ) : appointments.length === 0 ? (
              <div style={{
                textAlign: 'center',
                padding: '3rem 1.5rem',
                color: 'var(--text-muted)',
                background: 'var(--bg-surface)',
                borderRadius: 'var(--radius-md)',
                border: '1px dashed var(--border)',
              }}>
                <p style={{ margin: 0 }}>No patients have booked appointments yet.</p>
                <p style={{ margin: '0.4rem 0 0 0', fontSize: '0.85rem', color: 'var(--text-dim)' }}>
                  As patients reserve your consultation slots, their details will appear here.
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
                {appointments.map((app) => (
                  <div
                    key={app.id}
                    style={{
                      padding: '1rem',
                      borderRadius: 'var(--radius-md)',
                      background: 'var(--bg-surface)',
                      border: selectedAppointmentId === app.id ? '2px solid var(--primary)' : '1px solid var(--border)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: '0.75rem',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: '600', color: 'var(--text-main)', fontSize: '0.95rem' }}>
                        Patient: {app.User?.name || 'Walk-in Patient'}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                        📅 {app.DoctorSlot?.date || 'N/A'} ({app.DoctorSlot?.startTime} - {app.DoctorSlot?.endTime})
                      </div>
                      {app.User?.email && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '2px' }}>
                          Email: {app.User.email} {app.User.phone && `| Tel: ${app.User.phone}`}
                        </div>
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      {app.status === 'completed' ? (
                        <span className="badge badge-success">✓ Completed</span>
                      ) : (
                        <>
                          <span className="badge badge-warning">Booked</span>
                          <button
                            type="button"
                            onClick={() => handleCompleteAppointment(app.id)}
                            disabled={completingAppointmentId === app.id}
                            className="btn btn-success btn-sm"
                            style={{ fontSize: '0.8rem', padding: '0.35rem 0.65rem' }}
                            title="Confirm that you completed this consultation slot"
                          >
                            {completingAppointmentId === app.id ? 'Saving...' : '✓ Mark Completed'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setSelectedAppointmentId(app.id)}
                            className="btn btn-secondary btn-sm"
                            style={{ fontSize: '0.8rem', padding: '0.35rem 0.65rem' }}
                          >
                            Prescribe
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Digital Prescription Form Drawer */}
            {selectedAppointmentId && (
              <form
                onSubmit={handleAddPrescription}
                style={{
                  marginTop: '1.25rem',
                  paddingTop: '1.25rem',
                  borderTop: '1px solid var(--border)',
                  background: 'rgba(99, 102, 241, 0.04)',
                  padding: '1.25rem',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid rgba(99, 102, 241, 0.2)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h4 style={{ margin: 0, color: 'var(--text-main)' }}>
                    Write Digital Prescription
                  </h4>
                  <button
                    type="button"
                    onClick={() => setSelectedAppointmentId('')}
                    style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: '1.1rem' }}
                  >
                    ✕
                  </button>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="pres-diag">
                    Diagnosis / Clinical Findings
                  </label>
                  <input
                    id="pres-diag"
                    type="text"
                    value={diagnosis}
                    onChange={(e) => setDiagnosis(e.target.value)}
                    placeholder="e.g. Acute Upper Respiratory Infection, Mild Hypertension"
                    required
                    className="form-input"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="pres-meds">
                    Medicines & Dosage Schedule
                  </label>
                  <textarea
                    id="pres-meds"
                    value={medicines}
                    onChange={(e) => setMedicines(e.target.value)}
                    placeholder="1. Amoxicillin 500mg - 1 capsule tid x 7 days&#10;2. Paracetamol 650mg - 1 tab prn for fever"
                    required
                    className="form-textarea"
                    rows={4}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="pres-instructions">
                    Special Advice & Lifestyle Instructions (Optional)
                  </label>
                  <input
                    id="pres-instructions"
                    type="text"
                    value={instructions}
                    onChange={(e) => setInstructions(e.target.value)}
                    placeholder="e.g. Drink warm fluids, follow up in 5 days if fever persists."
                    className="form-input"
                  />
                </div>

                <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
                  <button
                    type="submit"
                    disabled={submittingPrescription}
                    className="btn btn-success"
                    style={{ flex: 1, minHeight: '44px' }}
                  >
                    {submittingPrescription ? 'Issuing Prescription...' : 'Issue Digital Prescription'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedAppointmentId('')}
                    className="btn btn-secondary"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </section>

        </div>

      </main>
    </div>
  );
}
