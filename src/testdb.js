const logger = require("../utils/logger");

function getDbConfig() {
  return {
    host: process.env.DB_HOST || "127.0.0.1",
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || "u7_l98v4XGe9U",
    password: process.env.DB_PASSWORD || "aROKXUnru+OcYL@64TDz4M3P",
    database: process.env.DB_NAME || "s7_Test",
    connectTimeout: 5000,
  };
}

function hasPlaceholders(config) {
  const values = [config.host, config.user, config.password, config.database];
  return values.some(
    (value) => typeof value === "string" && value.startsWith("YOUR_"),
  );
}

async function testDb() {
  logger.info("[DB] Test starting...");
  let mysql;
  try {
    mysql = require("mysql2/promise");
  } catch (error) {
    logger.error(`[DB] Missing dependency mysql2: ${error.message}`);
    return false;
  }

  const config = getDbConfig();
  if (hasPlaceholders(config)) {
    logger.warn(
      "[DB] Test skipped: configure DB credentials in src/testdb.js or .env",
    );
    return false;
  }

  let connection;
  try {
    connection = await mysql.createConnection(config);
    await connection.query("SELECT 1");
    logger.info("[DB] DB OK");
    return true;
  } catch (error) {
    logger.error(`[DB] Connection error: ${error.message}`);
    return false;
  } finally {
    if (connection) {
      await connection.end().catch(() => {});
    }
  }
}

module.exports = { testDb };
