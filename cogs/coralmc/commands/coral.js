const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const config = require('../config.json');
const logger = require('../services/logger');
const { getError, buildErrorEmbed } = require('../errors');
const {
  buildProfileEmbed,
  buildBedwarsEmbed,
  buildKitPvPEmbed,
  buildDuelsEmbed,
  buildLeaderboardEmbed,
  buildMatchBedwarsEmbed,
  buildMatchDuelsEmbed,
  buildMatchLogsEmbed,
  buildMatchesListEmbed,
  buildClanEmbed,
  buildSearchEmbed,
  buildCupLeaderboardEmbed,
  buildCupTeamEmbed,
} = require('../ui/embeds');
const {
  buildPlayerPageButtons,
  buildDuelsModeSelect,
  buildPaginationRow,
  buildMatchDetailButton,
  buildViewLogsButton,
  buildClanButton,
  buildProfileButton,
  buildPlayerSelectMenu,
  buildMatchSelectMenu,
  disableAllComponents,
} = require('../ui/buttons');
const { createCollector } = require('../ui/collectors');

const DUELS_KITS = [
  'NO_DEBUFF', 'BUILDUHC', 'BEDFIGHT', 'SKYWARS', 'SPLEEF', 'BRIDGES',
  'BOXING', 'SUMO', 'PEARL_FIGHT', 'FIREBALL_FIGHT', 'STICK_FIGHT',
  'SG_DEATHMATCH', 'GAPPLE', 'INVADED', 'CLASSIC', 'FINALUHC',
  'BATTLE_RUSH', 'TOP_FIGHT',
];

// ─── Guard helpers ────────────────────────────────────────────────────────────

function channelAllowed(interaction) {
  if (config.allowedChannels.length === 0) return true;
  return config.allowedChannels.includes(interaction.channelId);
}

function handleApiError(err, interaction, context = {}) {
  logger.error(`API error in /coral`, err);
  let msg;
  if (err.code === 'TIMEOUT') msg = getError('timeout');
  else if (err.code === 'RATE_LIMIT') msg = getError('rateLimit');
  else if (err.status === 404) {
    if (context.username) msg = getError('playerNotFound', { username: context.username });
    else if (context.id) msg = getError('matchNotFound', { id: context.id });
    else msg = getError('clanNotFound');
  } else if (err.status) msg = getError('apiError', { status: err.status });
  else msg = '❌ Si è verificato un errore imprevisto.';
  return buildErrorEmbed(msg);
}

// ─── Shared player display + navigation ──────────────────────────────────────

