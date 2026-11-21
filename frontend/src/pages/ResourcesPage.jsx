import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { Building2, CalendarDays, LayoutDashboard, LoaderCircle, MapPin, ShieldCheck } from 'lucide-react'
import { apiRequest } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'

import '@/styles/admin.css'

const workspaceStyles = "\n.personal-workspace .workspace-body { display: grid; gap: 22px; min-width: 0; }\n.personal-workspace .workspace-body > .mt-8 { margin-top: 0; }\n.personal-workspace .workspace-body > .mt-6 { margin-top: 0; }\n.personal-workspace .workspace-body article { min-width: 0; border: 1px solid #e2e7e0; border-radius: 12px; background: #fff; box-shadow: none; padding: 25px; overflow-wrap: anywhere; }\n.personal-workspace .workspace-body article h3 { font-size: 18px; letter-spacing: -.02em; }\n.personal-workspace .workspace-body article p { margin-top: 8px; color: #606f63; }\n.personal-workspace .workspace-body h2 { font-size: 16px; font-weight: 650; }\n.personal-workspace .workspace-body :is(button, a[data-slot=\"button\"]) { min-height: 38px; height: auto; border-radius: 7px; padding: 8px 14px; font-size: 12px; white-space: normal; text-align: center; }\n.personal-workspace .workspace-body :is(.rounded-2xl, .rounded-3xl) { border-radius: 12px; }\n.personal-workspace .workspace-body > div[class*=\"bg-white\"] { border: 1px solid #e2e7e0; }\n.personal-workspace .workspace-account-state { padding: 5px 10px; border: 1px solid #dce7d8; border-radius: 6px; background: #eff5eb; color: #45674e; font-size: 12px; font-weight: 600; flex-shrink: 0; }\n.personal-workspace .workspace-empty-help { margin-top: 10px; color: #606f63; font-size: 13px; }\n.personal-workspace .workspace-signout-error { margin-top: 16px; }\n@media (max-width: 800px) {\n .personal-workspace .admin-section-nav { grid-template-columns: repeat(3, minmax(0, 1fr)); }\n .personal-workspace .admin-utility-nav { justify-content: flex-end; align-items: center; }\n}\n@media (max-width: 600px) {\n .personal-workspace .admin-nav-link { gap: 5px; font-size: 11px; }\n .personal-workspace .workspace-body article { padding: 20px; }\n .personal-workspace .workspace-body :is(button, a[data-slot=\"button\"]), .personal-workspace .admin-utility-nav button { min-height: 40px; font-size: 12px; }\n}\n"

function PersonalWorkspace({ section, title, description, children }) {
  const { user, isAdmin, signOut } = useAuth()
  const navigate = useNavigate()
  const [signingOut, setSigningOut] = useState(false)
  const [signOutError, setSignOutError] = useState('')

  async function leave() {
    setSignOutError('')
    setSigningOut(true)
    try {
      const { error } = await signOut()
      if (error) {
        setSignOutError(error.message || 'Unable to sign out. Please try again.')
        return
      }
      navigate('/login', { replace: true })
    } catch {
      setSignOutError('Unable to sign out. Please try again.')
    } finally {
      setSigningOut(false)
    }
  }

  return (
    <div className="admin-shell personal-workspace">
      <style>{workspaceStyles}</style>
      <a className="admin-skip-link" href="#workspace-content">Skip to content</a>
      <aside className="admin-sidebar" aria-label="Personal workspace sidebar">
        <Link className="admin-brand" to="/dashboard">
          <span className="admin-brand-mark"><CalendarDays aria-hidden="true" /></span>
          <span><strong>Booking & Scheduling</strong><span className="admin-brand-subtitle">Personal workspace</span></span>
        </Link>
        <div className="admin-nav-group">
          <p className="admin-nav-caption">Your workspace</p>
          <nav className="admin-section-nav" aria-label="Personal workspace">
            <Link className="admin-nav-link" to="/dashboard"><LayoutDashboard aria-hidden="true" />Dashboard</Link>
            <Link className={'admin-nav-link' + (section === 'resources' ? ' is-selected' : '')} to="/resources" aria-current={section === 'resources' ? 'page' : undefined}><Building2 aria-hidden="true" />Resource tab</Link>
            <Link className={'admin-nav-link' + (section === 'bookings' ? ' is-selected' : '')} to="/bookings" aria-current={section === 'bookings' ? 'page' : undefined}><CalendarDays aria-hidden="true" />My bookings</Link>
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
          <Button className="admin-btn admin-btn-outline" variant="outline" type="button" onClick={leave} disabled={signingOut}>{signingOut ? 'Signing out...' : 'Sign out'}</Button>
        </nav>
        <div className="admin-profile">
          <span className="admin-avatar" aria-hidden="true">{user?.email?.slice(0, 1).toUpperCase() || 'U'}</span>
          <div><strong>{isAdmin ? 'Personal booking area' : 'Your account'}</strong><span title={user?.email}>{user?.email || 'Signed-in account'}</span></div>
        </div>
      </aside>
      <main id="workspace-content" className="admin-main" tabIndex={-1}>
        <header className="admin-topbar">
          <p className="admin-breadcrumb"><span>Personal workspace</span><span aria-hidden="true">/</span><strong>{section === 'resources' ? 'Resource tab' : 'My bookings'}</strong></p>
          <span className="workspace-account-state">Signed in</span>
        </header>
        <div className="admin-content">
          <header className="admin-page-heading">
            <p className="admin-eyebrow">Your workspace</p>
            <h1>{title}</h1>
            <p>{description}</p>
          </header>
          {signOutError && <p role="alert" className="admin-notice is-error workspace-signout-error">{signOutError}</p>}
          <div className="workspace-body">{children}</div>
        </div>
      </main>
    </div>
  )
}

