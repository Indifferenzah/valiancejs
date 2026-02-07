const fs = require("fs");
const path = require("path");
const logger = require("../../utils/logger");

function listJsFiles(dirPath) {
  if (!fs.existsSync(dirPath)) return [];
  return fs
    .readdirSync(dirPath, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".js"))
    .map((entry) => entry.name);
}

function checkModule(filePath) {
  try {
    const mod = require(filePath);
    if (
      Object.prototype.hasOwnProperty.call(mod, "setup") &&
      typeof mod.setup !== "function"
    ) {
      return { ok: false };
    }
    return { ok: true };
  } catch (error) {
    return { ok: false };
  }
}

function buildGroupRows(baseDir, files, prefix = "") {
  return files.map((file) => {
    const filePath = path.join(baseDir, file);
    const result = checkModule(filePath);
    return {
      name: `${prefix}${file.replace(/\.js$/i, "")}`,
      ok: result.ok,
    };
  });
}

function renderTable(title, rows) {
  if (!rows || rows.length === 0) return;

  const nameWidth = Math.max(title.length, ...rows.map((r) => r.name.length));
  const statusWidth = 6;

  const line = `+${"-".repeat(nameWidth + 2)}+${"-".repeat(statusWidth + 2)}+`;
  logger.info(line);
  logger.info(
    `| ${title.padEnd(nameWidth)} | ${"STATUS".padEnd(statusWidth)} |`,
  );
  logger.info(line);

  for (const row of rows) {
    const status = row.ok ? "✅" : "❌";
    logger.info(
      `| ${row.name.padEnd(nameWidth)} | ${status.padEnd(statusWidth)} |`,
    );
  }

  logger.info(line);
}

function printBootReport({ cogs }) {
  const root = process.cwd();

  const eventsDir = path.join(root, "src", "events");
  const servicesDir = path.join(root, "src", "services");
  const commandsDir = path.join(root, "src", "commands");
  const commandHandlersDir = path.join(commandsDir, "handlers");
  const coreDir = path.join(root, "src", "core");

  const eventRows = buildGroupRows(eventsDir, listJsFiles(eventsDir));
  const serviceRows = buildGroupRows(servicesDir, listJsFiles(servicesDir));

  const commandRows = buildGroupRows(
    commandsDir,
    listJsFiles(commandsDir).filter((f) => f !== "index.js"),
  );
  const commandHandlerRows = buildGroupRows(
    commandHandlersDir,
    listJsFiles(commandHandlersDir),
    "handlers/",
  );

  const coreRows = buildGroupRows(coreDir, listJsFiles(coreDir));

  renderTable("COGS", cogs || []);
  renderTable("EVENTS", eventRows);
  renderTable("SERVICES", serviceRows);
  renderTable("COMMANDS", [...commandRows, ...commandHandlerRows]);
  renderTable("CORE", coreRows);
}

module.exports = { printBootReport };
