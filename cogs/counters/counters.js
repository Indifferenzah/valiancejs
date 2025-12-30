const fs = require('fs');
const path = require('path');
const { SlashCommandBuilder, ChannelType, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { ownerOrHasPermissions } = require('../../utils/botUtils');
const { loadJsonSync, saveJsonSync } = require('../../utils/jsonStore');

const CONFIG_PATH = path.join(__dirname, '../../config.json');
const COUNTERS_PATH = path.join(__dirname, 'counter.json');

function toIdString(value) {
  if (value === undefined || value === null) return null;
  return String(value);
}

async function computeTotalMembers(guild, { members }) {
  const collection = members || guild.members.cache;
  return collection.filter(m => !m.user.bot).size;
}
async function computeBots(guild, { members }) {
  const collection = members || guild.members.cache;
  return collection.filter(m => m.user.bot).size;
}
async function computeRoleMembers(guild, { role_id, members }) {
  if (!role_id) return 0;
  const role = guild.roles.cache.get(role_id);
  if (!role) return 0;
  const collection = members || guild.members.cache;
  return collection.filter(m => m.roles.cache.has(role.id) && !m.user.bot).size;
}
async function computeTotalChannels(guild) {
  return guild.channels.cache.size;
}
async function computeTextChannels(guild) {
  return guild.channels.cache.filter(c => c.type === ChannelType.GuildText).size;
}
async function computeVoiceChannels(guild) {
  return guild.channels.cache.filter(c => c.type === ChannelType.GuildVoice).size;
}

const COUNTER_TYPES = {
  total_members: computeTotalMembers,
  role_members: computeRoleMembers,
  bots: computeBots,
  total_channels: computeTotalChannels,
  text_channels: computeTextChannels,
  voice_channels: computeVoiceChannels
};

function loadConfig() {
  return loadJsonSync(CONFIG_PATH, {});
}
function saveConfig(cfg) {
  saveJsonSync(CONFIG_PATH, cfg);
}
function loadCountersState() {
  try {
    const raw = fs.readFileSync(COUNTERS_PATH, 'utf8');
    const sanitized = raw
      .replace(/\uFEFF/g, '')
      .replace(/,\s*([}\]])/g, '$1')
      .replace(/("active_counters"\s*:\s*\{[^]*?\})/g, (match) => match)
      .replace(/("?[a-zA-Z0-9_]+"?\s*:\s*)(\d{15,})/g, (_, key, num) => `${key}"${num}"`);

    const rawState = JSON.parse(sanitized);
    const normalized = { ...rawState, active_counters: {} };
    for (const [gid, counters] of Object.entries(rawState.active_counters || {})) {
      normalized.active_counters[gid] = {};
      for (const [ctype, cid] of Object.entries(counters || {})) {
        const idStr = toIdString(cid);
        if (idStr) normalized.active_counters[gid][ctype] = idStr;
      }
    }
    return normalized;
  } catch (error) {
    if (error.code === 'ENOENT') return {};
    const fallback = loadJsonSync(COUNTERS_PATH, {});
    const normalized = { ...fallback, active_counters: {} };
    for (const [gid, counters] of Object.entries(fallback.active_counters || {})) {
      normalized.active_counters[gid] = {};
      for (const [ctype, cid] of Object.entries(counters || {})) {
        const idStr = toIdString(cid);
        if (idStr) normalized.active_counters[gid][ctype] = idStr;
      }
    }
    return normalized;
  }
}
function saveCountersState(state) {
  const prepared = { ...(state || {}) };
  prepared.active_counters = prepared.active_counters || {};
  for (const [gid, counters] of Object.entries(prepared.active_counters)) {
    const normalizedCounters = {};
    for (const [ctype, cid] of Object.entries(counters || {})) {
      const idStr = toIdString(cid);
      if (idStr) normalizedCounters[ctype] = idStr;
    }
    prepared.active_counters[gid] = normalizedCounters;
  }
  saveJsonSync(COUNTERS_PATH, prepared);
}

