const { requireAuth } = require('../middleware/auth')
const { getGuildInvites } = require('../services/discord')

module.exports = async function (fastify) {
  fastify.addHook('preHandler', requireAuth)

  fastify.get('/api/invites', async (request, reply) => {
    try {
      const invites = await getGuildInvites(process.env.DISCORD_GUILD_ID) || []
      const inviterMap = new Map()
      for (const invite of invites) {
        if (!invite.inviter) continue
        const { id, username, avatar } = invite.inviter
        if (!inviterMap.has(id)) inviterMap.set(id, { userId: id, username, avatar, total: 0, uses: 0, temporary: 0 })
        const e = inviterMap.get(id)
        e.total += invite.max_uses || 0
        e.uses += invite.uses || 0
        e.temporary += invite.temporary ? 1 : 0
      }
      return reply.send([...inviterMap.values()].sort((a, b) => b.uses - a.uses))
    } catch (err) {
      return reply.code(500).send({ error: 'Failed to fetch invites', code: 'DISCORD_ERROR' })
    }
  })
}
