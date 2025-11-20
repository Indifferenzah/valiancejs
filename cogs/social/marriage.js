const {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder
} = require('discord.js');
const path = require('path');
const fs = require('fs');
const fsp = require('fs').promises;
const { loadJson, saveJson, loadJsonSync } = require('../../utils/jsonStore');
const logger = require('../../utils/logger');

const CONFIG_PATH = path.join(__dirname, 'config.json');
const DATA_PATH = path.join(__dirname, '..', '..', 'data', 'marriages.json');

function loadConfig() {
  try {
    return loadJsonSync(CONFIG_PATH, {
      enabled: true,
      announce_channel_id: null,
      messages: {
        proposal: '💍 {proposer} ha chiesto di sposare {target}!',
        accepted: '🎉 {proposer} e {target} ora sono sposati!',
        declined: '❌ {target} ha rifiutato la proposta di {proposer}.',
        already_married: '❌ Uno dei due è già in una relazione.',
        not_married: '❌ Non sei in una relazione.',
        divorced: '💔 {a} e {b} hanno divorziato.',
        status: '💞 {a} è in relazione con {b} dal {date}.'
      }
    });
  } catch (error) {
    return {
      enabled: true,
      announce_channel_id: null,
      messages: {
        proposal: '💍 {proposer} ha chiesto di sposare {target}!',
        accepted: '🎉 {proposer} e {target} ora sono sposati!',
        declined: '❌ {target} ha rifiutato la proposta di {proposer}.',
        already_married: '❌ Uno dei due è già in una relazione.',
        not_married: '❌ Non sei in una relazione.',
        divorced: '💔 {a} e {b} hanno divorziato.',
        status: '💞 {a} è in relazione con {b} dal {date}.'
      }
    };
  }
}

async function loadData() {
  try {
    const data = await loadJson(DATA_PATH, {});
    return data && typeof data === 'object' ? data : {};
  } catch (error) {
    logger.error(`Errore caricando marriages.json: ${error.message}`);
    return {};
  }
}

async function saveData(data) {
  await fsp.mkdir(path.dirname(DATA_PATH), { recursive: true });
  await saveJson(DATA_PATH, data || {});
}

async function isUserMarried(guildId, userId) {
  const data = await loadData();
  const gid = String(guildId);
  const pairs = data?.[gid]?.pairs || [];
  for (const p of pairs) {
    const a = Number(p.a);
    const b = Number(p.b);
    if (a === Number(userId) || b === Number(userId)) {
      return { user_id_a: a, user_id_b: b, started_at: Number(p.started_at || 0) };
    }
  }
  return null;
}

class ConsentView {
  constructor(proposerId, target, interaction, config) {
    this.proposerId = proposerId;
    this.targetId = target.id;
    this.interaction = interaction;
    this.config = config;
    this.result = null;
    this.message = null;
  }

  components() {
    return [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('marry_accept').setLabel('Accetta').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('marry_decline').setLabel('Rifiuta').setStyle(ButtonStyle.Danger)
      )
    ];
  }

  async sendProposal(content) {
    this.message = await this.interaction.reply({ content, components: this.components(), ephemeral: false, fetchReply: true });
    const collector = this.message.createMessageComponentCollector({ time: 60000, filter: (i) => i.user.id === this.targetId });
    collector.on('collect', async (i) => {
      if (i.customId === 'marry_accept') {
        this.result = true;
      } else if (i.customId === 'marry_decline') {
        this.result = false;
      }
      await i.update({ components: [], content: this.result ? '✅ Proposta accettata!' : '❌ Proposta rifiutata.' });
      collector.stop();
    });
    collector.on('end', async () => {
      if (this.result === null) {
        try {
          await this.message.edit({ components: [], content: '⏱️ Nessuna risposta, proposta scaduta.' });
        } catch (error) {
          logger.error(`Errore chiudendo proposta matrimonio: ${error.message}`);
        }
      }
    });
    await new Promise((resolve) => collector.on('end', () => resolve()));
  }
}

class MarriageCog {
  constructor(client) {
    this.client = client;
    this.config = loadConfig();

    this.commands = [
      new SlashCommandBuilder()
        .setName('marry')
        .setDescription('Chiedi di sposare un utente')
        .addUserOption(opt => opt.setName('user').setDescription('Utente da sposare').setRequired(true)),
      new SlashCommandBuilder()
        .setName('divorce')
        .setDescription('Divorzia dalla tua relazione attuale'),
      new SlashCommandBuilder()
        .setName('relationship')
        .setDescription('Mostra lo stato della tua relazione o di un utente')
        .addUserOption(opt => opt.setName('user').setDescription('Utente (opzionale)').setRequired(false))
    ];
  }

