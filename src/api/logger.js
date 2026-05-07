const ts = () => new Date().toISOString()

module.exports = {
  info: (...args) => console.log(`[${ts()}] [API] [INFO]`, ...args),
  warn: (...args) => console.warn(`[${ts()}] [API] [WARN]`, ...args),
  error: (...args) => console.error(`[${ts()}] [API] [ERROR]`, ...args),
}
