const Cache = require('./cache');
const RateLimiter = require('./ratelimiter');
const logger = require('./logger');

const MCHEADS_BASE = 'https://mc-heads.net/avatar';
const FETCH_TIMEOUT_MS = 10000;

class CoralMCApi {
  constructor(config) {
    this._config = config;
    this._cache = new Cache(config.cache.enabled);
    this._rateLimiter = new RateLimiter(config.rateLimit.maxRequestsPerSecond);
    this.totalRequests = 0;
    this.totalErrors = 0;
    this.loadedAt = Date.now();
  }

  get cache() { return this._cache; }
  get rateLimiter() { return this._rateLimiter; }

  async _fetch(endpoint, queryString = '') {
    const cacheKey = `coralmc:${endpoint}:${encodeURIComponent(queryString)}`;
    const cached = this._cache.getWithMeta(cacheKey);
    if (cached) return { data: cached.value, cachedAt: cached.cachedAt };

    return this._rateLimiter.enqueue(async () => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
      const url = `${this._config.baseUrl}${endpoint}${queryString ? '?' + queryString : ''}`;

      try {
        this.totalRequests++;
        const res = await fetch(url, {
          signal: controller.signal,
          headers: { 'X-Contact': this._config.contact },
        });

        if (res.status === 404) return null;

        if (!res.ok) {
          this.totalErrors++;
          const err = new Error(`HTTP ${res.status}`);
          err.status = res.status;
          throw err;
        }

        const data = await res.json();
        const cachedAt = Date.now();
        this._cache.set(cacheKey, data, this._config.cache.ttlSeconds);
        return { data, cachedAt };
      } catch (err) {
        if (err.name === 'AbortError') {
          this.totalErrors++;
          const te = new Error('Request timed out');
          te.code = 'TIMEOUT';
          throw te;
        }
        throw err;
      } finally {
        clearTimeout(timer);
      }
    });
  }

  async resolveAvatar(username) {
    const safe = encodeURIComponent(username);
    return `${MCHEADS_BASE}/${safe}/64`;
  }

  async searchPlayers(input) {
    if (input.length < 3) return [];
    try {
      const result = await this._fetch(`/stats/search/${encodeURIComponent(input)}`);
      return result?.data ?? [];
    } catch {
      return [];
    }
  }

  async getPlayer(username) {
    return this._fetch(`/stats/player/${encodeURIComponent(username)}`);
  }

  async getBedwars(username) {
    return this._fetch(`/stats/bedwars/${encodeURIComponent(username)}`);
  }

  async getBedwarsMatches(username) {
    return this._fetch(`/stats/bedwars/${encodeURIComponent(username)}/matches`);
  }

  async getBedwarsMatch(id, edition) {
    return this._fetch(`/stats/bedwars/match/${encodeURIComponent(id)}`, edition ? `edition=${encodeURIComponent(edition)}` : '');
  }

  async getBedwarsMatchLogs(id, edition) {
    return this._fetch(`/stats/bedwars/match/${encodeURIComponent(id)}/logs`, edition ? `edition=${encodeURIComponent(edition)}` : '');
  }

  async getBedwarsLeaderboard() {
    return this._fetch('/stats/bedwars/leaderboard');
  }

  async getClan(name) {
    return this._fetch(`/stats/bedwars/clans/${encodeURIComponent(name)}`);
  }

  async getClanLeaderboard() {
    return this._fetch('/stats/bedwars/clans/leaderboard');
  }

  async getKitPvP(username) {
    return this._fetch(`/stats/kitpvp/${encodeURIComponent(username)}`);
  }

  async getKitPvPLeaderboard() {
    return this._fetch('/stats/kitpvp/leaderboard');
  }

  async getDuels(username) {
    return this._fetch(`/stats/duels/${encodeURIComponent(username)}`);
  }

  async getDuelsMatches(username) {
    return this._fetch(`/stats/duels/${encodeURIComponent(username)}/matches`);
  }

  async getDuelsMatch(matchId) {
    return this._fetch(`/stats/duels/match/${encodeURIComponent(matchId)}`);
  }

  async getDuelsLeaderboard(kit) {
    return this._fetch('/stats/duels/leaderboard', kit ? `gamemode=${encodeURIComponent(kit)}` : '');
  }

  async getCupLeaderboard(edition) {
    return this._fetch('/stats/coralcup/full-lead', edition ? `edition=${encodeURIComponent(edition)}` : '');
  }

  async getCupTeam(id, edition) {
    return this._fetch(`/stats/coralcup/team/${encodeURIComponent(id)}`, edition ? `edition=${encodeURIComponent(edition)}` : '');
  }

  apiStats() {
    return {
      totalRequests: this.totalRequests,
      totalErrors: this.totalErrors,
    };
  }
}

module.exports = CoralMCApi;