class CountersCog {
  constructor(client) {
    this.client = client;
    this.counterChannels = {};
    this.counterCache = {};
    this.pendingUpdates = {};
    this.bootstrapped = false;
    this.updateInterval = null;

    this.commands = [
      new SlashCommandBuilder()
        .setName('counter')
        .setDescription('Gestione dei counter')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(sub =>
          sub.setName('start')
            .setDescription('Crea e avvia i counter selezionati')
            .addStringOption(opt => opt.setName('types').setDescription('Tipi separati da virgola (default: total_members,role_members)'))
        )
        .addSubcommand(sub =>
          sub.setName('stop')
            .setDescription('Ferma e rimuove tutti i counter')
        )
        .addSubcommand(sub =>
          sub.setName('enable')
            .setDescription('Abilita un counter su un canale')
            .addStringOption(opt => opt.setName('counter_type').setDescription('Tipo di counter').setRequired(true).addChoices(
              { name: 'total_members', value: 'total_members' },
              { name: 'role_members', value: 'role_members' },
              { name: 'bots', value: 'bots' },
              { name: 'total_channels', value: 'total_channels' },
              { name: 'text_channels', value: 'text_channels' },
              { name: 'voice_channels', value: 'voice_channels' }
            ))
            .addChannelOption(opt => opt.setName('channel').setDescription('Canale vocale esistente').addChannelTypes(ChannelType.GuildVoice))
        )
        .addSubcommand(sub =>
          sub.setName('disable')
            .setDescription('Disabilita un counter')
            .addStringOption(opt => opt.setName('counter_type').setDescription('Tipo di counter').setRequired(true).addChoices(
              { name: 'total_members', value: 'total_members' },
              { name: 'role_members', value: 'role_members' },
              { name: 'bots', value: 'bots' },
              { name: 'total_channels', value: 'total_channels' },
              { name: 'text_channels', value: 'text_channels' },
              { name: 'voice_channels', value: 'voice_channels' }
            ))
        )
        .addSubcommand(sub =>
          sub.setName('setname')
            .setDescription('Imposta il template del nome per un counter')
            .addStringOption(opt => opt.setName('counter_type').setDescription('Tipo di counter').setRequired(true).addChoices(
              { name: 'total_members', value: 'total_members' },
              { name: 'role_members', value: 'role_members' },
              { name: 'bots', value: 'bots' },
              { name: 'total_channels', value: 'total_channels' },
              { name: 'text_channels', value: 'text_channels' },
              { name: 'voice_channels', value: 'voice_channels' }
            ))
            .addStringOption(opt => opt.setName('template').setDescription('Template con {count}').setRequired(true))
        )
        .addSubcommand(sub =>
          sub.setName('setrole')
            .setDescription('Imposta il ruolo per role_members')
            .addRoleOption(opt => opt.setName('role').setDescription('Ruolo').setRequired(true))
        )
        .addSubcommand(sub =>
          sub.setName('list')
            .setDescription('Lista dei counter attivi')
        )
    ];
  }

  async onReady() {
    if (this.bootstrapped) return;
    this.bootstrapped = true;
    await this.loadExistingCounters();
    this.startLoop();
  }

  async loadExistingCounters() {
    const state = loadCountersState();
    for (const [gidStr, channels] of Object.entries(state.active_counters || {})) {
      const gid = gidStr;
      const guild = this.client.guilds.cache.get(gid);
      if (!guild) continue;
      this.counterChannels[gid] = {};
      this.counterCache[gid] = {};
      this.pendingUpdates[gid] = true;
      for (const [ctype, cid] of Object.entries(channels)) {
        let ch = guild.channels.cache.get(cid);
        if (!ch) {
          try {
            ch = await guild.channels.fetch(cid);
          } catch (_) {
            ch = null;
          }
        }
        if (ch && ch.type === ChannelType.GuildVoice) {
          this.counterChannels[gid][ctype] = ch;
        }
      }
    }
  }

