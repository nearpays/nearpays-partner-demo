import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

/**
 * A small JSON-file key-value store, used two ways:
 *  - as the SDK's `Store`, holding each customer's Nearpays connection;
 *  - for this app's own records (invoices, top-ups, webhook events).
 *
 * Good enough for one process on one machine. In production use your
 * database or Redis, encrypt the SDK's values at rest (they are secrets), and
 * implement `lock` across instances. See README → Going to production.
 */
export class FileStore {
  #path;
  #data;
  #queue = Promise.resolve();

  constructor(path) {
    this.#path = path;
    mkdirSync(dirname(path), { recursive: true });
    this.#data = existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : {};
  }

  #live(key) {
    const entry = this.#data[key];
    if (!entry) return undefined;
    if (entry.expiresAt && entry.expiresAt <= Date.now()) {
      delete this.#data[key];
      return undefined;
    }
    return entry.value;
  }

  #flush() {
    // Write to a temporary file and rename, so a crash never leaves half a file.
    const temp = `${this.#path}.tmp`;
    writeFileSync(temp, JSON.stringify(this.#data), { mode: 0o600 });
    renameSync(temp, this.#path);
  }

  async get(key) {
    return this.#live(key);
  }

  async set(key, value, ttlSeconds) {
    this.#data[key] = { value, expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : undefined };
    this.#flush();
  }

  async delete(key) {
    delete this.#data[key];
    this.#flush();
  }

  /** One holder at a time within this process. */
  lock(_key, fn) {
    const run = this.#queue.then(fn, fn);
    this.#queue = run.catch(() => undefined);
    return run;
  }

  /** Every live value whose key starts with `prefix`, for this app's own lists. */
  async list(prefix) {
    return Object.keys(this.#data)
      .filter((key) => key.startsWith(prefix))
      .map((key) => this.#live(key))
      .filter((value) => value !== undefined)
      .map((value) => JSON.parse(value));
  }
}
