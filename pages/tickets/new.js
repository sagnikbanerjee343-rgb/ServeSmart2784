import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Navbar from '../../components/Navbar'
import { getCurrentUser } from '../../lib/auth'
import { CATEGORIES, PRIORITIES } from '../../lib/store'

const MIN_DESCRIPTION_LENGTH = 20
const MAX_ATTACHMENTS = 3
const MAX_ATTACHMENT_BYTES = 250 * 1024
const ALLOWED_ATTACHMENT_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
]

const EMPTY_FORM = {
  title: '',
  description: '',
  category: CATEGORIES[0],
  location: '',
  priority: 'P3',
  attachments: [],
}

export default function NewTicket() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState(null)
  const [fieldErrors, setFieldErrors] = useState({})

  useEffect(() => {
    const u = getCurrentUser()
    setUser(u)
    if (!u) router.push('/')
  }, [])

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
    setFieldErrors((errors) => ({ ...errors, [field]: '' }))
    setError(null)
  }

  async function handleFiles(event) {
    const files = Array.from(event.target.files || [])
    event.target.value = ''
    if (!files.length) return

    if (form.attachments.length + files.length > MAX_ATTACHMENTS) {
      setError(`Attach no more than ${MAX_ATTACHMENTS} files.`)
      return
    }

    const invalid = files.find(
      (file) =>
        !ALLOWED_ATTACHMENT_TYPES.includes(file.type) ||
        file.size > MAX_ATTACHMENT_BYTES,
    )
    if (invalid) {
      setError('Attachments must be JPEG, PNG, WebP, or PDF files under 250 KB.')
      return
    }

    try {
      const attachments = await Promise.all(
        files.map(
          (file) =>
            new Promise((resolve, reject) => {
              const reader = new FileReader()
              reader.onload = () =>
                resolve({
                  name: file.name,
                  type: file.type,
                  size: file.size,
                  dataUrl: reader.result,
                })
              reader.onerror = () => reject(new Error('Could not read the attachment.'))
              reader.readAsDataURL(file)
            }),
        ),
      )
      setForm((current) => ({
        ...current,
        attachments: [...current.attachments, ...attachments],
      }))
      setError(null)
    } catch (err) {
      setError(err.message)
    }
  }

  function removeAttachment(index) {
    setForm((current) => ({
      ...current,
      attachments: current.attachments.filter((_, i) => i !== index),
    }))
  }

  function validateForm() {
    const errors = {}
    if (!form.title.trim()) errors.title = 'Title is required.'
    if (!form.description.trim()) {
      errors.description = 'Description is required.'
    } else if (form.description.trim().length < MIN_DESCRIPTION_LENGTH) {
      errors.description = `Use at least ${MIN_DESCRIPTION_LENGTH} characters.`
    }
    if (!form.category) errors.category = 'Category is required.'
    if (!form.location.trim()) errors.location = 'Location is required.'
    if (!PRIORITIES.includes(form.priority)) {
      errors.priority = 'Choose a valid priority.'
    }
    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  async function handleSubmit(ev) {
    ev.preventDefault()
    if (!validateForm()) return

    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/tickets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': user.id,
        },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Could not submit the ticket.')
      }
      setSuccess(true)
      setForm({ ...EMPTY_FORM, attachments: [] })
      setTimeout(() => router.push('/tickets'), 700)
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (!user) return null

  return (
    <div className="new-ticket-page">
      <Navbar user={user} title="New Ticket" />
      <div className="container" style={{ maxWidth: 620 }}>
        <h1>Create a Ticket</h1>
        <p className="subtitle">
          Submit a campus service request — it'll be routed to a technician
          shortly after review.
        </p>

        {success && (
          <div className="banner banner-success">
            Ticket submitted. Taking you to your ticket list…
          </div>
        )}
        {error && <div className="banner banner-error">{error}</div>}

        <form className="panel panel-pad new-ticket-form" onSubmit={handleSubmit}>
          <div className="field">
            <label>Title</label>
            <input
              aria-invalid={Boolean(fieldErrors.title)}
              value={form.title}
              onChange={(e) => update('title', e.target.value)}
              placeholder="e.g. Projector not turning on"
              maxLength={80}
            />
            {fieldErrors.title && (
              <div className="field-hint">{fieldErrors.title}</div>
            )}
          </div>

          <div className="field">
            <label>Description</label>
            <textarea
              aria-invalid={Boolean(fieldErrors.description)}
              value={form.description}
              onChange={(e) => update('description', e.target.value)}
              placeholder="What's happening, and anything a technician should know before arriving."
            />
            <div className="field-hint">
              Minimum {MIN_DESCRIPTION_LENGTH} characters.
            </div>
            {fieldErrors.description && (
              <div className="field-hint">{fieldErrors.description}</div>
            )}
          </div>

          <div className="field-row">
            <div className="field">
              <label>Category</label>
              <select
                aria-invalid={Boolean(fieldErrors.category)}
                value={form.category}
                onChange={(e) => update('category', e.target.value)}
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              {fieldErrors.category && (
                <div className="field-hint">{fieldErrors.category}</div>
              )}
            </div>

            <div className="field">
              <label>Priority</label>
              <select
                aria-invalid={Boolean(fieldErrors.priority)}
                value={form.priority}
                onChange={(e) => update('priority', e.target.value)}
              >
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
              <div className="field-hint">
                P1 is urgent/safety, P4 is minor.
              </div>
              {fieldErrors.priority && (
                <div className="field-hint">{fieldErrors.priority}</div>
              )}
            </div>
          </div>

          <div className="field">
            <label>Location</label>
            <input
              aria-invalid={Boolean(fieldErrors.location)}
              value={form.location}
              onChange={(e) => update('location', e.target.value)}
              placeholder="e.g. Hall A - Room 101"
            />
            {fieldErrors.location && (
              <div className="field-hint">{fieldErrors.location}</div>
            )}
          </div>

          <div className="field">
            <label htmlFor="attachments">Photos or files</label>
            <input
              id="attachments"
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              multiple
              onChange={handleFiles}
              disabled={submitting || form.attachments.length >= MAX_ATTACHMENTS}
            />
            <div className="field-hint">
              Add up to {MAX_ATTACHMENTS} photos or PDF files, 250 KB each.
            </div>
            {form.attachments.length > 0 && (
              <div className="attachment-list">
                {form.attachments.map((attachment, index) => (
                  <div className="attachment-item" key={`${attachment.name}-${index}`}>
                    <span>{attachment.name}</span>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => removeAttachment(index)}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={submitting || success}
          >
            {submitting ? 'Submitting…' : 'Submit Ticket'}
          </button>
        </form>
      </div>
    </div>
  )
}
