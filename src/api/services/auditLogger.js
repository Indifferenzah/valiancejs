const { randomUUID } = require('crypto')
const db = require('../db')

const RETENTION_DAYS = 90

function prune() {
  return db.run('DELETE FROM audit_log WHERE timestamp < ?', [
    new Date(Date.now() - RETENTION_DAYS * 86400000).toISOString(),
  ])
}

function rowToEntry(r) {
  return {
    id: r.id,
    timestamp: r.timestamp,
    admin: { id: r.admin_id, username: r.admin_username },
    action: r.action,
    cog: r.cog || null,
    before: r.before_data ? JSON.parse(r.before_data) : null,
    after: r.after_data ? JSON.parse(r.after_data) : null,
  }
}

async function writeAuditEntry({ admin, action, cog, before = null, after = null }) {
  await prune()
  const id = randomUUID()
  const timestamp = new Date().toISOString()
  await db.run(
    'INSERT INTO audit_log (id, timestamp, admin_id, admin_username, action, cog, before_data, after_data) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [id, timestamp, admin?.id || 'unknown', admin?.username || 'unknown', action, cog || null,
      before ? JSON.stringify(before) : null, after ? JSON.stringify(after) : null]
  )
  return { id, timestamp, admin: { id: admin?.id, username: admin?.username }, action, cog, before, after }
}

async function readAuditEntries({ adminId, action, from, to, page = 1, limit = 50 } = {}) {
  let rows = await db.all('SELECT * FROM audit_log ORDER BY timestamp DESC')

  if (adminId) rows = rows.filter(r => r.admin_id === adminId)
  if (action) rows = rows.filter(r => r.action === action)
  if (from) { const t = new Date(from).getTime(); rows = rows.filter(r => new Date(r.timestamp).getTime() >= t) }
  if (to) { const t = new Date(to).getTime(); rows = rows.filter(r => new Date(r.timestamp).getTime() <= t) }

  const total = rows.length
  const entries = rows.slice((page - 1) * limit, page * limit).map(rowToEntry)
  return { entries, total, page, limit, pages: Math.ceil(total / limit) }
}

async function exportAuditCSV(filters = {}) {
  const { entries } = await readAuditEntries({ ...filters, limit: 100000 })
  const headers = ['ID', 'Timestamp', 'Admin ID', 'Admin Username', 'Action', 'Cog']
  const rows = entries.map(e => [e.id, e.timestamp, e.admin.id, e.admin.username, e.action, e.cog || ''])
  return [headers, ...rows]
    .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n')
}

module.exports = { writeAuditEntry, readAuditEntries, exportAuditCSV }