async function showPlayerProfile(interaction, api, playerRes, bwRes, kitRes, duelsRes, avatarUrl) {
  const playerData = playerRes.data;
  const bwData = bwRes?.data ?? {};
  const kitData = kitRes?.data ?? {};
  const duelsData = duelsRes?.data ?? null;
  const cachedAt = playerRes.cachedAt;

  function getComponents(page, selectedDuelsMode) {
    const rows = [buildPlayerPageButtons(page)];
    if (page === 'bedwars' && bwData.clan_name) {
      rows.push(buildClanButton(bwData.clan_name));
    }
    if (page === 'duels' && duelsData?.modeStats) {
      rows.push(buildDuelsModeSelect(duelsData.modeStats, selectedDuelsMode ?? _topMode(duelsData.modeStats)));
    }
    return rows;
  }

  function getEmbed(page, selectedDuelsMode) {
    if (page === 'bedwars') return buildBedwarsEmbed(bwData, playerData, avatarUrl, bwRes?.cachedAt ?? cachedAt);
    if (page === 'kitpvp') return buildKitPvPEmbed(kitData, playerData, avatarUrl, kitRes?.cachedAt ?? cachedAt);
    if (page === 'duels') {
      if (!duelsData) return buildErrorEmbed('❌ Statistiche Duels non disponibili.');
      return buildDuelsEmbed(duelsData, playerData, avatarUrl, selectedDuelsMode, duelsRes?.cachedAt ?? cachedAt);
    }
    return buildProfileEmbed(playerData, avatarUrl, cachedAt);
  }

  let selectedDuelsMode = duelsData?.modeStats ? _topMode(duelsData.modeStats) : null;

  await interaction.editReply({
    embeds: [getEmbed('profile')],
    components: getComponents('profile', selectedDuelsMode),
  });
  const message = await interaction.fetchReply();

  await createCollector(interaction, message, config.collector.timeoutMs, async (i) => {
    const cid = i.customId;

    if (cid.startsWith('coralmc_page_') && ['profile', 'bedwars', 'kitpvp', 'duels'].some(p => cid.endsWith(p))) {
      const newPage = cid.replace('coralmc_page_', '');
      await i.update({
        embeds: [getEmbed(newPage, selectedDuelsMode)],
        components: getComponents(newPage, selectedDuelsMode),
      });
      return;
    }

    if (cid === 'coralmc_duels_mode') {
      selectedDuelsMode = i.values[0];
      await i.update({
        embeds: [getEmbed('duels', selectedDuelsMode)],
        components: getComponents('duels', selectedDuelsMode),
      });
      return;
    }

    if (cid.startsWith('coralmc_clan_') && !cid.startsWith('coralmc_clan_prev') && !cid.startsWith('coralmc_clan_next')) {
      const clanName = cid.slice('coralmc_clan_'.length);
      if (!clanName) return i.reply({ content: '❌ Nome clan non valido.', ephemeral: true });

      await i.deferUpdate();
      try {
        const clanRes = await api.getClan(clanName);
        if (!clanRes) return interaction.editReply({ embeds: [buildErrorEmbed(getError('clanNotFound'))], components: [] });
        const clanData = clanRes.data;
        const totalPages = Math.max(1, Math.ceil((clanData.members?.length ?? 0) / 10));
        await interaction.editReply({
          embeds: [buildClanEmbed(clanData, clanData.color ?? null, clanRes.cachedAt, 1)],
          components: totalPages > 1 ? [buildPaginationRow(1, totalPages)] : [],
        });

        if (totalPages > 1) {
          const clanMsg = await interaction.fetchReply();
          let clanPage = 1;
          await createCollector(interaction, clanMsg, config.collector.timeoutMs, async (pi) => {
            if (pi.customId === 'coralmc_page_prev') clanPage = Math.max(1, clanPage - 1);
            else if (pi.customId === 'coralmc_page_next') clanPage = Math.min(totalPages, clanPage + 1);
            else return;
            await pi.update({
              embeds: [buildClanEmbed(clanData, clanData.color ?? null, clanRes.cachedAt, clanPage)],
              components: [buildPaginationRow(clanPage, totalPages)],
            });
          });
        }
      } catch (err) {
        await interaction.editReply({ embeds: [handleApiError(err, interaction)], components: [] });
      }
      return;
    }
  });
}

// ─── /coral player ────────────────────────────────────────────────────────────

async function handlePlayer(interaction, api) {
  const username = interaction.options.getString('username', true);

  const [playerRes, bwRes, kitRes, duelsRes, avatarUrl] = await Promise.all([
    api.getPlayer(username),
    api.getBedwars(username),
    api.getKitPvP(username),
    api.getDuels(username),
    api.resolveAvatar(username),
  ]);

  if (!playerRes) {
    return interaction.editReply({ embeds: [buildErrorEmbed(getError('playerNotFound', { username }))] });
  }

  await showPlayerProfile(interaction, api, playerRes, bwRes, kitRes, duelsRes, avatarUrl);
}

function _topMode(modeStats) {
  let top = null, topElo = -1;
  for (const [mode, stats] of Object.entries(modeStats)) {
    if ((stats.elo ?? 0) > topElo) { topElo = stats.elo; top = mode; }
  }
  return top;
}

// ─── /coral matches ───────────────────────────────────────────────────────────

