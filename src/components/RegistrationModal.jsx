import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

export default function RegistrationModal({
  isOpen,
  onClose,
  event,
  initialMode = 'attend',
  onSuccess,
  showToast,
}) {
  const dialogRef = useRef(null)
  const [mode, setMode] = useState(() => (
    event && event.roles && event.roles.length > 0 ? initialMode : 'attend'
  ))
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [college, setCollege] = useState('')
  const [selectedRoleIndex, setSelectedRoleIndex] = useState(0)
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (isOpen && dialogRef.current && !dialogRef.current.open) {
      dialogRef.current.showModal()
    }
  }, [isOpen])

  if (!isOpen || !event) return null

  const handleClose = () => {
    if (dialogRef.current && dialogRef.current.open) {
      dialogRef.current.close()
    }
    onClose()
  }

  const handleBackdropClick = (e) => {
    if (e.target === dialogRef.current) {
      handleClose()
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const trimmedName = name.trim()
    const trimmedEmail = email.trim()
    const trimmedCollege = college.trim()
    const trimmedReason = reason.trim()

    if (!trimmedName || !/\S+@\S+\.\S+/.test(trimmedEmail)) {
      showToast('Enter your name and a valid email')
      return
    }

    if (mode === 'vol' && trimmedReason.length < 10) {
      showToast('Tell us briefly why you want to volunteer (at least 10 characters)')
      return
    }

    setLoading(true)

    try {
      if (supabase && (event.remote || event.id)) {
        let r
        if (mode === 'attend') {
          r = await supabase.rpc('register_attendee', {
            p_event: String(event.id),
            p_name: trimmedName,
            p_email: trimmedEmail,
            p_college: trimmedCollege || null,
          })
        } else {
          const roleId = event.roleIds && event.roleIds[selectedRoleIndex]
            ? String(event.roleIds[selectedRoleIndex])
            : String(selectedRoleIndex)

          r = await supabase.rpc('apply_volunteer', {
            p_event: String(event.id),
            p_role: roleId,
            p_name: trimmedName,
            p_email: trimmedEmail,
            p_college: trimmedCollege || null,
            p_reason: trimmedReason,
          })
        }

        if (r.error) {
          if (r.error.code === '23505') {
            showToast('You have already signed up with this email')
          } else if (/sold out/i.test(r.error.message || '')) {
            showToast('Sorry, this event is full')
          } else if (/not open/i.test(r.error.message || '')) {
            showToast('This event is not open for sign-ups')
          } else {
            showToast(r.error.message || 'Could not save. Please try again')
          }
          setLoading(false)
          return
        }

        showToast(mode === 'attend' ? `Registered for ${event.title}` : `Application sent for ${event.title}`)
        onSuccess(event, mode)
        handleClose()
      } else {
        showToast('Service temporarily unavailable. Please try again later.')
        handleClose()
      }
    } catch {
      showToast('An unexpected error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const hasRoles = event.roles && event.roles.length > 0

  return (
    <dialog
      ref={dialogRef}
      id="dlg"
      aria-labelledby="dTitle"
      onClick={handleBackdropClick}
      onClose={onClose}
    >
      <h3 id="dTitle">{event.title}</h3>
      <p id="dMeta">
        {event.venue}, {event.area} · {event.time}
      </p>

      <div className="tabs" role="tablist">
        <button
          className="chip"
          id="tAttend"
          type="button"
          aria-pressed={mode === 'attend'}
          onClick={() => setMode('attend')}
        >
          Attend
        </button>
        {hasRoles && (
          <button
            className="chip"
            id="tVol"
            type="button"
            aria-pressed={mode === 'vol'}
            onClick={() => setMode('vol')}
          >
            Volunteer
          </button>
        )}
      </div>

      <form onSubmit={handleSubmit}>
        <label htmlFor="fName">Full name</label>
        <input
          id="fName"
          autoComplete="name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <label htmlFor="fMail">Email</label>
        <input
          id="fMail"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <div id="fColWrap">
          <label htmlFor="fCollege">College or Institution (optional)</label>
          <input
            id="fCollege"
            autoComplete="organization"
            maxLength={160}
            placeholder="Optional"
            value={college}
            onChange={(e) => setCollege(e.target.value)}
          />
        </div>

        {mode === 'vol' && hasRoles && (
          <div id="fRoleWrap">
            <label htmlFor="fRole">Volunteer role</label>
            <select
              id="fRole"
              value={selectedRoleIndex}
              onChange={(e) => setSelectedRoleIndex(Number(e.target.value))}
            >
              {event.roles.map((r, i) => (
                <option key={r[0]} value={i}>
                  {r[0]} ({r[1]} needed)
                </option>
              ))}
            </select>

            <div id="fReasonWrap">
              <label htmlFor="fReason">Why do you want to volunteer?</label>
              <textarea
                id="fReason"
                rows={3}
                maxLength={500}
                placeholder="Share your interest or relevant experience (min 10 characters)"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
          </div>
        )}

        <div className="mrow">
          <button
            className="btn"
            id="cancel"
            type="button"
            onClick={handleClose}
            disabled={loading}
          >
            Cancel
          </button>
          <button
            className="btn solid"
            id="submit"
            type="submit"
            disabled={loading}
          >
            {loading ? 'Saving...' : mode === 'vol' ? 'Send application' : 'Confirm registration'}
          </button>
        </div>
      </form>
    </dialog>
  )
}
