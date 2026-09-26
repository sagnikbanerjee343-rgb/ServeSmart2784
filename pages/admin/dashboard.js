import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/router'
import Navbar from '../../components/Navbar'
import StatStrip from '../../components/StatStrip'
import { getCurrentUser } from '../../lib/auth'
import { CATEGORIES, PRIORITIES, users } from '../../lib/store'

function resolvedAt(ticket) {
  if (ticket.resolvedAt) return ticket.resolvedAt
  const event = (ticket.activity || []).find(
    (activity) =>
      activity.type === 'status' &&
      activity.message === 'Status changed to Resolved',
  )
  return event ? event.at : null
}

function resolutionHours(ticket) {
  const end = resolvedAt(ticket)
  if (!end || !ticket.createdAt) return null
  const hours = (new Date(end) - new Date(ticket.createdAt)) / 3600000
  return Number.isFinite(hours) && hours >= 0 ? hours : null
}

function monthLabel(month) {
  const [year, value] = month.split('-')
  return new Date(Number(year), Number(value) - 1, 1).toLocaleDateString(
    undefined,
    { month: 'short', year: 'numeric' },
  )
}

function BarList({ items, emptyMessage }) {
  const maximum = Math.max(...items.map((item) => item.value), 1)
  if (!items.length) return <div className="empty-state">{emptyMessage}</div>

  return (
    <div className="bar-list">
      {items.map((item) => (
        <div className="kv-row" key={item.label}>
          <span className="k" style={{ minWidth: 120 }}>
            {item.label}
          </span>
          <span className="v" style={{ flex: 1 }}>
            <span
              style={{
                display: 'inline-block',
                width: `${(item.value / maximum) * 100}%`,
                minWidth: item.value ? 8 : 0,
                height: 8,
                marginRight: 8,
                borderRadius: 99,
                background: 'var(--rust, #b85c38)',
                verticalAlign: 'middle',
              }}
            />
            <strong>{item.value}</strong>
          </span>
        </div>
      ))}
    </div>
  )
}

export default function AdminDashboard() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const currentUser = getCurrentUser()
    if (!currentUser || currentUser.role !== 'admin') {
      router.push(currentUser?.role === 'student' ? '/tickets' : '/')
      return
    }
    setUser(currentUser)
    load(currentUser)
  }, [])

  async function load(currentUser) {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/tickets', {
        headers: { 'x-user-id': currentUser.id },
      })
      if (!res.ok) throw new Error('Could not load analytics.')
      const data = await res.json()
      setTickets(data.tickets)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const analytics = useMemo(() => {
    const categoryCounts = CATEGORIES.map((category) => ({
      label: category,
      value: tickets.filter((ticket) => ticket.category === category).length,
    })).filter((item) => item.value > 0)

    const priorityCounts = PRIORITIES.map((priority) => ({
      label: priority,
      value: tickets.filter((ticket) => ticket.priority === priority).length,
    }))

    const durations = tickets.map(resolutionHours).filter((hours) => hours !== null)
    const averageResolution = durations.length
      ? durations.reduce((sum, hours) => sum + hours, 0) / durations.length
      : 0

    const technicianWorkload = users
      .filter((person) => person.role === 'technician')
      .map((technician) => {
        const assigned = tickets.filter(
          (ticket) => ticket.technicianId === technician.id,
        )
        const active = assigned.filter(
          (ticket) => !['Resolved', 'Closed'].includes(ticket.status),
        )
        return {
          label: technician.name,
          value: active.length,
          assigned: assigned.length,
        }
      })

    const months = {}
    tickets.forEach((ticket) => {
      const date = new Date(ticket.createdAt)
      if (Number.isNaN(date.getTime())) return
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      months[key] = (months[key] || 0) + 1
    })
    const monthlyTrends = Object.entries(months)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([month, value]) => ({ label: monthLabel(month), value }))

    return {
      categoryCounts,
      priorityCounts,
      averageResolution,
      technicianWorkload,
      monthlyTrends,
      resolvedCount: durations.length,
      activeCount: tickets.filter(
        (ticket) => !['Resolved', 'Closed'].includes(ticket.status),
      ).length,
    }
  }, [tickets])

  if (!user) return null

  return (
    <div className="admin-dashboard-page">
      <Navbar user={user} title="Analytics" />
      <div className="container">
        <h1>Service Analytics</h1>
        <p className="subtitle">
          A live view of ticket volume, resolution speed, and technician workload.
        </p>

        <StatStrip
          stats={[
            { label: 'Total tickets', value: tickets.length },
            { label: 'Active', value: analytics.activeCount, tone: 'amber' },
            { label: 'Resolved', value: analytics.resolvedCount, tone: 'moss' },
            {
              label: 'Avg. resolution',
              value: analytics.resolvedCount
                ? `${analytics.averageResolution.toFixed(1)}h`
                : '—',
            },
          ]}
        />

        {error && <div className="banner banner-error">{error}</div>}
        {loading ? (
          <div className="panel panel-pad">Loading analytics…</div>
        ) : (
          <div className="detail-grid">
            <div>
              <div className="panel panel-pad" style={{ marginBottom: 14 }}>
                <div className="section-label">Tickets by category</div>
                <BarList
                  items={analytics.categoryCounts}
                  emptyMessage="No category data yet."
                />
              </div>

              <div className="panel panel-pad" style={{ marginBottom: 14 }}>
                <div className="section-label">Tickets by priority</div>
                <BarList items={analytics.priorityCounts} />
              </div>

              <div className="panel panel-pad">
                <div className="section-label">Monthly ticket trends</div>
                <BarList
                  items={analytics.monthlyTrends}
                  emptyMessage="No monthly data yet."
                />
              </div>
            </div>

            <div>
              <div className="panel panel-pad" style={{ marginBottom: 14 }}>
                <div className="section-label">Technician workload</div>
                <div className="kv-list">
                  {analytics.technicianWorkload.map((technician) => (
                    <div className="kv-row" key={technician.label}>
                      <span className="k">{technician.label}</span>
                      <span className="v">
                        {technician.value} active · {technician.assigned} total
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="panel panel-pad">
                <div className="section-label">Resolution time</div>
                <p style={{ marginTop: 0 }}>
                  Average time from ticket creation to the Resolved status.
                </p>
                <strong style={{ fontSize: 28 }}>
                  {analytics.resolvedCount
                    ? `${analytics.averageResolution.toFixed(1)} hours`
                    : 'No resolved tickets'}
                </strong>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
