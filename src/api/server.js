const Fastify = require('fastify')
const { Server: SocketIOServer } = require('socket.io')
const fastifyCors = require('@fastify/cors')
const fastifyCookie = require('@fastify/cookie')
const fastifySession = require('@fastify/session')
const fastifyOAuth2 = require('@fastify/oauth2')
const crypto = require('crypto')

const db = require('./db')
const logger = require('./logger')
const { setupLogsFeed } = require('./socket/logsFeed')

const authRoutes = require('./routes/auth')
const configRoutes = require('./routes/config')
const statsRoutes = require('./routes/stats')
const moderationRoutes = require('./routes/moderation')
const giveawayRoutes = require('./routes/giveaway')
const ticketsRoutes = require('./routes/tickets')
const levelingRoutes = require('./routes/leveling')
const invitesRoutes = require('./routes/invites')
const auditRoutes = require('./routes/audit')
const serverRoutes = require('./routes/server')

const pendingStates = new Map()
setInterval(() => {
  const cutoff = Date.now() - 10 * 60 * 1000
  for (const [state, ts] of pendingStates) {
    if (ts < cutoff) pendingStates.delete(state)
  }
}, 60_000)

function buildSessionStore() {
  return {
    get(sid, cb) {
      db.raw.get('SELECT sess FROM sessions WHERE sid = ? AND expired > ?', [sid, Date.now()],
        (err, row) => err ? cb(err) : cb(null, row ? JSON.parse(row.sess) : null))
    },
    set(sid, sess, cb) {
      const exp = Date.now() + (sess?.cookie?.maxAge || 604800000)
      db.raw.run('INSERT OR REPLACE INTO sessions (sid, sess, expired) VALUES (?, ?, ?)',
        [sid, JSON.stringify(sess), exp], (err) => cb(err || null))
    },
    destroy(sid, cb) {
      db.raw.run('DELETE FROM sessions WHERE sid = ?', [sid], (err) => cb(err || null))
    },
  }
}

async function startApiServer() {
  const fastify = Fastify({ trustProxy: true, logger: false })

  await fastify.register(fastifyCors, {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  })

  await fastify.register(fastifyCookie, { secret: process.env.SESSION_SECRET })

  await fastify.register(fastifySession, {
    secret: process.env.SESSION_SECRET,
    store: buildSessionStore(),
    cookie: { secure: false, httpOnly: true, sameSite: 'lax', maxAge: 86400000 * 7 },
    saveUninitialized: false,
  })

  await fastify.register(fastifyOAuth2, {
    name: 'discordOAuth2',
    scope: ['identify', 'guilds', 'guilds.members.read'],
    credentials: {
      client: { id: process.env.DISCORD_CLIENT_ID, secret: process.env.DISCORD_CLIENT_SECRET },
      auth: {
        tokenHost: 'https://discord.com',
        tokenPath: '/api/oauth2/token',
        authorizePath: '/api/oauth2/authorize',
      },
    },
    startRedirectPath: '/auth/discord',
    callbackUri: process.env.DISCORD_REDIRECT_URI,
  })

  await fastify.register(authRoutes)
  await fastify.register(configRoutes)
  await fastify.register(statsRoutes)
  await fastify.register(moderationRoutes)
  await fastify.register(giveawayRoutes)
  await fastify.register(ticketsRoutes)
  await fastify.register(levelingRoutes)
  await fastify.register(invitesRoutes)
  await fastify.register(auditRoutes)
  await fastify.register(serverRoutes)

  await fastify.ready()

  const io = new SocketIOServer(fastify.server, {
    cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost:5173',
      credentials: true,
      methods: ['GET', 'POST'],
    },
  })
  setupLogsFeed(io)

  const port = parseInt(process.env.API_PORT || '50003')
  await fastify.listen({ port, host: '0.0.0.0' })
  logger.info(`Dashboard API listening on 0.0.0.0:${port}`)
}

module.exports = { startApiServer }
