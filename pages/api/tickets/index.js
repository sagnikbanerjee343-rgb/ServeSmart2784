import {
  tickets,
  generateId,
  findUser,
  CATEGORIES,
  PRIORITIES,
} from '../../../lib/store'

const MIN_DESCRIPTION_LENGTH = 20

export function getRequestUser(req) {
  const rawId = req.headers['x-user-id']
  const userId = Array.isArray(rawId) ? rawId[0] : rawId
  return userId ? findUser(userId) : null
}

export function canViewTicket(user, ticket) {
  if (!user) return false
  if (user.role === 'admin') return true
  if (user.role === 'student') return ticket.studentId === user.id
  if (user.role === 'technician') return ticket.technicianId === user.id
  return false
}

export default function handler(req, res) {
  if (req.method === 'GET') return handleGet(req, res)
  if (req.method === 'POST') return handlePost(req, res)
  res.setHeader('Allow', ['GET', 'POST'])
  return res.status(405).json({ error: 'Method not allowed' })
}

function handleGet(req, res) {
  const actor = getRequestUser(req)
  if (!actor) {
    return res.status(401).json({ error: 'A valid logged-in user is required.' })
  }

  const { studentId, technicianId, unassigned } = req.query
  let result = tickets

  if (actor.role === 'student') {
    if (studentId && studentId !== actor.id) {
      return res.status(403).json({ error: 'You can only view your own tickets.' })
    }
    if (technicianId || unassigned === 'true') {
      return res.status(403).json({ error: 'You cannot view these tickets.' })
    }
    result = result.filter((t) => t.studentId === actor.id)
  } else if (actor.role === 'technician') {
    if (studentId || (technicianId && technicianId !== actor.id)) {
      return res.status(403).json({ error: 'You can only view your assigned tickets.' })
    }
    if (unassigned === 'true') {
      return res.status(403).json({ error: 'You cannot view unassigned tickets.' })
    }
    result = result.filter((t) => t.technicianId === actor.id)
  } else if (actor.role === 'admin') {
    if (studentId) result = result.filter((t) => t.studentId === studentId)
    if (technicianId)
      result = result.filter((t) => t.technicianId === technicianId)
    if (unassigned === 'true') result = result.filter((t) => !t.technicianId)
  }

  return res.status(200).json({ tickets: result })
}

function handlePost(req, res) {
  const actor = getRequestUser(req)
  if (!actor) {
    return res.status(401).json({ error: 'A valid logged-in user is required.' })
  }
  if (actor.role !== 'student') {
    return res.status(403).json({ error: 'Only students can create tickets.' })
  }

  const { title, description, category, location, priority, studentId } =
    req.body || {}

  if (studentId && studentId !== actor.id) {
    return res.status(403).json({ error: 'You can only create tickets for yourself.' })
  }

  const cleanTitle = typeof title === 'string' ? title.trim() : ''
  const cleanDescription =
    typeof description === 'string' ? description.trim() : ''
  const cleanLocation = typeof location === 'string' ? location.trim() : ''

  if (!cleanTitle) {
    return res.status(400).json({ error: 'Title is required.' })
  }
  if (!cleanDescription) {
    return res.status(400).json({ error: 'Description is required.' })
  }
  if (cleanDescription.length < MIN_DESCRIPTION_LENGTH) {
    return res.status(400).json({
      error: `Description must be at least ${MIN_DESCRIPTION_LENGTH} characters.`,
    })
  }
  if (!category) {
    return res.status(400).json({ error: 'Category is required.' })
  }
  if (!cleanLocation) {
    return res.status(400).json({ error: 'Location is required.' })
  }
  if (!priority) {
    return res.status(400).json({ error: 'Priority is required.' })
  }
  if (!CATEGORIES.includes(category)) {
    return res.status(400).json({ error: 'Unknown category.' })
  }
  if (!PRIORITIES.includes(priority)) {
    return res.status(400).json({ error: 'Unknown priority.' })
  }
  const now = new Date().toISOString()

  const ticket = {
    id: generateId(),
    title: cleanTitle,
    description: cleanDescription,
    category,
    location: cleanLocation,
    priority,
    status: 'Open',
    studentId: actor.id,
    technicianId: null,
    createdAt: now,
    updatedAt: now,
    activity: [
      {
        id: 'a1',
        type: 'created',
        message: `Submitted by ${actor.name}`,
        at: now,
      },
    ],
  }

  tickets.push(ticket)
  return res.status(201).json({ ticket })
}
