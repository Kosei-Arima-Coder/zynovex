import { MON, CAT_LIST } from '../lib/constants'
import { need } from '../lib/utils'

export default function EventGrid({
  events,
  totalCount = 0,
  selectedCat,
  onSelectCat,
  volOnly,
  onToggleVolOnly,
  onOpenRegister,
  onOpenVolunteer,
}) {
  const categories = ['All', ...CAT_LIST]

  return (
    <section id="discover">
      <div className="wrap">
        <h2 className="chrome">Discover Bengaluru</h2>
        <p className="sub">
          Every event here is from an organizer we’ve verified. Register to attend or sign up for a volunteer role.
        </p>

        <div className="filters" role="group" aria-label="Categories">
          {categories.map((c) => (
            <button
              key={c}
              className="chip"
              type="button"
              aria-pressed={c === selectedCat}
              onClick={() => onSelectCat(c)}
            >
              {c}
            </button>
          ))}

          <label className="toggle">
            <input
              type="checkbox"
              checked={volOnly}
              onChange={(e) => onToggleVolOnly(e.target.checked)}
            />
            Needs volunteers
          </label>
        </div>

        <div className="grid" aria-live="polite">
          {events.length === 0 ? (
            <div className="empty">
              {totalCount === 0
                ? 'No events available right now. Please check back later.'
                : 'No events match these filters. Clear the search or pick another category.'}
            </div>
          ) : (
            events.map((e) => {
              const d = new Date(e.date + 'T00:00:00')
              const n = need(e)
              const seatsLeft = Math.max(0, e.seats - (e.taken || 0))
              const pct = Math.min(100, Math.round(((e.taken || 0) / (e.seats || 1)) * 100))
              const hue = e.hue || 215

              return (
                <article className="card" key={e.id}>
                  <div
                    className="poster"
                    style={{
                      background: `radial-gradient(120% 100% at 80% 0%, hsl(${hue} 40% 38%) 0%, transparent 62%), linear-gradient(160deg, #343942, #1a1c21)`,
                    }}
                  >
                    {e.img && (
                      <img
                        className="pimg"
                        src={e.img}
                        alt={`${e.title} poster`}
                        loading="lazy"
                        onError={(ev) => {
                          ev.currentTarget.style.display = 'none'
                        }}
                      />
                    )}
                    <div className="date">
                      <b>{isNaN(d.getDate()) ? '--' : d.getDate()}</b>
                      <small>{isNaN(d.getMonth()) ? '' : MON[d.getMonth()]}</small>
                    </div>
                    <span className="tag">{e.cat}</span>
                  </div>

                  <div className="body">
                    <h3>{e.title}</h3>
                    <p className="meta">
                      {e.venue}, {e.area}
                      <br />
                      {e.time} · {e.price ? '₹' + e.price : 'Free'} · by {e.org}
                    </p>
                    <div className="bar" aria-hidden="true">
                      <i style={{ width: `${pct}%` }}></i>
                    </div>
                    <div className="row">
                      <span>{seatsLeft} of {e.seats} seats left</span>
                      <span className="vol">
                        {n > 0 ? `${n} volunteer${n === 1 ? '' : 's'} needed` : 'No volunteer roles'}
                      </span>
                    </div>
                    <div className="actions">
                      <button
                        className="btn solid"
                        type="button"
                        onClick={() => onOpenRegister(e)}
                      >
                        Register
                      </button>
                      {n > 0 && (
                        <button
                          className="btn"
                          type="button"
                          onClick={() => onOpenVolunteer(e)}
                        >
                          Volunteer
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              )
            })
          )}
        </div>
      </div>
    </section>
  )
}
