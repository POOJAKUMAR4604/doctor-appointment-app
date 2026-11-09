import { useNavigate } from 'react-router-dom';

export default function Navbar({ portalTitle, portalRole }) {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    navigate('/login');
  };

  const getRoleBadgeClass = () => {
    switch (portalRole) {
      case 'admin':
        return 'badge-danger';
      case 'doctor':
        return 'badge-primary';
      case 'patient':
      default:
        return 'badge-success';
    }
  };

  return (
    <header className="app-navbar">
      <div className="navbar-container">
        <div className="navbar-brand">
          <div className="brand-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              <path d="M12 8v8"/>
              <path d="M8 12h8"/>
            </svg>
          </div>
          <div>
            <div className="brand-text">MedQueue Pro</div>
            {portalTitle && (
              <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', fontWeight: '500' }}>
                {portalTitle}
              </div>
            )}
          </div>
        </div>

        <div className="navbar-actions">
          {portalRole && (
            <span className={`badge ${getRoleBadgeClass()}`}>
              <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', background: 'currentColor' }} />
              {portalRole}
            </span>
          )}

          <button 
            type="button" 
            onClick={handleLogout} 
            className="btn btn-secondary btn-sm"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            title="Sign out of your account"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            Sign Out
          </button>
        </div>
      </div>
    </header>
  );
}
