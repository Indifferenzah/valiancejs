const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const config = require('../config.json');
const logger = require('../services/logger');
const { getError, buildErrorEmbed } = require('../errors');
const { buildAdminStatsEmbed } = require('../ui/embeds');

function isAdmin(interaction) {
  if (config.admin.allowedUsers.includes(interaction.user.id)) return true;
  const memberRoles = interaction.member?.roles?.cache;
  if (memberRoles && config.admin.allowedRoles.some(r => memberRoles.has(r))) return true;
  if (config.admin.requireAdministratorPermission && interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) return true;
  return false;
}

async function handleCommand(interaction, api, loadedAt) {
  if (!isAdmin(interaction)) {
    return interaction.reply({
      embeds: [buildErrorEmbed(getError('notAllowed'))],
      ephemeral: true,
    });
  }

  await interaction.deferReply({ ephemeral: true });

  const subGroup = interaction.options.getSubcommandGroup(false);
  const sub = interaction.options.getSubcommand();

  try {
    if (sub === 'stats') {
      const stats = {
        cache: api.cache.info(),
        rateLimiter: api.rateLimiter.stats(),
        api: api.apiStats(),
        uptimeMs: Date.now() - loadedAt,
      };
      return interaction.editReply({ embeds: [buildAdminStatsEmbed(stats)] });
    }

    if (subGroup === 'cache' && sub === 'clear') {
      api.cache.clear();
      logger.info('Cache cleared by admin');
      return interaction.editReply({
        embeds: [buildErrorEmbed('✅ Cache svuotata.', config.colors.admin)],
      });
    }

    if (subGroup === 'cache' && sub === 'info') {
      const info = api.cache.info();
      return interaction.editReply({
        embeds: [buildErrorEmbed(
          `🗃️ **Cache Info**\nSize: **${info.size}** · Hits: **${info.hits}** · Misses: **${info.misses}** · Hit rate: **${info.hitRate}**`,
          config.colors.admin
        )],
      });
    }
  } catch (err) {
    logger.error('/coralcog command error', err);
    await interaction.editReply({ embeds: [buildErrorEmbed('❌ Errore interno.')] }).catch(() => {});
  }
}

const builder = new SlashCommandBuilder()
  .setName('coralcog')
  .setDescription('[ADMIN] Comandi admin CoralMC')

  .addSubcommand(sub =>
    sub.setName('stats').setDescription('[ADMIN] Statistiche interne del cog')
  )

  .addSubcommandGroup(group =>
    group.setName('cache')
      .setDescription('Gestione cache')
      .addSubcommand(sub =>
        sub.setName('clear').setDescription('[ADMIN] Svuota la cache')
      )
      .addSubcommand(sub =>
        sub.setName('info').setDescription('[ADMIN] Info sulla cache')
      )
  );

module.exports = { builder, handleCommand };