async function handleMatches(interaction, api) {
  const gamemode = interaction.options.getString('gamemode', true);
  const username = interaction.options.getString('player', true);
  const perPage = config.leaderboard.entriesPerPage;

  const res = gamemode === 'bedwars'
    ? await api.getBedwarsMatches(username)
    : await api.getDuelsMatches(username);

  if (!res) {
    return interaction.editReply({ embeds: [buildErrorEmbed(getError('playerNotFound', { username }))] });
  }

  const allMatches = res.data ?? [];
  let page = 1;
  const totalPages = Math.max(1, Math.ceil(allMatches.length / perPage));

  let state = 'list';
  let currentMatchId = null;
  let logsPage = 1;
  let allLogs = [];
  let logsTotal = 1;

  function getSlice() {
    return allMatches.slice((page - 1) * perPage, page * perPage);
  }

  function listPayload() {
    return {
      embeds: [buildMatchesListEmbed(getSlice(), gamemode, username, page, totalPages)],
      components: _matchDetailRows(getSlice(), gamemode, page, totalPages),
    };
  }

  await interaction.editReply(listPayload());
  const message = await interaction.fetchReply();

  await createCollector(interaction, message, config.collector.timeoutMs, async (i) => {
    const cid = i.customId;

    if (state === 'list') {
      if (cid === 'coralmc_page_prev') {
        page = Math.max(1, page - 1);
        await i.update(listPayload());
        return;
      }
      if (cid === 'coralmc_page_next') {
        page = Math.min(totalPages, page + 1);
        await i.update(listPayload());
        return;
      }
      if (cid === 'coralmc_matchselect') {
        const [gm, ...idParts] = i.values[0].split('|');
        const id = idParts.join('|');
        await i.deferUpdate();
        try {
          const matchRes = gm === 'bedwars'
            ? await api.getBedwarsMatch(id)
            : await api.getDuelsMatch(id);
          if (!matchRes) {
            return interaction.editReply({ embeds: [buildErrorEmbed(getError('matchNotFound', { id }))], components: [] });
          }
          currentMatchId = id;
          state = 'detail';
          const detailEmbed = gm === 'bedwars'
            ? buildMatchBedwarsEmbed(matchRes.data)
            : buildMatchDuelsEmbed(matchRes.data);
          const rows = gm === 'bedwars' ? [buildViewLogsButton(id)] : [];
          await interaction.editReply({ embeds: [detailEmbed], components: rows });
        } catch (err) {
          await interaction.editReply({ embeds: [handleApiError(err, interaction, { id })], components: [] });
        }
        return;
      }
    }

    if (state === 'detail') {
      if (cid.startsWith('coralmc_matchlogs_')) {
        const id = cid.replace('coralmc_matchlogs_', '');
        await i.deferUpdate();
        try {
          const logsRes = await api.getBedwarsMatchLogs(id);
          if (!logsRes) return interaction.editReply({ embeds: [buildErrorEmbed('❌ Log non trovati.')], components: [] });
          allLogs = logsRes.data ?? [];
          logsPage = 1;
          logsTotal = Math.max(1, Math.ceil(allLogs.length / config.pagination.logsPerPage));
          state = 'logs';
          await interaction.editReply({
            embeds: [buildMatchLogsEmbed(allLogs.slice(0, config.pagination.logsPerPage), 1, logsTotal, id)],
            components: [buildPaginationRow(1, logsTotal)],
          });
        } catch (err) {
          await interaction.editReply({ embeds: [handleApiError(err, interaction)], components: [] });
        }
        return;
      }
    }

    if (state === 'logs') {
      if (cid === 'coralmc_page_prev') {
        logsPage = Math.max(1, logsPage - 1);
      } else if (cid === 'coralmc_page_next') {
        logsPage = Math.min(logsTotal, logsPage + 1);
      }
      const slice = allLogs.slice((logsPage - 1) * config.pagination.logsPerPage, logsPage * config.pagination.logsPerPage);
      await i.update({
        embeds: [buildMatchLogsEmbed(slice, logsPage, logsTotal, currentMatchId)],
        components: [buildPaginationRow(logsPage, logsTotal)],
      });
    }
  });
}

function _matchDetailRows(matches, gamemode, page, totalPages) {
  const rows = [buildPaginationRow(page, totalPages)];
  if (matches.length > 0) rows.push(buildMatchSelectMenu(matches, gamemode));
  return rows;
}

// ─── /coral match ─────────────────────────────────────────────────────────────

