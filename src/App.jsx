import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import './App.css'
import { supabase } from './lib/supabase'
import { DEFAULT_EVENTS } from './lib/constants'
import { need } from './lib/utils'

import Navbar from './components/Navbar'
import Hero from './components/Hero'
import IntroSection from './components/IntroSection'
import EventGrid from './components/EventGrid'
import RolesSection from './components/RolesSection'
import Footer from './components/Footer'
import RegistrationModal from './components/RegistrationModal'
import OrganizerModal from './components/OrganizerModal'
import AdminModal from './components/AdminModal'
import Toast from './components/Toast'

export default function App() {
  const [events, setEvents] = useState(() => {
    try {
      const cached = localStorage.getItem('zx_cache')
      if (cached) {
        const parsed = JSON.parse(cached)
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Only preserve genuine remote events from Supabase; filter out any fabricated events
          const genuine = parsed.filter((e) => e && e.remote === true)
          if (genuine.length > 0) return genuine
        }
      }
    } catch {
      // Ignore localStorage read errors
    }
    return DEFAULT_EVENTS
  })

  const [selectedCat, setSelectedCat] = useState('All')
  const [volOnly, setVolOnly] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedArea, setSelectedArea] = useState('')

  // Modals state
  const [regModal, setRegModal] = useState({ isOpen: false, event: null, mode: 'attend' })
  const [orgModalOpen, setOrgModalOpen] = useState(false)
  const [adminModalOpen, setAdminModalOpen] = useState(false)

  // Toast state
  const [toast, setToast] = useState({ message: '', isVisible: false })
  const toastTimer = useRef(null)

  const showToast = useCallback((message) => {
    setToast({ message, isVisible: true })
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => {
      setToast((prev) => ({ ...prev, isVisible: false }))
    }, 2800)
  }, [])

  // Load live events from Supabase events_public view
  const loadRemoteEvents = useCallback(async () => {
    if (!supabase) {
      setEvents([])
      return
    }

    try {
      const { data, error } = await supabase
        .from('events_public')
        .select('*')
        .order('event_date')

      if (error) {
        setEvents([])
        return
      }

      if (!data || data.length === 0) {
        setEvents([])
        try {
          localStorage.setItem('zx_cache', JSON.stringify([]))
        } catch {
          // Ignore localStorage quota errors
        }
        return
      }

      const remoteEvents = data.map((x) => ({
        id: x.id,
        remote: true,
        title: x.title,
        cat: x.cat,
        area: x.area,
        venue: x.venue,
        date: x.event_date,
        time: x.event_time,
        price: x.price || 0,
        seats: x.seats || 0,
        taken: x.taken || 0,
        org: x.org,
        hue: x.hue || 215,
        img: x.img || '',
        roles: (x.roles || []).map((q) => [q.name, q.open]),
        roleIds: (x.roles || []).map((q) => q.id),
      }))

      setEvents(remoteEvents)
      try {
        localStorage.setItem('zx_cache', JSON.stringify(remoteEvents))
      } catch {
        // Ignore localStorage quota errors
      }
    } catch {
      setEvents([])
    }
  }, [])

  useEffect(() => {
    let active = true

    async function fetchOnMount() {
      if (!supabase) {
        if (active) setEvents([])
        return
      }
      try {
        const { data, error } = await supabase
          .from('events_public')
          .select('*')
          .order('event_date')

        if (!active) return

        if (error || !data || data.length === 0) {
          setEvents([])
          try {
            localStorage.setItem('zx_cache', JSON.stringify([]))
          } catch {
            // Ignore storage errors
          }
          return
        }

        const remoteEvents = data.map((x) => ({
          id: x.id,
          remote: true,
          title: x.title,
          cat: x.cat,
          area: x.area,
          venue: x.venue,
          date: x.event_date,
          time: x.event_time,
          price: x.price || 0,
          seats: x.seats || 0,
          taken: x.taken || 0,
          org: x.org,
          hue: x.hue || 215,
          img: x.img || '',
          roles: (x.roles || []).map((q) => [q.name, q.open]),
          roleIds: (x.roles || []).map((q) => q.id),
        }))

        setEvents(remoteEvents)
        try {
          localStorage.setItem('zx_cache', JSON.stringify(remoteEvents))
        } catch {
          // Ignore storage errors
        }
      } catch {
        if (active) setEvents([])
      }
    }

    fetchOnMount()

    if (supabase) {
      const { data: authListener } = supabase.auth.onAuthStateChange((event) => {
        if (event === 'PASSWORD_RECOVERY') {
          setOrgModalOpen(true)
        }
      })

      return () => {
        active = false
        if (authListener && authListener.subscription) {
          authListener.subscription.unsubscribe()
        }
      }
    }

    return () => {
      active = false
    }
  }, [])

  // Filtered events
  const filteredEvents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return events.filter((e) => {
      const matchesCat = selectedCat === 'All' || e.cat === selectedCat
      const matchesArea = !selectedArea || e.area === selectedArea
      const matchesVol = !volOnly || need(e) > 0
      const matchesSearch =
        !q ||
        (e.title + ' ' + e.venue + ' ' + e.org + ' ' + e.area)
          .toLowerCase()
          .includes(q)

      return matchesCat && matchesArea && matchesVol && matchesSearch
    })
  }, [events, selectedCat, selectedArea, volOnly, searchQuery])

  // Dynamic statistics
  const totalVolunteerSpots = useMemo(() => {
    return events.reduce((acc, e) => acc + need(e), 0)
  }, [events])

  const uniqueOrganizersCount = useMemo(() => {
    return new Set(events.map((e) => e.org).filter(Boolean)).size
  }, [events])

  const availableAreas = useMemo(() => {
    return Array.from(new Set(events.map((e) => e.area).filter(Boolean)))
  }, [events])

  // Handlers
  const handleOpenRegister = (ev) => {
    setRegModal({ isOpen: true, event: ev, mode: 'attend' })
  }

  const handleOpenVolunteer = (ev) => {
    setRegModal({ isOpen: true, event: ev, mode: 'vol' })
  }

  const handleRegistrationSuccess = () => {
    loadRemoteEvents()
  }

  const handleShowVolunteers = () => {
    setVolOnly(true)
    const element = document.getElementById('discover')
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' })
    }
  }

  return (
    <>
      <Navbar onOpenOrgModal={() => setOrgModalOpen(true)} />

      <main id="top">
        <Hero />

        <IntroSection
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          selectedArea={selectedArea}
          onAreaChange={setSelectedArea}
          eventCount={events.length}
          volunteerSpots={totalVolunteerSpots}
          organizerCount={uniqueOrganizersCount}
          availableAreas={availableAreas}
        />

        <EventGrid
          events={filteredEvents}
          totalCount={events.length}
          selectedCat={selectedCat}
          onSelectCat={setSelectedCat}
          volOnly={volOnly}
          onToggleVolOnly={setVolOnly}
          onOpenRegister={handleOpenRegister}
          onOpenVolunteer={handleOpenVolunteer}
        />

        <RolesSection
          onShowVolunteers={handleShowVolunteers}
          onOpenOrgModal={() => setOrgModalOpen(true)}
        />
      </main>

      <Footer onOpenAdminModal={() => setAdminModalOpen(true)} />

      {regModal.isOpen && regModal.event && (
        <RegistrationModal
          key={`${regModal.event.id}_${regModal.mode}`}
          isOpen={regModal.isOpen}
          onClose={() => setRegModal((prev) => ({ ...prev, isOpen: false }))}
          event={regModal.event}
          initialMode={regModal.mode}
          onSuccess={handleRegistrationSuccess}
          showToast={showToast}
        />
      )}

      {orgModalOpen && (
        <OrganizerModal
          isOpen={orgModalOpen}
          onClose={() => setOrgModalOpen(false)}
          showToast={showToast}
          onEventsChanged={loadRemoteEvents}
        />
      )}

      {adminModalOpen && (
        <AdminModal
          isOpen={adminModalOpen}
          onClose={() => setAdminModalOpen(false)}
          showToast={showToast}
        />
      )}

      <Toast message={toast.message} isVisible={toast.isVisible} />
    </>
  )
}
