const { getUserProfile, getUserPermissionsInGuild } = require('../services/discord')

module.exports = async function (fastify) {
  fastify.get('/auth/discord/callback', async (request, reply) => {
    try {
      fastify.log.info('OAuth callback started')

      const tokenData = await fastify.discordOAuth2.getAccessTokenFromAuthorizationCodeFlow(request)
      const accessToken = tokenData.token.access_token
      fastify.log.info(`Got access token for user`)

      const profile = await getUserProfile(accessToken)
      fastify.log.info(`Got profile: ${profile.username}#${profile.discriminator} (ID: ${profile.id})`)

      // Owner check - bypass permission check
      const isOwner = profile.id === process.env.OWNER_ID
      fastify.log.info(`Is owner check: ${isOwner} (OWNER_ID=${process.env.OWNER_ID})`)

      let permissions = '0'
      if (!isOwner) {
        // Get permissions by calculating from roles
        try {
          const result = await getUserPermissionsInGuild(accessToken, process.env.DISCORD_GUILD_ID)
          permissions = result.permissions
          fastify.log.info(`User ${profile.username} has permissions: ${permissions}`)
        } catch (err) {
          fastify.log.error(`Failed to get permissions for ${profile.username}: ${err.message}`)
          return reply.redirect(`${process.env.FRONTEND_URL}/login?error=oauth_failed`)
        }
      } else {
        fastify.log.info(`User ${profile.username} is OWNER, skipping permission check`)
      }

      const ADMINISTRATOR = 0x8n
      const isAdmin = (BigInt(permissions) & ADMINISTRATOR) === ADMINISTRATOR
      fastify.log.info(`Admin check: permissions=${permissions}, isAdmin=${isAdmin}`)

      if (!isOwner && !isAdmin) {
        fastify.log.warn(`User ${profile.username} denied access: not owner and not admin`)
        return reply.redirect(`${process.env.FRONTEND_URL}/login?error=insufficient_permissions`)
      }

      request.session.user = {
        id: profile.id,
        username: profile.username,
        discriminator: profile.discriminator,
        avatar: profile.avatar,
        permissions,
        accessToken,
      }

      await request.session.save()
      fastify.log.info(`Session saved for user ${profile.username} (sid: ${request.session.sessionId})`)

      return reply.redirect(`${process.env.FRONTEND_URL}/overview`)
    } catch (err) {
      fastify.log.error({ err }, `OAuth callback error: ${err.message}`)
      fastify.log.error(`Error stack: ${err.stack}`)
      return reply.redirect(`${process.env.FRONTEND_URL}/login?error=oauth_failed`)
    }
  })

  fastify.get('/api/auth/me', async (request, reply) => {
    if (!request.session?.user) {
      return reply.code(401).send({ error: 'Unauthorized', code: 'NOT_AUTHENTICATED' })
    }
    const { accessToken, ...safeUser } = request.session.user
    return reply.send(safeUser)
  })

  fastify.post('/api/auth/logout', async (request, reply) => {
    await request.session.destroy()
    return reply.send({ success: true })
  })
}
