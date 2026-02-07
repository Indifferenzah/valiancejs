class RewardService {
  constructor(configManager, logger) {
    this.configManager = configManager;
    this.logger = logger;
  }

  async applyRoleRewards(guild, member, newLevel) {
    try {
      if (!guild || !member) return;

      const mapping = this.configManager.getRoleLevels() || {};
      const roleId = mapping[String(newLevel)];
      if (!roleId) return;

      const role = guild.roles.cache.get(roleId);
      if (!role) return;

      if (!member.roles.cache.has(role.id)) {
        await member.roles.add(role, `Level reward: reached level ${newLevel}`);
        this.logger?.info?.(
          `[leveling] Added reward role ${role.id} to ${member.user.id} at level ${newLevel}`,
        );
      }
    } catch (error) {
      this.logger?.error?.(
        `[leveling] applyRoleRewards error: ${error?.message || error}`,
      );
    }
  }
}

module.exports = RewardService;
