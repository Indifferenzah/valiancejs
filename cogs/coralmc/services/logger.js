const rootLogger = require('../../../utils/logger');

const logger = {
  info(msg) {
    rootLogger.info(`[CoralMC] [INFO]  ${msg}`);
  },
  warn(msg) {
    rootLogger.warn(`[CoralMC] [WARN]  ${msg}`);
  },
  error(msg, err) {
    const stack = err ? `\n${err.stack || err.message || String(err)}` : '';
    rootLogger.error(`[CoralMC] [ERROR] ${msg}${stack}`);
  },
};

module.exports = logger;
