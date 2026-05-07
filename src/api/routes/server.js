const { requireAuth } = require('../middleware/auth')
const { getGuildChannels, getGuildRoles, getGuildMembers, addRole, removeRole } = require('../services/discord')
const { writeAuditEntry } = require('../services/auditLogger')

module.exports = async function (fastify) {
  fastify.addHook('preHandler', requireAuth)

  fastify.get('/api/server/channels', async (request, reply) => {
    try { return reply.send(await getGuildChannels(process.env.DISCORD_GUILD_ID) || []) }
    catch (err) { return reply.code(500).send({ error: 'Failed to fetch channels', code: 'DISCORD_ERROR' }) }
  })

  fastify.get('/api/server/roles', async (request, reply) => {
    try { return reply.send(await getGuildRoles(process.env.DISCORD_GUILD_ID) || []) }
    catch (err) { return reply.code(500).send({ error: 'Failed to fetch roles', code: 'DISCORD_ERROR' }) }
  })

  fastify.get('/api/server/members', {
    schema: { querystring: { type: 'object', properties: { limit: { type: 'number', default: 100, maximum: 1000 } } } },
  }, async (request, reply) => {
    try { return reply.send(await getGuildMembers(process.env.DISCORD_GUILD_ID, request.query.limit) || []) }
    catch (err) { return reply.code(500).send({ error: 'Failed to fetch members', code: 'DISCORD_ERROR' }) }
  })

  fastify.patch('/api/server/members/:id', {
    schema: { params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } }, body: { type: 'object', required: ['action', 'roleId'], properties: { action: { type: 'string', enum: ['add', 'remove'] }, roleId: { type: 'string' } } } },
  }, async (request, reply) => {
    const { id } = request.params
    const { action, roleId } = request.body
    try {
      if (action === 'add') await addRole(process.env.DISCORD_GUILD_ID, id, roleId)
      else await removeRole(process.env.DISCORD_GUILD_ID, id, roleId)
      await writeAuditEntry({ admin: request.session.user, action: 'server_edit', cog: 'server', before: null, after: { action, userId: id, roleId } })
      return reply.send({ success: true })
    } catch (err) {
      return reply.code(500).send({ error: 'Failed to update member', code: 'DISCORD_ERROR' })
    }
  })
}
