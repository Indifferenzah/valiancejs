const MAX_QUEUE = 50;

class RateLimiter {
  constructor(maxRequestsPerSecond) {
    this._maxRps = maxRequestsPerSecond;
    this._tokens = maxRequestsPerSecond;
    this._lastRefill = Date.now();
    this._queue = [];
    this._processing = false;
    this._enqueued = 0;
    this._rejected = 0;
  }

  _refill() {
    const now = Date.now();
    const elapsed = (now - this._lastRefill) / 1000;
    this._tokens = Math.min(this._maxRps, this._tokens + elapsed * this._maxRps);
    this._lastRefill = now;
  }

  enqueue(fn) {
    if (this._queue.length >= MAX_QUEUE) {
      this._rejected++;
      const err = new Error('Rate limit queue full');
      err.code = 'RATE_LIMIT';
      return Promise.reject(err);
    }

    return new Promise((resolve, reject) => {
      this._queue.push({ fn, resolve, reject });
      this._enqueued++;
      this._process();
    });
  }

  _process() {
    if (this._processing) return;
    this._processing = true;

    const tick = () => {
      this._refill();

      while (this._queue.length > 0 && this._tokens >= 1) {
        const { fn, resolve, reject } = this._queue.shift();
        this._tokens -= 1;
        fn().then(resolve).catch(reject);
      }

      if (this._queue.length > 0) {
        setTimeout(tick, Math.ceil(1000 / this._maxRps));
      } else {
        this._processing = false;
      }
    };

    tick();
  }

  stats() {
    return { enqueued: this._enqueued, rejected: this._rejected };
  }
}

module.exports = RateLimiter;
