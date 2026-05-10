const MOCK_LOGS = [
  { type: 'join', message: 'Nuovo membro: {user} si è unito al server' },
  { type: 'leave', message: '{user} ha lasciato il server' },
  { type: 'command', message: '{user} ha usato il comando /help' },
  { type: 'moderation', message: '{user} è stato warnato da un admin' },
  { type: 'command', message: '{user} ha avviato un giveaway' },
  { type: 'error', message: 'Errore nel cog leveling: timeout database' },
  { type: 'join', message: '{user} si è unito al canale vocale Generale' },
  { type: 'moderation', message: '{user} è stato bannato: spam' },
  { type: 'command', message: '{user} ha usato il comando /rep @someone' },
  { type: 'leave', message: '{user} ha lasciato il canale vocale' },
]

function generateMockLog() {
  const template = MOCK_LOGS[Math.floor(Math.random() * MOCK_LOGS.length)]
  const names = ['AlphaUser', 'BetaUser', 'GammaUser', 'DeltaUser', 'EpsilonUser']
  const user = `${names[Math.floor(Math.random() * names.length)]}#${Math.floor(Math.random() * 9000) + 1000}`
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    timestamp: new Date().toISOString(),
    type: template.type,
    message: template.message.replace('{user}', user),
    user,
  }
}

function setupLogsFeed(io) {
  io.on('connection', (socket) => {
    console.log(`[Socket] Client connected: ${socket.id}`)
    for (let i = 0; i < 5; i++) {
      setTimeout(() => socket.emit('log', generateMockLog()), i * 200)
    }
    socket.on('disconnect', () => console.log(`[Socket] Client disconnected: ${socket.id}`))
  })

  setInterval(() => {
    if (io.engine.clientsCount > 0) io.emit('log', generateMockLog())
  }, 4000 + Math.random() * 2000)
}

module.exports = { setupLogsFeed }
