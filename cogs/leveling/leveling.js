const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder
} = require('discord.js');

const { loadJsonSync, saveJsonSync } = require('../../utils/jsonStore');
const { ownerOrHasPermissions } = require('../../utils/botUtils');
const logger = require('../../utils/logger');
const path = require('path');

class LevelingCog {
  constructor(client) {
    this.client = client;

    this.configPath = path.join(__dirname, 'leveling.json');
    this.dataPath = path.join(__dirname, 'levels.json');

    this.config = this.loadConfig();
    this.data = this.loadData();

    // Cooldown XP per utente (per guild): key = `${guildId}:${userId}` => timestamp ms
    this.cooldowns = new Map();

    this.commands = [
      new SlashCommandBuilder()
        .setName('rank')
        .setDescription('Mostra il rank (livello/xp) di un utente')
        .addUserOption(opt =>
          opt.setName('user')
            .setDescription('Utente (default: tu)')
            .setRequired(false)
        ),

      new SlashCommandBuilder()
        .setName('leaderboard')
        .setDescription('Mostra la classifica XP del server')
        .addIntegerOption(opt =>
          opt.setName('limit')
            .setDescription('Quanti utenti mostrare (1-25)')
            .setRequired(false)
            .setMinValue(1)
            .setMaxValue(25)
        ),

      new SlashCommandBuilder()
        .setName('level')
        .setDescription('Gestione livelli/XP (staff)')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addSubcommand(sc =>
          sc.setName('give')
            .setDescription('Aggiunge livelli a un utente')
            .addUserOption(o => o.setName('user').setDescription('Utente').setRequired(true))
            .addIntegerOption(o => o.setName('amount').setDescription('Livelli da aggiungere').setRequired(true).setMinValue(1))
        )
        .addSubcommand(sc =>
          sc.setName('set')
            .setDescription('Imposta il livello di un utente')
            .addUserOption(o => o.setName('user').setDescription('Utente').setRequired(true))
            .addIntegerOption(o => o.setName('amount').setDescription('Livello target').setRequired(true).setMinValue(0))
        )
        .addSubcommand(sc =>
          sc.setName('remove')
            .setDescription('Rimuove livelli a un utente')
            .addUserOption(o => o.setName('user').setDescription('Utente').setRequired(true))
            .addIntegerOption(o => o.setName('amount').setDescription('Livelli da rimuovere').setRequired(true).setMinValue(1))
        )
        .addSubcommand(sc =>
          sc.setName('givexp')
            .setDescription('Aggiunge XP a un utente')
            .addUserOption(o => o.setName('user').setDescription('Utente').setRequired(true))
            .addIntegerOption(o => o.setName('amount').setDescription('XP da aggiungere').setRequired(true).setMinValue(1))
        )
        .addSubcommand(sc =>
          sc.setName('setxp')
            .setDescription('Imposta gli XP di un utente')
            .addUserOption(o => o.setName('user').setDescription('Utente').setRequired(true))
            .addIntegerOption(o => o.setName('amount').setDescription('XP target').setRequired(true).setMinValue(0))
        )
        .addSubcommand(sc =>
          sc.setName('removexp')
            .setDescription('Rimuove XP a un utente')
            .addUserOption(o => o.setName('user').setDescription('Utente').setRequired(true))
            .addIntegerOption(o => o.setName('amount').setDescription('XP da rimuovere').setRequired(true).setMinValue(1))
        ),

      new SlashCommandBuilder()
        .setName('rlevel')
        .setDescription('Reward roles per livello')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
        .addSubcommand(sc =>
          sc.setName('add')
            .setDescription('Aggiunge un reward role a un livello')
            .addIntegerOption(o => o.setName('level').setDescription('Livello').setRequired(true).setMinValue(1))
            .addRoleOption(o => o.setName('role').setDescription('Ruolo da assegnare').setRequired(true))
        )
        .addSubcommand(sc =>
          sc.setName('remove')
            .setDescription('Rimuove il reward role di un livello')
            .addIntegerOption(o => o.setName('level').setDescription('Livello').setRequired(true).setMinValue(1))
        )
        .addSubcommand(sc =>
          sc.setName('show')
            .setDescription('Mostra tutti i reward roles configurati')
        ),

      new SlashCommandBuilder()
        .setName('leveling')
        .setDescription('Config base leveling')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addSubcommand(sc =>
          sc.setName('enable')
            .setDescription('Abilita il leveling')
        )
        .addSubcommand(sc =>
          sc.setName('disable')
            .setDescription('Disabilita il leveling')
        )
        .addSubcommand(sc =>
          sc.setName('setchannel')
            .setDescription('Imposta il canale annunci level-up (opzionale)')
            .addStringOption(o =>
              o.setName('channel_id')
                .setDescription('ID canale (vuoto per disabilitare)')
                .setRequired(false)
            )
        )
    ];
  }

