import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import Navbar from '../../components/Navbar'
import Tag from '../../components/Tag'
import StatStrip from '../../components/StatStrip'
import { getCurrentUser } from '../../lib/auth'
import { findUser, STATUSES } from '../../lib/store'
import {
  STATUS_META,
  PRIORITY_META,
  ticketCode,
  timeAgo,
  statusOrder,
  priorityOrder,
} from '../../lib/meta'

export default function TicketList() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [sort, setSort] = useState('updated')

  useEffect(() => {
    const u = getCurrentUser()
    if (!u) {
      router.push('/')
      return
    }
    setUser(u)
    load(u)
  }, [])

  async function load(u) {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/tickets?studentId=${u.id}`, {
        headers: { 'x-user-id': u.id },
      })
      if (!res.ok) throw new Error('Request failed')
      const data = await res.json()
      setTickets(data.tickets)
    } catch {
      setError('Could not load your tickets. Try refreshing the page.')
    } finally {
      setLoading(false)
    }
  }

  const stats = useMemo(() => {
    const open = tickets.filter((t) => t.status === 'Open').length
    const active = tickets.filter((t) =>
      ['Assigned', 'In Progress'].includes(t.status),
    ).length
    const resolved = tickets.filter((t) =>
      ['Resolved', 'Closed'].includes(t.status),
    ).length
    return [
      { label: 'Total', value: tickets.length },
      { label: 'Open', value: open, tone: 'rust' },
      { label: 'In progress', value: active, tone: 'amber' },
      { label: 'Resolved', value: resolved, tone: 'moss' },
    ]
  }, [tickets])

  const visible = useMemo(() => {
    let list = tickets
    if (status !== 'all') list = list.filter((t) => t.status === status)
    const q = search.trim().toLowerCase()
    if (q) {
      list = list.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.location.toLowerCase().includes(q) ||
          t.category.toLowerCase().includes(q),
      )
    }
    list = [...list]
    if (sort === 'updated') {
      list.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
    } else if (sort === 'priority') {
      list.sort((a, b) => priorityOrder(a.priority) - priorityOrder(b.priority))
    } else if (sort === 'status') {
      list.sort((a, b) => statusOrder(a.status) - statusOrder(b.status))
    }
    return list
  }, [tickets, status, search, sort])

  if (!user) return null

  return (
    <div>
      <Navbar user={user} title="My Tickets" />
      <div className="container">
        <div className="detail-head">
          <div>
            <h1>My Tickets</h1>
            <p className="subtitle">Requests you've submitted to facilities.</p>
          </div>
          <Link href="/tickets/new" className="btn btn-primary">
            New Ticket
          </Link>
        </div>

        <StatStrip stats={stats} />

        {error && <div className="banner banner-error">{error}</div>}

        <div className="filter-bar">
          <input
            type="search"
            placeholder="Search title, location, category…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="all">All statuses</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <select value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="updated">Sort: recently updated</option>
            <option value="priority">Sort: priority</option>
            <option value="status">Sort: status</option>
          </select>
        </div>

        <div className="panel ticket-table">
          <div className="ticket-head">
            <div>ID</div>
            <div>Ticket</div>
            <div>Location</div>
            <div>Priority</div>
            <div>Status</div>
            <div>Technician</div>
            <div>Updated</div>
          </div>

          {loading && <div className="empty-state">Loading tickets…</div>}

          {!loading && visible.length === 0 && (
            <div className="empty-state">
              <strong>No tickets match</strong>
              {tickets.length === 0
                ? "You haven't submitted a service request yet."
                : 'Try a different search or filter.'}
            </div>
          )}

          {!loading &&
            visible.map((t) => {
              const tech = t.technicianId ? findUser(t.technicianId) : null
              return (
                <div className="ticket-row" key={t.id}>
                  <div>
                    <span className="code">{ticketCode(t.id)}</span>
                  </div>
                  <div className="ticket-title-cell">
                    <span className="cell-label">Ticket</span>
                    <Link href={`/tickets/${t.id}`}>{t.title}</Link>
                    <div className="ticket-meta">{t.category}</div>
                  </div>
                  <div className="ticket-meta">
                    <span className="cell-label">Location</span>
                    {t.location}
                  </div>
                  <div>
                    <span className="cell-label">Priority</span>
                    <Tag tone={PRIORITY_META[t.priority].tone}>
                      {t.priority}
                    </Tag>
                  </div>
                  <div>
                    <span className="cell-label">Status</span>
                    <Tag tone={STATUS_META[t.status].tone}>{t.status}</Tag>
                  </div>
                  <div className="ticket-meta">
                    <span className="cell-label">Technician</span>
                    {tech ? tech.name : '—'}
                  </div>
                  <div className="ticket-meta">
                    <span className="cell-label">Updated</span>
                    {timeAgo(t.updatedAt)}
                  </div>
                </div>
              )
            })}
        </div>
      </div>
    </div>
  )
}
