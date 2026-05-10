const { readFile, writeFile, readdir } = require('fs/promises')
const path = require('path')

const COG_FILE_MAP = {
  birthdays: 'config.json',
  rep: 'config.json',
  social: 'config.json',
  counters: 'counter.json',
  ticket: 'ticketmsg.json',
}

function getCogPath() {
  return process.env.COG_CONFIG_PATH || './cogs'
}

function getFileName(cogName, fileName = null) {
  if (fileName) return fileName
  return COG_FILE_MAP[cogName] || `${cogName}.json`
}

async function readConfig(cogName, fileName = null) {
  const filePath = path.join(getCogPath(), cogName, getFileName(cogName, fileName))
  try {
    const content = await readFile(filePath, 'utf-8')
    return JSON.parse(content)
  } catch (err) {
    if (err.code === 'ENOENT') return null
    throw new Error(`Failed to read config for ${cogName}: ${err.message}`)
  }
}

async function writeConfig(cogName, data, fileName = null) {
  const filePath = path.join(getCogPath(), cogName, getFileName(cogName, fileName))
  try {
    await writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8')
  } catch (err) {
    throw new Error(`Failed to write config for ${cogName}: ${err.message}`)
  }
}

async function listConfigs(cogName) {
  const cogDir = path.join(getCogPath(), cogName)
  try {
    const files = await readdir(cogDir)
    return files.filter(f => f.endsWith('.json'))
  } catch (err) {
    if (err.code === 'ENOENT') return []
    throw new Error(`Failed to list configs for ${cogName}: ${err.message}`)
  }
}

module.exports = { readConfig, writeConfig, listConfigs }
