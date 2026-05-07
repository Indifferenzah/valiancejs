const { requireAuth } = require('../middleware/auth')
const { readAuditEntries, exportAuditCSV } = require('../services/auditLogger')

module.exports = async function (fastify) {
  fastify.addHook('preHandler', requireAuth)

  fastify.get('/api/audit', {
    schema: { querystring: { type: 'object', properties: { admin: { type: 'string' }, action: { type: 'string' }, from: { type: 'string' }, to: { type: 'string' }, page: { type: 'number', default: 1 }, limit: { type: 'number', default: 50, maximum: 200 } } } },
  }, async (request, reply) => {
    const { admin, action, from, to, page, limit } = request.query
    return reply.send(await readAuditEntries({ adminId: admin, action, from, to, page, limit }))
  })

  fastify.get('/api/audit/export', {
    schema: { querystring: { type: 'object', properties: { admin: { type: 'string' }, action: { type: 'string' }, from: { type: 'string' }, to: { type: 'string' } } } },
  }, async (request, reply) => {
    const { admin, action, from, to } = request.query
    const csv = await exportAuditCSV({ adminId: admin, action, from, to })
    reply.header('Content-Type', 'text/csv')
    reply.header('Content-Disposition', 'attachment; filename="audit_log.csv"')
    return reply.send(csv)
  })
}
