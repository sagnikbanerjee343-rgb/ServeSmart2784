import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import Navbar from '../../components/Navbar'
import Tag from '../../components/Tag'
import StatStrip from '../../components/StatStrip'
import { getCurrentUser } from '../../lib/auth'
import { PRIORITIES, STATUSES } from '../../lib/store'
import {
  STATUS_META,
  PRIORITY_META,
  ticketCode,
  timeAgo,
  priorityOrder,
} from '../../lib/meta'

const NEXT_STATUS = {
  Assigned: 'In Progress',
  'In Progress': 'Resolved',
  Resolved: 'Closed',
}

export default function TechnicianDashboard() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [working, setWorking] = useState(null)

  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [priority, setPriority] = useState('all')

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
      const res = await fetch(`/api/tickets?technicianId=${u.id}`)
      if (!res.ok) throw new Error('Request failed')
      const data = await res.json()
      setTickets(data.tickets)
    } catch {
      setError('Could not load your queue. Try refreshing the page.')
    } finally {
      setLoading(false)
    }
  }

  async function advance(ticketId, nextStatus) {
    setWorking(ticketId)
    try {
      const res = await fetch(`/api/tickets/${ticketId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus, actorId: user.id }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Could not update that ticket.')
      }
      const data = await res.json()
      setTickets((list) =>
        list.map((t) => (t.id === ticketId ? data.ticket : t)),
      )
    } catch (err) {
      setError(err.message)
    } finally {
      setWorking(null)
    }
  }

  const stats = useMemo(() => {
    const open = tickets.filter((t) => t.status === 'Assigned').length
    const active = tickets.filter((t) => t.status === 'In Progress').length
    const critical = tickets.filter(
      (t) => t.priority === 'P1' && !['Resolved', 'Closed'].includes(t.status),
    ).length
    const done = tickets.filter((t) =>
      ['Resolved', 'Closed'].includes(t.status),
    ).length
    return [
      { label: 'Assigned', value: open, tone: 'amber' },
      { label: 'In progress', value: active, tone: 'amber' },
      { label: 'Critical open', value: critical, tone: 'rust' },
      { label: 'Completed', value: done, tone: 'moss' },
    ]
  }, [tickets])

  const visible = useMemo(() => {
    let list = tickets
    if (status !== 'all') list = list.filter((t) => t.status === status)
    if (priority !== 'all') list = list.filter((t) => t.priority === priority)
    const q = search.trim().toLowerCase()
    if (q) {
      list = list.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.location.toLowerCase().includes(q),
      )
    }
    return [...list].sort(
      (a, b) =>
        priorityOrder(a.priority) - priorityOrder(b.priority) ||
        new Date(b.updatedAt) - new Date(a.updatedAt),
    )
  }, [tickets, status, priority, search])

  if (!user) return null

  return (
    <div className="technician-page">
      <Navbar user={user} title="My Queue" />
      <div className="container">
        <h1>My Queue</h1>
        <p className="subtitle">
          Tickets assigned to you, ordered from highest to lowest priority.
        </p>

        <StatStrip stats={stats} />

        {error && <div className="banner banner-error">{error}</div>}

        <div className="filter-bar">
          <input
            type="search"
            placeholder="Search title or location…"
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
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
          >
            <option value="all">All priorities</option>
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>

        <div className="panel ticket-table cols-queue">
          <div className="ticket-head">
            <div>ID</div>
            <div>Ticket</div>
            <div>Location</div>
            <div>Priority</div>
            <div>Status</div>
            <div>Updated</div>
            <div>Action</div>
          </div>

          {loading && <div className="empty-state">Loading queue…</div>}

          {!loading && visible.length === 0 && (
            <div className="empty-state">
              <strong>No matching tickets</strong>
              {tickets.length === 0
                ? 'Nothing is assigned to you right now.'
                : 'Try a different status, priority, or search term.'}
            </div>
          )}

          {!loading &&
            visible.map((t) => {
              const next = NEXT_STATUS[t.status]
              return (
                <div
                  className="ticket-row"
                  key={t.id}
                  style={{
                    gridTemplateColumns: '84px 1.6fr 1fr 70px 110px 1fr 130px',
                  }}
                >
                  <div>
                    <span className="code">{ticketCode(t.id)}</span>
                  </div>
                  <div className="ticket-title-cell">
                    <span className="cell-label">Ticket</span>
                    <Link href={`/tickets/${t.id}`}>{t.title}</Link>
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
                    <span className="cell-label">Updated</span>
                    {timeAgo(t.updatedAt)}
                  </div>
                  <div>
                    {next && (
                      <button
                        className="btn btn-secondary btn-sm"
                        disabled={working === t.id}
                        onClick={() => advance(t.id, next)}
                      >
                        {working === t.id ? 'Saving…' : `Mark ${next}`}
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
        </div>
      </div>
    </div>
  )
}
