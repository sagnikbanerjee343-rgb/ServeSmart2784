import { tickets, findUser, STATUSES } from '../../../lib/store'

// A ticket moves forward one step at a time.
const NEXT_STATUS = {
  Open: 'Assigned',
  Assigned: 'In Progress',
  'In Progress': 'Resolved',
  Resolved: 'Closed',
}

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

  if (req.method === 'GET') return res.status(200).json({ ticket })

  if (req.method === 'PATCH') return handlePatch(req, res, ticket)

  res.setHeader('Allow', ['GET', 'PATCH'])
  return res.status(405).json({ error: 'Method not allowed' })
}

function handlePatch(req, res, ticket) {
  const { actorId, technicianId, status } = req.body || {}
  const now = new Date().toISOString()

  if (status !== undefined && typeof status !== 'string') {
    return res.status(400).json({ error: 'Status must be a string.' })
  }

  const actor = actorId ? findUser(actorId) : null
  if ((status !== undefined || technicianId !== undefined) && !actor) {
    return res.status(401).json({ error: 'A valid logged-in user is required.' })
  }

  // Validate everything first so a bad request never half-applies.
  const hasAssignmentChange = technicianId !== undefined
  const tech = hasAssignmentChange ? findUser(technicianId) : null
  if (hasAssignmentChange && (!tech || tech.role !== 'technician')) {
    return res.status(400).json({ error: 'Choose a valid technician.' })
  }

  const assigning = hasAssignmentChange && tech.id !== ticket.technicianId
  if (assigning && actor.role !== 'admin') {
    return res.status(403).json({ error: 'Only admins can assign tickets.' })
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
        .json({ error: `A ticket cannot move from ${current} to ${status}.` })
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
