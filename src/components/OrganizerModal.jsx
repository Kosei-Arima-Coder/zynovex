import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { CAT_HUE, CAT_LIST } from '../lib/constants'
import { to12, to24, exportCsv, parseRoles, compressImage } from '../lib/utils'

export default function OrganizerModal({ isOpen, onClose, showToast, onEventsChanged }) {
  const dialogRef = useRef(null)
  const [view, setView] = useState('loading') // 'loading' | 'login' | 'signup' | 'forgot' | 'reset' | 'pending' | 'dash' | 'form'
  const [user, setUser] = useState(null)
  const [org, setOrg] = useState(null)
  const [myEvents, setMyEvents] = useState([])
  const [editingEvent, setEditingEvent] = useState(null)
  const [openVolEventId, setOpenVolEventId] = useState(null)
  const [msg, setMsg] = useState({ text: '', ok: false })
  const [submitting, setSubmitting] = useState(false)

  // Auth form states
  const [authMail, setAuthMail] = useState('')
  const [authPass, setAuthPass] = useState('')
  const [authOrgName, setAuthOrgName] = useState('')
  const [newPass, setNewPass] = useState('')

  // Event form states
  const [formTitle, setFormTitle] = useState('')
  const [formCat, setFormCat] = useState('Tech')
  const [formArea, setFormArea] = useState('')
  const [formVenue, setFormVenue] = useState('')
  const [formDate, setFormDate] = useState('')
  const [formTime, setFormTime] = useState('')
  const [formSeats, setFormSeats] = useState(50)
  const [formPrice, setFormPrice] = useState(0)
  const [formImg, setFormImg] = useState('')
  const [formPub, setFormPub] = useState(true)
  const [formRoles, setFormRoles] = useState('')
  const [imageFile, setImageFile] = useState(null)

  const setStatusMsg = (text, ok = false) => {
    setMsg({ text, ok })
  }

  const getNormalizedVolunteerStatus = (status) => {
    if (!status || typeof status !== 'string') return 'unknown'
    const s = status.toLowerCase().trim()
    if (s === 'pending') return 'pending'
    if (s === 'approved' || s === 'accepted') return 'approved'
    if (s === 'declined' || s === 'rejected') return 'declined'
    return 'unknown'
  }

  const loadMyEvents = useCallback(async (userId) => {
    try {
      const { data: eventsData, error: eventsError } = await supabase
        .from('events')
        .select('*, event_roles(id, name, needed), registrations(id, name, email, created_at), volunteer_apps(id, role_id, name, email, status)')
        .eq('owner', userId)
        .order('event_date')

      if (eventsError || !eventsData) {
        setMyEvents([])
        return
      }

      // Also directly fetch fresh volunteer_apps for these events to ensure the latest un-cached statuses
      if (eventsData.length > 0) {
        const eventIds = eventsData.map((e) => e.id)
        const { data: freshApps, error: appsError } = await supabase
          .from('volunteer_apps')
          .select('id, event_id, role_id, name, email, status')
          .in('event_id', eventIds)

        if (!appsError && freshApps) {
          const merged = eventsData.map((e) => {
            const evFreshApps = freshApps.filter((a) => String(a.event_id) === String(e.id))
            return {
              ...e,
              volunteer_apps: evFreshApps.length > 0 ? evFreshApps : (e.volunteer_apps || []),
            }
          })
          setMyEvents(merged)
          return
        }
      }

      setMyEvents(eventsData || [])
    } catch {
      setMyEvents([])
    }
  }, [])

  const loadOrganizer = useCallback(async (u) => {
    try {
      const { data, error } = await supabase
        .from('organizers')
        .select('*')
        .eq('id', u.id)
        .maybeSingle()

      if (error || !data) {
        setView('login')
        setStatusMsg('No organizer account found for this login')
        return
      }

      setOrg(data)

      if (!data.verified) {
        setView('pending')
        return
      }

      await loadMyEvents(u.id)
      setView('dash')
    } catch {
      setView('login')
      setStatusMsg('Failed to load organizer profile')
    }
  }, [loadMyEvents])

  useEffect(() => {
    if (dialogRef.current && !dialogRef.current.open) {
      dialogRef.current.showModal()
    }

    let isMounted = true

    async function init() {
      if (!supabase) {
        if (isMounted) {
          setView('login')
          setStatusMsg('Supabase client is not connected')
        }
        return
      }

      try {
        const { data } = await supabase.auth.getSession()
        if (!isMounted) return

        if (data && data.session && data.session.user) {
          setUser(data.session.user)
          await loadOrganizer(data.session.user)
        } else {
          setView('login')
        }
      } catch {
        if (isMounted) setView('login')
      }
    }

    init()

    return () => {
      isMounted = false
    }
  }, [loadOrganizer])

  // Synchronize dashboard whenever status changes occur (e.g. from Super Admin) or window gains focus
  useEffect(() => {
    if (!user) return

    const handleRefresh = () => {
      loadMyEvents(user.id)
    }

    window.addEventListener('zynovex:volunteer_status_updated', handleRefresh)
    window.addEventListener('focus', handleRefresh)
    document.addEventListener('visibilitychange', handleRefresh)

    let channel = null
    if (supabase && typeof supabase.channel === 'function') {
      try {
        channel = supabase
          .channel('public:volunteer_apps_organizer_sync')
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'volunteer_apps' },
            () => {
              handleRefresh()
            }
          )
          .subscribe()
      } catch {
        // Fallback gracefully if realtime is disabled
      }
    }

    return () => {
      window.removeEventListener('zynovex:volunteer_status_updated', handleRefresh)
      window.removeEventListener('focus', handleRefresh)
      document.removeEventListener('visibilitychange', handleRefresh)
      if (supabase && channel && typeof supabase.removeChannel === 'function') {
        supabase.removeChannel(channel)
      }
    }
  }, [user, loadMyEvents])

  if (!isOpen) return null

  const handleClose = () => {
    if (dialogRef.current && dialogRef.current.open) {
      dialogRef.current.close()
    }
    onClose()
  }

  // Auth Handlers
  const handleLogin = async (e) => {
    e.preventDefault()
    if (!authMail.trim() || !authPass) {
      setStatusMsg('Please enter both email and password')
      return
    }
    setSubmitting(true)
    setStatusMsg('')
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: authMail.trim(),
        password: authPass,
      })
      if (error) {
        setStatusMsg('Wrong email or password')
        setSubmitting(false)
        return
      }
      setUser(data.user)
      await loadOrganizer(data.user)
    } catch {
      setStatusMsg('Login failed. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleSignup = async (e) => {
    e.preventDefault()
    if (authOrgName.trim().length < 2 || !/\S+@\S+\.\S+/.test(authMail.trim())) {
      setStatusMsg('Enter your organization name and a valid email')
      return
    }
    if (authPass.length < 8) {
      setStatusMsg('Password must be at least 8 characters')
      return
    }
    setSubmitting(true)
    setStatusMsg('')
    try {
      const { data, error } = await supabase.auth.signUp({
        email: authMail.trim(),
        password: authPass,
        options: {
          data: {
            org_name: authOrgName.trim(),
          },
        },
      })
      if (error) {
        setStatusMsg(error.message)
        setSubmitting(false)
        return
      }
      if (data && data.session) {
        setUser(data.user)
        await loadOrganizer(data.user)
      } else {
        setStatusMsg('Account created. Check your email to confirm it, then log in.', true)
      }
    } catch {
      setStatusMsg('Signup failed. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleForgot = async (e) => {
    e.preventDefault()
    if (!/\S+@\S+\.\S+/.test(authMail.trim())) {
      setStatusMsg('Type your email in the box, then click Send reset link')
      return
    }
    setSubmitting(true)
    setStatusMsg('')
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(authMail.trim(), {
        redirectTo: window.location.origin + window.location.pathname,
      })
      if (error) {
        setStatusMsg('Could not send the email. Please try again in a few minutes')
      } else {
        setStatusMsg('If that email has an account, a reset link is on its way. Check your inbox and spam folder.', true)
      }
    } catch {
      setStatusMsg('Failed to process password reset request')
    } finally {
      setSubmitting(false)
    }
  }

  const handleSetNewPassword = async (e) => {
    e.preventDefault()
    if (newPass.length < 8) {
      setStatusMsg('Password must be at least 8 characters')
      return
    }
    setSubmitting(true)
    try {
      const { data, error } = await supabase.auth.updateUser({ password: newPass })
      if (error) {
        setStatusMsg('Could not change the password. Please request a new reset link')
      } else {
        showToast('Password changed successfully')
        setUser(data.user)
        await loadOrganizer(data.user)
      }
    } catch {
      setStatusMsg('Failed to change password')
    } finally {
      setSubmitting(false)
    }
  }

  const handleLogout = async () => {
    if (supabase) {
      await supabase.auth.signOut()
    }
    setUser(null)
    setOrg(null)
    setMyEvents([])
    setView('login')
    setStatusMsg('')
  }

  // Event Form Handlers
  const openAddForm = () => {
    setEditingEvent(null)
    setFormTitle('')
    setFormCat('Tech')
    setFormArea('')
    setFormVenue('')
    setFormDate('')
    setFormTime('')
    setFormSeats(50)
    setFormPrice(0)
    setFormImg('')
    setFormPub(true)
    setFormRoles('')
    setImageFile(null)
    setStatusMsg('')
    setView('form')
  }

  const openEditForm = (ev) => {
    setEditingEvent(ev)
    setFormTitle(ev.title || '')
    setFormCat(ev.cat || 'Tech')
    setFormArea(ev.area || '')
    setFormVenue(ev.venue || '')
    setFormDate(ev.event_date || '')
    setFormTime(to24(ev.event_time) || '')
    setFormSeats(ev.seats || 50)
    setFormPrice(ev.price || 0)
    setFormImg(ev.img || '')
    setFormPub(ev.published ?? true)
    setFormRoles((ev.event_roles || []).map((r) => `${r.name}: ${r.needed}`).join('\n'))
    setImageFile(null)
    setStatusMsg('')
    setView('form')
  }

  const handleSaveEvent = async (e) => {
    e.preventDefault()
    setStatusMsg('')

    if (formTitle.trim().length < 3 || !formArea.trim() || !formVenue.trim() || !formDate || !formTime || formSeats < 1) {
      setStatusMsg('Please fill the title, area, venue, date, time and seats')
      return
    }

    const roles = parseRoles(formRoles)
    if (roles === null) {
      setStatusMsg('Write each volunteer role like "Stage crew: 3"')
      return
    }

    setSubmitting(true)

    try {
      let finalImg = formImg
      if (imageFile) {
        setStatusMsg('Compressing and uploading picture...', true)
        const blob = await compressImage(imageFile, 1200, 0.82)
        if (!blob) {
          setStatusMsg('Could not process the image. Please try another file')
          setSubmitting(false)
          return
        }

        const uniqueSuffix = Math.random().toString(36).substring(2, 9)
        const path = `${user.id}/${uniqueSuffix}.jpg`
        const { error: uploadError } = await supabase.storage
          .from('event-images')
          .upload(path, blob, { contentType: 'image/jpeg' })

        if (uploadError) {
          setStatusMsg('Could not upload image to storage: ' + uploadError.message)
          setSubmitting(false)
          return
        }

        const { data: urlData } = supabase.storage.from('event-images').getPublicUrl(path)
        finalImg = urlData.publicUrl
      }

      const row = {
        title: formTitle.trim(),
        cat: formCat,
        area: formArea.trim(),
        venue: formVenue.trim(),
        event_date: formDate,
        event_time: to12(formTime),
        price: Math.max(0, parseInt(formPrice, 10) || 0),
        seats: parseInt(formSeats, 10) || 1,
        img: finalImg || null,
        published: formPub,
        hue: CAT_HUE[formCat] || 215,
      }

      let eventId = editingEvent ? editingEvent.id : null

      if (editingEvent) {
        const { error: updateError } = await supabase
          .from('events')
          .update(row)
          .eq('id', editingEvent.id)

        if (updateError) {
          setStatusMsg('Could not save: ' + updateError.message)
          setSubmitting(false)
          return
        }
      } else {
        row.owner = user.id
        const { data: insertData, error: insertError } = await supabase
          .from('events')
          .insert(row)
          .select('id')
          .single()

        if (insertError) {
          setStatusMsg(/row-level|policy/i.test(insertError.message)
            ? 'Your account is not verified yet'
            : 'Could not save: ' + insertError.message)
          setSubmitting(false)
          return
        }
        eventId = insertData.id
      }

      // Sync event roles
      const oldRoles = editingEvent ? editingEvent.event_roles || [] : []

      for (const nr of roles) {
        const match = oldRoles.find((x) => x.name.toLowerCase() === nr.name.toLowerCase())
        if (match) {
          if (match.needed !== nr.needed) {
            await supabase.from('event_roles').update({ needed: nr.needed }).eq('id', match.id)
          }
        } else {
          await supabase.from('event_roles').insert({
            event_id: eventId,
            name: nr.name,
            needed: nr.needed,
          })
        }
      }

      for (const o of oldRoles) {
        if (!roles.some((nr) => nr.name.toLowerCase() === o.name.toLowerCase())) {
          await supabase.from('event_roles').delete().eq('id', o.id)
        }
      }

      await loadMyEvents(user.id)
      setView('dash')
      if (onEventsChanged) onEventsChanged()
      showToast(editingEvent ? 'Event updated' : 'Event published')
    } catch {
      setStatusMsg('An error occurred while saving the event')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteEvent = async (ev) => {
    if (!window.confirm(`Delete "${ev.title}"? Its registrations and volunteer applications will be deleted too.`)) {
      return
    }

    try {
      const { error } = await supabase.from('events').delete().eq('id', ev.id)
      if (error) {
        showToast('Could not delete event: ' + error.message)
        return
      }
      await loadMyEvents(user.id)
      if (onEventsChanged) onEventsChanged()
      showToast('Event deleted')
    } catch {
      showToast('Failed to delete event')
    }
  }

  const handleUpdateVolunteerStatus = async (ev, app, newStatus) => {
    const role = (ev.event_roles || []).find((r) => r.id === app.role_id)
    if (newStatus === 'approved' && role) {
      const filled = (ev.volunteer_apps || []).filter(
        (x) => x.role_id === role.id && getNormalizedVolunteerStatus(x.status) === 'approved' && String(x.id) !== String(app.id)
      ).length
      if (filled >= role.needed) {
        showToast(`All ${role.needed} spots for ${role.name} are already filled`)
        return
      }
    }

    try {
      const { error } = await supabase
        .from('volunteer_apps')
        .update({ status: newStatus })
        .eq('id', app.id)

      if (error) {
        showToast('Could not update status: ' + (error.message || ''))
        return
      }

      // Optimistically update local state immediately so UI updates with zero lag
      setMyEvents((prev) =>
        prev.map((e) => {
          if (e.id !== ev.id) return e
          const updatedApps = (e.volunteer_apps || []).map((a) =>
            String(a.id) === String(app.id) ? { ...a, status: newStatus } : a
          )
          return { ...e, volunteer_apps: updatedApps }
        })
      )

      await loadMyEvents(user.id)
      if (onEventsChanged) onEventsChanged()
      showToast(`Volunteer ${newStatus}`)
    } catch {
      showToast('Failed to update volunteer status')
    }
  }

  const handleExportAttendees = (ev) => {
    const regs = ev.registrations || []
    if (regs.length === 0) {
      showToast('No registrations yet')
      return
    }

    const rows = [
      ['Name', 'Email', 'Registered at'],
      ...regs.map((r) => [r.name, r.email, r.created_at]),
    ]

    const filename = (ev.title || 'event').replace(/[^a-z0-9]+/gi, '-').toLowerCase() + '-attendees'
    exportCsv(filename, rows)
  }

  const getTitle = () => {
    if (view === 'signup') return 'Create organizer account'
    if (view === 'login') return 'Organizer login'
    if (view === 'forgot') return 'Reset password'
    if (view === 'reset') return 'Choose a new password'
    if (view === 'pending') return 'Waiting for verification'
    if (view === 'form') return editingEvent ? 'Edit event' : 'Add event'
    if (view === 'dash' && org) return org.org_name
    return 'Organizer'
  }

  return (
    <dialog
      ref={dialogRef}
      id="orgDlg"
      className="wide"
      aria-labelledby="oTitle"
      onClick={(e) => e.target === dialogRef.current && handleClose()}
      onClose={onClose}
    >
      <div className="ohead">
        <h3 id="oTitle">{getTitle()}</h3>
        <button className="btn" id="oClose" type="button" onClick={handleClose}>
          Close
        </button>
      </div>

      {view === 'loading' && <p>Loading organizer dashboard...</p>}

      {view === 'login' && (
        <form onSubmit={handleLogin}>
          <p>Log in to add and manage your events.</p>
          <label htmlFor="oMail">Email</label>
          <input
            id="oMail"
            type="email"
            autoComplete="email"
            required
            value={authMail}
            onChange={(e) => setAuthMail(e.target.value)}
          />

          <label htmlFor="oPass">Password</label>
          <input
            id="oPass"
            type="password"
            autoComplete="current-password"
            required
            value={authPass}
            onChange={(e) => setAuthPass(e.target.value)}
          />

          {msg.text && (
            <p className={'omsg' + (msg.ok ? ' ok' : '')} role="alert">
              {msg.text}
            </p>
          )}

          <div className="mrow">
            <button className="btn solid" type="submit" disabled={submitting}>
              {submitting ? 'Logging in...' : 'Log in'}
            </button>
          </div>

          <p style={{ marginTop: '16px' }}>
            New organizer?{' '}
            <button
              className="olink"
              type="button"
              onClick={() => {
                setStatusMsg('')
                setView('signup')
              }}
            >
              Create an account
            </button>
            {' · '}
            <button
              className="olink"
              type="button"
              onClick={() => {
                setStatusMsg('')
                setView('forgot')
              }}
            >
              Forgot password?
            </button>
          </p>
        </form>
      )}

      {view === 'signup' && (
        <form onSubmit={handleSignup}>
          <p>Register your organization. We verify every organizer before events go live.</p>
          <label htmlFor="oOrg">Organization name</label>
          <input
            id="oOrg"
            maxLength={120}
            autoComplete="organization"
            required
            value={authOrgName}
            onChange={(e) => setAuthOrgName(e.target.value)}
          />

          <label htmlFor="oMail">Email</label>
          <input
            id="oMail"
            type="email"
            autoComplete="email"
            required
            value={authMail}
            onChange={(e) => setAuthMail(e.target.value)}
          />

          <label htmlFor="oPass">Password (at least 8 characters)</label>
          <input
            id="oPass"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={authPass}
            onChange={(e) => setAuthPass(e.target.value)}
          />

          {msg.text && (
            <p className={'omsg' + (msg.ok ? ' ok' : '')} role="alert">
              {msg.text}
            </p>
          )}

          <div className="mrow">
            <button className="btn solid" type="submit" disabled={submitting}>
              {submitting ? 'Creating account...' : 'Create account'}
            </button>
          </div>

          <p style={{ marginTop: '16px' }}>
            Already registered?{' '}
            <button
              className="olink"
              type="button"
              onClick={() => {
                setStatusMsg('')
                setView('login')
              }}
            >
              Log in
            </button>
          </p>
        </form>
      )}

      {view === 'forgot' && (
        <form onSubmit={handleForgot}>
          <p>Enter your organizer email to receive a password reset link.</p>
          <label htmlFor="oMail">Email</label>
          <input
            id="oMail"
            type="email"
            autoComplete="email"
            required
            value={authMail}
            onChange={(e) => setAuthMail(e.target.value)}
          />

          {msg.text && (
            <p className={'omsg' + (msg.ok ? ' ok' : '')} role="alert">
              {msg.text}
            </p>
          )}

          <div className="mrow">
            <button
              className="btn"
              type="button"
              onClick={() => {
                setStatusMsg('')
                setView('login')
              }}
            >
              Cancel
            </button>
            <button className="btn solid" type="submit" disabled={submitting}>
              {submitting ? 'Sending...' : 'Send reset link'}
            </button>
          </div>
        </form>
      )}

      {view === 'reset' && (
        <form onSubmit={handleSetNewPassword}>
          <label htmlFor="oNew">New password (at least 8 characters)</label>
          <input
            id="oNew"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={newPass}
            onChange={(e) => setNewPass(e.target.value)}
          />

          {msg.text && (
            <p className={'omsg' + (msg.ok ? ' ok' : '')} role="alert">
              {msg.text}
            </p>
          )}

          <div className="mrow">
            <button className="btn solid" type="submit" disabled={submitting}>
              {submitting ? 'Saving...' : 'Save password'}
            </button>
          </div>
        </form>
      )}

      {view === 'pending' && (
        <div>
          <p>
            Thanks, <b>{org && org.org_name}</b>. Your organizer account is waiting for verification by our team.
            Once approved, you will be able to publish and manage your events here.
          </p>
          <div className="mrow">
            <button className="btn" type="button" onClick={handleLogout}>
              Log out
            </button>
          </div>
        </div>
      )}

      {view === 'dash' && (
        <div>
          <div className="otop">
            <button className="btn solid" type="button" onClick={openAddForm}>
              Add event
            </button>
            <button
              className="btn"
              type="button"
              onClick={() => {
                if (user) {
                  loadMyEvents(user.id)
                  showToast('Applications refreshed')
                }
              }}
            >
              Refresh
            </button>
            <button className="btn" type="button" onClick={handleLogout}>
              Log out
            </button>
          </div>

          {myEvents.length === 0 ? (
            <p style={{ marginTop: '20px' }}>
              You have no events yet. Click <b>Add event</b> to create your first one.
            </p>
          ) : (
            myEvents.map((ev) => {
              const apps = ev.volunteer_apps || []
              const pendingCount = apps.filter((a) => getNormalizedVolunteerStatus(a.status) === 'pending').length
              const regCount = (ev.registrations || []).length
              const isVolDrawerOpen = openVolEventId === ev.id

              return (
                <div className="oev" key={ev.id}>
                  <b>{ev.title}</b>
                  <small>
                    {ev.event_date} · {ev.event_time} · {ev.venue}, {ev.area}
                    {ev.published ? '' : ' · (hidden)'}
                  </small>
                  <div>
                    {regCount} of {ev.seats} registered · {apps.length} volunteer application{apps.length === 1 ? '' : 's'}
                    {pendingCount > 0 ? ` (${pendingCount} waiting)` : ''}
                  </div>

                  <div className="oact">
                    <button className="btn" type="button" onClick={() => openEditForm(ev)}>
                      Edit
                    </button>
                    <button
                      className="btn"
                      type="button"
                      onClick={() => {
                        const nextOpen = isVolDrawerOpen ? null : ev.id
                        setOpenVolEventId(nextOpen)
                        if (nextOpen && user) {
                          loadMyEvents(user.id)
                        }
                      }}
                    >
                      {isVolDrawerOpen ? 'Hide volunteers' : 'Volunteers'}
                    </button>
                    <button className="btn" type="button" onClick={() => handleExportAttendees(ev)}>
                      Export attendees
                    </button>
                    <button className="btn" type="button" onClick={() => handleDeleteEvent(ev)}>
                      Delete
                    </button>
                  </div>

                  {isVolDrawerOpen && (
                    <div style={{ marginTop: '14px', borderTop: '1px solid var(--line)', paddingTop: '10px' }}>
                      {apps.length === 0 ? (
                        <p style={{ margin: '8px 0' }}>No volunteer applications yet.</p>
                      ) : (
                        apps.map((a) => {
                          const role = (ev.event_roles || []).find((r) => r.id === a.role_id)
                          const normStatus = getNormalizedVolunteerStatus(a.status)
                          const showApprove = normStatus === 'pending' || normStatus === 'declined'
                          const showDecline = normStatus === 'pending' || normStatus === 'approved'

                          const statusLabel =
                            normStatus === 'approved'
                              ? 'Approved'
                              : normStatus === 'declined'
                              ? 'Declined'
                              : normStatus === 'pending'
                              ? 'Pending'
                              : 'Unknown status'

                          return (
                            <div className="vrow" key={a.id}>
                              <span>
                                <b>{a.name}</b> · {a.email}
                                <br />
                                <span className="st">
                                  {role ? role.name : 'Unknown role'} · Status:{' '}
                                  <b style={{ textTransform: normStatus === 'unknown' ? 'none' : 'capitalize' }}>
                                    {statusLabel}
                                  </b>
                                </span>
                              </span>
                              <span className="oact" style={{ margin: 0 }}>
                                {showApprove && (
                                  <button
                                    className="btn sm"
                                    type="button"
                                    onClick={() => handleUpdateVolunteerStatus(ev, a, 'approved')}
                                  >
                                    Approve
                                  </button>
                                )}
                                {showDecline && (
                                  <button
                                    className="btn sm"
                                    type="button"
                                    onClick={() => handleUpdateVolunteerStatus(ev, a, 'declined')}
                                  >
                                    Decline
                                  </button>
                                )}
                              </span>
                            </div>
                          )
                        })
                      )}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      )}

      {view === 'form' && (
        <form onSubmit={handleSaveEvent}>
          <label htmlFor="eTitle">Event title</label>
          <input
            id="eTitle"
            maxLength={120}
            required
            value={formTitle}
            onChange={(e) => setFormTitle(e.target.value)}
          />

          <div className="ogrid">
            <div>
              <label htmlFor="eCat">Category</label>
              <select id="eCat" value={formCat} onChange={(e) => setFormCat(e.target.value)}>
                {CAT_LIST.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="eArea">Area in Bengaluru</label>
              <input
                id="eArea"
                list="blrPlaces"
                maxLength={60}
                required
                placeholder="e.g. Indiranagar"
                value={formArea}
                onChange={(e) => setFormArea(e.target.value)}
              />
            </div>

            <div>
              <label htmlFor="eVenue">Venue</label>
              <input
                id="eVenue"
                maxLength={120}
                required
                placeholder="Building, street, hall"
                value={formVenue}
                onChange={(e) => setFormVenue(e.target.value)}
              />
            </div>

            <div>
              <label htmlFor="eDate">Date</label>
              <input
                id="eDate"
                type="date"
                required
                value={formDate}
                onChange={(e) => setFormDate(e.target.value)}
              />
            </div>

            <div>
              <label htmlFor="eTime">Start time</label>
              <input
                id="eTime"
                type="time"
                required
                value={formTime}
                onChange={(e) => setFormTime(e.target.value)}
              />
            </div>

            <div>
              <label htmlFor="eSeats">Seats</label>
              <input
                id="eSeats"
                type="number"
                min="1"
                required
                value={formSeats}
                onChange={(e) => setFormSeats(Number(e.target.value))}
              />
            </div>

            <div>
              <label htmlFor="ePrice">Price in ₹ (0 = free)</label>
              <input
                id="ePrice"
                type="number"
                min="0"
                value={formPrice}
                onChange={(e) => setFormPrice(Number(e.target.value))}
              />
            </div>

            <div>
              <label htmlFor="eFile">Event picture (optional)</label>
              <input
                id="eFile"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => setImageFile(e.target.files[0] || null)}
              />
              <small>
                {formImg ? 'A picture is already uploaded. Choose a file to replace it.' : 'JPG, PNG or WebP under 8MB'}
              </small>
            </div>
          </div>

          <label htmlFor="eRoles">Volunteer roles, one per line as "Role: number"</label>
          <textarea
            id="eRoles"
            placeholder={'Registration desk: 4\nStage crew: 2'}
            value={formRoles}
            onChange={(e) => setFormRoles(e.target.value)}
          />

          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              id="ePub"
              checked={formPub}
              onChange={(e) => setFormPub(e.target.checked)}
              style={{ width: 'auto' }}
            />
            Show this event on the website
          </label>

          {msg.text && (
            <p className={'omsg' + (msg.ok ? ' ok' : '')} role="alert">
              {msg.text}
            </p>
          )}

          <div className="mrow">
            <button
              className="btn"
              type="button"
              onClick={() => {
                setStatusMsg('')
                setView('dash')
              }}
              disabled={submitting}
            >
              Cancel
            </button>
            <button className="btn solid" type="submit" disabled={submitting}>
              {submitting ? 'Saving...' : editingEvent ? 'Save changes' : 'Publish event'}
            </button>
          </div>
        </form>
      )}
    </dialog>
  )
}