  loadConfig() {
    return loadJsonSync(this.configPath, {
      enabled: true,

      // XP per messaggio
      xp_min: 8,
      xp_max: 15,
      cooldown_seconds: 45,

      // Ignora
      ignored_channel_ids: [],
      ignored_role_ids: [],

      // Annunci: se null => reply solo in DM/log oppure niente (qui: niente)
      announce_channel_id: null,

      // Formula XP->Level: xpNeeded(level) = base * level^2
      level_base_xp: 100,

      // Reward roles: { "5": "ROLE_ID", "10": "ROLE_ID" }
      role_levels: {}
    });
  }

  loadData() {
    return loadJsonSync(this.dataPath, {
      // guildId: { userId: { xp, level, lastMessageAt } }
    });
  }

  saveData() {
    saveJsonSync(this.dataPath, this.data);
  }

  reloadConfig() {
    this.config = this.loadConfig();
  }

  // ---------- Level math ----------
  xpForLevel(level) {
    // Totale XP richiesto per raggiungere "level"
    // level 0 => 0
    // level 1 => base*1
    // level 2 => base*4
    const base = Math.max(1, Number(this.config.level_base_xp || 100));
    const lv = Math.max(0, Number(level || 0));
    return Math.floor(base * (lv ** 2));
  }

  levelFromXp(xp) {
    const base = Math.max(1, Number(this.config.level_base_xp || 100));
    const safeXp = Math.max(0, Number(xp || 0));
    // inverse of base*level^2 => level = floor(sqrt(xp/base))
    return Math.floor(Math.sqrt(safeXp / base));
  }

  // ---------- Storage helpers ----------
  ensureGuildUser(guildId, userId) {
    if (!this.data[guildId]) this.data[guildId] = {};
    if (!this.data[guildId][userId]) {
      this.data[guildId][userId] = { xp: 0, level: 0, lastMessageAt: 0 };
    }
    return this.data[guildId][userId];
  }

  // ---------- XP awarding ----------
  canGainXp(message) {
    if (!message.guild || message.author.bot) return false;
    if (!this.config.enabled) return false;

    if (this.config.ignored_channel_ids?.includes(message.channelId)) return false;

    const member = message.member;
    if (member && Array.isArray(this.config.ignored_role_ids) && this.config.ignored_role_ids.length > 0) {
      if (member.roles.cache.some(r => this.config.ignored_role_ids.includes(r.id))) return false;
    }

    const key = `${message.guildId}:${message.author.id}`;
    const now = Date.now();
    const cooldownMs = Math.max(0, Number(this.config.cooldown_seconds || 45)) * 1000;
    const last = this.cooldowns.get(key) || 0;

    if (cooldownMs > 0 && (now - last) < cooldownMs) return false;
    this.cooldowns.set(key, now);
    return true;
  }