function ResourcesPage() {
    const { isAdmin } = useAuth()

    const [resources, setResources] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [reloadCount, setReloadCount] = useState(0)

    useEffect(() => {
        let active = true

        apiRequest('/api/resources')
            .then((result) => {
                if (!Array.isArray(result.resources)) {
                    throw new Error('The server returned an invalid resource list.')
                }

                if (active) {
                    setResources(result.resources)
                }
            })
            .catch((requestError) => {
                if (active) {
                    setError(
                        requestError.message || 'Unable to load resources.'
                    )
                }
            })
            .finally(() => {
                if (active) {
                    setLoading(false)
                }
            })

        return () => {
            active = false
        }
    }, [reloadCount])

    function refreshResources() {
        setError('')
        setLoading(true)
        setReloadCount((count) => count + 1)
    }

    return (
        <PersonalWorkspace section="resources" title="Browse resources" description="Explore rooms and resources, then choose an available time slot.">

                <div className="mt-8 flex items-center justify-between gap-4">
                    <h2 className="text-lg font-semibold">
                        Active resources
                    </h2>

                    <Button
                        type="button"
                        variant="outline"
                        onClick={refreshResources}
                        disabled={loading}
                    >
                        Refresh
                    </Button>
                </div>

                {loading ? (
                    <div
                        role="status"
                        className="mt-6 flex items-center gap-3 rounded-2xl bg-white p-8"
                    >
                        <LoaderCircle className="size-5 animate-spin" />
                        <p>Loading resources...</p>
                    </div>
                ) : error ? (
                    <div
                        role="alert"
                        className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700"
                    >
                        {error}
                    </div>
                ) : resources.length === 0 ? (
                    <div className="mt-6 rounded-2xl bg-white p-8">
                        <p>No active resources are available yet.</p>
                        <p className="workspace-empty-help">{isAdmin ? 'Restore or create an active location and room in Administration to make resources available.' : 'Rooms will appear here when an administrator makes them available.'}</p>
                    </div>
                ) : (
                    <section
                        aria-label="Available resources"
                        className="mt-6 grid gap-6 md:grid-cols-2"
                    >
                        {resources.map((resource) => (
                            <article
                                key={resource.id}
                                className="rounded-3xl bg-white p-8 shadow-sm"
                            >
                                <div className="flex items-start gap-4">
                                    <div className="rounded-2xl bg-[#e2ebe0] p-3 text-[#4e684f]">
                                        <Building2 className="size-6" />
                                    </div>

                                    <div>
                                        <h3 className="text-xl font-bold">
                                            {resource.name}
                                        </h3>

                                        <p className="mt-1 text-sm text-[#567058]">
                                            {resource.location?.name}
                                        </p>
                                    </div>
                                </div>

                                <p className="mt-5 text-muted-foreground">
                                    {resource.description || 'No description provided.'}
                                </p>

                                {resource.location?.address && (
                                    <p className="mt-5 flex items-start gap-2 text-sm text-muted-foreground">
                                        <MapPin className="mt-0.5 size-4 shrink-0" />
                                        {resource.location.address}
                                    </p>
                                )}
                                <Button
                                    className="mt-6 bg-[#4f654d] text-white hover:bg-[#3f523e]"
                                    asChild
                                >
                                    <Link to={`/resources/${resource.id}/slots`}>
                                        View time slots
                                    </Link>
                                </Button>
                                <Button className="ml-3 mt-6" variant="outline" asChild>
                                    <Link to={`/resources/${encodeURIComponent(resource.id)}/kiosk`}>Room availability</Link>
                                </Button>
                            </article>
                        ))}
                    </section>
                )}
        </PersonalWorkspace>
    )
}

export default ResourcesPage
