import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import Navbar from '../../components/Navbar'
import Tag from '../../components/Tag'
import { getCurrentUser } from '../../lib/auth'
import { findUser, users } from '../../lib/store'
import {
  STATUS_META,
  PRIORITY_META,
  ticketCode,
  formatDateTime,
} from '../../lib/meta'

const NEXT_STATUS = {
  Assigned: 'In Progress',
  'In Progress': 'Resolved',
  Resolved: 'Closed',
}

const RATING_OPTIONS = [1, 2, 3, 4, 5]

function formatAttachmentSize(bytes) {
  if (!bytes) return ''
  return `${Math.round(bytes / 1024)} KB`
}

export default function TicketDetail() {
  const router = useRouter()
  const { id } = router.query
  const [user, setUser] = useState(null)
  const [ticket, setTicket] = useState(null)
  const [error, setError] = useState(null)
  const [working, setWorking] = useState(false)
  const [selectedTech, setSelectedTech] = useState('')
  const [feedbackForm, setFeedbackForm] = useState({
    helpfulness: 5,
    resolution: 5,
    responseTime: 5,
    comment: '',
  })

  useEffect(() => {
    const u = getCurrentUser()
    if (!u) {
      router.push('/')
      return
    }
    setUser(u)
  }, [])

  useEffect(() => {
    if (user && id) load()
  }, [user, id])

  async function load() {
    setError(null)
    try {
      const res = await fetch(`/api/tickets/${id}`, {
        headers: { 'x-user-id': user.id },
      })
      if (!res.ok) throw new Error('Ticket not found.')
      const data = await res.json()
      setTicket(data.ticket)
      setSelectedTech(data.ticket.technicianId || '')
    } catch (err) {
      setError(err.message)
    }
  }

  async function patch(body) {
    setWorking(true)
    setError(null)
    try {
      const res = await fetch(`/api/tickets/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': user.id,
        },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'That update failed. Try again.')
      }
      const data = await res.json()
      setTicket(data.ticket)
    } catch (err) {
      setError(err.message)
    } finally {
      setWorking(false)
    }
  }

  function updateFeedback(field, value) {
    setFeedbackForm((current) => ({ ...current, [field]: value }))
  }

  if (!user) return null
  if (error && !ticket)
    return (
      <div>
        <Navbar user={user} title="Ticket" />
        <div className="container">
          <div className="banner banner-error">{error}</div>
          <Link href="/tickets">← Back to tickets</Link>
        </div>
      </div>
    )
  if (!ticket)
    return (
      <div>
        <Navbar user={user} title="Ticket" />
        <div className="container">Loading ticket…</div>
      </div>
    )

  const technicians = users.filter((u) => u.role === 'technician')
  const student = findUser(ticket.studentId)
  const assignedTech = ticket.technicianId
    ? findUser(ticket.technicianId)
    : null
  const isOwner = user.role === 'admin'
  const isAssignedTech =
    user.role === 'technician' && ticket.technicianId === user.id
  const isStudentOwner =
    user.role === 'student' && ticket.studentId === user.id
  const canLeaveFeedback =
    isStudentOwner &&
    ['Resolved', 'Closed'].includes(ticket.status) &&
    !ticket.feedback
  const nextStatus = NEXT_STATUS[ticket.status]
  const backHref =
    user.role === 'technician'
      ? '/technician/dashboard'
      : user.role === 'admin'
        ? '/admin/assign'
        : '/tickets'

  return (
    <div className="ticket-detail-page">
      <Navbar user={user} title={ticketCode(ticket.id)} />
      <div className="container">
        <p>
          <Link href={backHref}>← Back</Link>
        </p>

        {error && <div className="banner banner-error">{error}</div>}

        <div className="detail-head">
          <div>
            <h1>{ticket.title}</h1>
            <span className="code">{ticketCode(ticket.id)}</span>
          </div>
        </div>
        <div className="detail-tags">
          <Tag tone={PRIORITY_META[ticket.priority].tone}>
            {PRIORITY_META[ticket.priority].label}
          </Tag>
          <Tag tone={STATUS_META[ticket.status].tone}>{ticket.status}</Tag>
        </div>

        <div className="detail-grid">
          <div>
            <div className="panel panel-pad" style={{ marginBottom: 14 }}>
              <div className="section-label">Problem</div>
              <p style={{ margin: 0 }}>
                {ticket.description || 'No description provided.'}
              </p>
            </div>

            {ticket.attachments?.length > 0 && (
              <div className="panel panel-pad" style={{ marginBottom: 14 }}>
                <div className="section-label">Attachments</div>
                <div className="attachment-grid">
                  {ticket.attachments.map((attachment) => (
                    <div className="attachment-preview" key={attachment.name}>
                      {attachment.type.startsWith('image/') ? (
                        <a
                          href={attachment.dataUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <img src={attachment.dataUrl} alt={attachment.name} />
                        </a>
                      ) : (
                        <a href={attachment.dataUrl} download={attachment.name}>
                          Open {attachment.name}
                        </a>
                      )}
                      <div className="field-hint">
                        {attachment.name} · {formatAttachmentSize(attachment.size)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="panel panel-pad">
              <div className="section-label">Activity</div>
              <div className="timeline">
                {(ticket.activity || []).map((a) => (
                  <div className="timeline-item" key={a.id}>
                    <div className="timeline-dot" />
                    <div className="timeline-body">
                      <div className="msg">{a.message}</div>
                      <div className="when">{formatDateTime(a.at)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div>
            <div className="panel panel-pad" style={{ marginBottom: 14 }}>
              <div className="section-label">Record</div>
              <div className="kv-list">
                <div className="kv-row">
                  <span className="k">Category</span>
                  <span className="v">{ticket.category}</span>
                </div>
                <div className="kv-row">
                  <span className="k">Location</span>
                  <span className="v">{ticket.location}</span>
                </div>
                <div className="kv-row">
                  <span className="k">Requested by</span>
                  <span className="v">
                    {student ? student.name : 'Unknown'}
                  </span>
                </div>
                <div className="kv-row">
                  <span className="k">Technician</span>
                  <span className="v">
                    {assignedTech ? assignedTech.name : 'Unassigned'}
                  </span>
                </div>
                <div className="kv-row">
                  <span className="k">Created</span>
                  <span className="v">{formatDateTime(ticket.createdAt)}</span>
                </div>
                <div className="kv-row">
                  <span className="k">Updated</span>
                  <span className="v">{formatDateTime(ticket.updatedAt)}</span>
                </div>
              </div>
            </div>

            {isAssignedTech && nextStatus && (
              <div className="panel panel-pad" style={{ marginBottom: 14 }}>
                <div className="section-label">Update status</div>
                <button
                  className="btn btn-primary"
                  disabled={working}
                  onClick={() => patch({ status: nextStatus })}
                  style={{ width: '100%' }}
                >
                  {working ? 'Updating…' : `Mark as ${nextStatus}`}
                </button>
              </div>
            )}

            {isOwner && (
              <div className="panel panel-pad">
                <div className="section-label">
                  {ticket.technicianId ? 'Reassign' : 'Assign'}
                </div>
                <div className="assign-block">
                  <select
                    value={selectedTech}
                    onChange={(e) => setSelectedTech(e.target.value)}
                  >
                    <option value="">Choose technician</option>
                    {technicians.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                  <button
                    className="btn btn-primary"
                    disabled={working || !selectedTech}
                    onClick={() => patch({ technicianId: selectedTech })}
                  >
                    {working ? 'Saving…' : 'Save'}
                  </button>
                </div>
              </div>
            )}

            {ticket.feedback && (
              <div className="panel panel-pad" style={{ marginTop: 14 }}>
                <div className="section-label">Student feedback</div>
                <div className="kv-list">
                  <div className="kv-row">
                    <span className="k">Technician helpfulness</span>
                    <span className="v">{ticket.feedback.helpfulness}/5</span>
                  </div>
                  <div className="kv-row">
                    <span className="k">Resolution quality</span>
                    <span className="v">{ticket.feedback.resolution}/5</span>
                  </div>
                  <div className="kv-row">
                    <span className="k">Response time</span>
                    <span className="v">{ticket.feedback.responseTime}/5</span>
                  </div>
                </div>
                {ticket.feedback.comment && <p>{ticket.feedback.comment}</p>}
              </div>
            )}

            {canLeaveFeedback && (
              <div className="panel panel-pad" style={{ marginTop: 14 }}>
                <div className="section-label">Rate this service</div>
                {[
                  ['helpfulness', 'Technician helpfulness'],
                  ['resolution', 'Resolution quality'],
                  ['responseTime', 'Response time'],
                ].map(([field, label]) => (
                  <div className="field" key={field}>
                    <label>{label}</label>
                    <select
                      value={feedbackForm[field]}
                      onChange={(e) =>
                        updateFeedback(field, Number(e.target.value))
                      }
                    >
                      {RATING_OPTIONS.map((rating) => (
                        <option key={rating} value={rating}>
                          {rating}/5
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
                <div className="field">
                  <label>Comment (optional)</label>
                  <textarea
                    value={feedbackForm.comment}
                    onChange={(e) => updateFeedback('comment', e.target.value)}
                    maxLength={500}
                    placeholder="Tell us how the service went."
                  />
                </div>
                <button
                  className="btn btn-primary"
                  disabled={working}
                  onClick={() => patch({ feedback: feedbackForm })}
                >
                  {working ? 'Submitting…' : 'Submit feedback'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
