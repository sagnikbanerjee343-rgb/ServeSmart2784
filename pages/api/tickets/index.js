import {
  tickets,
  generateId,
  findUser,
  CATEGORIES,
  PRIORITIES,
} from '../../../lib/store'

const MIN_DESCRIPTION_LENGTH = 20

export default function handler(req, res) {
  if (req.method === 'GET') return handleGet(req, res)
  if (req.method === 'POST') return handlePost(req, res)
  res.setHeader('Allow', ['GET', 'POST'])
  return res.status(405).json({ error: 'Method not allowed' })
}

function handleGet(req, res) {
  const { studentId, technicianId, unassigned } = req.query
  let result = tickets

  if (studentId) result = result.filter((t) => t.studentId === studentId)
  if (technicianId)
    result = result.filter((t) => t.technicianId === technicianId)
  if (unassigned === 'true') result = result.filter((t) => !t.technicianId)

  return res.status(200).json({ tickets: result })
}

function handlePost(req, res) {
  const { title, description, category, location, priority, studentId } =
    req.body || {}

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
  if (!studentId) {
    return res.status(400).json({ error: 'Student is required.' })
  }

  const student = findUser(studentId)
  if (!student || student.role !== 'student') {
    return res.status(400).json({ error: 'A valid student is required.' })
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
    studentId: studentId || null,
    technicianId: null,
    createdAt: now,
    updatedAt: now,
    activity: [
      {
        id: 'a1',
        type: 'created',
        message: `Submitted by ${student ? student.name : 'student'}`,
        at: now,
      },
    ],
  }

  tickets.push(ticket)
  return res.status(201).json({ ticket })
}
