import { tickets, findUser, STATUSES } from '../../../lib/store'
import { canViewTicket, getRequestUser } from './index'

// A ticket moves forward one step at a time.
const NEXT_STATUS = {
  Open: 'Assigned',
  Assigned: 'In Progress',
  'In Progress': 'Resolved',
  Resolved: 'Closed',
}

const RATING_FIELDS = ['helpfulness', 'resolution', 'responseTime']

function addActivity(ticket, activity) {
  if (!Array.isArray(ticket.activity)) ticket.activity = []
  ticket.activity.push({
    id: `a${ticket.activity.length + 1}`,
    ...activity,
  })
}

export default function handler(req, res) {
  const { id } = req.query
  const ticket = tickets.find((t) => t.id === id)
  if (!ticket) return res.status(404).json({ error: 'Ticket not found.' })

  const actor = getRequestUser(req)
  if (!actor) {
    return res.status(401).json({ error: 'A valid logged-in user is required.' })
  }
  if (!canViewTicket(actor, ticket)) {
    return res.status(403).json({ error: 'You cannot access this ticket.' })
  }

  if (req.method === 'GET') return res.status(200).json({ ticket })

  if (req.method === 'PATCH') {
    const body = req.body || {}
    const isFeedbackUpdate = Object.prototype.hasOwnProperty.call(
      body,
      'feedback',
    )
    if (actor.role === 'student' && !isFeedbackUpdate) {
      return res.status(403).json({ error: 'You cannot update this ticket.' })
    }
    if (actor.role === 'admin' && isFeedbackUpdate) {
      return res.status(403).json({ error: 'Only the student can submit feedback.' })
    }
    if (actor.role === 'technician' && isFeedbackUpdate) {
      return res.status(403).json({ error: 'Only the student can submit feedback.' })
    }
    return handlePatch(req, res, ticket, actor)
  }

  res.setHeader('Allow', ['GET', 'PATCH'])
  return res.status(405).json({ error: 'Method not allowed' })
}

function handlePatch(req, res, ticket, actor) {
  const { technicianId, status, feedback } = req.body || {}
  const now = new Date().toISOString()

  if (
    technicianId === undefined &&
    status === undefined &&
    feedback === undefined
  ) {
    return res.status(400).json({ error: 'No ticket update was provided.' })
  }

  if (feedback !== undefined) {
    if (technicianId !== undefined || status !== undefined) {
      return res.status(400).json({
        error: 'Feedback must be submitted as a separate update.',
      })
    }
    if (actor.role !== 'student' || ticket.studentId !== actor.id) {
      return res.status(403).json({ error: 'Only the ticket owner can submit feedback.' })
    }
    if (!['Resolved', 'Closed'].includes(ticket.status)) {
      return res.status(400).json({
        error: 'Feedback is available after the ticket is resolved.',
      })
    }
    if (ticket.feedback) {
      return res.status(400).json({ error: 'Feedback has already been submitted.' })
    }
    if (!feedback || typeof feedback !== 'object') {
      return res.status(400).json({ error: 'Invalid feedback.' })
    }
    for (const field of RATING_FIELDS) {
      if (!Number.isInteger(feedback[field]) || feedback[field] < 1 || feedback[field] > 5) {
        return res.status(400).json({ error: 'Ratings must be between 1 and 5.' })
      }
    }
    const comment = typeof feedback.comment === 'string' ? feedback.comment.trim() : ''
    if (comment.length > 500) {
      return res.status(400).json({ error: 'Feedback must be 500 characters or fewer.' })
    }
    ticket.feedback = {
      helpfulness: feedback.helpfulness,
      resolution: feedback.resolution,
      responseTime: feedback.responseTime,
      comment,
      submittedAt: now,
    }
    ticket.updatedAt = now
    addActivity(ticket, {
      type: 'feedback',
      message: 'Student submitted service feedback',
      at: now,
    })
    return res.status(200).json({ ticket })
  }

  if (status !== undefined && typeof status !== 'string') {
    return res.status(400).json({ error: 'Status must be a string.' })
  }

  // Validate everything first so a bad request never half-applies.
  const hasAssignmentChange = technicianId !== undefined
  const tech = hasAssignmentChange ? findUser(technicianId) : null
  if (hasAssignmentChange && (!tech || tech.role !== 'technician')) {
    return res.status(400).json({ error: 'Choose a valid technician.' })
  }

  const assigning = hasAssignmentChange && tech.id !== ticket.technicianId
  if (hasAssignmentChange && actor.role !== 'admin') {
    return res.status(403).json({ error: 'Only admins can assign tickets.' })
  }
  if (hasAssignmentChange && !assigning) {
    return res.status(400).json({
      error: 'That technician is already assigned to this ticket.',
    })
  }

  const current = ticket.status

  if (status !== undefined) {
    if (!STATUSES.includes(status)) {
      return res.status(400).json({ error: 'Unknown status.' })
    }
    if (status === current) {
      return res.status(400).json({
        error: `The ticket is already ${current}.`,
      })
    }
    if (actor.role !== 'technician' || actor.id !== ticket.technicianId) {
      return res.status(403).json({
        error: 'Only the assigned technician can change the status.',
      })
    }
    if (!ticket.technicianId) {
      return res
        .status(400)
        .json({ error: 'Assign a technician before changing status.' })
    }
    if (NEXT_STATUS[current] !== status) {
      return res
        .status(400)
        .json({
          error: `A ticket can only move from ${current} to ${
            NEXT_STATUS[current] || 'a later status'
          }.`,
        })
    }
  }

  let changed = false

  if (assigning) {
    const wasAssigned = Boolean(ticket.technicianId)
    ticket.technicianId = tech.id
    addActivity(ticket, {
      type: 'assigned',
      message: `${wasAssigned ? 'Reassigned' : 'Assigned'} to ${tech.name}`,
      at: now,
    })
    if (ticket.status === 'Open') {
      ticket.status = 'Assigned'
      addActivity(ticket, {
        type: 'status',
        message: 'Status changed to Assigned',
        at: now,
      })
    }
    changed = true
  }

  if (status !== undefined) {
    ticket.status = status
    if (status === 'Resolved' && !ticket.resolvedAt) {
      ticket.resolvedAt = now
    }
    addActivity(ticket, {
      type: 'status',
      message: `Status changed to ${status}`,
      at: now,
    })
    changed = true
  }

  if (changed) ticket.updatedAt = now
  return res.status(200).json({ ticket })
}