  startLoop() {
    if (this.updateInterval) return;
    this.updateInterval = setInterval(async () => {
      for (const [gid, pending] of Object.entries(this.pendingUpdates)) {
        if (pending) {
          const guild = this.client.guilds.cache.get(gid);
          if (guild) await this.updateGuildCounters(guild);
          this.pendingUpdates[gid] = false;
        }
      }
    }, 60000);
  }

  markPending(gid) {
    this.pendingUpdates[gid] = true;
  }

  templatesFromConfig() {
    const cfg = loadConfig();
    const counters = cfg.counters || {};
    return {
      total_members: counters.total_members_name || '👥 Membri: {count}',
      role_members: counters.role_members_name || '⭐ Membri Clan: {count}',
      bots: counters.bots_name || '🤖 Bot: {count}',
      total_channels: counters.total_channels_name || '📺 Canali: {count}',
      text_channels: counters.text_channels_name || '💬 Testo: {count}',
      voice_channels: counters.voice_channels_name || '🔊 Voce: {count}',
      role_id: counters.member_role_id ? String(counters.member_role_id) : null
    };
  }

  async updateGuildCounters(guild, force = false) {
    const guildId = guild.id;
    if (!this.counterChannels[guildId]) return;
    const templates = this.templatesFromConfig();
    let membersCollection = null;
    const getMembers = async () => {
      if (membersCollection) return membersCollection;
      try {
        membersCollection = await guild.members.fetch();
      } catch (_) {
        membersCollection = guild.members.cache;
      }
      return membersCollection;
    };
    for (const [ctype, channel] of Object.entries(this.counterChannels[guildId])) {
      const compute = COUNTER_TYPES[ctype];
      if (!compute) continue;
      const kwargs = {};
      if (ctype === 'role_members' && templates.role_id) {
        kwargs.role_id = templates.role_id;
      }
      if (ctype === 'total_members' || ctype === 'bots' || ctype === 'role_members') {
        kwargs.members = await getMembers();
      }
      try {
        const count = await compute(guild, kwargs);
        const prev = this.counterCache?.[guildId]?.[ctype];
        if (force || prev !== count) {
          await channel.edit({ name: (templates[ctype] || '{count}').replace('{count}', String(count)) });
          this.counterCache[guildId] = this.counterCache[guildId] || {};
          this.counterCache[guildId][ctype] = count;
        }
      } catch (err) {
        logger.error(`Errore aggiornando counter ${ctype} in ${guild.name}: ${err.message}`);
      }
    }
  }

  async counterStart(interaction) {
    if (!ownerOrHasPermissions(PermissionFlagsBits.Administrator)(interaction)) {
      await interaction.reply({ content: '⛔ Non hai i permessi.', ephemeral: true });
      return;
    }
    const guild = interaction.guild;
    await interaction.reply({ content: '🔄 Creazione canali counter in corso...', ephemeral: false });
    let selected = [];
    const typesStr = interaction.options.getString('types');
    if (typesStr) {
      selected = typesStr.split(',').map(s => s.trim()).filter(t => COUNTER_TYPES[t]);
    }
    if (!selected.length) selected = ['total_members', 'role_members'];

    const templates = this.templatesFromConfig();
    const created = {};
    let position = 0;
    for (const ctype of selected) {
      const compute = COUNTER_TYPES[ctype];
      const kwargs = {};
      if (ctype === 'role_members' && templates.role_id) kwargs.role_id = templates.role_id;
      const count = await compute(guild, kwargs);
      const name = (templates[ctype] || '{count}').replace('{count}', String(count));
      const channel = await guild.channels.create({
        name,
        type: ChannelType.GuildVoice,
        position,
        permissionOverwrites: [
          { id: guild.id, deny: [PermissionFlagsBits.Connect] }
        ]
      });
      position += 1;
      created[ctype] = channel;
    }

    if (Object.keys(created).length) {
      this.counterChannels[guild.id] = created;
      const state = loadCountersState();
      state.active_counters = state.active_counters || {};
      state.active_counters[guild.id] = Object.fromEntries(Object.entries(created).map(([k, ch]) => [k, ch.id]));
      saveCountersState(state);
      await this.updateGuildCounters(guild, true);
      await interaction.followUp({ content: `✅ Counter creati: ${Object.keys(created).join(', ')}`, ephemeral: false });
    } else {
      await interaction.followUp({ content: '❌ Nessun counter valido selezionato.', ephemeral: true });
    }
  }

