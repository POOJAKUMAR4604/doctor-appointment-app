import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import API from '../services/api';

export default function Register() {
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState('patient');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [specialization, setSpecialization] = useState('');
  const [qualification, setQualification] = useState('');
  const [experience, setExperience] = useState('');
  const [consultationFee, setConsultationFee] = useState('50');
  const [about, setAbout] = useState('');
  const [medicalCertificate, setMedicalCertificate] = useState(null);

  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showApprovalPopup, setShowApprovalPopup] = useState(false);

  const navigate = useNavigate();

  const handleNextStep = (e) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError('Passwords do not match! Please check and try again.');
      return;
    }
    if (password.length < 6) {
      setError('Password should be at least 6 characters long.');
      return;
    }
    setError('');
    if (role === 'doctor') {
      setStep(2);
    } else {
      handleFinalSubmit();
    }
  };

  const handleFinalSubmit = async (e) => {
    if (e) e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append('name', name);
      formData.append('email', email);
      formData.append('phone', phone);
      formData.append('password', password);

      if (role === 'doctor') {
        formData.append('role', 'doctor');
        formData.append('specialization', specialization);
        formData.append('qualification', qualification);
        formData.append('experienceYears', experience || '1');
        formData.append('consultationFee', consultationFee || '50');
        formData.append('bio', about || 'Practicing Medical Specialist');

        // Backend multer middleware uses 'certificate' field name
        if (medicalCertificate) {
          formData.append('certificate', medicalCertificate);
        }
      } else {
        // Patient registration
        formData.append('role', 'user');
      }

      await API.post('/auth/register', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      // ONLY doctors require admin verification popup
      if (role === 'doctor') {
        setShowApprovalPopup(true);
      } else {
        setMessage('Registration successful! Redirecting to sign in...');
        setTimeout(() => {
          navigate('/login');
        }, 1500);
      }
      setError('');
    } catch (err) {
      console.error('Registration error:', err);
      setError(
        err.response?.data?.message || 
        err.response?.data?.error || 
        'Registration failed. Please check your information and try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card animate-fade-in">
        {/* Top Brand Shield Icon */}
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
          <p>
            {step === 1 ? 'Join us! Create your account to continue.' : 'Doctor Professional Credentials'}
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="auth-tabs">
          <button 
            type="button" 
            className="auth-tab"
            onClick={() => navigate('/login')}
          >
            Sign In
          </button>
          <button 
            type="button" 
            className="auth-tab active"
          >
            Create Account
          </button>
        </div>

        {/* Doctor Step Indicator */}
        {role === 'doctor' && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
            marginBottom: '1.5rem',
            padding: '8px 14px',
            background: 'var(--bg-input)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{
                width: '20px',
                height: '20px',
                borderRadius: '50%',
                background: step === 1 ? 'var(--primary)' : 'var(--success)',
                color: '#fff',
                fontSize: '11px',
                fontWeight: '700',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                1
              </span>
              <span style={{ fontSize: '0.825rem', fontWeight: '600', color: step === 1 ? 'var(--text-main)' : 'var(--text-muted)' }}>
                Account
              </span>
            </div>

            <span style={{ width: '20px', height: '1px', background: 'var(--border)' }} />

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{
                width: '20px',
                height: '20px',
                borderRadius: '50%',
                background: step === 2 ? 'var(--primary)' : 'transparent',
                border: step === 2 ? 'none' : '1px solid var(--border)',
                color: step === 2 ? '#fff' : 'var(--text-dim)',
                fontSize: '11px',
                fontWeight: '700',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                2
              </span>
              <span style={{ fontSize: '0.825rem', fontWeight: '600', color: step === 2 ? 'var(--text-main)' : 'var(--text-muted)' }}>
                Credentials
              </span>
            </div>
          </div>
        )}

        {/* Success Alert Banner for regular patient registration */}
        {message && (
          <div className="alert alert-success animate-fade-in">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
              <polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
            <div>
              <div>{message}</div>
              <Link to="/login" style={{ color: '#6ee7b7', fontWeight: '600', fontSize: '0.85rem', display: 'inline-block', marginTop: '4px' }}>
                Proceed to Sign In →
              </Link>
            </div>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="alert alert-error animate-fade-in">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <span>{error}</span>
          </div>
        )}

        {step === 1 ? (
          <form onSubmit={handleNextStep}>
            {/* Full Name */}
            <div className="form-group">
              <label className="form-label" htmlFor="reg-name">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                  <circle cx="12" cy="7" r="4"/>
                </svg>
                Full Name
              </label>
              <input 
                id="reg-name"
                type="text" 
                value={name} 
                onChange={(e) => setName(e.target.value)} 
                placeholder="Dr. Sarah Johnson / John Doe" 
                required 
                className="form-input" 
                autoComplete="name"
              />
            </div>

            {/* Email Address */}
            <div className="form-group">
              <label className="form-label" htmlFor="reg-email">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                  <polyline points="22,6 12,13 2,6"/>
                </svg>
                Email Address
              </label>
              <input 
                id="reg-email"
                type="email" 
                value={email} 
                onChange={(e) => setEmail(e.target.value)} 
                placeholder="name@example.com" 
                required 
                className="form-input" 
                autoComplete="email"
              />
            </div>

            {/* Phone Number */}
            <div className="form-group">
              <label className="form-label" htmlFor="reg-phone">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
                </svg>
                Phone Number
              </label>
              <input 
                id="reg-phone"
                type="tel" 
                value={phone} 
                onChange={(e) => setPhone(e.target.value)} 
                placeholder="+1 (555) 019-2834" 
                required 
                className="form-input" 
                autoComplete="tel"
              />
            </div>

            {/* Register As Role */}
            <div className="form-group">
              <label className="form-label" htmlFor="reg-role">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                  <circle cx="8.5" cy="7" r="4"/>
                  <polyline points="17 11 19 13 23 9"/>
                </svg>
                Register As
              </label>
              <select 
                id="reg-role"
                value={role} 
                onChange={(e) => setRole(e.target.value)} 
                className="form-select"
              >
                <option value="patient">Patient (Direct Access to Appointments)</option>
                <option value="doctor">Doctor (Requires Admin Verification)</option>
              </select>
            </div>

            {/* Password */}
            <div className="form-group">
              <label className="form-label" htmlFor="reg-pass">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
                Password
              </label>
              <input 
                id="reg-pass"
                type="password" 
                value={password} 
                onChange={(e) => setPassword(e.target.value)} 
                placeholder="••••••••" 
                required 
                className="form-input" 
                autoComplete="new-password"
              />
            </div>

            {/* Confirm Password */}
            <div className="form-group" style={{ marginBottom: '1.75rem' }}>
              <label className="form-label" htmlFor="reg-confirm">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
                Confirm Password
              </label>
              <input 
                id="reg-confirm"
                type="password" 
                value={confirmPassword} 
                onChange={(e) => setConfirmPassword(e.target.value)} 
                placeholder="••••••••" 
                required 
                className="form-input" 
                autoComplete="new-password"
              />
            </div>

            {/* Submit Button */}
            <button 
              type="submit" 
              disabled={loading}
              className="btn btn-primary btn-block"
              style={{ opacity: loading ? 0.75 : 1 }}
            >
              {loading ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
                  <span style={{ display: 'inline-block', width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                  Creating Account...
                </span>
              ) : role === 'doctor' ? (
                'Next: Doctor Credentials →'
              ) : (
                'Create Account'
              )}
            </button>
          </form>
        ) : (
          <form onSubmit={handleFinalSubmit} className="animate-fade-in">
            {/* Specialization */}
            <div className="form-group">
              <label className="form-label" htmlFor="doc-spec">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="8" r="7"/>
                  <polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/>
                </svg>
                Specialization
              </label>
              <input 
                id="doc-spec"
                type="text" 
                value={specialization} 
                onChange={(e) => setSpecialization(e.target.value)} 
                placeholder="Cardiologist, Neurologist, General Physician..." 
                required 
                className="form-input" 
              />
            </div>

            {/* Qualification */}
            <div className="form-group">
              <label className="form-label" htmlFor="doc-qual">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 10v6M2 10l10-5 10 5-10 5z"/>
                  <path d="M6 12v5c3 3 9 3 12 0v-5"/>
                </svg>
                Qualification
              </label>
              <input 
                id="doc-qual"
                type="text" 
                value={qualification} 
                onChange={(e) => setQualification(e.target.value)} 
                placeholder="e.g. MBBS, MD, MS" 
                required 
                className="form-input" 
              />
            </div>

            {/* Experience */}
            <div className="form-group">
              <label className="form-label" htmlFor="doc-exp">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/>
                  <polyline points="12 6 12 12 16 14"/>
                </svg>
                Years of Experience
              </label>
              <input 
                id="doc-exp"
                type="number" 
                min="0"
                value={experience} 
                onChange={(e) => setExperience(e.target.value)} 
                placeholder="e.g. 5" 
                required 
                className="form-input" 
              />
            </div>

            {/* Consultation Fee */}
            <div className="form-group">
              <label className="form-label" htmlFor="doc-fee">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="1" x2="12" y2="23"/>
                  <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
                </svg>
                Consultation Fee ($)
              </label>
              <input 
                id="doc-fee"
                type="number" 
                min="0"
                step="5"
                value={consultationFee} 
                onChange={(e) => setConsultationFee(e.target.value)} 
                placeholder="e.g. 50" 
                required 
                className="form-input" 
              />
            </div>

            {/* Professional Bio */}
            <div className="form-group">
              <label className="form-label" htmlFor="doc-about">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                  <line x1="16" y1="13" x2="8" y2="13"/>
                  <line x1="16" y1="17" x2="8" y2="17"/>
                </svg>
                Professional Bio / About
              </label>
              <textarea 
                id="doc-about"
                value={about} 
                onChange={(e) => setAbout(e.target.value)} 
                placeholder="Share your medical background, consultation hours, and expertise..." 
                required 
                className="form-textarea" 
              />
            </div>

            {/* Medical Certificate */}
            <div className="form-group" style={{ marginBottom: '1.75rem' }}>
              <label className="form-label">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="17 8 12 3 7 8"/>
                  <line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
                Medical License Certificate (Required: .pdf, .jpg, .png)
              </label>
              <input 
                type="file" 
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={(e) => setMedicalCertificate(e.target.files[0])} 
                required 
                className="form-input"
                style={{ padding: '0.5rem', fontSize: '0.85rem' }} 
              />
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button 
                type="button" 
                onClick={() => setStep(1)} 
                className="btn btn-secondary"
                style={{ flex: 1 }}
              >
                ← Back
              </button>
              <button 
                type="submit" 
                disabled={loading}
                className="btn btn-primary"
                style={{ flex: 2, opacity: loading ? 0.75 : 1 }}
              >
                {loading ? (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
                    <span style={{ display: 'inline-block', width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                    Submitting...
                  </span>
                ) : (
                  'Submit Registration'
                )}
              </button>
            </div>
          </form>
        )}

        {/* Footer */}
        <p style={{ marginTop: '1.5rem', textAlign: 'center', fontSize: '0.9rem' }}>
          Already have an account?{' '}
          <Link to="/login" style={{ fontWeight: '600', color: 'var(--accent)' }}>
            Sign In here
          </Link>
        </p>

        {/* Admin Approval Confirmation Modal Dialog - ONLY SHOWN TO DOCTORS */}
        {showApprovalPopup && role === 'doctor' && (
          <div style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(5, 8, 16, 0.85)',
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
              maxWidth: '430px',
              padding: '2.25rem 2rem',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
              border: '1px solid var(--border)'
            }}>
              <div style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                background: 'var(--success-bg)',
                color: 'var(--success)',
                border: '1px solid var(--success-border)',
                margin: '0 auto 1.25rem auto',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center'
              }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                  <polyline points="22 4 12 14.01 9 11.01"/>
                </svg>
              </div>

              <h3 style={{ marginBottom: '0.75rem', fontSize: '1.35rem' }}>Doctor Application Submitted!</h3>
              <p style={{ lineHeight: '1.6', marginBottom: '1.75rem', color: 'var(--text-muted)', fontSize: '0.95rem' }}>
                Your doctor credentials have been uploaded. The admin has to approve your details to confirm registration. Once approved by the administrator, you can log in to your portal.
              </p>

              <button 
                onClick={() => {
                  setShowApprovalPopup(false);
                  navigate('/login');
                }}
                className="btn btn-primary btn-block"
                style={{ minHeight: '46px', fontSize: '0.95rem' }}
              >
                Move to Login Page →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}