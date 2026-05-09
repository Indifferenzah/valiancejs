const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} = require('discord.js');

const PAGE_IDS = {
  profile: 'coralmc_page_profile',
  bedwars: 'coralmc_page_bedwars',
  kitpvp: 'coralmc_page_kitpvp',
  duels: 'coralmc_page_duels',
};

function buildPlayerPageButtons(activePage) {
  const pages = [
    { id: PAGE_IDS.profile, label: '👤 Profilo' },
    { id: PAGE_IDS.bedwars, label: '⚔️ Bedwars' },
    { id: PAGE_IDS.kitpvp, label: '🗡️ KitPvP' },
    { id: PAGE_IDS.duels, label: '🥊 Duels' },
  ];

  const row = new ActionRowBuilder();
  for (const page of pages) {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(page.id)
        .setLabel(page.label)
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(activePage === page.id.replace('coralmc_page_', ''))
    );
  }
  return row;
}

function buildDuelsModeSelect(modeStats, selectedMode) {
  const keys = Object.keys(modeStats);
  const options = keys.slice(0, 25).map(mode =>
    new StringSelectMenuOptionBuilder()
      .setLabel(mode.replace(/_/g, ' '))
      .setValue(mode)
      .setDefault(mode === selectedMode)
  );

  const select = new StringSelectMenuBuilder()
    .setCustomId('coralmc_duels_mode')
    .setPlaceholder('Seleziona modalità')
    .addOptions(options);

  return new ActionRowBuilder().addComponents(select);
}

function buildPaginationRow(page, totalPages) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('coralmc_page_prev')
      .setLabel('◀')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page <= 1),
    new ButtonBuilder()
      .setCustomId('coralmc_page_info')
      .setLabel(`Pagina ${page}/${totalPages}`)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true),
    new ButtonBuilder()
      .setCustomId('coralmc_page_next')
      .setLabel('▶')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page >= totalPages)
  );
}

function buildMatchDetailButton(gamemode, matchId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`coralmc_matchdetail_${gamemode}_${matchId}`)
      .setLabel('🔍 Dettagli')
      .setStyle(ButtonStyle.Primary)
  );
}

function buildViewLogsButton(matchId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`coralmc_matchlogs_${matchId}`)
      .setLabel('📋 Vedi Logs')
      .setStyle(ButtonStyle.Secondary)
  );
}

function buildClanButton(clanName) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`coralmc_clan_${clanName}`)
      .setLabel('🛡️ Vai al Clan')
      .setStyle(ButtonStyle.Success)
  );
}

function buildProfileButton(username) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`coralmc_viewprofile_${username}`)
      .setLabel('👤 Vedi Profilo')
      .setStyle(ButtonStyle.Primary)
  );
}

function buildPlayerSelectMenu(usernames) {
  const options = usernames.slice(0, 25).map(name =>
    new StringSelectMenuOptionBuilder()
      .setLabel(name)
      .setValue(name)
      .setEmoji('👤')
  );
  const select = new StringSelectMenuBuilder()
    .setCustomId('coralmc_playerselect')
    .setPlaceholder('Seleziona un giocatore…')
    .addOptions(options);
  return new ActionRowBuilder().addComponents(select);
}

function buildMatchSelectMenu(matches, gamemode) {
  const formatDur = (s) => {
    const sec = Number(s ?? 0);
    return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
  };

  const options = matches.slice(0, 25).map(m => {
    let label, value;
    if (gamemode === 'bedwars') {
      const id = m.match_id ?? m.id ?? '?';
      const outcome = m.match_outcome === 'Win' ? '✅' : '❌';
      label = `#${id} · ${m.match_type_name ?? '?'} · ${outcome} · ${formatDur(m.match_duration_seconds)}`;
      value = `bedwars|${id}`;
    } else {
      const id = m.matchId ?? m.id ?? '?';
      const outcome = m.outcome === 'Win' ? '✅' : m.outcome === 'Draw' ? '🤝' : '❌';
      label = `${id} · ${m.kitType ?? '?'} · ${outcome} · vs ${m.opponent ?? '?'}`;
      value = `duels|${id}`;
    }
    return new StringSelectMenuOptionBuilder()
      .setLabel(label.slice(0, 100))
      .setValue(String(value).slice(0, 100));
  });

  const select = new StringSelectMenuBuilder()
    .setCustomId('coralmc_matchselect')
    .setPlaceholder('Seleziona un match per i dettagli…')
    .addOptions(options);
  return new ActionRowBuilder().addComponents(select);
}

function disableAllComponents(rows) {
  return rows.map(row => {
    const newRow = ActionRowBuilder.from(row);
    newRow.components.forEach(c => {
      if (typeof c.setDisabled === 'function') c.setDisabled(true);
    });
    return newRow;
  });
}

module.exports = {
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
  PAGE_IDS,
};