  async counterStop(interaction) {
    if (!ownerOrHasPermissions(PermissionFlagsBits.Administrator)(interaction)) {
      await interaction.reply({ content: '⛔ Non hai i permessi.', ephemeral: true });
      return;
    }
    const guild = interaction.guild;
    if (!this.counterChannels[guild.id]) {
      await interaction.reply({ content: '❌ Nessun counter attivo.', ephemeral: true });
      return;
    }
    await interaction.reply({ content: '🔄 Rimozione dei counter...', ephemeral: false });
    for (const ch of Object.values(this.counterChannels[guild.id])) {
      try { await ch.delete(); } catch {}
    }
    delete this.counterChannels[guild.id];
    const state = loadCountersState();
    if (state.active_counters?.[guild.id]) {
      delete state.active_counters[guild.id];
      saveCountersState(state);
    }
    await interaction.followUp({ content: '✅ Tutti i counter sono stati rimossi.', ephemeral: false });
  }

  async counterEnable(interaction) {
    if (!ownerOrHasPermissions(PermissionFlagsBits.Administrator)(interaction)) {
      await interaction.reply({ content: '⛔ Non hai i permessi.', ephemeral: true });
      return;
    }
    const guild = interaction.guild;
    const ctype = interaction.options.getString('counter_type');
    const channelOpt = interaction.options.getChannel('channel');
    const templates = this.templatesFromConfig();
    const kwargs = {};
    if (ctype === 'role_members' && templates.role_id) kwargs.role_id = templates.role_id;
    const compute = COUNTER_TYPES[ctype];
    const count = await compute(guild, kwargs);
    const name = (templates[ctype] || '{count}').replace('{count}', String(count));
    let channel = channelOpt;
    try {
      if (!channel) {
        const position = Object.keys(this.counterChannels[guild.id] || {}).length;
        channel = await guild.channels.create({
          name,
          type: ChannelType.GuildVoice,
          position,
          permissionOverwrites: [{ id: guild.id, deny: [PermissionFlagsBits.Connect] }]
        });
      } else {
        await channel.edit({ name });
      }
    } catch (e) {
      await interaction.reply({ content: `❌ Errore nell'abilitazione del counter: ${e.message}`, ephemeral: true });
      return;
    }
    this.counterChannels[guild.id] = this.counterChannels[guild.id] || {};
    this.counterChannels[guild.id][ctype] = channel;
    const state = loadCountersState();
    state.active_counters = state.active_counters || {};
    state.active_counters[guild.id] = state.active_counters[guild.id] || {};
    state.active_counters[guild.id][ctype] = channel.id;
    saveCountersState(state);
    await this.updateGuildCounters(guild, true);
    await interaction.reply({ content: `✅ Counter \\\`${ctype}\\\` abilitato su ${channel}.`, ephemeral: true });
  }

  async counterDisable(interaction) {
    if (!ownerOrHasPermissions(PermissionFlagsBits.Administrator)(interaction)) {
      await interaction.reply({ content: '⛔ Non hai i permessi.', ephemeral: true });
      return;
    }
    const guild = interaction.guild;
    const ctype = interaction.options.getString('counter_type');
    if (!this.counterChannels[guild.id] || !this.counterChannels[guild.id][ctype]) {
      await interaction.reply({ content: '❌ Questo counter non è attivo.', ephemeral: true });
      return;
    }
    const channel = this.counterChannels[guild.id][ctype];
    try { await channel.delete(); } catch {}
    delete this.counterChannels[guild.id][ctype];
    const state = loadCountersState();
    if (state.active_counters?.[guild.id]) {
      delete state.active_counters[guild.id][ctype];
      if (!Object.keys(state.active_counters[guild.id]).length) delete state.active_counters[guild.id];
      saveCountersState(state);
    }
    await interaction.reply({ content: `✅ Counter \\\`${ctype}\\\` disabilitato e canale eliminato.`, ephemeral: true });
  }

