const DISCORD_API = 'https://discord.com/api/v10'

function botHeaders() {
  return {
    Authorization: `Bot ${process.env.TOKEN || process.env.BOT_TOKEN}`,
    'Content-Type': 'application/json',
  }
}

function bearerHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  }
}

async function discordFetch(path, options = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 10000)
  let res
  try {
    res = await fetch(`${DISCORD_API}${path}`, { ...options, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Discord API error ${res.status} on ${path}: ${text}`)
  }
  if (res.status === 204) return null
  return res.json()
}

/**
 * Calcola i permessi di un membro dai suoi ruoli
 * @param {Array} memberRoles - Array di ID ruoli del membro
 * @param {Array} guildRoles - Array di tutti i ruoli del server
 * @returns {bigint} - Permessi totali
 */
function calculatePermissions(memberRoles, guildRoles) {
  let permissions = 0n
  const everyoneRole = guildRoles.find(r => r.id === guildRoles[0]?.id)

  // Permessi del ruolo @everyone
  if (everyoneRole) {
    permissions |= BigInt(everyoneRole.permissions || '0')
  }

  // Permessi dai ruoli assegnati
  for (const roleId of memberRoles) {
    const role = guildRoles.find(r => r.id === roleId)
    if (role) {
      permissions |= BigInt(role.permissions || '0')
    }
  }

  return permissions
}

/**
 * Ottiene i permessi di un utente in un server usando l'accessToken
 * @param {string} accessToken - OAuth2 token dell'utente
 * @param {string} guildId - ID del server Discord
 * @returns {Promise<{permissions: string, roles: string[]}>}
 */
async function getUserPermissionsInGuild(accessToken, guildId) {
  // Ottieni info membro con ruoli
  const memberInfo = await discordFetch(`/users/@me/guilds/${guildId}/member`, {
    headers: bearerHeaders(accessToken)
  })

  // Ottieni tutti i ruoli del server (serve token bot)
  const guildRoles = await discordFetch(`/guilds/${guildId}/roles`, {
    headers: botHeaders()
  })

  const memberRoles = memberInfo.roles || []
  const calculatedPermissions = calculatePermissions(memberRoles, guildRoles)

  return {
    permissions: calculatedPermissions.toString(),
    roles: memberRoles
  }
}

module.exports = {
  getGuildChannels: (guildId) => discordFetch(`/guilds/${guildId}/channels`, { headers: botHeaders() }),
  getGuildRoles: (guildId) => discordFetch(`/guilds/${guildId}/roles`, { headers: botHeaders() }),
  getGuildMembers: (guildId, limit = 100) => discordFetch(`/guilds/${guildId}/members?limit=${limit}`, { headers: botHeaders() }),
  getGuildMember: (guildId, userId) => discordFetch(`/guilds/${guildId}/members/${userId}`, { headers: botHeaders() }),
  getGuild: (guildId) => discordFetch(`/guilds/${guildId}?with_counts=true`, { headers: botHeaders() }),
  getGuildBans: (guildId, limit = 100) => discordFetch(`/guilds/${guildId}/bans?limit=${limit}`, { headers: botHeaders() }),
  getGuildInvites: (guildId) => discordFetch(`/guilds/${guildId}/invites`, { headers: botHeaders() }),
  banMember: (guildId, userId, reason = '') => discordFetch(`/guilds/${guildId}/bans/${userId}`, {
    method: 'PUT', headers: botHeaders(), body: JSON.stringify({ reason }),
  }),
  unbanMember: (guildId, userId) => discordFetch(`/guilds/${guildId}/bans/${userId}`, {
    method: 'DELETE', headers: botHeaders(),
  }),
  kickMember: (guildId, userId, reason = '') => discordFetch(`/guilds/${guildId}/members/${userId}`, {
    method: 'DELETE', headers: { ...botHeaders(), 'X-Audit-Log-Reason': encodeURIComponent(reason) },
  }),
  addRole: (guildId, userId, roleId) => discordFetch(`/guilds/${guildId}/members/${userId}/roles/${roleId}`, {
    method: 'PUT', headers: botHeaders(),
  }),
  removeRole: (guildId, userId, roleId) => discordFetch(`/guilds/${guildId}/members/${userId}/roles/${roleId}`, {
    method: 'DELETE', headers: botHeaders(),
  }),
  getUserProfile: (accessToken) => discordFetch('/users/@me', { headers: bearerHeaders(accessToken) }),
  getUserGuildMember: (accessToken, guildId) => discordFetch(`/users/@me/guilds/${guildId}/member`, { headers: bearerHeaders(accessToken) }),
  getUserPermissionsInGuild,
}
