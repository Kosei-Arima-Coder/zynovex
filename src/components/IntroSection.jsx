import { BLR } from '../lib/constants'

export default function IntroSection({
  searchQuery,
  onSearchChange,
  selectedArea,
  onAreaChange,
  eventCount,
  volunteerSpots,
  organizerCount,
  availableAreas = [],
}) {
  const allAreas = Array.from(new Set([...BLR, ...availableAreas])).sort()

  return (
    <div className="intro">
      <div className="wrap">
        <p className="lead">
          Discover, register and volunteer in one place.
        </p>

        <div className="search" role="search">
          <input
            id="q"
            type="search"
            list="blrPlaces"
            placeholder="Search events, venues, or areas in Bengaluru"
            aria-label="Search events in Bengaluru"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
          />
          <datalist id="blrPlaces">
            {allAreas.map((area) => (
              <option key={area} value={area} />
            ))}
          </datalist>

          <select
            id="area"
            aria-label="Select Bengaluru area"
            value={selectedArea}
            onChange={(e) => onAreaChange(e.target.value)}
          >
            <option value="">All of Bengaluru</option>
            {allAreas.map((area) => (
              <option key={area} value={area}>
                {area}
              </option>
            ))}
          </select>
        </div>

        <div className="stats">
          <div>
            <b>{eventCount}</b>
            events this month
          </div>
          <div>
            <b>{volunteerSpots}</b>
            volunteer spots open
          </div>
          <div>
            <b>{organizerCount}</b>
            verified organizers
          </div>
        </div>
      </div>
    </div>
  )
}