  async counterSetName(interaction) {
    if (!ownerOrHasPermissions(PermissionFlagsBits.Administrator)(interaction)) {
      await interaction.reply({ content: '⛔ Non hai i permessi.', ephemeral: true });
      return;
    }
    const ctype = interaction.options.getString('counter_type');
    const template = interaction.options.getString('template');
    const cfg = loadConfig();
    cfg.counters = cfg.counters || {};
    cfg.counters[`${ctype}_name`] = template;
    saveConfig(cfg);
    await interaction.reply({ content: `✅ Template per \\\`${ctype}\\\` aggiornato a: ${template}`, ephemeral: true });
  }

  async counterSetRole(interaction) {
    if (!ownerOrHasPermissions(PermissionFlagsBits.Administrator)(interaction)) {
      await interaction.reply({ content: '⛔ Non hai i permessi.', ephemeral: true });
      return;
    }
    const role = interaction.options.getRole('role');
    const cfg = loadConfig();
    cfg.counters = cfg.counters || {};
    cfg.counters.member_role_id = String(role.id);
    saveConfig(cfg);
    await interaction.reply({ content: `✅ Ruolo per role_members impostato a ${role.name}`, ephemeral: true });
  }

  async counterList(interaction) {
    if (!ownerOrHasPermissions(PermissionFlagsBits.Administrator)(interaction)) {
      await interaction.reply({ content: '⛔ Non hai i permessi.', ephemeral: true });
      return;
    }
    const active = this.counterChannels[interaction.guild.id] || {};
    if (!Object.keys(active).length) {
      await interaction.reply({ content: 'ℹ️ Nessun counter attivo.', ephemeral: true });
      return;
    }
    const desc = Object.entries(active).map(([ctype, ch]) => `${ctype} ? ${ch} (ID: ${ch.id})`).join("\n");
    const embed = new EmbedBuilder().setTitle('Counter attivi').setDescription(desc).setColor(0x2ecc71);
    await interaction.reply({ embeds: [embed], ephemeral: true });
  }

  registerListeners() {
    this.client.once('clientReady', async () => { await this.onReady(); });
    this.client.on('guildMemberAdd', m => this.markPending(m.guild.id));
    this.client.on('guildMemberRemove', m => this.markPending(m.guild.id));
    this.client.on('guildMemberUpdate', (b, a) => { if (b.roles.cache.size !== a.roles.cache.size) this.markPending(a.guild.id); });
    this.client.on('channelCreate', ch => this.markPending(ch.guildId));
    this.client.on('channelDelete', ch => this.markPending(ch.guildId));

    this.client.on('interactionCreate', async (interaction) => {
      if (!interaction.isChatInputCommand()) return;
      if (interaction.commandName !== 'counter') return;
      const sub = interaction.options.getSubcommand();
      switch (sub) {
        case 'start': return this.counterStart(interaction);
        case 'stop': return this.counterStop(interaction);
        case 'enable': return this.counterEnable(interaction);
        case 'disable': return this.counterDisable(interaction);
        case 'setname': return this.counterSetName(interaction);
        case 'setrole': return this.counterSetRole(interaction);
        case 'list': return this.counterList(interaction);
      }
    });
  }
}

function setup(client) {
  const cog = new CountersCog(client);
  cog.registerListeners();
  if (!client.globalCommands) client.globalCommands = [];
  client.globalCommands.push(...cog.commands);
  return cog;
}

module.exports = { setup, CountersCog };
