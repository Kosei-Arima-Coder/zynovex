export default function RolesSection({ onShowVolunteers, onOpenOrgModal }) {
  return (
    <section className="roles" id="volunteer">
      <div className="wrap">
        <h2 className="chrome">Built for both sides of an event</h2>
        <p className="sub">
          Posters are easy to find anywhere. Running the event and showing up for it is the hard part, so that’s what ZYNOVEX handles.
        </p>

        <div className="cols">
          <div className="col">
            <h3>Attendees</h3>
            <p>Register once and keep every ticket in one list.</p>
            <ul>
              <li>Filter by category, area and date</li>
              <li>See how many seats are left</li>
              <li>Get reminders before the event</li>
            </ul>
            <a className="btn" href="#discover">
              Browse events
            </a>
          </div>

          <div className="col" id="vol">
            <h3>Volunteers</h3>
            <p>Pick a role, see how many people are needed, and apply.</p>
            <ul>
              <li>Roles like registration desk, stage crew, guest help</li>
              <li>Required headcount shown on every event</li>
              <li>Track your applications and hours</li>
            </ul>
            <button
              className="btn"
              type="button"
              onClick={onShowVolunteers}
            >
              Show events needing volunteers
            </button>
          </div>

          <div className="col" id="organizers">
            <h3>Organizers</h3>
            <p>Create an event, then manage attendees and volunteers together.</p>
            <ul>
              <li>Set seats and volunteer roles with counts</li>
              <li>Approve or decline volunteer applications</li>
              <li>Export the attendee list</li>
            </ul>
            <button
              className="btn solid"
              type="button"
              onClick={onOpenOrgModal}
            >
              Manage events
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