  randomXp() {
    const min = Math.max(0, Number(this.config.xp_min ?? 8));
    const max = Math.max(min, Number(this.config.xp_max ?? 15));
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  async onMessageCreate(message) {
    try {
      if (!this.canGainXp(message)) return;

      const guildId = message.guildId;
      const userId = message.author.id;

      const entry = this.ensureGuildUser(guildId, userId);
      const gained = this.randomXp();

      const beforeXp = entry.xp;
      const beforeLevel = entry.level;

      entry.xp = Math.max(0, beforeXp + gained);
      entry.level = this.levelFromXp(entry.xp);
      entry.lastMessageAt = Date.now();

      // Persist ogni volta (se vuoi ottimizzare, puoi batchare; per ora “safe”)
      this.saveData();

      if (entry.level > beforeLevel) {
        logger.info(`[levelingCog] Level up: guild=${guildId} user=${userId} ${beforeLevel} -> ${entry.level}`);

        await this.applyRoleRewards(message.guild, message.member, entry.level);

        // Annuncio level-up (se configurato)
        if (this.config.announce_channel_id) {
          const ch = message.guild.channels.cache.get(this.config.announce_channel_id);
          if (ch && ch.isTextBased()) {
            const embed = new EmbedBuilder()
              .setTitle('⬆️ Level Up!')
              .setDescription(`${message.author} è salito al **livello ${entry.level}**!`)
              .addFields(
                { name: 'XP Totali', value: `${entry.xp}`, inline: true },
                { name: 'XP per prossimo', value: `${Math.max(0, this.xpForLevel(entry.level + 1) - entry.xp)}`, inline: true }
              );

            await ch.send({ embeds: [embed] }).catch(() => {});
          }
        }
      }
    } catch (err) {
      logger.error(`[levelingCog] onMessageCreate error: ${err?.message || err}`);
    }
  }

  async applyRoleRewards(guild, member, newLevel) {
    try {
      if (!guild || !member) return;

      const mapping = this.config.role_levels || {};
      const roleId = mapping[String(newLevel)];
      if (!roleId) return;

      const role = guild.roles.cache.get(roleId);
      if (!role) return;

      if (!member.roles.cache.has(role.id)) {
        await member.roles.add(role, `Level reward: reached level ${newLevel}`);
        logger.info(`[levelingCog] Added reward role ${role.id} to ${member.user.id} at level ${newLevel}`);
      }
    } catch (err) {
      logger.error(`[levelingCog] applyRoleRewards error: ${err?.message || err}`);
    }
  }

  // ---------- Commands ----------
  async handleRank(interaction) {
    const user = interaction.options.getUser('user') || interaction.user;

    const entry = this.ensureGuildUser(interaction.guildId, user.id);
    const nextXp = this.xpForLevel(entry.level + 1);
    const prevXp = this.xpForLevel(entry.level);
    const progress = Math.max(0, entry.xp - prevXp);
    const needed = Math.max(1, nextXp - prevXp);

    const embed = new EmbedBuilder()
      .setTitle(`📊 Rank - ${user.tag}`)
      .setDescription(`${user}`)
      .addFields(
        { name: 'Livello', value: `${entry.level}`, inline: true },
        { name: 'XP', value: `${entry.xp}`, inline: true },
        { name: 'Progresso', value: `${progress}/${needed} (next: ${nextXp})`, inline: false }
      );

    await interaction.reply({ embeds: [embed], ephemeral: false });
  }

  async handleLeaderboard(interaction) {
    const limit = interaction.options.getInteger('limit') || 10;

    const guildId = interaction.guildId;
    const guildData = this.data[guildId] || {};

    const rows = Object.entries(guildData)
      .map(([userId, v]) => ({ userId, xp: Number(v.xp || 0), level: Number(v.level || 0) }))
      .sort((a, b) => b.xp - a.xp)
      .slice(0, limit);

    if (rows.length === 0) {
      return interaction.reply({ content: 'Nessun dato disponibile: scrivi qualche messaggio per iniziare a guadagnare XP.', ephemeral: true });
    }

    // Provo a risolvere i tag (senza spammare fetch)
    const lines = [];
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      let name = r.userId;
      const member = await interaction.guild.members.fetch(r.userId).catch(() => null);
      if (member) name = member.user.tag;

      lines.push(`**#${i + 1}** ${name} — **Lv ${r.level}** • **${r.xp} XP**`);
    }

    const embed = new EmbedBuilder()
      .setTitle('🏆 Leaderboard XP')
      .setDescription(lines.join('\n'));

    await interaction.reply({ embeds: [embed] });
  }

  async handleLevelAdmin(interaction) {
    // /level ... (give/set/remove/givexp/setxp/removexp)
    if (!ownerOrHasPermissions(PermissionFlagsBits.ManageGuild)(interaction)) {
      return interaction.reply({ content: '❌ Non hai i permessi per usare questo comando.', ephemeral: true });
    }

    const sub = interaction.options.getSubcommand();
    const user = interaction.options.getUser('user');
    const amount = interaction.options.getInteger('amount');

    const entry = this.ensureGuildUser(interaction.guildId, user.id);

    const beforeLevel = entry.level;
    const beforeXp = entry.xp;

    if (sub === 'give') {
      entry.level = Math.max(0, entry.level + amount);
      // Mantengo coerenza xp >= xpForLevel(level)
      entry.xp = Math.max(entry.xp, this.xpForLevel(entry.level));
    } else if (sub === 'set') {
      entry.level = Math.max(0, amount);
      entry.xp = Math.max(entry.xp, this.xpForLevel(entry.level));
    } else if (sub === 'remove') {
      entry.level = Math.max(0, entry.level - amount);
      entry.xp = Math.max(0, Math.min(entry.xp, this.xpForLevel(entry.level + 1) - 1));
    } else if (sub === 'givexp') {
      entry.xp = Math.max(0, entry.xp + amount);
      entry.level = this.levelFromXp(entry.xp);
    } else if (sub === 'setxp') {
      entry.xp = Math.max(0, amount);
      entry.level = this.levelFromXp(entry.xp);
    } else if (sub === 'removexp') {
      entry.xp = Math.max(0, entry.xp - amount);
      entry.level = this.levelFromXp(entry.xp);
    }

    entry.lastMessageAt = Date.now();
    this.saveData();

    // Provo ad applicare reward role se ha fatto level up
    if (interaction.guild && interaction.member && entry.level > beforeLevel) {
      await this.applyRoleRewards(interaction.guild, interaction.member, entry.level);
    }

    const embed = new EmbedBuilder()
      .setTitle('✅ Leveling aggiornato')
      .setDescription(`Utente: ${user} (${user.tag})`)
      .addFields(
        { name: 'Prima', value: `Lv ${beforeLevel} • ${beforeXp} XP`, inline: true },
        { name: 'Dopo', value: `Lv ${entry.level} • ${entry.xp} XP`, inline: true }
      );

    await interaction.reply({ embeds: [embed], ephemeral: true });
  }

