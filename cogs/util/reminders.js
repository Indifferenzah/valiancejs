const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder
} = require('discord.js');
const path = require('path');
const fs = require('fs');
const { loadJson, saveJson, loadJsonSync } = require('../../utils/jsonStore');
const logger = require('../../utils/logger');

const CONFIG_PATH = path.join(__dirname, 'config.json');
const DATA_PATH = path.join(__dirname, '..', '..', 'data', 'reminders.json');

function loadConfig() {
  try {
    return loadJsonSync(CONFIG_PATH, {
      enabled: true,
      default_send_in_dm: true,
      default_channel_id: null,
      cooldown_seconds: 10,
      max_per_user: 10,
      timezone: 'Europe/Rome',
      messages: {
        created: '✅ Promemoria creato per {time}.',
        deleted: '🗑️ Promemoria eliminato.',
        list_header: '📋 I tuoi promemoria:',
        remind_format: '⏰ {mention} Promemoria: {message}',
        no_reminders: 'Non hai promemoria.'
      }
    });
  } catch (error) {
    return {};
  }
}

function parseWhen(input) {
  const when = (input || '').trim();
  const now = Math.floor(Date.now() / 1000);
  const rel = when.match(/^(\d+)\s*([smhd])$/i);
  if (rel) {
    const val = Number(rel[1]);
    const unit = rel[2].toLowerCase();
    const mult = { s: 1, m: 60, h: 3600, d: 86400 }[unit];
    return now + val * mult;
  }
  const abs = when.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})\s+(\d{1,2}):(\d{2})$/);
  if (abs) {
    const [d, mo, yy, hh, mm] = abs.slice(1).map(Number);
    const year = 2000 + yy;
    try {
      const dt = new Date(Date.UTC(year, mo - 1, d, hh, mm));
      return Math.floor(dt.getTime() / 1000);
    } catch (error) {
      return null;
    }
  }
  return null;
}

async function loadData() {
  try {
    const data = await loadJson(DATA_PATH, {});
    return data && typeof data === 'object' ? data : {};
  } catch (error) {
    logger.error(`Errore caricando reminders.json: ${error.message}`);
    return {};
  }
}

async function saveData(data) {
  await fs.promises.mkdir(path.dirname(DATA_PATH), { recursive: true });
  await saveJson(DATA_PATH, data || {});
}

class RemindersCog {
  constructor(client) {
    this.client = client;
    this.config = loadConfig();
    this.loop = null;
    this.ready = false;

    this.commands = [
      new SlashCommandBuilder()
        .setName('remind')
        .setDescription('Sistema di reminder')
        .addSubcommand(sub =>
          sub.setName('add')
            .setDescription('Crea un promemoria')
            .addStringOption(opt => opt.setName('when').setDescription('Quando (es. 10m, 2h, 1d o DD/MM/YY HH:MM)').setRequired(true))
            .addStringOption(opt => opt.setName('message').setDescription('Messaggio del promemoria').setRequired(true))
            .addBooleanOption(opt => opt.setName('send_in_dm').setDescription('Inviare in DM (predefinito da config)'))
        )
        .addSubcommand(sub =>
          sub.setName('list')
            .setDescription('Lista i tuoi promemoria')
        )
        .addSubcommand(sub =>
          sub.setName('delete')
            .setDescription('Elimina un tuo promemoria')
            .addIntegerOption(opt => opt.setName('reminder_id').setDescription('ID promemoria').setRequired(true))
        )
    ];
  }

  startLoop() {
    if (this.loop) return;
    this.loop = setInterval(() => {
      this.dispatch().catch(err => logger.error(`Errore dispatch reminder: ${err.message}`));
    }, 30000);
  }

  async onReady() {
    this.ready = true;
    this.startLoop();
  }

  async handleAdd(interaction) {
    const cfg = this.config;
    const when = interaction.options.getString('when');
    const message = interaction.options.getString('message');
    const sendInDmOpt = interaction.options.getBoolean('send_in_dm');

    const due = parseWhen(when);
    if (!due || due <= Math.floor(Date.now() / 1000)) {
      await interaction.reply({ content: 'Formato tempo non valido o nel passato.', ephemeral: true });
      return;
    }

    const sendDm = sendInDmOpt === null ? Boolean(cfg.default_send_in_dm) : sendInDmOpt;
    const fallbackChannelId = cfg.default_channel_id ? String(cfg.default_channel_id) : String(interaction.channel.id);
    const targetChannelId = fallbackChannelId;

    const data = await loadData();
    const gid = String(interaction.guild.id);
    const uid = Number(interaction.user.id);
    const g = data[gid] || { last_id: 0, items: [] };

    const maxPerUser = Number(cfg.max_per_user || 10);
    const userCount = g.items.filter(it => Number(it.user_id) === uid).length;
    if (userCount >= maxPerUser) {
      await interaction.reply({ content: `Hai raggiunto il limite di ${maxPerUser} promemoria.`, ephemeral: true });
      return;
    }

    const newId = Number(g.last_id || 0) + 1;
    g.last_id = newId;
    g.items.push({
      id: newId,
      user_id: uid,
      channel_id: targetChannelId ? String(targetChannelId) : null,
      is_dm: Boolean(sendDm),
      message,
      remind_at: due,
      created_at: Math.floor(Date.now() / 1000)
    });
    data[gid] = g;
    await saveData(data);
    await interaction.reply({ content: cfg.messages?.created?.replace('{time}', when) || '✅ Promemoria creato.', ephemeral: true });
  }

