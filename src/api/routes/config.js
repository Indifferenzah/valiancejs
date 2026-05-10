const { requireAuth } = require('../middleware/auth')
const { readConfig, writeConfig, listConfigs } = require('../services/configManager')
const { writeAuditEntry } = require('../services/auditLogger')

module.exports = async function (fastify) {
  fastify.addHook('preHandler', requireAuth)

  fastify.get('/api/config/:cog', async (request, reply) => {
    const config = await readConfig(request.params.cog)
    if (config === null) return reply.code(404).send({ error: 'Config not found', code: 'CONFIG_NOT_FOUND' })
    return reply.send(config)
  })

  fastify.put('/api/config/:cog', async (request, reply) => {
    const { cog } = request.params
    const before = await readConfig(cog)
    await writeConfig(cog, request.body)
    await writeAuditEntry({ admin: request.session.user, action: 'config_change', cog, before, after: request.body })
    return reply.send({ success: true, message: 'Configurazione salvata' })
  })

  fastify.get('/api/config/:cog/files', async (request, reply) => {
    const files = await listConfigs(request.params.cog)
    return reply.send({ files })
  })
}