  async handleRLevel(interaction) {
    if (!ownerOrHasPermissions(PermissionFlagsBits.ManageRoles)(interaction)) {
      return interaction.reply({ content: '❌ Non hai i permessi per gestire i reward roles.', ephemeral: true });
    }

    const sub = interaction.options.getSubcommand();

    if (sub === 'add') {
      const level = interaction.options.getInteger('level');
      const role = interaction.options.getRole('role');

      if (!this.config.role_levels) this.config.role_levels = {};
      this.config.role_levels[String(level)] = role.id;

      saveJsonSync(this.configPath, this.config);

      return interaction.reply({
        content: `✅ Reward role impostato: **livello ${level}** → ${role} (${role.id})`,
        ephemeral: true
      });
    }

    if (sub === 'remove') {
      const level = interaction.options.getInteger('level');

      if (!this.config.role_levels || !this.config.role_levels[String(level)]) {
        return interaction.reply({ content: `❌ Nessun reward role configurato per il livello ${level}.`, ephemeral: true });
      }

      delete this.config.role_levels[String(level)];
      saveJsonSync(this.configPath, this.config);

      return interaction.reply({ content: `✅ Reward role rimosso per il livello ${level}.`, ephemeral: true });
    }

    if (sub === 'show') {
      const mapping = this.config.role_levels || {};
      const entries = Object.entries(mapping).sort((a, b) => Number(a[0]) - Number(b[0]));

      if (entries.length === 0) {
        return interaction.reply({ content: 'Nessun reward role configurato.', ephemeral: true });
      }

      const lines = entries.map(([lvl, roleId]) => `• **Lv ${lvl}** → <@&${roleId}> (${roleId})`).join('\n');
      const embed = new EmbedBuilder()
        .setTitle('🎖️ Reward roles (rlevel)')
        .setDescription(lines);

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }
  }

  async handleLevelingConfig(interaction) {
    if (!ownerOrHasPermissions(PermissionFlagsBits.ManageGuild)(interaction)) {
      return interaction.reply({ content: '❌ Non hai i permessi per configurare il leveling.', ephemeral: true });
    }

    const sub = interaction.options.getSubcommand();

    if (sub === 'enable') {
      this.config.enabled = true;
      saveJsonSync(this.configPath, this.config);
      return interaction.reply({ content: '✅ Leveling abilitato.', ephemeral: true });
    }

    if (sub === 'disable') {
      this.config.enabled = false;
      saveJsonSync(this.configPath, this.config);
      return interaction.reply({ content: '✅ Leveling disabilitato.', ephemeral: true });
    }

    if (sub === 'setchannel') {
      const channelId = interaction.options.getString('channel_id') || null;
      this.config.announce_channel_id = channelId;
      saveJsonSync(this.configPath, this.config);

      return interaction.reply({
        content: channelId
          ? `✅ Canale annunci impostato su: <#${channelId}>`
          : '✅ Annunci level-up disabilitati.',
        ephemeral: true
      });
    }
  }
}

function setup(client) {
  const levelingCog = new LevelingCog(client);

  client.on('messageCreate', async (message) => {
    await levelingCog.onMessageCreate(message);
  });

  client.on('interactionCreate', async (interaction) => {
    try {
      if (!interaction.isChatInputCommand()) return;

      switch (interaction.commandName) {
        case 'rank':
          await levelingCog.handleRank(interaction);
          break;
        case 'leaderboard':
          await levelingCog.handleLeaderboard(interaction);
          break;
        case 'level':
          await levelingCog.handleLevelAdmin(interaction);
          break;
        case 'rlevel':
          await levelingCog.handleRLevel(interaction);
          break;
        case 'leveling':
          await levelingCog.handleLevelingConfig(interaction);
          break;
      }
    } catch (error) {
      logger.error(`[levelingCog] interaction error: ${error?.message || error}`);
      if (!interaction.replied) {
        await interaction.reply({ content: '❌ Errore nel comando.', ephemeral: true }).catch(() => {});
      }
    }
  });

  if (!client.globalCommands) client.globalCommands = [];
  client.globalCommands.push(...levelingCog.commands);

  return levelingCog;
}

module.exports = { setup, LevelingCog };
