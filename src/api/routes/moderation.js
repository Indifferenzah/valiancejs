const { requireAuth } = require('../middleware/auth')
const { getGuildBans, banMember, unbanMember, kickMember } = require('../services/discord')
const { writeAuditEntry } = require('../services/auditLogger')

module.exports = async function (fastify) {
  fastify.addHook('preHandler', requireAuth)

  fastify.get('/api/moderation/bans', async (request, reply) => {
    try {
      return reply.send(await getGuildBans(process.env.DISCORD_GUILD_ID) || [])
    } catch (err) {
      return reply.code(500).send({ error: 'Failed to fetch bans', code: 'DISCORD_ERROR' })
    }
  })

  fastify.post('/api/moderation/ban', {
    schema: { body: { type: 'object', required: ['userId'], properties: { userId: { type: 'string' }, reason: { type: 'string', default: '' } } } },
  }, async (request, reply) => {
    const { userId, reason } = request.body
    try {
      await banMember(process.env.DISCORD_GUILD_ID, userId, reason)
      await writeAuditEntry({ admin: request.session.user, action: 'moderation', cog: 'moderation', before: null, after: { action: 'ban', userId, reason } })
      return reply.send({ success: true, message: 'Utente bannato' })
    } catch (err) {
      return reply.code(500).send({ error: 'Failed to ban user', code: 'DISCORD_ERROR' })
    }
  })

  fastify.delete('/api/moderation/ban/:userId', async (request, reply) => {
    try {
      await unbanMember(process.env.DISCORD_GUILD_ID, request.params.userId)
      await writeAuditEntry({ admin: request.session.user, action: 'moderation', cog: 'moderation', before: null, after: { action: 'unban', userId: request.params.userId } })
      return reply.send({ success: true, message: 'Ban rimosso' })
    } catch (err) {
      return reply.code(500).send({ error: 'Failed to unban user', code: 'DISCORD_ERROR' })
    }
  })

  fastify.post('/api/moderation/kick', {
    schema: { body: { type: 'object', required: ['userId'], properties: { userId: { type: 'string' }, reason: { type: 'string', default: '' } } } },
  }, async (request, reply) => {
    const { userId, reason } = request.body
    try {
      await kickMember(process.env.DISCORD_GUILD_ID, userId, reason)
      await writeAuditEntry({ admin: request.session.user, action: 'moderation', cog: 'moderation', before: null, after: { action: 'kick', userId, reason } })
      return reply.send({ success: true, message: 'Utente espulso' })
    } catch (err) {
      return reply.code(500).send({ error: 'Failed to kick user', code: 'DISCORD_ERROR' })
    }
  })
}
