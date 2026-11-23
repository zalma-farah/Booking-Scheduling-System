import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { publicRoomList } from '@/lib/api'
import { ArrowRight, CalendarDays, LogIn, MapPin, RefreshCw } from 'lucide-react'

const styles = `
.walk-in-directory{min-height:100vh;min-height:100dvh;background:#f5f7f3;color:#24392c;font-family:inherit;font-size:16px;line-height:1.6}
.walk-in-directory,.walk-in-directory *{box-sizing:border-box}.walk-in-directory h1,.walk-in-directory h2,.walk-in-directory p{margin:0}
.walk-in-directory .wd-container{max-width:1120px;margin:auto;padding:0 clamp(20px,4vw,40px);min-width:0}
.walk-in-directory .wd-nav{background:#fff;border-bottom:1px solid #e0e7dd}.walk-in-directory .wd-nav-inner{display:flex;align-items:center;justify-content:space-between;gap:16px;min-height:76px;padding-top:14px;padding-bottom:14px;flex-wrap:wrap}
.walk-in-directory .wd-brand{display:flex;align-items:center;gap:10px;font-size:15px;font-weight:700}.walk-in-directory .wd-brand-icon{display:grid;place-items:center;width:38px;height:38px;border-radius:11px;background:#41664c;color:#fff;flex-shrink:0}
.walk-in-directory svg{width:18px;height:18px;flex-shrink:0}.walk-in-directory .wd-main{padding-top:36px;padding-bottom:48px}.walk-in-directory h1{font-size:clamp(28px,3.4vw,38px);line-height:1.2;letter-spacing:-.03em;font-weight:750}.walk-in-directory .wd-intro{margin-top:8px;font-size:15px;color:#74816e}
.walk-in-directory .wd-toolbar{display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;margin:28px 0 16px}.walk-in-directory .wd-count{font-size:13px;color:#7c8875}
.walk-in-directory .wd-button{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:44px;padding:10px 15px;border:1px solid #dce4d7;border-radius:10px;background:#fff;color:#3f5943;font:inherit;font-size:13px;font-weight:650;text-decoration:none;cursor:pointer}.walk-in-directory .wd-button:hover{background:#edf3e9;border-color:#b7cab1}.walk-in-directory .wd-button:disabled{opacity:.55;cursor:wait}.walk-in-directory :is(a,button):focus-visible{outline:3px solid #608756;outline-offset:4px}
.walk-in-directory .wd-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,290px),1fr));gap:18px;list-style:none;margin:0;padding:0}.walk-in-directory .wd-card{display:flex;flex-direction:column;min-width:0;background:#fff;border:1px solid #e0e7db;border-radius:16px;padding:24px;box-shadow:0 3px 12px #24392c04}.walk-in-directory .wd-card h2{font-size:20px;font-weight:700;letter-spacing:-.02em;line-height:1.4;overflow-wrap:anywhere}
.walk-in-directory .wd-location{display:flex;align-items:flex-start;gap:6px;font-size:13px;color:#7a8874;margin-top:8px;overflow-wrap:anywhere}.walk-in-directory .wd-location svg{width:15px;height:15px;margin-top:3px}.walk-in-directory .wd-card-link{width:100%;justify-content:space-between;margin-top:24px;background:#41664c;border-color:#41664c;color:#fff}.walk-in-directory .wd-card-link:hover{background:#34563e;border-color:#34563e}
.walk-in-directory .wd-state{padding:32px 20px;border:1px dashed #ccd8c5;border-radius:16px;background:#ffffffb3;text-align:center;color:#71816a;font-size:14px}.walk-in-directory .wd-error{border-color:#e8c5b7;color:#8b4a35;background:#fff9f5}.walk-in-directory .wd-pages{display:flex;justify-content:flex-end;gap:12px;margin-top:24px;flex-wrap:wrap}
@media(max-width:560px){.walk-in-directory .wd-main{padding-top:28px}.walk-in-directory .wd-brand{font-size:13px}.walk-in-directory .wd-card{padding:20px}}
`

export default function WalkInRoomsPage() {
  const [after, setAfter] = useState(0)
  const [version, setVersion] = useState(0)
  const [result, setResult] = useState({ key: '', rooms: [], next: null, error: '' })
  const key = `${after}:${version}`
  const loading = result.key !== key
  useEffect(() => {
    let active = true
    publicRoomList(after).then(data => {
      if (data?.status !== 'ok' || !Array.isArray(data.rooms) || data.rooms.length > 50 ||
          data.rooms.some(r => !Number.isSafeInteger(r.id) || r.id < 1 || typeof r.name !== 'string' || typeof r.location?.name !== 'string') ||
          (data.next_after !== null && (!Number.isSafeInteger(data.next_after) || data.next_after <= after))) throw new Error('Invalid room list.')
      if (active) setResult({ key, rooms: data.rooms, next: data.next_after, error: '' })
    }).catch(error => { if (active) setResult({ key, rooms: [], next: null, error: error.message || 'Unable to load rooms.' }) })
    return () => { active = false }
  }, [after, key])
  return <div className="walk-in-directory">
    <style>{styles}</style>
    <header className="wd-nav"><div className="wd-container wd-nav-inner">
      <div className="wd-brand"><span className="wd-brand-icon"><CalendarDays aria-hidden="true" /></span>
        <span>Booking &amp; Scheduling</span>
      </div>
      <Link to="/login" className="wd-button"><LogIn aria-hidden="true" />Sign in</Link>
    </div></header>
    <main className="wd-container wd-main">
      <h1 id="walk-in-rooms-heading">Walk-in rooms</h1>
      <p className="wd-intro">Choose a room. No account needed.</p>
      <section aria-labelledby="walk-in-rooms-heading">
        <div className="wd-toolbar">
          <p className="wd-count">{loading ? 'Loading…' : result.error ? ''
            : `${result.rooms.length} room${result.rooms.length === 1 ? '' : 's'} shown`}</p>
          <button type="button" className="wd-button" disabled={loading} onClick={() => setVersion(v => v + 1)}><RefreshCw aria-hidden="true" />Refresh</button>
        </div>
        {loading ? <div className="wd-state" role="status">Loading rooms…</div>
          : result.error ? <div className="wd-state wd-error" role="alert">{result.error}</div>
            : result.rooms.length === 0 ? <div className="wd-state">No rooms available.</div>
              : <ul className="wd-grid">{result.rooms.map(room => <li key={room.id} className="wd-card">
                <h2>{room.name}</h2>
                <p className="wd-location"><MapPin aria-hidden="true" /><span>{room.location.name}</span></p>
                <Link className="wd-button wd-card-link" to={`/resources/${room.id}/kiosk`} aria-label={`Check availability for ${room.name}`}>
                  Check availability<ArrowRight aria-hidden="true" />
                </Link>
              </li>)}</ul>}
        {!loading && <nav aria-label="Room pages" className="wd-pages">
          {after > 0 && <button type="button" className="wd-button" onClick={() => setAfter(0)}>First page</button>}
          {result.next !== null && <button type="button" className="wd-button" onClick={() => setAfter(result.next)}>More rooms<ArrowRight aria-hidden="true" /></button>}
        </nav>}
      </section>
    </main>
  </div>
}
