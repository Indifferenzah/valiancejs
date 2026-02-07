const { loadJsonSync, saveJsonSync } = require("../../../utils/jsonStore");

class BlacklistService {
  constructor(blacklistPath) {
    this.blacklistPath = blacklistPath;
    this.blacklist = loadJsonSync(this.blacklistPath, []);
  }

  isBlacklisted(userId) {
    return this.blacklist.includes(userId);
  }

  add(userId) {
    if (this.isBlacklisted(userId)) return false;
    this.blacklist.push(userId);
    this.save();
    return true;
  }

  remove(userId) {
    const index = this.blacklist.indexOf(userId);
    if (index === -1) return false;
    this.blacklist.splice(index, 1);
    this.save();
    return true;
  }

  toggle(userId) {
    if (this.isBlacklisted(userId)) {
      this.remove(userId);
      return false;
    }
    this.add(userId);
    return true;
  }

  save() {
    saveJsonSync(this.blacklistPath, this.blacklist);
  }
}

module.exports = BlacklistService;