async function handleMatch(interaction, api) {
  const gamemode = interaction.options.getString('gamemode', true);
  const id = interaction.options.getString('id', true);

  const res = gamemode === 'bedwars'
    ? await api.getBedwarsMatch(id)
    : await api.getDuelsMatch(id);

  if (!res) {
    return interaction.editReply({ embeds: [buildErrorEmbed(getError('matchNotFound', { id }))] });
  }

  const embed = gamemode === 'bedwars'
    ? buildMatchBedwarsEmbed(res.data)
    : buildMatchDuelsEmbed(res.data);

  const rows = gamemode === 'bedwars' ? [buildViewLogsButton(id)] : [];
  await interaction.editReply({ embeds: [embed], components: rows });

  if (gamemode !== 'bedwars') return;

  const message = await interaction.fetchReply();
  await createCollector(interaction, message, config.collector.timeoutMs, async (i) => {
    if (i.customId.startsWith('coralmc_matchlogs_')) {
      const matchId = i.customId.replace('coralmc_matchlogs_', '');
      await i.deferUpdate();
      try {
        const logsRes = await api.getBedwarsMatchLogs(matchId);
        if (!logsRes) return interaction.editReply({ embeds: [buildErrorEmbed('❌ Log non trovati.')], components: [] });
        const allLogs = logsRes.data ?? [];
        const logsPerPage = config.pagination.logsPerPage;
        let logsPage = 1;
        const logsTotal = Math.max(1, Math.ceil(allLogs.length / logsPerPage));
        await interaction.editReply({
          embeds: [buildMatchLogsEmbed(allLogs.slice(0, logsPerPage), 1, logsTotal, matchId)],
          components: [buildPaginationRow(1, logsTotal)],
        });

        const innerMsg = await interaction.fetchReply();
        await createCollector(interaction, innerMsg, config.collector.timeoutMs, async (pi) => {
          if (pi.customId === 'coralmc_page_prev') logsPage = Math.max(1, logsPage - 1);
          else if (pi.customId === 'coralmc_page_next') logsPage = Math.min(logsTotal, logsPage + 1);
          const slice = allLogs.slice((logsPage - 1) * logsPerPage, logsPage * logsPerPage);
          await pi.update({
            embeds: [buildMatchLogsEmbed(slice, logsPage, logsTotal, matchId)],
            components: [buildPaginationRow(logsPage, logsTotal)],
          });
        });
      } catch (err) {
        await interaction.editReply({ embeds: [handleApiError(err, interaction)], components: [] });
      }
    }
  });
}

// ─── /coral leaderboard ───────────────────────────────────────────────────────

async function handleLeaderboard(interaction, api) {
  const gamemode = interaction.options.getString('gamemode', true);
  const kit = interaction.options.getString('kit', false);
  const highlightUsername = interaction.options.getString('player', false);
  const perPage = config.leaderboard.entriesPerPage;

  let res;
  if (gamemode === 'bedwars') res = await api.getBedwarsLeaderboard();
  else if (gamemode === 'kitpvp') res = await api.getKitPvPLeaderboard();
  else if (gamemode === 'duels') res = await api.getDuelsLeaderboard(kit);
  else if (gamemode === 'clan') res = await api.getClanLeaderboard();

  if (!res) {
    return interaction.editReply({ embeds: [buildErrorEmbed('❌ Leaderboard non disponibile.')] });
  }

  const allEntries = res.data ?? [];
  let page = 1;
  const totalPages = Math.max(1, Math.ceil(allEntries.length / perPage));

  function payload() {
    const slice = allEntries.slice((page - 1) * perPage, page * perPage);
    return {
      embeds: [buildLeaderboardEmbed(slice, gamemode, page, totalPages, highlightUsername)],
      components: [buildPaginationRow(page, totalPages)],
    };
  }

  await interaction.editReply(payload());
  const message = await interaction.fetchReply();

  await createCollector(interaction, message, config.collector.timeoutMs, async (i) => {
    if (i.customId === 'coralmc_page_prev') page = Math.max(1, page - 1);
    else if (i.customId === 'coralmc_page_next') page = Math.min(totalPages, page + 1);
    else return;
    await i.update(payload());
  });
}

// ─── /coral clan ─────────────────────────────────────────────────────────────

async function handleClan(interaction, api) {
  const name = interaction.options.getString('name', false);
  if (!name) {
    return interaction.editReply({
      embeds: [buildErrorEmbed('📌 Usa `/coral player <nome>` per trovare le stats di un giocatore e clicca **Vai al Clan** nella pagina Bedwars.').setColor(config.colors.clan)],
      components: [],
    });
  }

  const clanRes = await api.getClan(name);
  if (!clanRes) {
    return interaction.editReply({ embeds: [buildErrorEmbed(getError('clanNotFound'))], components: [] });
  }
  const clanData = clanRes.data;
  const totalPages = Math.max(1, Math.ceil((clanData.members?.length ?? 0) / 10));
  await interaction.editReply({
    embeds: [buildClanEmbed(clanData, clanData.color ?? null, clanRes.cachedAt, 1)],
    components: totalPages > 1 ? [buildPaginationRow(1, totalPages)] : [],
  });

  if (totalPages > 1) {
    const clanMsg = await interaction.fetchReply();
    let clanPage = 1;
    await createCollector(interaction, clanMsg, config.collector.timeoutMs, async (pi) => {
      if (pi.customId === 'coralmc_page_prev') clanPage = Math.max(1, clanPage - 1);
      else if (pi.customId === 'coralmc_page_next') clanPage = Math.min(totalPages, clanPage + 1);
      else return;
      await pi.update({
        embeds: [buildClanEmbed(clanData, clanData.color ?? null, clanRes.cachedAt, clanPage)],
        components: [buildPaginationRow(clanPage, totalPages)],
      });
    });
  }
}

