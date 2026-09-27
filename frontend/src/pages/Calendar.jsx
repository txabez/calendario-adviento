import { Link } from 'react-router-dom'

const DAYS = Array.from({ length: 24 }, (_, i) => i + 1)

export default function Calendar() {
  return (
    <main className="page">
      <h1>
        Calendario Adviento
        <span className="subtitle">20 aniversario</span>
      </h1>

      <div className="calendar">
        {DAYS.map((day) => (
          <Link key={day} to={`/dia/${day}`} className="calendar-day">
            {day}
          </Link>
        ))}
      </div>
    </main>
  )
}
