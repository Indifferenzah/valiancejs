const { requireAuth } = require('../middleware/auth')
const { readFile, writeFile, mkdir } = require('fs/promises')
const path = require('path')

const DATA_DIR = process.env.DATA_DIR || './data'
const TICKETS_FILE = path.join(DATA_DIR, 'tickets.json')
const CLOSED_TICKETS_FILE = path.join(DATA_DIR, 'closed_tickets.json')

async function readTickets() {
  try { return JSON.parse(await readFile(TICKETS_FILE, 'utf-8')) } catch { return [] }
}
async function readClosedTickets() {
  try { return JSON.parse(await readFile(CLOSED_TICKETS_FILE, 'utf-8')) } catch { return [] }
}
async function saveTickets(t) { await mkdir(DATA_DIR, { recursive: true }); await writeFile(TICKETS_FILE, JSON.stringify(t, null, 2)) }
async function saveClosedTickets(t) { await mkdir(DATA_DIR, { recursive: true }); await writeFile(CLOSED_TICKETS_FILE, JSON.stringify(t, null, 2)) }

module.exports = async function (fastify) {
  fastify.addHook('preHandler', requireAuth)

  fastify.get('/api/tickets', async (request, reply) => {
    const [open, closed] = await Promise.all([readTickets(), readClosedTickets()])
    return reply.send({ open, closed })
  })

  fastify.get('/api/tickets/:id', async (request, reply) => {
    const [open, closed] = await Promise.all([readTickets(), readClosedTickets()])
    const ticket = [...open, ...closed].find(t => t.id === request.params.id)
    if (!ticket) return reply.code(404).send({ error: 'Ticket not found', code: 'NOT_FOUND' })
    return reply.send(ticket)
  })

  fastify.post('/api/tickets/:id/close', async (request, reply) => {
    const tickets = await readTickets()
    const idx = tickets.findIndex(t => t.id === request.params.id)
    if (idx === -1) return reply.code(404).send({ error: 'Ticket not found', code: 'NOT_FOUND' })
    const [ticket] = tickets.splice(idx, 1)
    ticket.status = 'closed'; ticket.closedAt = new Date().toISOString(); ticket.closedBy = request.session.user.id
    const closed = await readClosedTickets(); closed.push(ticket)
    await Promise.all([saveTickets(tickets), saveClosedTickets(closed)])
    return reply.send(ticket)
  })

  fastify.delete('/api/tickets/:id', async (request, reply) => {
    const [tickets, closed] = await Promise.all([readTickets(), readClosedTickets()])
    const oi = tickets.findIndex(t => t.id === request.params.id)
    const ci = closed.findIndex(t => t.id === request.params.id)
    if (oi === -1 && ci === -1) return reply.code(404).send({ error: 'Ticket not found', code: 'NOT_FOUND' })
    if (oi !== -1) tickets.splice(oi, 1)
    if (ci !== -1) closed.splice(ci, 1)
    await Promise.all([saveTickets(tickets), saveClosedTickets(closed)])
    return reply.send({ success: true })
  })
}
