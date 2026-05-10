const { requireAuth } = require('../middleware/auth')
const { readFile, writeFile } = require('fs/promises')
const path = require('path')

const LEVELS_FILE = path.join(process.env.COG_CONFIG_PATH || './cogs', 'leveling', 'levels.json')

async function readLevels() {
  try { return JSON.parse(await readFile(LEVELS_FILE, 'utf-8')) } catch { return {} }
}
async function saveLevels(data) { await writeFile(LEVELS_FILE, JSON.stringify(data, null, 2)) }

module.exports = async function (fastify) {
  fastify.addHook('preHandler', requireAuth)

  fastify.get('/api/leveling/leaderboard', async (request, reply) => {
    const levels = await readLevels()
    const leaderboard = Object.entries(levels)
      .map(([userId, data]) => ({
        userId, username: data.username || userId, avatar: data.avatar || null,
        xp: data.xp || 0, level: Math.floor(Math.sqrt((data.xp || 0) / (data.baseXp || 100))), messages: data.messages || 0,
      }))
      .sort((a, b) => b.xp - a.xp).slice(0, 50)
    return reply.send(leaderboard)
  })

  fastify.put('/api/leveling/xp', {
    schema: { body: { type: 'object', required: ['userId', 'xp'], properties: { userId: { type: 'string' }, xp: { type: 'number', minimum: 0 } } } },
  }, async (request, reply) => {
    const { userId, xp } = request.body
    const levels = await readLevels()
    if (!levels[userId]) levels[userId] = { xp: 0, messages: 0 }
    levels[userId].xp = xp
    await saveLevels(levels)
    return reply.send({ success: true, userId, xp })
  })
}
