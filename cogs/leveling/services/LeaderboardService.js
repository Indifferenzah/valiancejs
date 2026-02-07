class LeaderboardService {
  constructor(dataStore) {
    this.dataStore = dataStore;
  }

  getTop(guildId, limit) {
    const guildData = this.dataStore.getGuildData(guildId);

    return Object.entries(guildData)
      .map(([userId, v]) => ({
        userId,
        xp: Number(v.xp || 0),
        level: Number(v.level || 0),
      }))
      .sort((a, b) => b.xp - a.xp)
      .slice(0, limit);
  }
}

module.exports = LeaderboardService;
