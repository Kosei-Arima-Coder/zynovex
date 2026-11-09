import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { ADMIN_EMAIL } from '../lib/constants'
import { fmtDT, exportCsv } from '../lib/utils'

export default function AdminModal({ isOpen, onClose, showToast }) {
  const dialogRef = useRef(null)
  const [view, setView] = useState('loading') // 'loading' | 'login' | 'dash'
  const [activeTab, setActiveTab] = useState('org') // 'org' | 'reg' | 'vol'
  const [adminUser, setAdminUser] = useState(null)
  const [msg, setMsg] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Auth inputs
  const [mail, setMail] = useState('')
  const [pass, setPass] = useState('')

  // Data lists
  const [organizers, setOrganizers] = useState([])
  const [registrations, setRegistrations] = useState([])
  const [volunteerApps, setVolunteerApps] = useState([])

  // Filters for registrations
  const [regEvFilter, setRegEvFilter] = useState('')
  const [regQ, setRegQ] = useState('')
  const [regFrom, setRegFrom] = useState('')
  const [regTo, setRegTo] = useState('')

  // Filters for volunteers
  const [volStatusFilter, setVolStatusFilter] = useState('')
  const [volEvFilter, setVolEvFilter] = useState('')
  const [volOrgFilter, setVolOrgFilter] = useState('')
  const [volQ, setVolQ] = useState('')

  const loadTabData = useCallback(async (tab) => {
    setActiveTab(tab)
    if (!supabase) return

    try {
      if (tab === 'org') {
        const { data, error } = await supabase
          .from('organizers')
          .select('*')
          .order('created_at', { ascending: false })
        if (!error && data) setOrganizers(data)
      } else if (tab === 'reg') {
        const { data, error } = await supabase.rpc('admin_registrations')
        if (!error && data) setRegistrations(data)
      } else if (tab === 'vol') {
        const { data, error } = await supabase.rpc('admin_volunteer_apps')
        if (!error && data) setVolunteerApps(data)
      }
    } catch {
      showToast('Failed to load ' + tab + ' data')
    }
  }, [showToast])

  useEffect(() => {
    if (dialogRef.current && !dialogRef.current.open) {
      dialogRef.current.showModal()
    }

    let isMounted = true

    async function checkSession() {
      if (!supabase) {
        if (isMounted) {
          setView('login')
          setMsg('Supabase client is not configured')
        }
        return
      }

      try {
        const { data } = await supabase.auth.getSession()
        const u = data?.session?.user
        if (!isMounted) return

        if (u && (u.email || '').toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
          setAdminUser(u)
          setView('dash')
          loadTabData('org')
        } else {
          setView('login')
        }
      } catch {
        if (isMounted) setView('login')
      }
    }

    checkSession()

    return () => {
      isMounted = false
    }
  }, [loadTabData])

  if (!isOpen) return null

  const handleClose = () => {
    if (dialogRef.current && dialogRef.current.open) {
      dialogRef.current.close()
    }
    onClose()
  }

  const handleLogin = async (e) => {
    e.preventDefault()
    setMsg('')
    setSubmitting(true)
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: mail.trim(),
        password: pass,
      })

      if (error) {
        setMsg('Wrong email or password')
        setSubmitting(false)
        return
      }

      if ((data.user?.email || '').toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
        await supabase.auth.signOut()
        setMsg('This account is not authorized as an administrator')
        setSubmitting(false)
        return
      }

      setAdminUser(data.user)
      setView('dash')
      loadTabData('org')
    } catch {
      setMsg('Authentication failed')
    } finally {
      setSubmitting(false)
    }
  }

  const handleLogout = async () => {
    if (supabase) {
      await supabase.auth.signOut()
    }
    setAdminUser(null)
    setView('login')
    setMsg('')
  }

  const handleToggleOrganizerVerification = async (orgItem) => {
    const newStatus = !orgItem.verified
    try {
      const { error } = await supabase
        .from('organizers')
        .update({ verified: newStatus })
        .eq('id', orgItem.id)

      if (error) {
        showToast('Could not update organizer status: ' + error.message)
        return
      }

      setOrganizers((prev) =>
        prev.map((o) => (o.id === orgItem.id ? { ...o, verified: newStatus } : o))
      )
      showToast(newStatus ? 'Organizer verified' : 'Verification removed')
    } catch {
      showToast('Error updating organizer status')
    }
  }

  const handleSetVolunteerStatus = async (appId, newStatus) => {
    try {
      const { error } = await supabase.rpc('admin_set_volunteer_status', {
        p_id: String(appId),
        p_status: newStatus,
      })

      if (error) {
        showToast('Could not update application status')
        return
      }

      setVolunteerApps((prev) =>
        prev.map((a) => (String(a.id) === String(appId) ? { ...a, status: newStatus } : a))
      )
      showToast(`Application marked as ${newStatus}`)

      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('zynovex:volunteer_status_updated', {
            detail: { appId, status: newStatus },
          })
        )
      }
    } catch {
      showToast('Error updating application')
    }
  }

  // Filtering Registrations
  const filteredRegs = registrations.filter((r) => {
    if (regEvFilter && r.event_title !== regEvFilter) return false
    if (regQ) {
      const s = (r.name + ' ' + r.email + ' ' + (r.college || '')).toLowerCase()
      if (!s.includes(regQ.toLowerCase())) return false
    }
    if (regFrom && r.created_at && r.created_at.slice(0, 10) < regFrom) return false
    if (regTo && r.created_at && r.created_at.slice(0, 10) > regTo) return false
    return true
  })

  // Filtering Volunteers
  const filteredVols = volunteerApps.filter((v) => {
    if (volStatusFilter && v.status !== volStatusFilter) return false
    if (volEvFilter && v.event_title !== volEvFilter) return false
    if (volOrgFilter && v.organizer !== volOrgFilter) return false
    if (volQ) {
      const s = (v.name + ' ' + v.email + ' ' + (v.college || '') + ' ' + (v.role || '')).toLowerCase()
      if (!s.includes(volQ.toLowerCase())) return false
    }
    return true
  })

  // Export CSV Handlers
  const handleExportRegsCsv = () => {
    if (filteredRegs.length === 0) {
      showToast('No registrations to export')
      return
    }
    const rows = [
      ['Name', 'Email', 'College', 'Event', 'Organizer', 'Registered at'],
      ...filteredRegs.map((r) => [r.name, r.email, r.college || '-', r.event_title, r.organizer, r.created_at]),
    ]
    exportCsv('zynovex-admin-registrations', rows)
  }

  const handleExportVolsCsv = () => {
    if (filteredVols.length === 0) {
      showToast('No volunteer applications to export')
      return
    }
    const rows = [
      ['Name', 'Email', 'College', 'Event', 'Organizer', 'Preferred role', 'Reason', 'Status', 'Applied at'],
      ...filteredVols.map((v) => [v.name, v.email, v.college || '-', v.event_title, v.organizer, v.role, v.reason, v.status, v.created_at]),
    ]
    exportCsv('zynovex-admin-volunteer-applications', rows)
  }

  // Unique options for selects
  const uniqueRegEvents = Array.from(new Set(registrations.map((r) => r.event_title).filter(Boolean)))
  const uniqueVolEvents = Array.from(new Set(volunteerApps.map((v) => v.event_title).filter(Boolean)))
  const uniqueVolOrgs = Array.from(new Set(volunteerApps.map((v) => v.organizer).filter(Boolean)))

  return (
    <dialog
      ref={dialogRef}
      id="admDlg"
      className="wide"
      aria-labelledby="aTitle"
      onClick={(e) => e.target === dialogRef.current && handleClose()}
      onClose={onClose}
    >
      <div className="ohead">
        <h3 id="aTitle">
          Super Admin{adminUser ? ` · ${adminUser.email}` : ''}
        </h3>
        <button className="btn" id="aClose" type="button" onClick={handleClose}>
          Close
        </button>
      </div>

      {view === 'loading' && <p>Checking admin authorization...</p>}

      {view === 'login' && (
        <form onSubmit={handleLogin}>
          <p>Super Admin portal for ZYNOVEX platform verification and oversight.</p>
          <label htmlFor="aMail">Admin Email</label>
          <input
            id="aMail"
            type="email"
            autoComplete="email"
            required
            value={mail}
            onChange={(e) => setMail(e.target.value)}
          />

          <label htmlFor="aPass">Password</label>
          <input
            id="aPass"
            type="password"
            autoComplete="current-password"
            required
            value={pass}
            onChange={(e) => setPass(e.target.value)}
          />

          {msg && (
            <p className="omsg" role="alert">
              {msg}
            </p>
          )}

          <div className="mrow">
            <button className="btn solid" type="submit" disabled={submitting}>
              {submitting ? 'Verifying...' : 'Log in as Admin'}
            </button>
          </div>
        </form>
      )}

      {view === 'dash' && (
        <div>
          <div className="otop">
            <div className="tabs" style={{ marginBottom: 0 }}>
              <button
                className="chip"
                type="button"
                aria-pressed={activeTab === 'org'}
                onClick={() => loadTabData('org')}
              >
                Organizers
              </button>
              <button
                className="chip"
                type="button"
                aria-pressed={activeTab === 'reg'}
                onClick={() => loadTabData('reg')}
              >
                Registrations
              </button>
              <button
                className="chip"
                type="button"
                aria-pressed={activeTab === 'vol'}
                onClick={() => loadTabData('vol')}
              >
                Volunteers
              </button>
            </div>
            <button className="btn" type="button" onClick={handleLogout}>
              Log out
            </button>
          </div>

          {activeTab === 'org' && (
            <div style={{ marginTop: '16px' }}>
              <p>Verify or remove verification for event organizers across the platform.</p>
              {organizers.length === 0 ? (
                <p>No organizers found.</p>
              ) : (
                organizers.map((o) => (
                  <div className="vrow" key={o.id}>
                    <span>
                      <b>{o.org_name || 'Unnamed Organization'}</b> · {o.id}
                      <br />
                      <span className="st">
                        Status: <b>{o.verified ? 'Verified' : 'Pending verification'}</b> · Created: {fmtDT(o.created_at)}
                      </span>
                    </span>
                    <button
                      className={'btn' + (o.verified ? '' : ' solid')}
                      type="button"
                      onClick={() => handleToggleOrganizerVerification(o)}
                    >
                      {o.verified ? 'Remove verification' : 'Verify organizer'}
                    </button>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'reg' && (
            <div style={{ marginTop: '16px' }}>
              <div className="ogrid">
                <div>
                  <label htmlFor="afEv">Filter by event</label>
                  <select
                    id="afEv"
                    value={regEvFilter}
                    onChange={(e) => setRegEvFilter(e.target.value)}
                  >
                    <option value="">All events</option>
                    {uniqueRegEvents.map((title) => (
                      <option key={title} value={title}>
                        {title}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="afQ">Search attendee</label>
                  <input
                    id="afQ"
                    placeholder="Name, email, college"
                    value={regQ}
                    onChange={(e) => setRegQ(e.target.value)}
                  />
                </div>

                <div>
                  <label htmlFor="afFrom">From date</label>
                  <input
                    id="afFrom"
                    type="date"
                    value={regFrom}
                    onChange={(e) => setRegFrom(e.target.value)}
                  />
                </div>

                <div>
                  <label htmlFor="afTo">To date</label>
                  <input
                    id="afTo"
                    type="date"
                    value={regTo}
                    onChange={(e) => setRegTo(e.target.value)}
                  />
                </div>
              </div>

              <div className="otop" style={{ marginTop: '14px' }}>
                <span>
                  <b>{filteredRegs.length}</b> of {registrations.length} registrations
                </span>
                <button className="btn" type="button" onClick={handleExportRegsCsv}>
                  Export CSV
                </button>
              </div>

              {filteredRegs.length === 0 ? (
                <p>No registrations to show.</p>
              ) : (
                filteredRegs.map((r, i) => (
                  <div className="vrow" key={r.id || i}>
                    <span>
                      <b>{r.name}</b> · {r.email}
                      <br />
                      <span className="st">
                        {r.college || 'No college'} · {r.event_title} · {r.organizer} · {fmtDT(r.created_at)}
                      </span>
                    </span>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'vol' && (
            <div style={{ marginTop: '16px' }}>
              <div className="ogrid">
                <div>
                  <label htmlFor="afSt">Status</label>
                  <select
                    id="afSt"
                    value={volStatusFilter}
                    onChange={(e) => setVolStatusFilter(e.target.value)}
                  >
                    <option value="">All statuses</option>
                    <option value="pending">Pending</option>
                    <option value="approved">Accepted</option>
                    <option value="declined">Rejected</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="afEv">Filter by event</label>
                  <select
                    id="afEv"
                    value={volEvFilter}
                    onChange={(e) => setVolEvFilter(e.target.value)}
                  >
                    <option value="">All events</option>
                    {uniqueVolEvents.map((title) => (
                      <option key={title} value={title}>
                        {title}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="afOrg">Organizer</label>
                  <select
                    id="afOrg"
                    value={volOrgFilter}
                    onChange={(e) => setVolOrgFilter(e.target.value)}
                  >
                    <option value="">All organizers</option>
                    {uniqueVolOrgs.map((org) => (
                      <option key={org} value={org}>
                        {org}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="afQ">Search volunteer</label>
                  <input
                    id="afQ"
                    placeholder="Name, email, college, role"
                    value={volQ}
                    onChange={(e) => setVolQ(e.target.value)}
                  />
                </div>
              </div>

              <div className="otop" style={{ marginTop: '14px' }}>
                <span>
                  <b>{filteredVols.length}</b> shown ·{' '}
                  {volunteerApps.filter((a) => a.status === 'pending').length} pending ·{' '}
                  {volunteerApps.filter((a) => a.status === 'approved').length} accepted ·{' '}
                  {volunteerApps.filter((a) => a.status === 'declined').length} rejected
                </span>
                <button className="btn" type="button" onClick={handleExportVolsCsv}>
                  Export CSV
                </button>
              </div>

              {filteredVols.length === 0 ? (
                <p>No volunteer applications to show.</p>
              ) : (
                filteredVols.map((v) => (
                  <div className="vrow" key={v.id}>
                    <span>
                      <b>{v.name}</b> · {v.email}
                      <br />
                      <span className="st">
                        {v.college || 'No college'} · {v.event_title} · {v.organizer}
                        <br />
                        Role: <b>{v.role || '-'}</b> · Status: <b>{v.status}</b> · Applied: {fmtDT(v.created_at)}
                        <br />
                        Reason: {v.reason || '-'}
                      </span>
                    </span>
                    <span className="oact" style={{ margin: 0 }}>
                      {v.status !== 'approved' && (
                        <button
                          className="btn sm"
                          type="button"
                          onClick={() => handleSetVolunteerStatus(v.id, 'approved')}
                        >
                          Accept
                        </button>
                      )}
                      {v.status !== 'declined' && (
                        <button
                          className="btn sm"
                          type="button"
                          onClick={() => handleSetVolunteerStatus(v.id, 'declined')}
                        >
                          Reject
                        </button>
                      )}
                      {v.status !== 'pending' && (
                        <button
                          className="btn sm"
                          type="button"
                          onClick={() => handleSetVolunteerStatus(v.id, 'pending')}
                        >
                          Reset
                        </button>
                      )}
                    </span>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}
    </dialog>
  )
}
