import { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import API from '../services/api';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();

  // Modals initialized directly from navigation state if redirected from DoctorDashboard
  const [rejectionModal, setRejectionModal] = useState(() => ({
    isOpen: Boolean(location.state?.isRejected),
    reason: location.state?.reason || 'Medical credentials could not be verified by administration.',
    doctorName: location.state?.doctorName || ''
  }));

  const [pendingModal, setPendingModal] = useState(() => ({
    isOpen: Boolean(location.state?.isPending),
    doctorName: location.state?.doctorName || ''
  }));

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await API.post('/auth/login', { email, password });
      
      const role = response.data?.user?.role;
      const user = response.data?.user;
      const doctorProfile = response.data?.doctorProfile;

      // Doctor verification safeguards
      if (role === 'doctor' && doctorProfile) {
        // If rejected
        if (!doctorProfile.isApproved && doctorProfile.rejectionReason) {
          localStorage.removeItem('token');
          localStorage.removeItem('role');
          setRejectionModal({
            isOpen: true,
            reason: doctorProfile.rejectionReason,
            doctorName: user?.name || ''
          });
          return;
        }

        // If pending approval
        if (!doctorProfile.isApproved) {
          localStorage.removeItem('token');
          localStorage.removeItem('role');
          setPendingModal({
            isOpen: true,
            doctorName: user?.name || ''
          });
          return;
        }
      }

      localStorage.setItem('token', response.data.token);
      localStorage.setItem('role', role);
      
      // Redirect based on backend role
      if (role === 'admin') {
        navigate('/admin-dashboard');
      } else if (role === 'doctor') {
        navigate('/doctor-dashboard');
      } else {
        navigate('/patient-dashboard');
      }
    } catch (err) {
      const data = err.response?.data;

      // Handle rejected doctor response from backend
      if (data?.isRejected || (data?.rejectionReason && data.rejectionReason.trim())) {
        localStorage.removeItem('token');
        localStorage.removeItem('role');
        setRejectionModal({
          isOpen: true,
          reason: data.rejectionReason || 'Medical credentials could not be verified.',
          doctorName: data.doctorName || ''
        });
      } else if (data?.isPending) {
        localStorage.removeItem('token');
        localStorage.removeItem('role');
        setPendingModal({
          isOpen: true,
          doctorName: data.doctorName || ''
        });
      } else {
        const msg = data?.message || 'Invalid email or password. Please try again.';
        if (msg.toLowerCase().includes('reject')) {
          localStorage.removeItem('token');
          localStorage.removeItem('role');
          setRejectionModal({
            isOpen: true,
            reason: data?.rejectionReason || msg.replace(/Doctor application rejected:\s*/i, ''),
            doctorName: data?.doctorName || ''
          });
        } else if (msg.toLowerCase().includes('pending')) {
          localStorage.removeItem('token');
          localStorage.removeItem('role');
          setPendingModal({
            isOpen: true,
            doctorName: data?.doctorName || ''
          });
        } else {
          setError(msg);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card animate-fade-in">
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.25rem' }}>
          <div style={{
            width: '60px',
            height: '60px',
            borderRadius: '16px',
            background: 'var(--primary-gradient)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            color: '#ffffff',
            boxShadow: '0 8px 20px rgba(99, 102, 241, 0.35)'
          }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              <path d="M12 8v8"/>
              <path d="M8 12h8"/>
            </svg>
          </div>
        </div>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
          <h2 style={{ marginBottom: '0.4rem' }}>MedQueue Pro</h2>
          <p>Welcome back! Sign in to access your portal.</p>
        </div>

        {/* Tab Switcher */}
        <div className="auth-tabs">
          <button type="button" className="auth-tab active">
            Sign In
          </button>
          <button 
            type="button" 
            className="auth-tab" 
            onClick={() => navigate('/register')}
          >
            Create Account
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="alert alert-error">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label className="form-label" htmlFor="login-email">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                <polyline points="22,6 12,13 2,6"/>
              </svg>
              Email Address
            </label>
            <input 
              id="login-email"
              type="email" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              placeholder="doctor@medqueue.com" 
              required 
              className="form-input"
              autoComplete="email"
            />
          </div>

          <div className="form-group" style={{ marginBottom: '1.75rem' }}>
            <label className="form-label" htmlFor="login-password">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
              Password
            </label>
            <input 
              id="login-password"
              type="password" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              placeholder="••••••••" 
              required 
              className="form-input"
              autoComplete="current-password"
            />
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="btn btn-primary btn-block"
            style={{ opacity: loading ? 0.75 : 1 }}
          >
            {loading ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ display: 'inline-block', width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                Signing In...
              </span>
            ) : (
              'Sign In'
            )}
          </button>

          <p style={{ marginTop: '1.5rem', textAlign: 'center', fontSize: '0.9rem' }}>
            Don't have an account?{' '}
            <Link to="/register" style={{ fontWeight: '600', color: 'var(--accent)' }}>
              Register here
            </Link>
          </p>
        </form>

        {/* 1. DOCTOR PROFILE REJECTED POP-UP MODAL */}
        {rejectionModal.isOpen && (
          <div style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(5, 8, 16, 0.88)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000,
            padding: '1.25rem',
            backdropFilter: 'blur(8px)',
            boxSizing: 'border-box'
          }}>
            <div className="auth-card animate-fade-in" style={{
              textAlign: 'center',
              maxWidth: '460px',
              padding: '2.25rem 2rem',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.85)',
              border: '1px solid var(--danger-border)',
              background: 'linear-gradient(180deg, #181528 0%, #111524 100%)'
            }}>
              {/* Alert Badge Icon */}
              <div style={{
                width: '68px',
                height: '68px',
                borderRadius: '50%',
                background: 'var(--danger-bg)',
                color: 'var(--danger)',
                border: '2px solid var(--danger-border)',
                margin: '0 auto 1.25rem auto',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                boxShadow: '0 8px 24px rgba(239, 68, 68, 0.25)'
              }}>
                <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="15" y1="9" x2="9" y2="15" />
                  <line x1="9" y1="9" x2="15" y2="15" />
                </svg>
              </div>

              {/* Status Header */}
              <span style={{
                display: 'inline-block',
                padding: '0.25rem 0.8rem',
                borderRadius: '9999px',
                fontSize: '0.75rem',
                fontWeight: '700',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                background: 'var(--danger-bg)',
                color: '#f87171',
                border: '1px solid var(--danger-border)',
                marginBottom: '0.75rem'
              }}>
                Application Rejected
              </span>

              <h3 style={{ marginBottom: '0.5rem', fontSize: '1.35rem', color: '#f8fafc' }}>
                Doctor Portal Access Denied
              </h3>
              
              <p style={{ lineHeight: '1.5', marginBottom: '1.25rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                {rejectionModal.doctorName ? `Dear Dr. ${rejectionModal.doctorName}, your` : 'Your'} doctor profile application has been reviewed and was not approved by administration.
              </p>

              {/* Noted Reason Callout Box */}
              <div style={{
                padding: '1rem 1.15rem',
                background: 'rgba(239, 68, 68, 0.08)',
                border: '1px solid rgba(239, 68, 68, 0.25)',
                borderRadius: 'var(--radius-md)',
                marginBottom: '1.25rem',
                textAlign: 'left'
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
                  marginBottom: '6px'
                }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  Reason Noted by Administration:
                </div>
                <div style={{
                  fontSize: '0.95rem',
                  color: '#ffffff',
                  fontWeight: '600',
                  lineHeight: '1.45',
                  fontStyle: 'italic'
                }}>
                  "{rejectionModal.reason || 'Medical certificate or credentials could not be verified.'}"
                </div>
              </div>

              <p style={{ fontSize: '0.825rem', color: 'var(--text-dim)', marginBottom: '1.5rem', lineHeight: '1.4' }}>
                Please ensure that your medical registration documents are valid, current, and clearly legible. You can re-register with updated documents.
              </p>

              {/* Modal Action Buttons */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                <button
                  type="button"
                  onClick={() => {
                    setRejectionModal({ isOpen: false, reason: '', doctorName: '' });
                    navigate('/register');
                  }}
                  className="btn btn-primary btn-block"
                  style={{ minHeight: '44px', fontSize: '0.925rem' }}
                >
                  Re-Register with Updated Documents →
                </button>

                <button
                  type="button"
                  onClick={() => setRejectionModal({ isOpen: false, reason: '', doctorName: '' })}
                  className="btn btn-secondary btn-block"
                  style={{ minHeight: '42px', fontSize: '0.9rem' }}
                >
                  Close & Back to Sign In
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 2. DOCTOR PROFILE PENDING VERIFICATION POP-UP MODAL */}
        {pendingModal.isOpen && (
          <div style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(5, 8, 16, 0.88)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000,
            padding: '1.25rem',
            backdropFilter: 'blur(8px)',
            boxSizing: 'border-box'
          }}>
            <div className="auth-card animate-fade-in" style={{
              textAlign: 'center',
              maxWidth: '440px',
              padding: '2.25rem 2rem',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.85)',
              border: '1px solid var(--warning-border)',
              background: 'linear-gradient(180deg, #1e1912 0%, #121524 100%)'
            }}>
              <div style={{
                width: '68px',
                height: '68px',
                borderRadius: '50%',
                background: 'var(--warning-bg)',
                color: 'var(--warning)',
                border: '2px solid var(--warning-border)',
                margin: '0 auto 1.25rem auto',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                boxShadow: '0 8px 24px rgba(245, 158, 11, 0.25)'
              }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
              </div>

              <span style={{
                display: 'inline-block',
                padding: '0.25rem 0.8rem',
                borderRadius: '9999px',
                fontSize: '0.75rem',
                fontWeight: '700',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                background: 'var(--warning-bg)',
                color: '#fbbf24',
                border: '1px solid var(--warning-border)',
                marginBottom: '0.75rem'
              }}>
                Verification Pending
              </span>

              <h3 style={{ marginBottom: '0.5rem', fontSize: '1.35rem', color: '#f8fafc' }}>
                Account Under Review
              </h3>

              <p style={{ lineHeight: '1.6', marginBottom: '1.5rem', color: 'var(--text-muted)', fontSize: '0.925rem' }}>
                {pendingModal.doctorName ? `Dr. ${pendingModal.doctorName}, your` : 'Your'} medical license credentials are being verified by our administration. Once approved, you will be able to access your doctor practice portal.
              </p>

              <button
                type="button"
                onClick={() => setPendingModal({ isOpen: false, doctorName: '' })}
                className="btn btn-primary btn-block"
                style={{ minHeight: '44px', fontSize: '0.925rem' }}
              >
                Understood
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
