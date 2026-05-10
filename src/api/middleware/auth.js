const ADMINISTRATOR = 0x8n

async function requireAuth(request, reply) {
  if (!request.session?.user) {
    return reply.code(401).send({ error: 'Unauthorized', code: 'NOT_AUTHENTICATED' })
  }

  const user = request.session.user
  if (user.id === process.env.OWNER_ID) return

  const permissions = BigInt(user.permissions || '0')
  if ((permissions & ADMINISTRATOR) === ADMINISTRATOR) return

  return reply.code(403).send({ error: 'Forbidden', code: 'INSUFFICIENT_PERMISSIONS' })
}

module.exports = { requireAuth }
