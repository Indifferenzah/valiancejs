const { EmbedBuilder } = require('discord.js');
const config = require('../config.json');

const MONTHS_IT = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];
const FOOTER_ICON = 'https://i.postimg.cc/0NZGWpJs/Logo-Crown.png';

function formatDate(ts) {
  const d = new Date(ts);
  return `${d.getDate()} ${MONTHS_IT[d.getMonth()]} ${d.getFullYear()}`;
}

function formatRelative(ts) {
  const diff = Date.now() - ts;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days} giorn${days === 1 ? 'o' : 'i'} fa`;
  if (hours > 0) return `${hours} or${hours === 1 ? 'a' : 'e'} fa`;
  if (minutes > 0) return `${minutes} min fa`;
  return 'poco fa';
}

function footerText(cachedAt) {
  if (!cachedAt) return 'Dati aggiornati ora';
  const minutes = Math.round((Date.now() - cachedAt) / 60000);
  if (minutes < 1) return 'Dati aggiornati ora';
  if (minutes === 1) return 'Dati aggiornati 1 min fa';
  return `Dati aggiornati ${minutes} min fa`;
}

function setFooter(embed, cachedAt) {
  embed.setFooter({ text: `CoralMC Stats · ${footerText(cachedAt)}`, iconURL: FOOTER_ICON });
}

function kd(kills, deaths) {
  const k = Number(kills ?? 0);
  const d = Number(deaths ?? 0);
  if (d === 0) return k.toString();
  return (k / d).toFixed(2);
}

function rankEmoji(rank) {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  return `#${rank}`;
}

