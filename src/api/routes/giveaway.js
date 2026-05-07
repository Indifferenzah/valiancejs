const { requireAuth } = require('../middleware/auth')
const { randomUUID } = require('crypto')
const db = require('../db')

function parse(row) {
  if (!row) return null
  return { ...row, winners: JSON.parse(row.winners), entries: JSON.parse(row.entries) }
}

function parseDuration(duration) {
  let ms = 0
  const d = duration.match(/(\d+)d/), h = duration.match(/(\d+)h/), m = duration.match(/(\d+)m/)
  if (d) ms += parseInt(d[1]) * 86400000
  if (h) ms += parseInt(h[1]) * 3600000
  if (m) ms += parseInt(m[1]) * 60000
  return ms
}

function pickWinners(entries, count) {
  return [...entries].sort(() => Math.random() - 0.5).slice(0, Math.min(count, entries.length))
}

module.exports = async function (fastify) {
  fastify.addHook('preHandler', requireAuth)

  fastify.get('/api/giveaway', async (request, reply) => {
    const rows = await db.all('SELECT * FROM giveaways ORDER BY created_at DESC')
    return reply.send(rows.map(parse))
  })

  fastify.post('/api/giveaway', {
    schema: { body: { type: 'object', required: ['channelId', 'prize', 'duration', 'winners'], properties: { channelId: { type: 'string' }, prize: { type: 'string' }, duration: { type: 'string' }, winners: { type: 'number', minimum: 1 } } } },
  }, async (request, reply) => {
    const { channelId, prize, duration, winners } = request.body
    const id = randomUUID()
    const now = new Date().toISOString()
    await db.run(
      'INSERT INTO giveaways (id, channel_id, prize, duration, ends_at, winners_count, winners, entries, status, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [id, channelId, prize, duration, new Date(Date.now() + parseDuration(duration)).toISOString(), winners, '[]', '[]', 'active', request.session.user.id, now]
    )
    return reply.code(201).send(parse(await db.get('SELECT * FROM giveaways WHERE id = ?', [id])))
  })

  fastify.post('/api/giveaway/:id/end', async (request, reply) => {
    const row = await db.get('SELECT * FROM giveaways WHERE id = ?', [request.params.id])
    if (!row) return reply.code(404).send({ error: 'Giveaway not found', code: 'NOT_FOUND' })
    const g = parse(row)
    const winners = pickWinners(g.entries, g.winners_count)
    await db.run('UPDATE giveaways SET status = ?, ends_at = ?, winners = ? WHERE id = ?', ['ended', new Date().toISOString(), JSON.stringify(winners), g.id])
    return reply.send(parse(await db.get('SELECT * FROM giveaways WHERE id = ?', [g.id])))
  })

  fastify.post('/api/giveaway/:id/reroll', async (request, reply) => {
    const row = await db.get('SELECT * FROM giveaways WHERE id = ?', [request.params.id])
    if (!row) return reply.code(404).send({ error: 'Giveaway not found', code: 'NOT_FOUND' })
    const g = parse(row)
    const winners = pickWinners(g.entries, g.winners_count)
    await db.run('UPDATE giveaways SET winners = ? WHERE id = ?', [JSON.stringify(winners), g.id])
    return reply.send(parse(await db.get('SELECT * FROM giveaways WHERE id = ?', [g.id])))
  })
}
