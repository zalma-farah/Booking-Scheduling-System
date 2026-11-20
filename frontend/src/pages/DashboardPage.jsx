import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { ArrowRight, Building2, CalendarDays, LayoutDashboard, ShieldCheck } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import '@/styles/admin.css'

const dashboardStyles = "/* Reuse the admin shell's spacing, navigation, palette and responsive behavior.\n   All extra rules are scoped so the administration pages remain unchanged. */\n.user-dashboard .dashboard-account-state {\n  flex-shrink: 0;\n  padding: 5px 10px;\n  border: 1px solid #dce7d8;\n  border-radius: 6px;\n  background: #eff5eb;\n  color: #45674e;\n  font-size: 12px;\n  font-weight: 600;\n}\n.user-dashboard .dashboard-welcome {\n  display: flex;\n  align-items: flex-start;\n  gap: 18px;\n  padding: 27px;\n  border: 1px solid #dce7d8;\n  border-radius: 12px;\n  background: #edf3e9;\n}\n.user-dashboard .dashboard-feature-icon {\n  display: grid;\n  place-items: center;\n  flex-shrink: 0;\n  width: 44px;\n  height: 44px;\n  border: 1px solid #dce7d8;\n  border-radius: 10px;\n  background: #f3f7ef;\n  color: #45674e;\n}\n.user-dashboard .dashboard-feature-icon svg { width: 22px; height: 22px; }\n.user-dashboard .dashboard-welcome > div { min-width: 0; }\n.user-dashboard .dashboard-welcome h2 { font-size: 21px; font-weight: 650; letter-spacing: -0.025em; }\n.user-dashboard .dashboard-welcome p { margin-top: 7px; color: #596c5d; }\n.user-dashboard .dashboard-welcome .dashboard-account-email { margin-top: 15px; font-size: 12px; overflow-wrap: anywhere; }\n.user-dashboard .dashboard-action-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 21px; margin-top: 25px; }\n.user-dashboard .dashboard-action-card { display: flex; flex-direction: column; align-items: flex-start; min-width: 0; padding: 27px; border: 1px solid var(--admin-line); border-radius: 12px; background: #fff; }\n.user-dashboard .dashboard-action-card h2 { margin-top: 21px; font-size: 18px; font-weight: 650; letter-spacing: -0.02em; }\n.user-dashboard .dashboard-action-card p { margin: 9px 0 24px; max-width: 370px; color: #606f63; }\n.user-dashboard .dashboard-action-card .admin-btn { margin-top: auto; }\n.user-dashboard .dashboard-booking-guide { margin-top: 35px; padding-top: 28px; border-top: 1px solid var(--admin-line); }\n.user-dashboard .dashboard-booking-guide > h2 { font-size: 16px; font-weight: 650; }\n.user-dashboard .dashboard-booking-guide ol { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 25px; margin: 21px 0 0; padding: 0; list-style: none; }\n.user-dashboard .dashboard-booking-guide li { display: flex; align-items: flex-start; gap: 12px; min-width: 0; }\n.user-dashboard .dashboard-booking-guide li > span { color: #45674e; font-size: 12px; font-weight: 650; }\n.user-dashboard .dashboard-booking-guide h3 { font-size: 13px; font-weight: 650; }\n.user-dashboard .dashboard-booking-guide p { margin-top: 5px; font-size: 12px; color: #606f63; }\n@media (max-width: 800px) {\n  .user-dashboard .admin-section-nav { grid-template-columns: repeat(3, minmax(0, 1fr)); }\n  .user-dashboard .admin-utility-nav { justify-content: flex-end; align-items: center; }\n  .user-dashboard .dashboard-booking-guide ol { grid-template-columns: minmax(0, 1fr); gap: 18px; }\n}\n@media (max-width: 600px) {\n  .user-dashboard .dashboard-action-grid { grid-template-columns: minmax(0, 1fr); gap: 16px; }\n  .user-dashboard .dashboard-welcome { padding: 21px; gap: 13px; }\n  .user-dashboard .dashboard-welcome h2 { font-size: 18px; }\n  .user-dashboard .dashboard-action-card { padding: 23px; }\n  .user-dashboard .admin-nav-link { gap: 5px; font-size: 11px; }\n  .user-dashboard.admin-shell .admin-btn { min-height: 40px; font-size: 12px; }\n}\n"