function formatDuration(seconds) {
  const s = Number(seconds ?? 0);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

// ─── Player pages ─────────────────────────────────────────────────────────────

function buildProfileEmbed(playerData, avatarUrl, cachedAt) {
  const { username, lastServer, isOnline, lastSeen, joinDate, isStaff, isVip, isBanned } = playerData;

  let badges = '';
  if (isStaff) badges += ' 🌟';
  if (isVip) badges += ' 💎';
  if (isBanned) badges += ' 🔨';

  const embed = new EmbedBuilder()
    .setColor(config.colors.profile)
    .setTitle(`${username}${badges}`)
    .setThumbnail(avatarUrl)
    .setTimestamp();

  embed.addFields({
    name: 'Stato',
    value: isOnline ? `🟢 Online su ${lastServer ?? '?'}` : '🔴 Offline',
    inline: false,
  });

  if (lastSeen) {
    embed.addFields({
      name: "Visto l'ultima volta",
      value: `${formatDate(lastSeen)} (${formatRelative(lastSeen)})`,
      inline: false,
    });
  }

  if (joinDate) {
    embed.addFields({ name: 'Iscritto', value: formatDate(joinDate), inline: false });
  }

  setFooter(embed, cachedAt);
  return embed;
}

function buildBedwarsEmbed(bwData, playerData, avatarUrl, cachedAt) {
  const embed = new EmbedBuilder()
    .setColor(config.colors.bedwars)
    .setTitle(`${playerData.username} — Bedwars`)
    .setThumbnail(avatarUrl)
    .setTimestamp();

  embed.addFields(
    { name: '🏆 Level', value: String(bwData.level ?? '?'), inline: true },
    { name: '⚔️ K/D', value: kd(bwData.kills, bwData.deaths), inline: true },
    { name: '🛏️ Beds Broken', value: String(bwData.beds_broken ?? 0), inline: true },
    { name: '🎯 Final K/D', value: kd(bwData.final_kills, bwData.final_deaths), inline: true },
    { name: '📈 WL%', value: (() => { const p = Number(bwData.played ?? 0); return p > 0 ? `${(Number(bwData.wins ?? 0) / p * 100).toFixed(1)}%` : '0.0%'; })(), inline: true },
    { name: '🔥 Winstreak', value: `${bwData.winstreak ?? 0} (max: ${bwData.h_winstreak ?? 0})`, inline: true },
    { name: '🎮 Partite', value: String(bwData.played ?? 0), inline: true },
    { name: '💰 Coins', value: String(bwData.coins ?? 0), inline: true }
  );

  if (bwData.level_rank != null) {
    embed.addFields({
      name: '🏅 Rank',
      value: `#${bwData.level_rank} / ${bwData.total_players ?? '?'}`,
      inline: true,
    });
  }

  if (bwData.clan_name) {
    embed.addFields({
      name: '🛡️ Clan',
      value: `[${bwData.clan_tag ?? '?'}] ${bwData.clan_name}`,
      inline: false,
    });
  }

  setFooter(embed, cachedAt);
  return embed;
}

function buildKitPvPEmbed(kitData, playerData, avatarUrl, cachedAt) {
  const embed = new EmbedBuilder()
    .setColor(config.colors.kitpvp)
    .setTitle(`${playerData.username} — KitPvP`)
    .setThumbnail(avatarUrl)
    .setTimestamp();

  embed.addFields(
    { name: '⚔️ K/D', value: kd(kitData.overall_kills, kitData.overall_deaths), inline: true },
    { name: '🔥 Killstreak', value: `${kitData.overall_killstreak ?? 0} (max: ${kitData.overall_max_killstreak ?? 0})`, inline: true },
    { name: '💰 Balance', value: String(kitData.balance ?? 0), inline: true },
    { name: '💀 Bounty', value: `${kitData.bounty ?? 0} (max: ${kitData.max_bounty ?? 0})`, inline: true }
  );

  if (kitData.gang_name) {
    embed.addFields({
      name: '👥 Gang',
      value: `${kitData.gang_name} — ${kitData.gang_rank_name ?? '?'}`,
      inline: true,
    });
  }

  setFooter(embed, cachedAt);
  return embed;
}

function buildDuelsEmbed(duelsData, playerData, avatarUrl, selectedMode, cachedAt) {
  const embed = new EmbedBuilder()
    .setColor(config.colors.duels)
    .setTitle(`${playerData.username} — Duels`)
    .setThumbnail(avatarUrl)
    .setTimestamp();

  const gs = duelsData.globalStats ?? {};
  embed.addFields(
    { name: '🎮 Partite totali', value: String(gs.totalPlays ?? 0), inline: true },
    { name: '🏆 Vittorie', value: String(gs.totalWins ?? 0), inline: true },
    { name: '💔 Sconfitte', value: String(gs.totalLosses ?? 0), inline: true },
    { name: '⭐ Level', value: String(duelsData.level ?? '?'), inline: true },
    { name: 'XP', value: String(duelsData.xp ?? 0), inline: true }
  );

  const modeStats = duelsData.modeStats ?? {};
  const mode = selectedMode ?? _topDuelsMode(modeStats);

  if (mode && modeStats[mode]) {
    const m = modeStats[mode];
    embed.addFields(
      { name: '​', value: `**Modalità: ${mode.replace(/_/g, ' ')}**`, inline: false },
      { name: 'ELO', value: String(m.elo ?? 0), inline: true },
      { name: 'Highest ELO', value: String(m.highestElo ?? 0), inline: true },
      { name: 'Partite', value: String(m.plays ?? 0), inline: true },
      { name: 'Vittorie', value: String(m.wins ?? 0), inline: true },
      { name: 'Sconfitte', value: String(m.losses ?? 0), inline: true },
      { name: 'Streak', value: String(m.streak ?? 0), inline: true },
      { name: 'Streak max', value: String(m.longestStreak ?? 0), inline: true }
    );
  }

  setFooter(embed, cachedAt);
  return embed;
}

function _topDuelsMode(modeStats) {
  let top = null;
  let topElo = -1;
  for (const [mode, stats] of Object.entries(modeStats)) {
    if ((stats.elo ?? 0) > topElo) { topElo = stats.elo; top = mode; }
  }
  return top;
}

// ─── Leaderboard ──────────────────────────────────────────────────────────────

function buildLeaderboardEmbed(entries, gamemode, page, totalPages, highlightUsername) {
  const colorKey = gamemode === 'clan' ? 'clan' : gamemode;
  const color = config.colors[colorKey] ?? config.colors.profile;

  const lines = entries.map((e, i) => {
    const globalRank = (page - 1) * config.leaderboard.entriesPerPage + i + 1;
    const prefix = rankEmoji(globalRank);
    const isHighlight = highlightUsername && e.username === highlightUsername;
    const arrow = isHighlight ? '→ ' : '';

    let line = '';
    if (gamemode === 'bedwars') {
      line = `${arrow}${prefix} **${e.username}** · Lvl ${e.level ?? '?'} · ${e.wins ?? 0} vittorie · WL ${e.wl_percentage ?? '?'}%`;
    } else if (gamemode === 'kitpvp') {
      line = `${arrow}${prefix} **${e.username}** · ${e.kills ?? 0} kills · K/D ${e.kd_ratio ?? kd(e.kills, e.deaths)}`;
    } else if (gamemode === 'duels') {
      line = `${arrow}${prefix} **${e.username}** · ${e.wins ?? 0} vittorie`;
    } else if (gamemode === 'clan') {
      line = `${arrow}${prefix} **[${e.tag ?? '?'}] ${e.name}** · ${e.total_exp ?? 0} EXP · ${e.member_count ?? 0} membri`;
    } else {
      line = `${arrow}${prefix} **${e.username ?? e.name}**`;
    }
    return line;
  });

  const title = `🏆 Leaderboard — ${gamemode.charAt(0).toUpperCase() + gamemode.slice(1)}`;
  return new EmbedBuilder()
    .setColor(color)
    .setTitle(title)
    .setDescription(lines.join('\n') || 'Nessun dato.')
    .setFooter({ text: `Pagina ${page}/${totalPages} · CoralMC Stats`, iconURL: FOOTER_ICON })
    .setTimestamp();
}

// ─── Match embeds ─────────────────────────────────────────────────────────────

function buildMatchBedwarsEmbed(matchData) {
  const { match_id, arena_name, type_name, start_time, end_time, duration_seconds, winning_team_name, per_player_stats } = matchData;

  const embed = new EmbedBuilder()
    .setColor(config.colors.matches)
    .setTitle(`⚔️ Match Bedwars #${match_id ?? '?'}`)
    .setTimestamp();

  const headerLines = [
    `**Arena:** ${arena_name ?? '?'}`,
    `**Tipo:** ${type_name ?? '?'}`,
    start_time ? `**Inizio:** ${formatDate(start_time)}` : null,
    end_time ? `**Fine:** ${formatDate(end_time)}` : null,
    duration_seconds != null ? `**Durata:** ${formatDuration(duration_seconds)}` : null,
    winning_team_name ? `**Team vincitore:** ${winning_team_name}` : null,
  ].filter(Boolean);
  embed.setDescription(headerLines.join('\n'));

  if (Array.isArray(per_player_stats) && per_player_stats.length > 0) {
    const table = per_player_stats.map(p => {
      const outcome = p.match_outcome === 'Win' ? '✅' : '❌';
      return `**${p.team_name ?? '?'}** | ${p.username ?? '?'} | ${p.kills ?? 0}K ${p.final_kills ?? 0}FK ${p.deaths ?? 0}D | Beds: ${p.beds_broken ?? 0} | ${outcome}`;
    }).join('\n');
    embed.addFields({ name: '👥 Giocatori', value: table.slice(0, 1024), inline: false });
  }

  embed.setFooter({ text: 'CoralMC Stats', iconURL: FOOTER_ICON });
  return embed;
}

function buildMatchDuelsEmbed(matchData) {
  const { matchId, kitType, arena, startedAt, endedAt, durationSeconds, players } = matchData;

  const embed = new EmbedBuilder()
    .setColor(config.colors.matches)
    .setTitle(`🥊 Match Duels — ${kitType ?? '?'}`)
    .setTimestamp();

  const headerLines = [
    `**Match ID:** ${matchId ?? '?'}`,
    `**Arena:** ${arena ?? '?'}`,
    startedAt ? `**Inizio:** ${formatDate(startedAt)}` : null,
    endedAt ? `**Fine:** ${formatDate(endedAt)}` : null,
    durationSeconds != null ? `**Durata:** ${formatDuration(durationSeconds)}` : null,
  ].filter(Boolean);
  embed.setDescription(headerLines.join('\n'));

  if (Array.isArray(players) && players.length > 0) {
    const table = players.map(p => {
      const outcome = p.outcome === 'Win' ? '✅' : '❌';
      return `**${p.username ?? '?'}** | ${p.totalHits ?? 0} hits · combo ${p.longestCombo ?? 0} · ${p.criticalHits ?? 0} crits | pots: ${p.potionsThrown ?? 0} (mancati: ${p.missedPots ?? 0}) | bloccati: ${p.blockedHits ?? 0} | ♥ ${p.healthRemaining ?? 0} | ${outcome} | ELO ${p.elo ?? '?'}`;
    }).join('\n');
    embed.addFields({ name: '👥 Giocatori', value: table.slice(0, 1024), inline: false });
  }

  embed.setFooter({ text: 'CoralMC Stats', iconURL: FOOTER_ICON });
  return embed;
}

function buildMatchLogsEmbed(logs, page, totalPages, matchId) {
  const lines = logs.map(l => {
    const time = l.time != null ? `[${l.time}]` : '';
    const target = l.target_player_username ? ` · target: ${l.target_player_username}` : ' · target: —';
    return `${time} **${l.player_username ?? '?'}** → ${l.action_name ?? '?'}${target}`;
  });

  return new EmbedBuilder()
    .setColor(config.colors.matches)
    .setTitle(`📋 Logs — Match #${matchId}`)
    .setDescription(lines.join('\n') || 'Nessun log.')
    .setFooter({ text: `Pagina ${page}/${totalPages} · CoralMC Stats`, iconURL: FOOTER_ICON })
    .setTimestamp();
}

// ─── Matches list ─────────────────────────────────────────────────────────────

function buildMatchesListEmbed(matches, gamemode, username, page, totalPages) {
  const lines = matches.map((m, i) => {
    const globalIdx = (page - 1) * config.leaderboard.entriesPerPage + i + 1;
    if (gamemode === 'bedwars') {
      const outcome = m.match_outcome === 'Win' ? '✅' : '❌';
      return `${globalIdx}. **#${m.match_id ?? '?'}** · ${m.match_type_name ?? '?'} · ${m.arena_name ?? '?'} · ${outcome} · ${formatDuration(m.match_duration_seconds ?? 0)}`;
    } else {
      const outcome = m.outcome === 'Win' ? '✅' : m.outcome === 'Draw' ? '🤝' : '❌';
      return `${globalIdx}. **${m.matchId ?? '?'}** · ${m.kitType ?? '?'} · ${m.arena ?? '?'} · ${outcome} · vs ${m.opponent ?? '?'}`;
    }
  });

  return new EmbedBuilder()
    .setColor(config.colors.matches)
    .setTitle(`🎮 Match recenti — ${username} (${gamemode})`)
    .setDescription(lines.join('\n') || 'Nessun match trovato.')
    .setFooter({ text: `Pagina ${page}/${totalPages} · CoralMC Stats`, iconURL: FOOTER_ICON })
    .setTimestamp();
}

// ─── Clan ─────────────────────────────────────────────────────────────────────

const CLAN_ROLES = { 0: 'Membro', 1: 'Ufficiale', 2: 'Leader' };

const MEMBERS_PER_PAGE = 10;

function buildClanEmbed(clanData, clanColor, cachedAt, membersPage = 1) {
  const color = clanColor || config.colors.clan;
  const members = Array.isArray(clanData.members) ? clanData.members : [];
  const totalPages = Math.max(1, Math.ceil(members.length / MEMBERS_PER_PAGE));
  const page = Math.min(Math.max(1, membersPage), totalPages);

  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(`🛡️ Clan — [${clanData.tag ?? '?'}] ${clanData.name ?? '?'}`)
    .setTimestamp();

  embed.addFields(
    { name: '🏷️ Tag', value: clanData.tag ?? '?', inline: true },
    { name: '✨ Total EXP', value: String(clanData.total_exp ?? 0), inline: true }
  );

  if (members.length > 0) {
    const slice = members.slice((page - 1) * MEMBERS_PER_PAGE, page * MEMBERS_PER_PAGE);
    const memberLines = slice.map(m =>
      `**${m.username ?? '?'}** · ${CLAN_ROLES[m.role] ?? `Ruolo ${m.role}`} · Lvl ${m.level ?? '?'} · ${m.wins ?? 0} vittorie · ${m.kills ?? 0} kills`
    );
    embed.addFields({
      name: `👥 Membri (${members.length}) — Pagina ${page}/${totalPages}`,
      value: memberLines.join('\n'),
      inline: false,
    });
  }

  setFooter(embed, cachedAt);
  return embed;
}

// ─── Search ───────────────────────────────────────────────────────────────────

function buildSearchEmbed(results, query) {
  const embed = new EmbedBuilder()
    .setColor(config.colors.profile)
    .setTitle(`🔍 Risultati per "${query}"`)
    .setTimestamp()
    .setFooter({ text: 'CoralMC Stats', iconURL: FOOTER_ICON });

  if (!results || results.length === 0) {
    embed.setDescription(`Nessun giocatore trovato per **${query}**.`);
  } else {
    embed.setDescription(results.map(r => `• **${r}**`).join('\n'));
  }
  return embed;
}

// ─── CoralCUP ─────────────────────────────────────────────────────────────────

function buildCupLeaderboardEmbed(entries, page, totalPages) {
  const lines = entries.map((e, i) => {
    const globalRank = (page - 1) * config.leaderboard.entriesPerPage + i + 1;
    const members = (e.team_members ?? []).join(', ') || '?';
    return `${rankEmoji(globalRank)} **${members}** (Team #${e.id}) · ${e.points ?? 0} punti · ${e.games ?? 0} partite`;
  });

  return new EmbedBuilder()
    .setColor(config.colors.coralcup)
    .setTitle('🏆 CoralCUP — Leaderboard')
    .setDescription(lines.join('\n') || 'Nessun dato.')
    .setFooter({ text: `Pagina ${page}/${totalPages} · CoralMC Stats`, iconURL: FOOTER_ICON })
    .setTimestamp();
}

function buildCupTeamEmbed(teamData, cachedAt) {
  const embed = new EmbedBuilder()
    .setColor(config.colors.coralcup)
    .setTitle(`🏆 CoralCUP — Team #${teamData.id ?? '?'}`)
    .setTimestamp();

  embed.addFields(
    { name: '🏅 Punti', value: String(teamData.points ?? 0), inline: true },
    { name: '🏆 Vittorie', value: String(teamData.wins ?? 0), inline: true },
    { name: '🎮 Partite', value: String(teamData.games ?? 0), inline: true }
  );

  if (Array.isArray(teamData.players) && teamData.players.length > 0) {
    const memberLines = teamData.players.map(m =>
      `**${m.username ?? '?'}** ⭐${m.stars ?? 0} · ${m.kills ?? 0}K ${m.deaths ?? 0}D · ${m.final_kills ?? 0}FK · ${m.beds_broken ?? 0}B · K/D ${m.kd ?? '?'} · FKD ${m.fkd ?? '?'}`
    );
    embed.addFields({
      name: '👥 Giocatori',
      value: memberLines.join('\n').slice(0, 1024),
      inline: false,
    });
  }

  if (Array.isArray(teamData.matches) && teamData.matches.length > 0) {
    const matchLines = teamData.matches.slice(0, 5).map(m => {
      const outcome = m.winner_team === null ? '⏹️' : (m.team_name === m.winner_team ? '✅' : '❌');
      const date = m.start ? formatDate(new Date(m.start).getTime()) : null;
      const datePart = date ? ` · ${date}` : '';
      return `${outcome} **#${m.id ?? '?'}** · ${m.arena_name ?? '?'} · ${m.type_name ?? '?'}${datePart}`;
    });
    embed.addFields({ name: '📋 Match recenti', value: matchLines.join('\n'), inline: false });
  }

  setFooter(embed, cachedAt);
  return embed;
}

// ─── Error ────────────────────────────────────────────────────────────────────

function buildErrorEmbed(message, color = config.colors.error) {
  return new EmbedBuilder()
    .setColor(color)
    .setDescription(message)
    .setTimestamp();
}

// ─── Admin stats ──────────────────────────────────────────────────────────────

function buildAdminStatsEmbed(stats) {
  const { cache, rateLimiter, api, uptimeMs } = stats;

  const uptimeSec = Math.floor(uptimeMs / 1000);
  const hours = Math.floor(uptimeSec / 3600);
  const minutes = Math.floor((uptimeSec % 3600) / 60);
  const seconds = uptimeSec % 60;
  const uptimeStr = `${hours}h ${minutes}m ${seconds}s`;

  const embed = new EmbedBuilder()
    .setColor(config.colors.admin)
    .setTitle('📊 CoralMC — Stats Interne')
    .setTimestamp();

  embed.addFields(
    {
      name: '🗃️ Cache',
      value: `Size: **${cache.size}** · Hits: **${cache.hits}** · Misses: **${cache.misses}** · Hit rate: **${cache.hitRate}**`,
      inline: false,
    },
    {
      name: '🚦 Rate Limiter',
      value: `Enqueued: **${rateLimiter.enqueued}** · Rejected: **${rateLimiter.rejected}**`,
      inline: false,
    },
    {
      name: '🌐 API',
      value: `Richieste OK: **${api.totalRequests - api.totalErrors}** · Errori: **${api.totalErrors}**`,
      inline: false,
    },
    {
      name: '⏱️ Uptime',
      value: uptimeStr,
      inline: false,
    }
  );

  return embed;
}

module.exports = {
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
  buildErrorEmbed,
  buildAdminStatsEmbed,
};
