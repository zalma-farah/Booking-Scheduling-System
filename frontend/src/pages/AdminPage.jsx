import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { ArrowLeft, ArrowUpRight, Building2, CalendarDays, MapPin, Settings2 } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import AuthApiCheck from '@/components/AuthApiCheck'
import LocationsManager from '@/components/admin/LocationsManager'
import ResourcesManager from '@/components/admin/ResourcesManager'
import TimeSlotsManager from '@/components/admin/TimeSlotsManager'
import ReservationsManager from '@/components/admin/ReservationsManager'
import { apiRequest } from '@/lib/api'
import '@/styles/admin.css'

const sections = [
  { key: 'reservations', label: 'Reservations', icon: CalendarDays, title: 'Reservations', description: 'Review and cancel reservations for your assigned university.' },
  {
    key: 'locations',
    label: 'Locations',
    icon: MapPin,
    title: 'Locations',
    description: 'Manage the buildings and places that contain your bookable rooms.',
  },
  {
    key: 'resources',
    label: 'Rooms & resources',
    icon: Building2,
    title: 'Rooms & resources',
    description: 'Add bookable spaces and choose the location each one belongs to.',
  },
  {
    key: 'slots',
    label: 'Time slots',
    icon: CalendarDays,
    title: 'Time slots',
    description: 'Create future time windows for your rooms and check their availability.',
  },
  {
    key: 'checks',
    label: 'System checks',
    icon: Settings2,
    title: 'System checks',
    description: 'Check your API connection and administrator permissions.',
  },
]

function AdminPage() {
  const { user, signOut } = useAuth()
  const [organization, setOrganization] = useState(null)
  const [setupError, setSetupError] = useState('')
  const [signingOut, setSigningOut] = useState(false)
  useEffect(() => {
    let active = true
    apiRequest('/api/admin/organization').then(data => {
      if (!data.organization || typeof data.organization.name !== 'string') throw new Error('Invalid university response.')
      if (active) setOrganization(data.organization)
    }).catch(error => { if (active) setSetupError(error.message || 'Unable to verify university assignment.') })
    return () => { active = false }
  }, [])
  async function leave() {
    setSigningOut(true)
    try {
      const { error } = await signOut()
      if (error) setSetupError(error.message)
    } catch { setSetupError('Unable to sign out. Please try again.') }
    finally { setSigningOut(false) }
  }
  const [locationVersion, setLocationVersion] = useState(0)
  const [resourceVersion, setResourceVersion] = useState(0)
  const [searchParams] = useSearchParams()
  const currentSection =
    sections.find((section) => section.key === searchParams.get('section')) ?? sections[1]

  return (
    <div className="admin-shell">
      <a className="admin-skip-link" href="#admin-content">Skip to content</a>

      <aside className="admin-sidebar" aria-label="Administration sidebar">
        <Link className="admin-brand" to="/admin">
          <span className="admin-brand-mark"><CalendarDays aria-hidden="true" /></span>
          <span>
            <strong>Booking & Scheduling</strong>
            <span className="admin-brand-subtitle">Administration</span>
          </span>
        </Link>

        <div className="admin-nav-group">
          <p className="admin-nav-caption">Manage your spaces</p>
          <nav className="admin-section-nav" aria-label="Administration sections">
            {sections.map((section) => {
              const Icon = section.icon
              const selected = currentSection.key === section.key

              return (
                <Link
                  key={section.key}
                  className={`admin-nav-link${selected ? ' is-selected' : ''}`}
                  to={`/admin?section=${section.key}`}
                  aria-current={selected ? 'page' : undefined}
                >
                  <Icon aria-hidden="true" />
                  <span>{section.label}</span>
                </Link>
              )
            })}
          </nav>
        </div>

        <div className="admin-setup-guide">
          <p className="admin-nav-caption">Simple setup order</p>
          <ol>
            <li><span>1</span><div><strong>Add a location</strong><small>A building or site</small></div></li>
            <li><span>2</span><div><strong>Add a room</strong><small>A space inside that location</small></div></li>
            <li><span>3</span><div><strong>Add time slots</strong><small>Availability for each room</small></div></li>
          </ol>
        </div>

        <nav className="admin-utility-nav" aria-label="Other pages">
          <Link to="/bookings"><CalendarDays aria-hidden="true" />My bookings</Link>
          <Link to="/resources"><ArrowLeft aria-hidden="true" />Personal booking area</Link>
          <Button variant="outline" disabled={signingOut} onClick={leave}>{signingOut ? 'Signing out...' : 'Sign out'}</Button>
        </nav>

        <div className="admin-profile">
          <span className="admin-avatar" aria-hidden="true">
            {user?.email?.slice(0, 1).toUpperCase() || 'A'}
          </span>
          <div>
            <strong>Administrator</strong>
            <span title={user?.email}>{user?.email || 'Signed-in account'}</span>
          </div>
        </div>
      </aside>

      <main id="admin-content" className="admin-main" tabIndex={-1}>
        <header className="admin-topbar">
          <p className="admin-breadcrumb">
            <span>Administration</span><span aria-hidden="true">/</span>
            <strong>{currentSection.label}</strong>
          </p>
          <Button className="admin-btn admin-btn-outline" variant="outline" asChild>
            <Link to="/resources">Browse resources<ArrowUpRight aria-hidden="true" /></Link>
          </Button>
        </header>

        <div className="admin-content">
          <header className="admin-page-heading">
            <p className="admin-eyebrow">Workspace</p>
            <p>{organization?.name || 'Verifying university assignment...'}</p>
            <h1>{currentSection.title}</h1>
            <p>{currentSection.description}</p>
          </header>

          {setupError && <p role="alert" className="admin-notice is-error">{setupError}</p>}
          {/* Keep managers mounted after trusted context is loaded. */}
          {organization && <>
          <div hidden={currentSection.key !== 'reservations'}><ReservationsManager /></div>
          <div hidden={currentSection.key !== 'locations'}>
            <LocationsManager
              key={`locations:${user?.id ?? 'signed-out'}`}
              onCreated={() => setLocationVersion((version) => version + 1)}
            />
          </div>

          <div hidden={currentSection.key !== 'resources'}>
            <ResourcesManager
              key={`resources:${user?.id ?? 'signed-out'}`}
              locationVersion={locationVersion}
              onCreated={() => setResourceVersion((version) => version + 1)}
            />
          </div>

          <div hidden={currentSection.key !== 'slots'}>
            <TimeSlotsManager
              key={`slots:${user?.id ?? 'signed-out'}`}
              resourceVersion={resourceVersion}
            />
          </div>

          <section className="admin-system-card" hidden={currentSection.key !== 'checks'}>
            <h2>Connection and authentication</h2>
            <p>These tools test your connection. They do not change locations, rooms, or bookings.</p>
            <AuthApiCheck />
          </section>
          </>}
        </div>
      </main>
    </div>
  )
}

export default AdminPage