  async handleMarry(interaction) {
    const user = interaction.options.getMember('user');
    if (!user) {
      await interaction.reply({ content: '❌ Utente non trovato.', ephemeral: true });
      return;
    }
    if (user.id === interaction.user.id || user.user.bot) {
      await interaction.reply({ content: '❌ Non puoi sposarti da solo o con un bot.', ephemeral: true });
      return;
    }

    if (await isUserMarried(interaction.guild.id, interaction.user.id) || await isUserMarried(interaction.guild.id, user.id)) {
      await interaction.reply({ content: this.config.messages.already_married, ephemeral: true });
      return;
    }

    const msg = this.config.messages.proposal.replace('{proposer}', interaction.user.toString()).replace('{target}', user.toString());
    const view = new ConsentView(interaction.user.id, user, interaction, this.config);
    await view.sendProposal(msg);

    if (view.result === true) {
      const started = Math.floor(Date.now() / 1000);
      const a = Math.min(interaction.user.id, user.id);
      const b = Math.max(interaction.user.id, user.id);
      const data = await loadData();
      const gid = String(interaction.guild.id);
      const g = data[gid] || { pairs: [] };
      g.pairs = g.pairs || [];
      g.pairs.push({ a: Number(a), b: Number(b), started_at: started });
      data[gid] = g;
      await saveData(data);

      const text = this.config.messages.accepted.replace('{proposer}', interaction.user.toString()).replace('{target}', user.toString());
      const announceId = this.config.announce_channel_id;
      const announceChannel = announceId ? interaction.guild.channels.cache.get(String(announceId)) : null;
      await interaction.followUp({ content: text });
      if (announceChannel && announceChannel.id !== interaction.channel.id) {
        await announceChannel.send(text).catch(() => {});
      }
    } else if (view.result === false) {
      await interaction.followUp({ content: this.config.messages.declined.replace('{proposer}', interaction.user.toString()).replace('{target}', user.toString()) });
    }
  }

  async handleDivorce(interaction) {
    const r = await isUserMarried(interaction.guild.id, interaction.user.id);
    if (!r) {
      await interaction.reply({ content: this.config.messages.not_married, ephemeral: true });
      return;
    }
    const { user_id_a: a, user_id_b: b } = r;
    const data = await loadData();
    const gid = String(interaction.guild.id);
    const g = data[gid] || { pairs: [] };
    g.pairs = (g.pairs || []).filter(p => {
      const pa = Number(p.a); const pb = Number(p.b);
      return !((pa === a && pb === b) || (pa === b && pb === a));
    });
    data[gid] = g;
    await saveData(data);

    const userA = interaction.guild.members.cache.get(String(a));
    const userB = interaction.guild.members.cache.get(String(b));
    await interaction.reply({ content: this.config.messages.divorced.replace('{a}', userA ? userA.toString() : String(a)).replace('{b}', userB ? userB.toString() : String(b)) });
  }

  async handleRelationship(interaction) {
    const member = interaction.options.getMember('user') || interaction.member;
    const r = await isUserMarried(interaction.guild.id, member.id);
    if (!r) {
      await interaction.reply({ content: 'Nessuna relazione.', ephemeral: true });
      return;
    }
    const { user_id_a: a, user_id_b: b, started_at } = r;
    const partnerId = a === member.id ? b : a;
    const partner = interaction.guild.members.cache.get(String(partnerId));
    const date = `<t:${started_at}:D>`;
    await interaction.reply({ content: this.config.messages.status.replace('{a}', member.toString()).replace('{b}', partner ? partner.toString() : String(partnerId)).replace('{date}', date) });
  }
}

function setup(client) {
  const marriageCog = new MarriageCog(client);
  client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    if (interaction.commandName === 'marry') return marriageCog.handleMarry(interaction);
    if (interaction.commandName === 'divorce') return marriageCog.handleDivorce(interaction);
    if (interaction.commandName === 'relationship') return marriageCog.handleRelationship(interaction);
  });
  if (!client.globalCommands) client.globalCommands = [];
  client.globalCommands.push(...marriageCog.commands);
  return marriageCog;
}

module.exports = { setup, MarriageCog };
