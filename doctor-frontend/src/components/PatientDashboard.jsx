import { useState, useEffect, useCallback, useMemo } from 'react';
import API from '../services/api';
import Navbar from './Navbar';

export default function PatientDashboard() {
  // Doctor selection & Directory state
  const [doctors, setDoctors] = useState([]);
  const [loadingDoctors, setLoadingDoctors] = useState(false);
  const [selectedDoctorId, setSelectedDoctorId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSpecialty, setSelectedSpecialty] = useState('all');

  // Slots state
  const [slots, setSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedDate, setSelectedDate] = useState('all');
  const [bookingSlotId, setBookingSlotId] = useState(null);

  // Patient bookings & history state
  const [myBookings, setMyBookings] = useState([]);
  const [loadingBookings, setLoadingBookings] = useState(false);
  const [activeTab, setActiveTab] = useState('find'); // 'find', 'my-appointments', 'notifications'
  const [viewPrescription, setViewPrescription] = useState(null);

  // Notifications state
  const [notifications, setNotifications] = useState([]);
  const [loadingNotifications, setLoadingNotifications] = useState(false);

  // Cancellation & Rescheduling modals
  const [cancellingAppointment, setCancellingAppointment] = useState(null);
  const [cancellingLoading, setCancellingLoading] = useState(false);

  const [reschedulingAppointment, setReschedulingAppointment] = useState(null);
  const [rescheduleData, setRescheduleData] = useState(null);
  const [rescheduleLoading, setRescheduleLoading] = useState(false);
  const [selectedNewSlotId, setSelectedNewSlotId] = useState('');
  const [confirmingReschedule, setConfirmingReschedule] = useState(false);

  // Global messages
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  // 1. Fetch all approved doctors on mount
  const fetchDoctors = useCallback(async () => {
    setLoadingDoctors(true);
    try {
      const response = await API.get('/appointments/doctors');
      const docList = response.data || [];
      setDoctors(docList);
      // Auto-select first doctor if available and none selected
      if (docList.length > 0 && !selectedDoctorId) {
        setSelectedDoctorId(docList[0].id);
      }
    } catch (err) {
      console.error('Error fetching doctors:', err);
    } finally {
      setLoadingDoctors(false);
    }
  }, [selectedDoctorId]);

  // 2. Fetch slots for the currently selected doctor
  const fetchSlots = useCallback(async (docId) => {
    const idToFetch = docId || selectedDoctorId;
    if (!idToFetch) {
      setSlots([]);
      return;
    }

    setLoadingSlots(true);
    setError('');
    try {
      const response = await API.get(`/appointments/slots/${idToFetch}`);
      setSlots(response.data || []);
    } catch (err) {
      console.error('Error fetching slots:', err);
      setError(err.response?.data?.message || 'Could not load slots for this doctor.');
      setSlots([]);
    } finally {
      setLoadingSlots(false);
    }
  }, [selectedDoctorId]);

  // 3. Fetch patient's booked appointments
  const fetchMyBookings = useCallback(async () => {
    setLoadingBookings(true);
    try {
      const response = await API.get('/appointments/patient-appointments');
      setMyBookings(response.data || []);
    } catch (err) {
      console.error('Error fetching patient appointments:', err);
    } finally {
      setLoadingBookings(false);
    }
  }, []);

  // 4. Fetch notifications
  const fetchNotifications = useCallback(async () => {
    setLoadingNotifications(true);
    try {
      const response = await API.get('/notifications');
      setNotifications(response.data || []);
    } catch (err) {
      console.error('Error fetching notifications:', err);
    } finally {
      setLoadingNotifications(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchDoctors();
    fetchMyBookings();
    fetchNotifications();

    // Auto-poll notifications every 10 seconds for real-time reminders
    const interval = setInterval(fetchNotifications, 10000);
    return () => clearInterval(interval);
  }, [fetchDoctors, fetchMyBookings, fetchNotifications]);

  // Mark single notification as read
  const handleMarkNotificationRead = async (id) => {
    try {
      await API.put(`/notifications/${id}/read`);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
    } catch (err) {
      console.error('Error marking notification read:', err);
    }
  };

  // Check 24-hour difference helper for UI feedback
  const getHoursUntilAppointment = (dateStr, startTime) => {
    if (!dateStr || !startTime) return 999;
    try {
      const [year, month, day] = dateStr.split('-').map(Number);
      const match = String(startTime).trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
      if (!match) return 999;

      let hours = parseInt(match[1], 10);
      const minutes = parseInt(match[2], 10);
      const ampm = match[3] ? match[3].toUpperCase() : null;

      if (ampm === 'PM' && hours < 12) hours += 12;
      if (ampm === 'AM' && hours === 12) hours = 0;

      const appDate = new Date(year, month - 1, day, hours, minutes);
      const diffMs = appDate.getTime() - new Date().getTime();
      return diffMs / (1000 * 60 * 60);
    } catch {
      return 999;
    }
  };

  // Open Cancel Modal
  const handleOpenCancelModal = (appointment) => {
    setCancellingAppointment(appointment);
    setError('');
    setMessage('');
  };

  // Confirm Cancellation
  const handleConfirmCancel = async () => {
    if (!cancellingAppointment) return;
    setCancellingLoading(true);
    setError('');
    setMessage('');
    try {
      const response = await API.put(`/appointments/${cancellingAppointment.id}/cancel`);
      setMessage(response.data?.message || 'Appointment cancelled successfully and slot released.');
      setCancellingAppointment(null);
      fetchMyBookings();
      fetchNotifications();
      if (selectedDoctorId) fetchSlots(selectedDoctorId);
    } catch (err) {
      console.error('Error cancelling appointment:', err);
      setError(err.response?.data?.message || 'Failed to cancel appointment.');
    } finally {
      setCancellingLoading(false);
    }
  };

  // Open Reschedule Modal & fetch auto-suggested next slot
  const handleOpenRescheduleModal = async (appointment) => {
    setReschedulingAppointment(appointment);
    setRescheduleData(null);
    setSelectedNewSlotId('');
    setRescheduleLoading(true);
    setError('');
    setMessage('');

    try {
      const response = await API.get(`/appointments/${appointment.id}/reschedule-suggestion`);
      setRescheduleData(response.data);
      if (response.data?.nextAvailableSlot) {
        setSelectedNewSlotId(response.data.nextAvailableSlot.id);
      }
    } catch (err) {
      console.error('Error fetching reschedule suggestions:', err);
      setError(err.response?.data?.message || 'Cannot reschedule this appointment.');
      setReschedulingAppointment(null);
    } finally {
      setRescheduleLoading(false);
    }
  };

  // Confirm Reschedule to selected slot
  const handleConfirmReschedule = async () => {
    if (!reschedulingAppointment) return;
    setConfirmingReschedule(true);
    setError('');
    setMessage('');

    try {
      const response = await API.put(`/appointments/${reschedulingAppointment.id}/reschedule-confirm`, {
        newSlotId: selectedNewSlotId || undefined,
      });
      setMessage(response.data?.message || 'Appointment rescheduled successfully!');
      setReschedulingAppointment(null);
      setRescheduleData(null);
      fetchMyBookings();
      fetchNotifications();
      if (selectedDoctorId) fetchSlots(selectedDoctorId);
    } catch (err) {
      console.error('Error confirming reschedule:', err);
      setError(err.response?.data?.message || 'Failed to reschedule appointment.');
    } finally {
      setConfirmingReschedule(false);
    }
  };

  // When selected doctor changes, automatically fetch their available slots
  useEffect(() => {
    if (selectedDoctorId) {
      fetchSlots(selectedDoctorId);
      setSelectedDate('all');
    }
  }, [selectedDoctorId, fetchSlots]);

  // Handle booking an available slot
  const handleBookSlot = async (slotId) => {
    setBookingSlotId(slotId);
    setError('');
    setMessage('');

    try {
      const response = await API.post('/appointments/book', { slotId });
      setMessage(response.data?.message || 'Appointment confirmed and booked successfully!');
      // Refresh current doctor's slots and patient's bookings
      fetchSlots(selectedDoctorId);
      fetchMyBookings();
    } catch (err) {
      console.error('Error booking slot:', err);
      setError(err.response?.data?.message || 'Booking failed. This slot may have just been reserved by someone else.');
    } finally {
      setBookingSlotId(null);
    }
  };

  // Extract unique specializations for filter tabs
  const specialties = useMemo(() => {
    const set = new Set();
    doctors.forEach((d) => {
      if (d.specialization) set.add(d.specialization);
    });
    return Array.from(set);
  }, [doctors]);

  // Filter doctors based on search query and specialty
  const filteredDoctors = useMemo(() => {
    return doctors.filter((doc) => {
      const matchesSearch =
        !searchQuery.trim() ||
        (doc.User?.name && doc.User.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (doc.specialization && doc.specialization.toLowerCase().includes(searchQuery.toLowerCase())) ||
        doc.id.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesSpec = selectedSpecialty === 'all' || doc.specialization === selectedSpecialty;

      return matchesSearch && matchesSpec;
    });
  }, [doctors, searchQuery, selectedSpecialty]);

  // Active doctor object
  const activeDoctor = useMemo(() => {
    return doctors.find((d) => d.id === selectedDoctorId) || null;
  }, [doctors, selectedDoctorId]);

  // Unique dates in available slots
  const availableDates = useMemo(() => {
    const dateSet = new Set(slots.map((s) => s.date));
    return Array.from(dateSet).sort();
  }, [slots]);

  // Filtered slots by chosen date
  const filteredSlots = useMemo(() => {
    if (selectedDate === 'all') return slots;
    return slots.filter((s) => s.date === selectedDate);
  }, [slots, selectedDate]);

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
      <Navbar portalTitle="Patient Appointments Portal" portalRole="patient" />

      <main className="page-container animate-fade-in">
        {/* Welcome Card & Tab Toggle */}
        <div className="card" style={{
          background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.14) 0%, rgba(6, 182, 212, 0.08) 100%)',
          borderColor: 'rgba(99, 102, 241, 0.28)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
        }}>
          <div>
            <h2 style={{ margin: 0 }}>Patient Appointments & Care</h2>
            <p style={{ marginTop: '0.35rem', marginBottom: 0, color: 'var(--text-muted)' }}>
              Browse approved healthcare specialists, view real-time open consultation slots, and book your visit instantly.
            </p>
          </div>

          <div style={{
            display: 'flex',
            background: 'var(--bg-surface)',
            padding: '4px',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border)',
            flexWrap: 'wrap',
            gap: '4px',
          }}>
            <button
              type="button"
              onClick={() => setActiveTab('find')}
              className={`btn btn-sm ${activeTab === 'find' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ borderRadius: '6px' }}
            >
              🩺 Find Doctors & Book Slots
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('my-appointments');
                fetchMyBookings();
              }}
              className={`btn btn-sm ${activeTab === 'my-appointments' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ borderRadius: '6px' }}
            >
              📋 My Bookings ({myBookings.length})
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('notifications');
                fetchNotifications();
              }}
              className={`btn btn-sm ${activeTab === 'notifications' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ borderRadius: '6px', position: 'relative' }}
            >
              🔔 Notifications
              {notifications.filter((n) => !n.isRead).length > 0 && (
                <span
                  style={{
                    marginLeft: '6px',
                    background: 'var(--danger)',
                    color: '#fff',
                    borderRadius: '10px',
                    padding: '1px 6px',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                  }}
                >
                  {notifications.filter((n) => !n.isRead).length}
                </span>
              )}
            </button>
          </div>
        </div>

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

        {/* TAB 1: DOCTOR DIRECTORY & LIVE SLOTS */}
        {activeTab === 'find' && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 460px), 1fr))',
            gap: '1.5rem',
            alignItems: 'start',
          }}>
            {/* COLUMN 1: DOCTOR SELECTOR / DIRECTORY */}
            <section className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                  <div style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '10px',
                    background: 'var(--primary-light)',
                    color: 'var(--primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                      <circle cx="8.5" cy="7" r="4" />
                      <polyline points="17 11 19 13 23 9" />
                    </svg>
                  </div>
                  <div>
                    <h3 style={{ margin: 0 }}>Select a Doctor</h3>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>
                      {doctors.length} approved practitioners available
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={fetchDoctors}
                  disabled={loadingDoctors}
                  className="btn btn-secondary btn-sm"
                  title="Reload doctors list"
                >
                  ↻ Refresh
                </button>
              </div>

              {/* Search & Specialty Filters */}
              <div style={{ marginBottom: '1rem' }}>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="🔍 Search doctor by name or specialty..."
                  className="form-input"
                  style={{ marginBottom: '0.75rem' }}
                />

                {specialties.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                    <button
                      type="button"
                      onClick={() => setSelectedSpecialty('all')}
                      className={`btn btn-sm ${selectedSpecialty === 'all' ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ fontSize: '0.75rem', padding: '0.2rem 0.55rem' }}
                    >
                      All Specialties
                    </button>
                    {specialties.map((spec) => (
                      <button
                        key={spec}
                        type="button"
                        onClick={() => setSelectedSpecialty(spec)}
                        className={`btn btn-sm ${selectedSpecialty === spec ? 'btn-primary' : 'btn-secondary'}`}
                        style={{ fontSize: '0.75rem', padding: '0.2rem 0.55rem' }}
                      >
                        {spec}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Doctors List */}
              {loadingDoctors ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                  Loading available doctors...
                </div>
              ) : filteredDoctors.length === 0 ? (
                <div style={{
                  textAlign: 'center',
                  padding: '2.5rem 1rem',
                  color: 'var(--text-muted)',
                  background: 'var(--bg-surface)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px dashed var(--border)',
                }}>
                  No doctors found matching your criteria.
                </div>
              ) : (
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem',
                  maxHeight: '520px',
                  overflowY: 'auto',
                  paddingRight: '4px',
                }}>
                  {filteredDoctors.map((doc) => {
                    const isSelected = selectedDoctorId === doc.id;

                    return (
                      <div
                        key={doc.id}
                        onClick={() => setSelectedDoctorId(doc.id)}
                        style={{
                          padding: '1rem',
                          borderRadius: 'var(--radius-md)',
                          background: isSelected ? 'rgba(99, 102, 241, 0.12)' : 'var(--bg-surface)',
                          border: isSelected ? '2px solid var(--primary)' : '1px solid var(--border)',
                          cursor: 'pointer',
                          transition: 'all 0.18s ease',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: '0.75rem',
                        }}
                      >
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                            <strong style={{ fontSize: '1rem', color: isSelected ? 'var(--primary)' : 'var(--text-main)' }}>
                              Dr. {doc.User?.name || 'Practitioner'}
                            </strong>
                            <span className="badge badge-success" style={{ fontSize: '0.7rem' }}>
                              {doc.specialization}
                            </span>
                          </div>

                          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            {doc.experienceYears} Years Experience • {doc.User?.phone || 'Verified'}
                          </div>

                          {doc.bio && (
                            <p style={{ margin: '0.35rem 0 0 0', fontSize: '0.8rem', color: 'var(--text-dim)', fontStyle: 'italic' }}>
                              "{doc.bio}"
                            </p>
                          )}
                        </div>

                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <div style={{ fontSize: '1.15rem', fontWeight: '700', color: 'var(--success)' }}>
                            ₹{doc.totalAmount || Math.round(parseFloat(doc.consultationFee || 50) * 1.1)}
                          </div>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)', display: 'block' }}>Total Payable</span>
                          <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                            (₹{parseFloat(doc.consultationFee || 50).toFixed(0)} + ₹{doc.adminCommission || Math.round(parseFloat(doc.consultationFee || 50) * 0.1)} fee)
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* COLUMN 2: REAL-TIME DOCTOR SLOTS */}
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
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                      <line x1="16" y1="2" x2="16" y2="6" />
                      <line x1="8" y1="2" x2="8" y2="6" />
                      <line x1="3" y1="10" x2="21" y2="10" />
                    </svg>
                  </div>
                  <div>
                    <h3 style={{ margin: 0 }}>
                      {activeDoctor ? `Available Slots for Dr. ${activeDoctor.User?.name || ''}` : 'Doctor Consultation Slots'}
                    </h3>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>
                      {filteredSlots.length} open {filteredSlots.length === 1 ? 'opening' : 'openings'} available
                    </span>
                  </div>
                </div>

                {selectedDoctorId && (
                  <button
                    type="button"
                    onClick={() => fetchSlots(selectedDoctorId)}
                    disabled={loadingSlots}
                    className="btn btn-secondary btn-sm"
                    title="Reload slots"
                  >
                    {loadingSlots ? 'Loading...' : '↻ Refresh Slots'}
                  </button>
                )}
              </div>

              {/* Consultation Fee Breakdown Banner (Doctor Fee + Commission) */}
              {activeDoctor && (
                <div style={{
                  padding: '0.85rem 1rem',
                  borderRadius: 'var(--radius-sm)',
                  background: 'rgba(99, 102, 241, 0.06)',
                  border: '1px solid rgba(99, 102, 241, 0.25)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '0.75rem',
                  marginBottom: '1rem',
                }}>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 600 }}>
                      Consultation Fee Breakdown
                    </div>
                    <div style={{ display: 'flex', gap: '0.85rem', marginTop: '3px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      <span>Doctor Fee: <strong style={{ color: 'var(--text-main)' }}>₹{activeDoctor.consultationFee}</strong></span>
                      <span>•</span>
                      <span>Platform Commission ({activeDoctor.commissionPercentage || 10}%): <strong style={{ color: 'var(--warning)' }}>₹{activeDoctor.adminCommission || Math.round(parseFloat(activeDoctor.consultationFee || 50) * 0.1)}</strong></span>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>Total Amount Payable</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--success)' }}>
                      ₹{activeDoctor.totalAmount || Math.round(parseFloat(activeDoctor.consultationFee || 50) * 1.1)}
                    </div>
                  </div>
                </div>
              )}

              {/* Date Filter Bar */}
              {availableDates.length > 1 && (
                <div style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '0.35rem',
                  marginBottom: '1rem',
                  padding: '0.65rem',
                  background: 'var(--bg-surface)',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border)',
                }}>
                  <button
                    type="button"
                    onClick={() => setSelectedDate('all')}
                    className={`btn btn-sm ${selectedDate === 'all' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem' }}
                  >
                    All Dates ({slots.length})
                  </button>
                  {availableDates.map((d) => {
                    const count = slots.filter((s) => s.date === d).length;
                    return (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setSelectedDate(d)}
                        className={`btn btn-sm ${selectedDate === d ? 'btn-primary' : 'btn-secondary'}`}
                        style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem' }}
                      >
                        {d} ({count})
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Slots Grid */}
              {loadingSlots ? (
                <div style={{ textAlign: 'center', padding: '3rem 1.5rem', color: 'var(--text-muted)' }}>
                  Loading available consultation hours...
                </div>
              ) : !selectedDoctorId ? (
                <div style={{ textAlign: 'center', padding: '3rem 1.5rem', color: 'var(--text-muted)' }}>
                  Please select a doctor from the list on the left to see their open consultation slots.
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
                  <h4 style={{ color: 'var(--text-main)', marginBottom: '0.25rem' }}>No Open Slots Right Now</h4>
                  <p style={{ margin: 0, fontSize: '0.85rem' }}>
                    Dr. {activeDoctor?.User?.name || 'this practitioner'} currently has no open consultation slots.
                    Please check back later or select another doctor from the list.
                  </p>
                </div>
              ) : (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                  gap: '0.75rem',
                  maxHeight: '520px',
                  overflowY: 'auto',
                  paddingRight: '4px',
                }}>
                  {filteredSlots.map((slot) => (
                    <div
                      key={slot.id}
                      style={{
                        padding: '1rem',
                        borderRadius: 'var(--radius-md)',
                        background: 'var(--bg-surface)',
                        border: '1px solid var(--border)',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        gap: '0.85rem',
                        transition: 'transform 0.15s ease, border-color 0.15s ease',
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                          <span className="badge badge-success" style={{ fontSize: '0.7rem' }}>Open Slot</span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                            {slot.date}
                          </span>
                        </div>

                        <div style={{
                          fontSize: '0.925rem',
                          fontWeight: '600',
                          color: 'var(--text-main)',
                          fontFamily: 'var(--font-mono)',
                          marginBottom: '0.25rem',
                        }}>
                          {slot.startTime} - {slot.endTime}
                        </div>

                        {activeDoctor && (
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            <div>
                              Total: <strong style={{ color: 'var(--success)' }}>₹{activeDoctor.totalAmount || Math.round(parseFloat(activeDoctor.consultationFee || 50) * 1.1)}</strong>
                            </div>
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>
                              (₹{activeDoctor.consultationFee} + ₹{activeDoctor.adminCommission || Math.round(parseFloat(activeDoctor.consultationFee || 50) * 0.1)} fee)
                            </span>
                          </div>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => handleBookSlot(slot.id)}
                        disabled={bookingSlotId === slot.id}
                        className="btn btn-success btn-block btn-sm"
                        style={{ minHeight: '38px', fontWeight: '600' }}
                      >
                        {bookingSlotId === slot.id ? 'Reserving...' : 'Book This Slot'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}

        {/* TAB 2: MY BOOKINGS & DIGITAL PRESCRIPTIONS */}
        {activeTab === 'my-appointments' && (
          <section className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  background: 'var(--primary-light)',
                  color: 'var(--primary)',
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
                  <h3 style={{ margin: 0 }}>My Reserved Consultations</h3>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>
                    {myBookings.length} Total Bookings
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={fetchMyBookings}
                disabled={loadingBookings}
                className="btn btn-secondary btn-sm"
              >
                {loadingBookings ? 'Refreshing...' : '↻ Refresh'}
              </button>
            </div>

            {loadingBookings ? (
              <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                Loading your appointment history...
              </div>
            ) : myBookings.length === 0 ? (
              <div style={{
                textAlign: 'center',
                padding: '3rem 1.5rem',
                color: 'var(--text-muted)',
                background: 'var(--bg-surface)',
                borderRadius: 'var(--radius-md)',
                border: '1px dashed var(--border)',
              }}>
                <p style={{ margin: 0 }}>You don't have any booked appointments yet.</p>
                <button
                  type="button"
                  onClick={() => setActiveTab('find')}
                  className="btn btn-primary"
                  style={{ marginTop: '1rem' }}
                >
                  Browse Available Slots & Book Now →
                </button>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 380px), 1fr))', gap: '1rem' }}>
                {myBookings.map((b) => (
                  <div
                    key={b.id}
                    style={{
                      padding: '1.25rem',
                      borderRadius: 'var(--radius-md)',
                      background: 'var(--bg-surface)',
                      border: '1px solid var(--border)',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      gap: '1rem',
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                        <div>
                          <strong style={{ fontSize: '1.05rem', color: 'var(--text-main)' }}>
                            Dr. {b.DoctorProfile?.User?.name || 'Specialist'}
                          </strong>
                          <div style={{ fontSize: '0.8rem', color: 'var(--primary)', marginTop: '2px' }}>
                            {b.DoctorProfile?.specialization || 'General Consultation'}
                          </div>
                        </div>

                        <span className={`badge ${b.status === 'completed' ? 'badge-success' : 'badge-primary'}`}>
                          {b.status}
                        </span>
                      </div>

                      <div style={{
                        marginTop: '0.65rem',
                        padding: '0.65rem 0.85rem',
                        borderRadius: 'var(--radius-sm)',
                        background: 'rgba(255, 255, 255, 0.03)',
                        border: '1px solid var(--border)',
                        fontSize: '0.85rem',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                          <span>📅</span>
                          <strong>{b.DoctorSlot?.date || 'N/A'}</strong>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)' }}>
                          <span>⏰</span>
                          <span>{b.DoctorSlot?.startTime} - {b.DoctorSlot?.endTime}</span>
                        </div>
                      </div>

                      {/* Fee Breakdown: Doctor fee + Commission + Total */}
                      <div style={{
                        marginTop: '0.65rem',
                        padding: '0.65rem 0.85rem',
                        borderRadius: 'var(--radius-sm)',
                        background: 'rgba(255, 255, 255, 0.02)',
                        border: '1px solid var(--border)',
                        fontSize: '0.8rem',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '3px',
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--text-muted)' }}>Doctor Consultation Fee:</span>
                          <span style={{ color: 'var(--text-main)', fontWeight: 600 }}>₹{parseFloat(b.consultationFee || 0).toFixed(0)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--text-muted)' }}>Platform Service Fee:</span>
                          <span style={{ color: 'var(--warning)', fontWeight: 600 }}>₹{parseFloat(b.adminCommission || 0).toFixed(0)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border)', paddingTop: '4px', marginTop: '2px' }}>
                          <span style={{ color: 'var(--text-main)', fontWeight: 700 }}>Total Paid:</span>
                          <span style={{ color: 'var(--success)', fontWeight: 800 }}>₹{parseFloat(b.totalAmount || 0).toFixed(0)}</span>
                        </div>
                      </div>

                      {b.DoctorProfile?.User?.phone && (
                        <div style={{ marginTop: '0.4rem', fontSize: '0.785rem', color: 'var(--text-dim)' }}>
                          Doctor Tel: {b.DoctorProfile.User.phone}
                        </div>
                      )}
                    </div>

                    {/* Reschedule & Cancellation Actions (Strictly enforcing 24-hr restriction) */}
                    {b.status === 'booked' && (
                      getHoursUntilAppointment(b.DoctorSlot?.date, b.DoctorSlot?.startTime) < 24 ? (
                        <div style={{
                          padding: '0.6rem 0.75rem',
                          borderRadius: 'var(--radius-sm)',
                          background: 'rgba(245, 158, 11, 0.08)',
                          border: '1px solid var(--warning-border)',
                          fontSize: '0.785rem',
                          color: 'var(--warning)',
                          textAlign: 'center',
                          fontWeight: 500,
                        }}>
                          🔒 Within 24 Hours: Cancellation & Rescheduling are locked
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button
                              type="button"
                              onClick={() => handleOpenRescheduleModal(b)}
                              className="btn btn-secondary btn-sm"
                              style={{ flex: 1, fontSize: '0.785rem', padding: '0.35rem 0.5rem' }}
                              title="Reschedule to next available slot"
                            >
                              🔄 Reschedule
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenCancelModal(b)}
                              className="btn btn-danger btn-sm"
                              style={{ flex: 1, fontSize: '0.785rem', padding: '0.35rem 0.5rem' }}
                              title="Cancel appointment (only allowed > 24 hours prior)"
                            >
                              ✕ Cancel
                            </button>
                          </div>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)', textAlign: 'center' }}>
                            ✓ Eligible for free cancellation/reschedule (&gt;24h prior)
                          </span>
                        </div>
                      )
                    )}

                    {/* Prescription Action */}
                    {b.prescription || b.prescriptionText ? (
                      <button
                        type="button"
                        onClick={() => setViewPrescription(b.prescription || { diagnosis: b.prescriptionText, medicines: '' })}
                        className="btn btn-secondary btn-block btn-sm"
                      >
                        📄 View Issued Prescription
                      </button>
                    ) : b.status === 'completed' ? (
                      <div style={{ fontSize: '0.8rem', color: 'var(--success)', textAlign: 'center' }}>
                        ✓ Consultation Completed
                      </div>
                    ) : b.status === 'cancelled' ? (
                      <div style={{ fontSize: '0.8rem', color: 'var(--danger)', textAlign: 'center' }}>
                        Appointment Cancelled
                      </div>
                    ) : (
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', textAlign: 'center' }}>
                        Waiting for doctor consultation
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* TAB 3: NOTIFICATIONS & REMINDERS */}
        {activeTab === 'notifications' && (
          <section className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  background: 'var(--warning-bg)',
                  color: 'var(--warning)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  🔔
                </div>
                <div>
                  <h3 style={{ margin: 0 }}>System Notifications & Reminders</h3>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>
                    Instant booking alerts, completion notices, and 1-day / 1-hour / 15-minute reminders
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={fetchNotifications}
                disabled={loadingNotifications}
                className="btn btn-secondary btn-sm"
              >
                {loadingNotifications ? 'Checking...' : '↻ Refresh'}
              </button>
            </div>

            {loadingNotifications ? (
              <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                Loading your notifications...
              </div>
            ) : notifications.length === 0 ? (
              <div style={{
                textAlign: 'center',
                padding: '3rem 1.5rem',
                color: 'var(--text-muted)',
                background: 'var(--bg-surface)',
                borderRadius: 'var(--radius-md)',
                border: '1px dashed var(--border)',
              }}>
                <p style={{ margin: 0 }}>No notifications yet. You will receive automatic alerts for bookings and appointment reminders here.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {notifications.map((n) => (
                  <div
                    key={n.id}
                    style={{
                      padding: '1rem',
                      borderRadius: 'var(--radius-md)',
                      background: n.isRead ? 'var(--bg-surface)' : 'rgba(99, 102, 241, 0.08)',
                      border: `1px solid ${n.isRead ? 'var(--border)' : 'rgba(99, 102, 241, 0.3)'}`,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      gap: '1rem',
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                        <span className={`badge ${n.type === 'reminder' ? 'badge-warning' : n.type === 'completion' ? 'badge-success' : 'badge-primary'}`}>
                          {n.type === 'reminder' ? '⏰ Reminder' : n.type === 'completion' ? '✓ Completed' : '📅 Booking'}
                        </span>
                        <strong style={{ fontSize: '0.95rem', color: 'var(--text-main)' }}>{n.title}</strong>
                        {!n.isRead && (
                          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--primary)', display: 'inline-block' }} />
                        )}
                      </div>
                      <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-muted)', lineHeight: '1.45' }}>
                        {n.message}
                      </p>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '0.35rem', display: 'inline-block' }}>
                        {new Date(n.createdAt).toLocaleString()}
                      </span>
                    </div>

                    {!n.isRead && (
                      <button
                        type="button"
                        onClick={() => handleMarkNotificationRead(n.id)}
                        className="btn btn-secondary btn-sm"
                        style={{ fontSize: '0.75rem', whiteSpace: 'nowrap' }}
                      >
                        Mark Read
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Prescription Modal */}
        {viewPrescription && (
          <div style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.5rem',
            zIndex: 100,
          }}>
            <div className="card animate-fade-in" style={{
              maxWidth: '520px',
              width: '100%',
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                <h3 style={{ margin: 0, color: 'var(--text-main)' }}>Digital Medical Prescription</h3>
                <button
                  type="button"
                  onClick={() => setViewPrescription(null)}
                  style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: '1.2rem' }}
                >
                  ✕
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {viewPrescription.diagnosis && (
                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: '600' }}>
                      Diagnosis / Findings
                    </span>
                    <div style={{ marginTop: '0.25rem', color: 'var(--text-main)', fontWeight: '600' }}>
                      {viewPrescription.diagnosis}
                    </div>
                  </div>
                )}

                {viewPrescription.medicines && (
                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: '600' }}>
                      Medicines & Dosage Instructions
                    </span>
                    <div style={{
                      marginTop: '0.25rem',
                      padding: '0.75rem',
                      borderRadius: 'var(--radius-sm)',
                      background: 'var(--bg-surface)',
                      border: '1px solid var(--border)',
                      whiteSpace: 'pre-line',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.875rem',
                      color: 'var(--text-main)',
                    }}>
                      {viewPrescription.medicines}
                    </div>
                  </div>
                )}

                {viewPrescription.instructions && (
                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: '600' }}>
                      Special Advice
                    </span>
                    <div style={{ marginTop: '0.25rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                      {viewPrescription.instructions}
                    </div>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => setViewPrescription(null)}
                  className="btn btn-primary btn-block"
                  style={{ marginTop: '0.5rem' }}
                >
                  Close Prescription
                </button>
              </div>
            </div>
          </div>
        )}

        {/* CANCEL APPOINTMENT CONFIRMATION MODAL */}
        {cancellingAppointment && (() => {
          const hoursLeft = getHoursUntilAppointment(
            cancellingAppointment.DoctorSlot?.date,
            cancellingAppointment.DoctorSlot?.startTime
          );
          const isWithin24Hours = hoursLeft !== null && hoursLeft < 24;

          return (
            <div style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0, 0, 0, 0.75)',
              backdropFilter: 'blur(4px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '1.5rem',
              zIndex: 100,
            }}>
              <div className="card animate-fade-in" style={{
                maxWidth: '480px',
                width: '100%',
                background: 'var(--bg-card)',
                border: isWithin24Hours ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid var(--danger-border)',
                padding: '1.5rem',
              }}>
                <h3 style={{ margin: '0 0 0.5rem 0', color: isWithin24Hours ? '#f87171' : 'var(--danger)' }}>
                  {isWithin24Hours ? '🔒 Cancellation Locked' : 'Cancel Consultation Appointment'}
                </h3>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: '1.5', marginBottom: '1.25rem' }}>
                  Consultation with <strong>Dr. {cancellingAppointment.DoctorProfile?.User?.name}</strong> on{' '}
                  <strong>{cancellingAppointment.DoctorSlot?.date} at {cancellingAppointment.DoctorSlot?.startTime}</strong>.
                </p>

                {isWithin24Hours ? (
                  <div style={{
                    padding: '0.9rem',
                    borderRadius: 'var(--radius-sm)',
                    background: 'rgba(239, 68, 68, 0.12)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    fontSize: '0.85rem',
                    color: '#fca5a5',
                    lineHeight: '1.5',
                    marginBottom: '1.5rem',
                  }}>
                    ⛔ <strong>Cancellation Not Permitted:</strong> Per platform policy, appointments scheduled within <strong>24 hours</strong> cannot be cancelled (<strong>{hoursLeft !== null ? hoursLeft.toFixed(1) : '< 24'} hrs</strong> remaining). Please reach out to the clinic directly if you cannot attend.
                  </div>
                ) : (
                  <>
                    <p style={{ fontSize: '0.9rem', color: 'var(--text-main)', marginBottom: '1rem' }}>
                      Are you sure you want to cancel this appointment?
                    </p>
                    <div style={{
                      padding: '0.85rem',
                      borderRadius: 'var(--radius-sm)',
                      background: 'rgba(239, 68, 68, 0.08)',
                      border: '1px solid var(--danger-border)',
                      fontSize: '0.825rem',
                      color: '#fca5a5',
                      marginBottom: '1.5rem',
                    }}>
                      ⚠️ <strong>24-Hour Policy Notice:</strong> Free cancellation is only permitted when there are more than 24 hours remaining before the appointment.
                    </div>
                  </>
                )}

                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    onClick={() => setCancellingAppointment(null)}
                    disabled={cancellingLoading}
                    className={isWithin24Hours ? 'btn btn-primary' : 'btn btn-secondary'}
                  >
                    {isWithin24Hours ? 'Close' : 'Keep Appointment'}
                  </button>
                  {!isWithin24Hours && (
                    <button
                      type="button"
                      onClick={handleConfirmCancel}
                      disabled={cancellingLoading}
                      className="btn btn-danger"
                    >
                      {cancellingLoading ? 'Cancelling...' : 'Confirm Cancellation'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })()}

        {/* RESCHEDULE APPOINTMENT MODAL (AUTO-MOVE ON CONFIRMATION) */}
        {reschedulingAppointment && (
          <div style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.5rem',
            zIndex: 100,
          }}>
            <div className="card animate-fade-in" style={{
              maxWidth: '560px',
              width: '100%',
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              padding: '1.75rem',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ margin: 0, color: 'var(--text-main)' }}>
                  Reschedule Consultation
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    setReschedulingAppointment(null);
                    setRescheduleData(null);
                  }}
                  style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: '1.2rem' }}
                >
                  ✕
                </button>
              </div>

              <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                Current Appointment:{' '}
                <strong style={{ color: 'var(--text-main)' }}>
                  {reschedulingAppointment.DoctorSlot?.date} ({reschedulingAppointment.DoctorSlot?.startTime} - {reschedulingAppointment.DoctorSlot?.endTime})
                </strong>{' '}
                with Dr. {reschedulingAppointment.DoctorProfile?.User?.name}
              </div>

              {rescheduleLoading ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                  Checking doctor's next available slots...
                </div>
              ) : rescheduleData ? (
                <div>
                  {rescheduleData.nextAvailableSlot ? (
                    <div style={{
                      padding: '1rem',
                      borderRadius: 'var(--radius-md)',
                      background: 'rgba(16, 185, 129, 0.08)',
                      border: '1px solid var(--success-border)',
                      marginBottom: '1.25rem',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--success)', fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.25rem' }}>
                        <span>⚡</span> Auto-Suggested Next Available Slot:
                      </div>
                      <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)', fontFamily: 'var(--font-mono)' }}>
                        {rescheduleData.nextAvailableSlot.date} at {rescheduleData.nextAvailableSlot.startTime} - {rescheduleData.nextAvailableSlot.endTime}
                      </div>
                    </div>
                  ) : (
                    <div style={{
                      padding: '1rem',
                      borderRadius: 'var(--radius-md)',
                      background: 'rgba(239, 68, 68, 0.08)',
                      border: '1px solid var(--danger-border)',
                      color: '#fca5a5',
                      marginBottom: '1.25rem',
                      fontSize: '0.875rem',
                    }}>
                      Dr. {reschedulingAppointment.DoctorProfile?.User?.name} currently has no future available slots. Please contact the clinic directly.
                    </div>
                  )}

                  {rescheduleData.allAvailableSlots && rescheduleData.allAvailableSlots.length > 1 && (
                    <div style={{ marginBottom: '1.25rem' }}>
                      <label className="form-label" style={{ fontSize: '0.8rem' }}>
                        Or Choose Another Available Slot:
                      </label>
                      <select
                        value={selectedNewSlotId}
                        onChange={(e) => setSelectedNewSlotId(e.target.value)}
                        className="form-input"
                        style={{ fontSize: '0.875rem' }}
                      >
                        {rescheduleData.allAvailableSlots.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.date} — {s.startTime} to {s.endTime}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div style={{
                    padding: '0.75rem',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border)',
                    fontSize: '0.8rem',
                    color: 'var(--text-dim)',
                    marginBottom: '1.5rem',
                  }}>
                    ℹ️ <strong>Confirmation rule:</strong> Upon confirmation, your current slot will be released back to the platform and your booking will be moved to the new slot immediately.
                  </div>

                  <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                    <button
                      type="button"
                      onClick={() => {
                        setReschedulingAppointment(null);
                        setRescheduleData(null);
                      }}
                      disabled={confirmingReschedule}
                      className="btn btn-secondary"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmReschedule}
                      disabled={confirmingReschedule || !selectedNewSlotId}
                      className="btn btn-primary"
                    >
                      {confirmingReschedule ? 'Rescheduling...' : 'Confirm & Move to Slot'}
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
