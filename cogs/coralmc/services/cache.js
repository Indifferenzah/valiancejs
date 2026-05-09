class Cache {
  constructor(enabled = true) {
    this._store = new Map();
    this._enabled = enabled;
    this._hits = 0;
    this._misses = 0;
  }

  get(key) {
    if (!this._enabled) { this._misses++; return null; }
    const entry = this._store.get(key);
    if (!entry) { this._misses++; return null; }
    if (Date.now() > entry.expiresAt) {
      this._store.delete(key);
      this._misses++;
      return null;
    }
    this._hits++;
    return entry.value;
  }

  getWithMeta(key) {
    if (!this._enabled) { this._misses++; return null; }
    const entry = this._store.get(key);
    if (!entry) { this._misses++; return null; }
    if (Date.now() > entry.expiresAt) {
      this._store.delete(key);
      this._misses++;
      return null;
    }
    this._hits++;
    return { value: entry.value, cachedAt: entry.createdAt };
  }

  set(key, value, ttlSeconds) {
    if (!this._enabled) return;
    this._store.set(key, {
      value,
      createdAt: Date.now(),
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  delete(key) {
    this._store.delete(key);
  }

  clear() {
    this._store.clear();
    this._hits = 0;
    this._misses = 0;
  }

  info() {
    const total = this._hits + this._misses;
    return {
      size: this._store.size,
      hits: this._hits,
      misses: this._misses,
      hitRate: total > 0 ? ((this._hits / total) * 100).toFixed(1) + '%' : '0%',
    };
  }
}

module.exports = Cache;
