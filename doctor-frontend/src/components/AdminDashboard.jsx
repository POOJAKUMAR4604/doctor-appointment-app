import { useState, useEffect, useCallback, useMemo } from 'react';
import API from '../services/api';
import Navbar from './Navbar';

export default function AdminDashboard() {
  // Navigation tabs matching the project flow: 'dashboard', 'doctors', 'users', 'appointments', 'settings'
  const [activeTab, setActiveTab] = useState('dashboard');

  // Stats & Overview Data (loaded live from backend)
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalPatients: 0,
    totalDoctors: 0,
    activeDoctors: 0,
    totalAppointments: 0,
    todayAppointments: 0,
    monthRevenue: 0,
    pendingApprovals: 0,
    thisWeekAppointments: 0,
    monthCommission: 0,
    commissionPercentage: 10,
  });
  const [recentAppointments, setRecentAppointments] = useState([]);
  const [recentUsers, setRecentUsers] = useState([]);
  const [loadingDashboard, setLoadingDashboard] = useState(true);

  // Doctors management state
  const [doctors, setDoctors] = useState([]);
  const [doctorFilter, setDoctorFilter] = useState('all'); // 'all', 'pending', 'approved', 'rejected'
  const [loadingDoctors, setLoadingDoctors] = useState(false);
  const [approvingId, setApprovingId] = useState(null);
  const [rejectingDoc, setRejectingDoc] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [submittingReject, setSubmittingReject] = useState(false);
  const [viewingCertDoc, setViewingCertDoc] = useState(null);

  // Users management state
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [userRoleFilter, setUserRoleFilter] = useState('all');

  // Appointments management state
  const [appointments, setAppointments] = useState([]);
  const [loadingAppointments, setLoadingAppointments] = useState(false);
  const [appointmentStatusFilter, setAppointmentStatusFilter] = useState('all');

  // Settings state
  const [commissionRate, setCommissionRate] = useState(10);
  const [appName, setAppName] = useState('MedQueue Pro');
  const [savingSettings, setSavingSettings] = useState(false);

  // Search & Feedback
  const [searchTerm, setSearchTerm] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  // 1. Fetch live dashboard statistics from database
  const fetchDashboardStats = useCallback(async () => {
    setLoadingDashboard(true);
    try {
      const res = await API.get('/admin/stats');
      if (res.data?.stats) {
        setStats(res.data.stats);
      }
      if (res.data?.recentAppointments) {
        setRecentAppointments(res.data.recentAppointments);
      }
      if (res.data?.recentUsers) {
        setRecentUsers(res.data.recentUsers);
      }
      if (res.data?.stats?.commissionPercentage) {
        setCommissionRate(res.data.stats.commissionPercentage);
      }
    } catch (err) {
      console.error('Error fetching dashboard stats:', err);
    } finally {
      setLoadingDashboard(false);
    }
  }, []);

  // 2. Fetch doctors
  const fetchDoctors = useCallback(async () => {
    setLoadingDoctors(true);
    try {
      const res = await API.get('/admin/doctors');
      setDoctors(res.data || []);
    } catch (err) {
      console.error('Error fetching doctors:', err);
    } finally {
      setLoadingDoctors(false);
    }
  }, []);

  // 3. Fetch users
  const fetchUsers = useCallback(async () => {
    setLoadingUsers(true);
    try {
      const res = await API.get('/admin/users');
      setUsers(res.data || []);
    } catch (err) {
      console.error('Error fetching users:', err);
    } finally {
      setLoadingUsers(false);
    }
  }, []);

  // 4. Fetch appointments
  const fetchAppointments = useCallback(async () => {
    setLoadingAppointments(true);
    try {
      const res = await API.get('/admin/appointments');
      setAppointments(res.data || []);
    } catch (err) {
      console.error('Error fetching appointments:', err);
    } finally {
      setLoadingAppointments(false);
    }
  }, []);

  // 5. Fetch settings
  const fetchSettings = useCallback(async () => {
    try {
      const res = await API.get('/admin/settings');
      if (res.data) {
        if (res.data.commissionPercentage) setCommissionRate(res.data.commissionPercentage);
        if (res.data.appName) setAppName(res.data.appName);
      }
    } catch (err) {
      console.error('Error fetching settings:', err);
    }
  }, []);

  // Initial Load & Automatic Live Polling every 8 seconds
  useEffect(() => {
    fetchDashboardStats();
    fetchDoctors();
    fetchUsers();
    fetchAppointments();
    fetchSettings();

    const interval = setInterval(() => {
      fetchDashboardStats();
    }, 8000);

    return () => clearInterval(interval);
  }, [fetchDashboardStats, fetchDoctors, fetchUsers, fetchAppointments, fetchSettings]);

  // Doctor Approval action
  const handleApprove = async (doctorId) => {
    setApprovingId(doctorId);
    setMessage('');
    setError('');
    try {
      await API.put(`/admin/approve-doctor/${doctorId}`);
      setMessage('Doctor application approved successfully!');
      fetchDoctors();
      fetchDashboardStats();
    } catch (err) {
      setError(err.response?.data?.message || 'Error approving doctor.');
    } finally {
      setApprovingId(null);
    }
  };

  // Doctor Rejection action
  const handleReject = async (e) => {
    e.preventDefault();
    if (!rejectingDoc) return;
    setSubmittingReject(true);
    setMessage('');
    setError('');
    try {
      await API.put(`/admin/reject-doctor/${rejectingDoc.id}`, { reason: rejectionReason });
      setMessage('Doctor application rejected and review noted.');
      setRejectingDoc(null);
      setRejectionReason('');
      fetchDoctors();
      fetchDashboardStats();
    } catch (err) {
      setError(err.response?.data?.message || 'Error rejecting doctor application.');
    } finally {
      setSubmittingReject(false);
    }
  };

  // Save Settings action
  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setSavingSettings(true);
    setMessage('');
    setError('');
    try {
      await API.put('/admin/settings', {
        commissionPercentage: commissionRate,
        appName,
      });
      setMessage('Platform configurations saved successfully!');
      fetchDashboardStats();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update settings.');
    } finally {
      setSavingSettings(false);
    }
  };

  // Helper for Certificate URL
  const getCertificateUrl = (certPath) => {
    if (!certPath) return null;
    if (certPath.startsWith('http://') || certPath.startsWith('https://')) return certPath;
    const filename = certPath.split(/[/\\]/).pop();
    return `http://localhost:5000/uploads/${filename}`;
  };

  const isPdf = (url) => (url ? url.toLowerCase().endsWith('.pdf') : false);

  // Filtered Doctors list
  const filteredDoctors = useMemo(() => {
    return doctors.filter((doc) => {
      const name = doc.User?.name || '';
      const email = doc.User?.email || '';
      const spec = doc.specialization || '';
      const matchesSearch =
        !searchTerm.trim() ||
        name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        spec.toLowerCase().includes(searchTerm.toLowerCase());

      let matchesStatus = true;
      if (doctorFilter === 'pending') {
        matchesStatus = !doc.isApproved && !doc.rejectionReason;
      } else if (doctorFilter === 'approved') {
        matchesStatus = doc.isApproved;
      } else if (doctorFilter === 'rejected') {
        matchesStatus = !doc.isApproved && !!doc.rejectionReason;
      }

      return matchesSearch && matchesStatus;
    });
  }, [doctors, searchTerm, doctorFilter]);

  // Filtered Users list
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const matchesSearch =
        !searchTerm.trim() ||
        u.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.email?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesRole = userRoleFilter === 'all' || u.role === userRoleFilter;
      return matchesSearch && matchesRole;
    });
  }, [users, searchTerm, userRoleFilter]);

  // Filtered Appointments list
  const filteredAppointments = useMemo(() => {
    return appointments.filter((app) => {
      const patientName = app.User?.name || '';
      const docName = app.DoctorProfile?.User?.name || '';
      const matchesSearch =
        !searchTerm.trim() ||
        patientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        docName.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus =
        appointmentStatusFilter === 'all' || app.status === appointmentStatusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [appointments, searchTerm, appointmentStatusFilter]);

  // Date formatter helper (e.g. "Jul 15")
  const formatDateShort = (dateStr) => {
    if (!dateStr) return 'N/A';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
      {/* Shared Navbar matching DoctorDashboard & PatientDashboard */}
      <Navbar portalTitle="Admin Control Center" portalRole="admin" />

      <main className="page-container animate-fade-in">
        {/* HERO BANNER - Consistent with DoctorDashboard and PatientDashboard */}
        <section
          className="card"
          style={{
            background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.16) 0%, rgba(139, 92, 246, 0.1) 100%)',
            borderColor: 'rgba(99, 102, 241, 0.3)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '1.25rem',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.35rem' }}>
              <span className="badge badge-danger">Administration</span>
              <span className="badge badge-primary">{appName || 'MedQueue Pro'}</span>
            </div>
            <h2 style={{ margin: 0, fontSize: '1.75rem' }}>
              Admin Dashboard
            </h2>
            <p style={{ marginTop: '0.35rem', marginBottom: 0, color: 'var(--text-muted)' }}>
              Monitor healthcare platform operations, verify practitioner accounts, inspect bookings, and configure settings.
            </p>
          </div>

          {/* Navigation Tab Pills */}
          <div
            style={{
              display: 'flex',
              background: 'var(--bg-surface)',
              padding: '4px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border)',
              flexWrap: 'wrap',
              gap: '4px',
            }}
          >
            {[
              { id: 'dashboard', label: '📊 Overview' },
              {
                id: 'doctors',
                label: `🩺 Doctors ${stats.pendingApprovals > 0 ? `(${stats.pendingApprovals})` : ''}`,
              },
              { id: 'users', label: `👥 Users (${stats.totalUsers})` },
              { id: 'appointments', label: `📅 Appointments (${stats.totalAppointments})` },
              { id: 'settings', label: '⚙️ Settings' },
            ].map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setActiveTab(tab.id);
                    setMessage('');
                    setError('');
                  }}
                  className={`btn btn-sm ${isActive ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ borderRadius: '6px' }}
                >
                  {tab.label}
                </button>
              );
            })}
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

        {/* ============================================================== */}
        {/* VIEW 1: OVERVIEW TAB (Real-Time Cards & Feeds)                 */}
        {/* ============================================================== */}
        {activeTab === 'dashboard' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* ROW 1: Key Statistics Cards */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '1.25rem',
            }}>
              {/* 1. Total Users */}
              <div className="card card-hover" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
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
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                </div>
                <div>
                  <div style={{ fontSize: '1.85rem', fontWeight: '700', color: 'var(--text-main)', lineHeight: 1.1 }}>
                    {stats.totalUsers}
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                    Total Users ({stats.totalPatients} Patients)
                  </div>
                </div>
              </div>

              {/* 2. Active Doctors */}
              <div className="card card-hover" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '10px',
                  background: 'var(--success-bg)',
                  color: 'var(--success)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4.8 2.3A.3.3 0 1 0 5 2H4a2 2 0 0 0-2 2v5a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6V4a2 2 0 0 0-2-2h-1a.2.2 0 1 0 .3.3" />
                    <path d="M8 15v1a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6v-4" />
                    <circle cx="20" cy="10" r="2" />
                  </svg>
                </div>
                <div>
                  <div style={{ fontSize: '1.85rem', fontWeight: '700', color: 'var(--text-main)', lineHeight: 1.1 }}>
                    {stats.activeDoctors}
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                    Active Doctors ({stats.totalDoctors} Total)
                  </div>
                </div>
              </div>

              {/* 3. Today's Appointments */}
              <div className="card card-hover" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div style={{
                  width: '38px',
                  height: '38px',
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
                  <div style={{ fontSize: '1.85rem', fontWeight: '700', color: 'var(--text-main)', lineHeight: 1.1 }}>
                    {stats.todayAppointments}
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                    Today's Appointments
                  </div>
                </div>
              </div>

              {/* 4. Month Revenue */}
              <div className="card card-hover" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '10px',
                  background: 'var(--warning-bg)',
                  color: 'var(--warning)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: '700',
                  fontSize: '1.1rem',
                }}>
                  ₹
                </div>
                <div>
                  <div style={{ fontSize: '1.85rem', fontWeight: '700', color: 'var(--text-main)', lineHeight: 1.1 }}>
                    ₹{parseFloat(stats.monthRevenue || 0).toFixed(0)}
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                    Platform Revenue
                  </div>
                </div>
              </div>
            </div>

            {/* ROW 2: Operational Highlights */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: '1.25rem',
            }}>
              {/* Pending Approvals */}
              <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: '500' }}>
                    Pending Approvals
                  </span>
                  <div style={{ fontSize: '1.85rem', fontWeight: '700', color: 'var(--text-main)', margin: '0.35rem 0' }}>
                    {stats.pendingApprovals}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('doctors');
                      setDoctorFilter('pending');
                    }}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--accent)',
                      fontSize: '0.85rem',
                      fontWeight: '600',
                      cursor: 'pointer',
                      padding: 0,
                    }}
                  >
                    Review doctor applications →
                  </button>
                </div>

                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  background: 'var(--warning-bg)',
                  color: 'var(--warning)',
                  border: '1px solid var(--warning-border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                </div>
              </div>

              {/* This Week's Appointments */}
              <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: '500' }}>
                    This Week
                  </span>
                  <div style={{ fontSize: '1.85rem', fontWeight: '700', color: 'var(--text-main)', margin: '0.35rem 0' }}>
                    {stats.thisWeekAppointments}
                  </div>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-dim)' }}>
                    Appointments ({stats.totalAppointments} all-time)
                  </span>
                </div>

                <div style={{ color: 'var(--success)', padding: '4px' }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                    <polyline points="17 6 23 6 23 12" />
                  </svg>
                </div>
              </div>

              {/* Commission Percentage */}
              <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: '500' }}>
                    Platform Commission
                  </span>
                  <div style={{ fontSize: '1.85rem', fontWeight: '700', color: 'var(--text-main)', margin: '0.35rem 0' }}>
                    ₹{parseFloat(stats.monthCommission || 0).toFixed(0)}
                  </div>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-dim)' }}>
                    Earned this month
                  </span>
                </div>

                <span className="badge badge-success">
                  {stats.commissionPercentage}% Rate
                </span>
              </div>
            </div>

            {/* ROW 3: Recent Appointments & Recent Users (2 Columns) */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 460px), 1fr))',
              gap: '1.5rem',
            }}>
              {/* Column A: Recent Appointments */}
              <div className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                    <div style={{
                      width: '34px',
                      height: '34px',
                      borderRadius: '8px',
                      background: 'var(--accent-light)',
                      color: 'var(--accent)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                        <line x1="16" y1="2" x2="16" y2="6" />
                        <line x1="8" y1="2" x2="8" y2="6" />
                        <line x1="3" y1="10" x2="21" y2="10" />
                      </svg>
                    </div>
                    <h3 style={{ margin: 0 }}>Recent Appointments</h3>
                  </div>

                  <button
                    type="button"
                    onClick={() => setActiveTab('appointments')}
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: '0.785rem' }}
                  >
                    View all ({stats.totalAppointments}) →
                  </button>
                </div>

                {recentAppointments.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--text-muted)' }}>
                    No recent appointments logged yet.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {recentAppointments.map((app) => {
                      const patientName = app.User?.name || 'Walk-in Patient';
                      const docName = app.DoctorProfile?.User?.name || 'Practitioner';
                      const dateFormatted = app.DoctorSlot?.date
                        ? formatDateShort(app.DoctorSlot.date)
                        : formatDateShort(app.createdAt);

                      return (
                        <div
                          key={app.id}
                          style={{
                            padding: '0.75rem 1rem',
                            borderRadius: 'var(--radius-md)',
                            background: 'var(--bg-surface)',
                            border: '1px solid var(--border)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '0.75rem',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <div style={{
                              width: '36px',
                              height: '36px',
                              borderRadius: '50%',
                              background: 'var(--primary-light)',
                              color: 'var(--primary)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: '700',
                              fontSize: '0.9rem',
                            }}>
                              {patientName.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div style={{ fontSize: '0.925rem', fontWeight: '600', color: 'var(--text-main)' }}>
                                {patientName}
                              </div>
                              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                Dr. {docName} • {dateFormatted}
                              </div>
                            </div>
                          </div>

                          <span className={`badge ${app.status === 'completed' ? 'badge-success' : 'badge-warning'}`}>
                            {app.status === 'completed' ? 'Completed' : 'Pending'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Column B: Recent Users */}
              <div className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                    <div style={{
                      width: '34px',
                      height: '34px',
                      borderRadius: '8px',
                      background: 'var(--primary-light)',
                      color: 'var(--primary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                        <circle cx="9" cy="7" r="4" />
                      </svg>
                    </div>
                    <h3 style={{ margin: 0 }}>Recent Users</h3>
                  </div>

                  <button
                    type="button"
                    onClick={() => setActiveTab('users')}
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: '0.785rem' }}
                  >
                    View all ({stats.totalUsers}) →
                  </button>
                </div>

                {recentUsers.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--text-muted)' }}>
                    No registered users logged yet.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {recentUsers.map((u) => {
                      const dateFormatted = formatDateShort(u.createdAt);

                      return (
                        <div
                          key={u.id}
                          style={{
                            padding: '0.75rem 1rem',
                            borderRadius: 'var(--radius-md)',
                            background: 'var(--bg-surface)',
                            border: '1px solid var(--border)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '0.75rem',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <div style={{
                              width: '36px',
                              height: '36px',
                              borderRadius: '50%',
                              background: 'var(--success-bg)',
                              color: 'var(--success)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: '700',
                              fontSize: '0.9rem',
                            }}>
                              {u.name?.charAt(0).toUpperCase() || 'U'}
                            </div>
                            <div>
                              <div style={{ fontSize: '0.925rem', fontWeight: '600', color: 'var(--text-main)' }}>
                                {u.name}
                              </div>
                              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                {u.email}
                              </div>
                            </div>
                          </div>

                          <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>
                            {dateFormatted}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* VIEW 2: DOCTORS REGISTRY TAB                                   */}
        {/* ============================================================== */}
        {activeTab === 'doctors' && (
          <section className="card">
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '1rem',
              marginBottom: '1.25rem',
            }}>
              <div>
                <h3 style={{ margin: 0 }}>Doctor Verification & Registry</h3>
                <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem' }}>
                  Review certificates, inspect medical credentials, and manage practitioner approval status.
                </p>
              </div>

              <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                {[
                  { id: 'all', label: `All Doctors (${doctors.length})` },
                  { id: 'pending', label: `Pending (${doctors.filter((d) => !d.isApproved && !d.rejectionReason).length})` },
                  { id: 'approved', label: 'Approved' },
                  { id: 'rejected', label: 'Rejected' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setDoctorFilter(tab.id)}
                    className={`btn btn-sm ${doctorFilter === tab.id ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ fontSize: '0.785rem', padding: '0.3rem 0.65rem' }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {loadingDoctors ? (
              <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                Loading doctors registry...
              </div>
            ) : filteredDoctors.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                No doctor records match this filter.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-dim)', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                      <th style={{ padding: '0.75rem 1rem' }}>Doctor</th>
                      <th style={{ padding: '0.75rem 1rem' }}>Specialization</th>
                      <th style={{ padding: '0.75rem 1rem' }}>Experience</th>
                      <th style={{ padding: '0.75rem 1rem' }}>Fee</th>
                      <th style={{ padding: '0.75rem 1rem' }}>Certificate</th>
                      <th style={{ padding: '0.75rem 1rem' }}>Status</th>
                      <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDoctors.map((doc) => (
                      <tr key={doc.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.04)' }}>
                        <td style={{ padding: '0.9rem 1rem' }}>
                          <div style={{ fontWeight: '600', color: 'var(--text-main)' }}>
                            Dr. {doc.User?.name || 'Practitioner'}
                          </div>
                          <div style={{ fontSize: '0.785rem', color: 'var(--text-dim)' }}>
                            {doc.User?.email}
                          </div>
                        </td>
                        <td style={{ padding: '0.9rem 1rem' }}>
                          <span className="badge badge-primary" style={{ fontSize: '0.75rem' }}>
                            {doc.specialization}
                          </span>
                        </td>
                        <td style={{ padding: '0.9rem 1rem', color: 'var(--text-muted)' }}>
                          {doc.experienceYears} Years
                        </td>
                        <td style={{ padding: '0.9rem 1rem', fontWeight: '600', color: 'var(--success)' }}>
                          ₹{parseFloat(doc.consultationFee || 0).toFixed(0)}
                        </td>
                        <td style={{ padding: '0.9rem 1rem' }}>
                          {doc.certificateUrl ? (
                            <button
                              type="button"
                              onClick={() => setViewingCertDoc(doc)}
                              className="btn btn-secondary btn-sm"
                              style={{ fontSize: '0.75rem', padding: '0.2rem 0.55rem' }}
                            >
                              📄 View File
                            </button>
                          ) : (
                            <span style={{ color: 'var(--text-dim)', fontSize: '0.8rem' }}>None</span>
                          )}
                        </td>
                        <td style={{ padding: '0.9rem 1rem' }}>
                          {doc.isApproved ? (
                            <span className="badge badge-success">Approved</span>
                          ) : doc.rejectionReason ? (
                            <span className="badge badge-danger">Rejected</span>
                          ) : (
                            <span className="badge badge-warning">Pending Review</span>
                          )}
                        </td>
                        <td style={{ padding: '0.9rem 1rem', textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: '0.4rem' }}>
                            {!doc.isApproved && (
                              <button
                                type="button"
                                onClick={() => handleApprove(doc.id)}
                                disabled={approvingId === doc.id}
                                className="btn btn-success btn-sm"
                                style={{ fontSize: '0.75rem', padding: '0.3rem 0.75rem' }}
                              >
                                {approvingId === doc.id ? 'Approving...' : 'Approve'}
                              </button>
                            )}
                            {(!doc.rejectionReason || doc.isApproved) && (
                              <button
                                type="button"
                                onClick={() => setRejectingDoc(doc)}
                                className="btn btn-danger btn-sm"
                                style={{ fontSize: '0.75rem', padding: '0.3rem 0.75rem' }}
                              >
                                Reject
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {/* ============================================================== */}
        {/* VIEW 3: USERS DIRECTORY TAB                                    */}
        {/* ============================================================== */}
        {activeTab === 'users' && (
          <section className="card">
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '1rem',
              marginBottom: '1.25rem',
            }}>
              <div>
                <h3 style={{ margin: 0 }}>Registered Users Directory</h3>
                <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem' }}>
                  Complete list of patients and doctor accounts registered on the system.
                </p>
              </div>

              <div style={{ display: 'flex', gap: '0.35rem' }}>
                {['all', 'user', 'doctor'].map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setUserRoleFilter(r)}
                    className={`btn btn-sm ${userRoleFilter === r ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ fontSize: '0.785rem', padding: '0.3rem 0.65rem' }}
                  >
                    {r === 'all' ? 'All Roles' : r === 'user' ? 'Patients' : 'Doctors'}
                  </button>
                ))}
              </div>
            </div>

            {loadingUsers ? (
              <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                Loading users directory...
              </div>
            ) : filteredUsers.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                No users found matching this filter.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-dim)', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                      <th style={{ padding: '0.75rem 1rem' }}>User Name</th>
                      <th style={{ padding: '0.75rem 1rem' }}>Email Address</th>
                      <th style={{ padding: '0.75rem 1rem' }}>Phone Number</th>
                      <th style={{ padding: '0.75rem 1rem' }}>Role</th>
                      <th style={{ padding: '0.75rem 1rem' }}>Registered Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((u) => (
                      <tr key={u.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.04)' }}>
                        <td style={{ padding: '0.9rem 1rem', fontWeight: '600', color: 'var(--text-main)' }}>
                          {u.name}
                        </td>
                        <td style={{ padding: '0.9rem 1rem', color: 'var(--text-muted)' }}>
                          {u.email}
                        </td>
                        <td style={{ padding: '0.9rem 1rem', color: 'var(--text-dim)' }}>
                          {u.phone || 'N/A'}
                        </td>
                        <td style={{ padding: '0.9rem 1rem' }}>
                          <span className={`badge ${u.role === 'doctor' ? 'badge-primary' : 'badge-success'}`}>
                            {u.role === 'user' ? 'Patient' : u.role}
                          </span>
                        </td>
                        <td style={{ padding: '0.9rem 1rem', color: 'var(--text-dim)', fontSize: '0.85rem' }}>
                          {formatDateShort(u.createdAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {/* ============================================================== */}
        {/* VIEW 4: APPOINTMENTS LEDGER TAB                                */}
        {/* ============================================================== */}
        {activeTab === 'appointments' && (
          <section className="card">
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '1rem',
              marginBottom: '1.25rem',
            }}>
              <div>
                <h3 style={{ margin: 0 }}>Appointments & Billing Ledger</h3>
                <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem' }}>
                  View scheduled visits, doctor assignments, and platform commission breakdown.
                </p>
              </div>

              <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                {['all', 'booked', 'completed', 'cancelled'].map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setAppointmentStatusFilter(st)}
                    className={`btn btn-sm ${appointmentStatusFilter === st ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ fontSize: '0.785rem', padding: '0.3rem 0.65rem', textTransform: 'capitalize' }}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>

            {loadingAppointments ? (
              <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                Loading appointments ledger...
              </div>
            ) : filteredAppointments.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                No appointments match this filter.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-dim)', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                      <th style={{ padding: '0.75rem 1rem' }}>Patient</th>
                      <th style={{ padding: '0.75rem 1rem' }}>Doctor</th>
                      <th style={{ padding: '0.75rem 1rem' }}>Slot Schedule</th>
                      <th style={{ padding: '0.75rem 1rem' }}>Doctor Fee</th>
                      <th style={{ padding: '0.75rem 1rem' }}>Platform Cut</th>
                      <th style={{ padding: '0.75rem 1rem' }}>Total Amount</th>
                      <th style={{ padding: '0.75rem 1rem' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAppointments.map((app) => (
                      <tr key={app.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.04)' }}>
                        <td style={{ padding: '0.9rem 1rem' }}>
                          <div style={{ fontWeight: '600', color: 'var(--text-main)' }}>
                            {app.User?.name || 'Walk-in'}
                          </div>
                          <div style={{ fontSize: '0.785rem', color: 'var(--text-dim)' }}>
                            {app.User?.email}
                          </div>
                        </td>
                        <td style={{ padding: '0.9rem 1rem', color: 'var(--text-main)' }}>
                          Dr. {app.DoctorProfile?.User?.name || 'Practitioner'}
                        </td>
                        <td style={{ padding: '0.9rem 1rem', color: 'var(--text-muted)' }}>
                          {app.DoctorSlot?.date || 'N/A'} ({app.DoctorSlot?.startTime} - {app.DoctorSlot?.endTime})
                        </td>
                        <td style={{ padding: '0.9rem 1rem', color: 'var(--text-muted)' }}>
                          ₹{parseFloat(app.consultationFee || 0).toFixed(0)}
                        </td>
                        <td style={{ padding: '0.9rem 1rem', color: 'var(--success)', fontWeight: '600' }}>
                          ₹{parseFloat(app.adminCommission || 0).toFixed(0)}
                        </td>
                        <td style={{ padding: '0.9rem 1rem', fontWeight: '700', color: 'var(--text-main)' }}>
                          ₹{parseFloat(app.totalAmount || 0).toFixed(0)}
                        </td>
                        <td style={{ padding: '0.9rem 1rem' }}>
                          <span className={`badge ${app.status === 'completed' ? 'badge-success' : 'badge-warning'}`}>
                            {app.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {/* ============================================================== */}
        {/* VIEW 5: SETTINGS & CONFIGURATION TAB                          */}
        {/* ============================================================== */}
        {activeTab === 'settings' && (
          <section className="card" style={{ maxWidth: '640px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '1.25rem' }}>
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
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
              </div>
              <div>
                <h3 style={{ margin: 0 }}>Platform Configurations</h3>
                <p style={{ margin: 0, fontSize: '0.85rem' }}>
                  Adjust system commissions and global branding options.
                </p>
              </div>
            </div>

            <form onSubmit={handleSaveSettings}>
              <div className="form-group">
                <label className="form-label" htmlFor="app-name-input">
                  Application Branding Name
                </label>
                <input
                  id="app-name-input"
                  type="text"
                  value={appName}
                  onChange={(e) => setAppName(e.target.value)}
                  required
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="commission-rate-input">
                  Admin Commission Percentage (%)
                </label>
                <input
                  id="commission-rate-input"
                  type="number"
                  step="0.5"
                  min="0"
                  max="100"
                  value={commissionRate}
                  onChange={(e) => setCommissionRate(e.target.value)}
                  required
                  className="form-input"
                />
                <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginTop: '4px', display: 'block' }}>
                  This commission cut is computed on every patient reservation.
                </span>
              </div>

              <button
                type="submit"
                disabled={savingSettings}
                className="btn btn-primary btn-block"
                style={{ minHeight: '44px' }}
              >
                {savingSettings ? 'Saving Settings...' : 'Save Configuration Changes'}
              </button>
            </form>
          </section>
        )}
      </main>

      {/* REJECTION REASON MODAL */}
      {rejectingDoc && (
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
            border: '1px solid var(--danger-border)',
          }}>
            <h3 style={{ margin: '0 0 0.5rem 0', color: 'var(--danger)' }}>
              Reject Doctor Application
            </h3>
            <p style={{ margin: '0 0 1.25rem 0', fontSize: '0.875rem' }}>
              Please provide the official rejection reason for <strong>Dr. {rejectingDoc.User?.name}</strong>.
            </p>

            <form onSubmit={handleReject}>
              <div className="form-group">
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="e.g. State medical council registration could not be verified from uploaded documents."
                  required
                  rows={4}
                  className="form-textarea"
                />
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => {
                    setRejectingDoc(null);
                    setRejectionReason('');
                  }}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingReject}
                  className="btn btn-danger"
                >
                  {submittingReject ? 'Saving...' : 'Confirm Rejection'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CERTIFICATE PREVIEW MODAL */}
      {viewingCertDoc && (
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
            maxWidth: '680px',
            width: '100%',
            maxHeight: '85vh',
            display: 'flex',
            flexDirection: 'column',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0 }}>
                Medical Credentials — Dr. {viewingCertDoc.User?.name}
              </h3>
              <button
                type="button"
                onClick={() => setViewingCertDoc(null)}
                style={{ background: 'transparent', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: 'var(--text-dim)' }}
              >
                ✕
              </button>
            </div>

            <div style={{
              flex: 1,
              overflow: 'auto',
              background: 'var(--bg-surface)',
              borderRadius: 'var(--radius-sm)',
              padding: '1rem',
              display: 'flex',
              justifyContent: 'center',
            }}>
              {isPdf(getCertificateUrl(viewingCertDoc.certificateUrl)) ? (
                <iframe
                  src={getCertificateUrl(viewingCertDoc.certificateUrl)}
                  title="Doctor Certificate"
                  style={{ width: '100%', height: '500px', border: 'none' }}
                />
              ) : (
                <img
                  src={getCertificateUrl(viewingCertDoc.certificateUrl)}
                  alt="Doctor Certificate"
                  style={{ maxWidth: '100%', maxHeight: '500px', objectFit: 'contain' }}
                />
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
              <button
                type="button"
                onClick={() => setViewingCertDoc(null)}
                className="btn btn-secondary"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