  async handleList(interaction) {
    const cfg = this.config;
    const data = await loadData();
    const gid = String(interaction.guild.id);
    const uid = Number(interaction.user.id);
    const g = data[gid] || { items: [] };
    const rows = g.items.filter(it => Number(it.user_id) === uid).sort((a, b) => Number(a.remind_at) - Number(b.remind_at));
    if (!rows.length) {
      await interaction.reply({ content: cfg.messages?.no_reminders || 'Non hai promemoria.', ephemeral: true });
      return;
    }
    const lines = [cfg.messages?.list_header || '📋 I tuoi promemoria:'];
    for (const r of rows) {
      const ts = `<t:${Number(r.remind_at)}:F>`;
      const dest = r.is_dm ? 'DM' : (r.channel_id ? `<#${r.channel_id}>` : '#current');
      lines.push(`\`#${r.id}\` ${ts} → ${dest} — ${r.message}`);
    }
    await interaction.reply({ content: lines.join('\n'), ephemeral: true });
  }

  async handleDelete(interaction) {
    const reminderId = interaction.options.getInteger('reminder_id');
    const data = await loadData();
    const gid = String(interaction.guild.id);
    const uid = Number(interaction.user.id);
    const g = data[gid] || { items: [] };
    const found = g.items.find(it => Number(it.id) === Number(reminderId));
    if (!found) {
      await interaction.reply({ content: 'Promemoria non trovato.', ephemeral: true });
      return;
    }
    if (Number(found.user_id) !== uid && !interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      await interaction.reply({ content: 'Non puoi eliminare promemoria di altri.', ephemeral: true });
      return;
    }
    g.items = g.items.filter(it => Number(it.id) !== Number(reminderId));
    data[gid] = g;
    await saveData(data);
    await interaction.reply({ content: this.config.messages?.deleted || '🗑️ Promemoria eliminato.', ephemeral: true });
  }

  async dispatch() {
    if (!this.ready) return;
    const now = Math.floor(Date.now() / 1000);
    let changed = false;
    const data = await loadData();
    for (const [gid, g] of Object.entries(data)) {
      const items = Array.isArray(g.items) ? g.items : [];
      const remaining = [];
      for (const r of items) {
        const remindAt = Number(r.remind_at || 0);
        if (remindAt > now) {
          remaining.push(r);
          continue;
        }
        let delivered = false;
        try {
          const guild = this.client.guilds.cache.get(gid);
          if (!guild) {
            remaining.push(r);
            continue;
          }
          const user = guild.members.cache.get(String(r.user_id));
          if (!user) {
            remaining.push(r);
            continue;
          }
          const content = this.config.messages?.remind_format
            ? this.config.messages.remind_format.replace('{mention}', user.toString()).replace('{message}', r.message)
            : `⏰ ${user} Promemoria: ${r.message}`;
          if (r.is_dm) {
            try {
              await user.send(content);
              delivered = true;
            } catch (error) {
              const chId = r.channel_id;
              const channel = chId ? guild.channels.cache.get(String(chId)) : null;
              const fallback = channel || guild.systemChannel || guild.channels.cache.find(c => c.isTextBased && c.isTextBased() && c.permissionsFor(guild.members.me).has(PermissionFlagsBits.SendMessages));
              if (fallback) {
                await fallback.send(content);
                delivered = true;
              }
            }
          } else {
            const chId = r.channel_id;
            let channel = chId ? guild.channels.cache.get(String(chId)) : null;
            if (!channel) {
              channel = guild.systemChannel || guild.channels.cache.find(c => c.isTextBased && c.isTextBased() && c.permissionsFor(guild.members.me).has(PermissionFlagsBits.SendMessages));
            }
            if (channel) {
              await channel.send(content);
              delivered = true;
            }
          }
        } catch (error) {
          delivered = false;
        } finally {
          if (!delivered) {
            remaining.push(r);
          } else {
            changed = true;
          }
        }
      }
      data[gid] = { ...g, items: remaining };
    }
    if (changed) {
      await saveData(data);
    }
  }

  registerListeners() {
    this.client.once('clientReady', () => this.onReady().catch(err => logger.error(`Reminders onReady error: ${err.message}`)));
    this.client.on('interactionCreate', async (interaction) => {
      if (!interaction.isChatInputCommand()) return;
      if (interaction.commandName !== 'remind') return;
      const sub = interaction.options.getSubcommand();
      switch (sub) {
        case 'add': return this.handleAdd(interaction);
        case 'list': return this.handleList(interaction);
        case 'delete': return this.handleDelete(interaction);
        default: return;
      }
    });
  }
}

function setup(client) {
  const cog = new RemindersCog(client);
  cog.registerListeners();
  if (!client.globalCommands) client.globalCommands = [];
  client.globalCommands.push(...cog.commands);
  return cog;
}

module.exports = { setup, RemindersCog };
