class LevelMath {
  constructor(baseXp) {
    this.baseXp = Math.max(1, Number(baseXp || 100));
  }

  xpForLevel(level) {
    const lv = Math.max(0, Number(level || 0));
    return Math.floor(this.baseXp * lv ** 2);
  }

  levelFromXp(xp) {
    const safeXp = Math.max(0, Number(xp || 0));
    return Math.floor(Math.sqrt(safeXp / this.baseXp));
  }
}

module.exports = LevelMath;