function DashboardPage() {
  const { user, isAdmin, profileError, signOut } = useAuth()
  const navigate = useNavigate()

  const [error, setError] = useState('')
  const [signingOut, setSigningOut] = useState(false)

  async function handleSignOut() {
    setError('')
    setSigningOut(true)

    try {
      const { error: signOutError } = await signOut()

      if (signOutError) {
        setError(signOutError.message)
        return
      }

      navigate('/login', { replace: true })
    } catch {
      setError('Unable to sign out. Please try again.')
    } finally {
      setSigningOut(false)
    }
  }

  return (
    <div className="admin-shell user-dashboard">
      <style>{dashboardStyles}</style>
      <a className="admin-skip-link" href="#dashboard-content">Skip to content</a>

      <aside className="admin-sidebar" aria-label="Personal workspace sidebar">
        <Link className="admin-brand" to="/dashboard">
          <span className="admin-brand-mark"><CalendarDays aria-hidden="true" /></span>
          <span>
            <strong>Booking & Scheduling</strong>
            <span className="admin-brand-subtitle">Personal workspace</span>
          </span>
        </Link>

        <div className="admin-nav-group">
          <p className="admin-nav-caption">Your workspace</p>
          <nav className="admin-section-nav" aria-label="Personal workspace">
            <Link className="admin-nav-link is-selected" to="/dashboard" aria-current="page">
              <LayoutDashboard aria-hidden="true" />Dashboard
            </Link>
            <Link className="admin-nav-link" to="/resources">
              <Building2 aria-hidden="true" />Resource tab
            </Link>
            <Link className="admin-nav-link" to="/bookings">
              <CalendarDays aria-hidden="true" />My bookings
            </Link>
          </nav>
        </div>

        <div className="admin-setup-guide">
          <p className="admin-nav-caption">Make a reservation</p>
          <ol>
            <li><span>1</span><div><strong>Find a room</strong><small>Explore available resources</small></div></li>
            <li><span>2</span><div><strong>Choose a time</strong><small>Select an available future slot</small></div></li>
            <li><span>3</span><div><strong>Manage your booking</strong><small>Review or cancel in My bookings</small></div></li>
          </ol>
        </div>

        <nav className="admin-utility-nav" aria-label="Account actions">
          {isAdmin && <Link to="/admin"><ShieldCheck aria-hidden="true" />Administration</Link>}
          <Button className="admin-btn admin-btn-outline" variant="outline" type="button" onClick={handleSignOut} disabled={signingOut}>
            {signingOut ? 'Signing out...' : 'Sign out'}
          </Button>
        </nav>

        <div className="admin-profile">
          <span className="admin-avatar" aria-hidden="true">{user?.email?.slice(0, 1).toUpperCase() || 'U'}</span>
          <div><strong>{isAdmin ? 'Personal booking area' : 'Your account'}</strong><span title={user?.email}>{user?.email || 'Signed-in account'}</span></div>
        </div>
      </aside>

      <main id="dashboard-content" className="admin-main" tabIndex={-1}>
        <header className="admin-topbar">
          <p className="admin-breadcrumb"><span>Personal workspace</span><span aria-hidden="true">/</span><strong>Dashboard</strong></p>
          <span className="dashboard-account-state">Signed in</span>
        </header>

        <div className="admin-content">
          <header className="admin-page-heading">
            <p className="admin-eyebrow">Your workspace</p>
            <h1>Your dashboard</h1>
            <p>Find a space, choose a time, and keep your bookings in one place.</p>
          </header>

          {profileError && <p role="alert" className="admin-notice is-error">{profileError}</p>}
          {error && <p role="alert" className="admin-notice is-error">{error}</p>}

          <section className="dashboard-welcome" aria-labelledby="dashboard-welcome-title">
            <span className="dashboard-feature-icon"><CalendarDays aria-hidden="true" /></span>
            <div>
              <h2 id="dashboard-welcome-title">Make room for your next session.</h2>
              <p>Browse rooms and resources, then reserve a time that works for you.</p>
              <p className="dashboard-account-email">Signed in as {user?.email}</p>
            </div>
          </section>

          <section className="dashboard-action-grid" aria-label="Booking shortcuts">
            <article className="dashboard-action-card">
              <span className="dashboard-feature-icon"><Building2 aria-hidden="true" /></span>
              <h2>Find your next space</h2>
              <p>Explore active rooms, check their details, and choose an available time slot.</p>
              <Button className="admin-btn admin-btn-primary" asChild>
                <Link to="/resources">Browse resources<ArrowRight aria-hidden="true" /></Link>
              </Button>
            </article>
            <article className="dashboard-action-card">
              <span className="dashboard-feature-icon"><CalendarDays aria-hidden="true" /></span>
              <h2>Keep track of your plans</h2>
              <p>See your upcoming reservations, review your history, or cancel a booking.</p>
              <Button className="admin-btn admin-btn-outline" variant="outline" asChild>
                <Link to="/bookings">View my bookings<ArrowRight aria-hidden="true" /></Link>
              </Button>
            </article>
          </section>

          <section className="dashboard-booking-guide" aria-labelledby="dashboard-guide-title">
            <h2 id="dashboard-guide-title">From finding a room to making it yours</h2>
            <ol>
              <li><span>01</span><div><h3>Explore resources</h3><p>Choose the room or resource you need.</p></div></li>
              <li><span>02</span><div><h3>Reserve a time</h3><p>Select an available future slot and confirm.</p></div></li>
              <li><span>03</span><div><h3>Check your bookings</h3><p>Your reservation appears in My bookings.</p></div></li>
            </ol>
          </section>
        </div>
      </main>
    </div>
  )
}

export default DashboardPage