// ─── /coral search ────────────────────────────────────────────────────────────

async function handleSearch(interaction, api) {
  const query = interaction.options.getString('query', true);

  const results = await api.searchPlayers(query);

  if (!results || results.length === 0) {
    return interaction.editReply({
      embeds: [buildErrorEmbed(`Nessun giocatore trovato per **${query}**.`)],
    });
  }

  const top5 = results.slice(0, 5);

  await interaction.editReply({
    embeds: [buildSearchEmbed(top5, query)],
    components: [buildPlayerSelectMenu(top5)],
  });

  const message = await interaction.fetchReply();
  await createCollector(interaction, message, config.collector.timeoutMs, async (i) => {
    if (i.customId !== 'coralmc_playerselect') return;
    const targetUser = i.values[0];

    await i.deferUpdate();
    try {
      const [pRes, bRes, kRes, dRes, av] = await Promise.all([
        api.getPlayer(targetUser),
        api.getBedwars(targetUser),
        api.getKitPvP(targetUser),
        api.getDuels(targetUser),
        api.resolveAvatar(targetUser),
      ]);
      if (!pRes) {
        return interaction.editReply({ embeds: [buildErrorEmbed(getError('playerNotFound', { username: targetUser }))], components: [] });
      }
      await showPlayerProfile(interaction, api, pRes, bRes, kRes, dRes, av);
    } catch (err) {
      await interaction.editReply({ embeds: [handleApiError(err, interaction, { username: targetUser })], components: [] });
    }
  });
}

// ─── /coral cup leaderboard ───────────────────────────────────────────────────

async function handleCupLeaderboard(interaction, api) {
  const perPage = config.leaderboard.entriesPerPage;
  const res = await api.getCupLeaderboard();

  if (!res) {
    return interaction.editReply({ embeds: [buildErrorEmbed('❌ Leaderboard CoralCUP non disponibile.')] });
  }

  const allEntries = res.data?.players ?? [];
  let page = 1;
  const totalPages = Math.max(1, Math.ceil(allEntries.length / perPage));

  function payload() {
    const slice = allEntries.slice((page - 1) * perPage, page * perPage);
    return {
      embeds: [buildCupLeaderboardEmbed(slice, page, totalPages)],
      components: [buildPaginationRow(page, totalPages)],
    };
  }

  await interaction.editReply(payload());
  const message = await interaction.fetchReply();

  await createCollector(interaction, message, config.collector.timeoutMs, async (i) => {
    if (i.customId === 'coralmc_page_prev') page = Math.max(1, page - 1);
    else if (i.customId === 'coralmc_page_next') page = Math.min(totalPages, page + 1);
    else return;
    await i.update(payload());
  });
}

// ─── /coral cup team ─────────────────────────────────────────────────────────

async function handleCupTeam(interaction, api) {
  const id = interaction.options.getInteger('id', true);
  const edition = interaction.options.getInteger('edition', false);

  const res = await api.getCupTeam(id, edition);
  if (!res) {
    return interaction.editReply({ embeds: [buildErrorEmbed('❌ Team non trovato.')] });
  }

  const teamData = res.data?.team ?? res.data;
  await interaction.editReply({
    embeds: [buildCupTeamEmbed(teamData, res.cachedAt)],
    components: [],
  });
}

// ─── Autocomplete ─────────────────────────────────────────────────────────────

async function handleAutocomplete(interaction, api) {
  const focused = interaction.options.getFocused(true);
  if (focused.name !== 'username' && focused.name !== 'player') {
    return interaction.respond([]);
  }
  const input = focused.value;
  if (input.length < 3) return interaction.respond([]);

  const results = await api.searchPlayers(input);
  const choices = results.slice(0, 5).map(name => ({ name, value: name }));
  await interaction.respond(choices);
}

// ─── Main handler ─────────────────────────────────────────────────────────────

async function handleCommand(interaction, api) {
  if (!channelAllowed(interaction)) {
    return interaction.reply({
      embeds: [buildErrorEmbed(getError('channelNotAllowed'))],
      ephemeral: true,
    });
  }

  await interaction.deferReply();

  const subGroup = interaction.options.getSubcommandGroup(false);
  const sub = interaction.options.getSubcommand();

  try {
    if (sub === 'player') return await handlePlayer(interaction, api);
    if (sub === 'matches') return await handleMatches(interaction, api);
    if (sub === 'match') return await handleMatch(interaction, api);
    if (sub === 'leaderboard') return await handleLeaderboard(interaction, api);
    if (sub === 'clan') return await handleClan(interaction, api);
    if (sub === 'search') return await handleSearch(interaction, api);
    if (subGroup === 'cup' && sub === 'leaderboard') return await handleCupLeaderboard(interaction, api);
    if (subGroup === 'cup' && sub === 'team') return await handleCupTeam(interaction, api);
  } catch (err) {
    logger.error(`/coral ${subGroup ? subGroup + ' ' : ''}${sub} failed`, err);
    const context = {
      username: interaction.options.getString('player', false) ?? interaction.options.getString('username', false) ?? undefined,
      id: interaction.options.getString('id', false) ?? undefined,
    };
    await interaction.editReply({ embeds: [handleApiError(err, interaction, context)], components: [] }).catch(() => {});
  }
}

// ─── Command builder ──────────────────────────────────────────────────────────

const builder = new SlashCommandBuilder()
  .setName('coral')
  .setDescription('Statistiche CoralMC')

  .addSubcommand(sub =>
    sub.setName('player')
      .setDescription('Stats di un giocatore (Profilo, Bedwars, KitPvP, Duels)')
      .addStringOption(o =>
        o.setName('username').setDescription('Nome giocatore').setRequired(true).setAutocomplete(true)
      )
  )

  .addSubcommand(sub =>
    sub.setName('matches')
      .setDescription('Match recenti di un giocatore')
      .addStringOption(o =>
        o.setName('gamemode').setDescription('Modalità di gioco').setRequired(true)
          .addChoices(
            { name: 'Bedwars', value: 'bedwars' },
            { name: 'Duels', value: 'duels' }
          )
      )
      .addStringOption(o =>
        o.setName('player').setDescription('Nome giocatore').setRequired(true).setAutocomplete(true)
      )
  )

  .addSubcommand(sub =>
    sub.setName('match')
      .setDescription('Dettagli di una partita specifica')
      .addStringOption(o =>
        o.setName('gamemode').setDescription('Modalità di gioco').setRequired(true)
          .addChoices(
            { name: 'Bedwars', value: 'bedwars' },
            { name: 'Duels', value: 'duels' }
          )
      )
      .addStringOption(o =>
        o.setName('id').setDescription('ID della partita').setRequired(true)
      )
  )

  .addSubcommand(sub =>
    sub.setName('leaderboard')
      .setDescription('Classifica globale per gamemode')
      .addStringOption(o =>
        o.setName('gamemode').setDescription('Modalità di gioco').setRequired(true)
          .addChoices(
            { name: 'Bedwars', value: 'bedwars' },
            { name: 'KitPvP', value: 'kitpvp' },
            { name: 'Duels', value: 'duels' },
            { name: 'Clan', value: 'clan' }
          )
      )
      .addStringOption(o =>
        o.setName('kit').setDescription('Kit Duels (solo per Duels)').setRequired(false)
          .addChoices(...DUELS_KITS.map(k => ({ name: k.replace(/_/g, ' '), value: k })))
      )
      .addStringOption(o =>
        o.setName('player').setDescription('Evidenzia giocatore').setRequired(false)
      )
  )

  .addSubcommand(sub =>
    sub.setName('clan')
      .setDescription('Dettagli clan Bedwars (usa il bottone da /coral player)')
      .addStringOption(o =>
        o.setName('name').setDescription('Nome clan').setRequired(false)
      )
  )

  .addSubcommand(sub =>
    sub.setName('search')
      .setDescription('Cerca giocatori per nome')
      .addStringOption(o =>
        o.setName('query').setDescription('Query di ricerca (min 3 caratteri)').setRequired(true).setMinLength(3)
      )
  )

  .addSubcommandGroup(group =>
    group.setName('cup')
      .setDescription('CoralCUP')
      .addSubcommand(sub =>
        sub.setName('leaderboard').setDescription('Classifica CoralCUP')
      )
      .addSubcommand(sub =>
        sub.setName('team')
          .setDescription('Dettagli team CoralCUP')
          .addIntegerOption(o =>
            o.setName('id').setDescription('ID del team').setRequired(true)
          )
          .addIntegerOption(o =>
            o.setName('edition').setDescription('Edizione CoralCUP').setRequired(false)
          )
      )
  );

module.exports = { builder, handleCommand, handleAutocomplete };
