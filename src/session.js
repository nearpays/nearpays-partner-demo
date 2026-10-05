import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

/**
 * Demo sign-in. Your app has its own users and login; here you just pick one
 * of two people. What matters for Nearpays is that each of your users has a
 * stable id, and that id is the `customer` you pass to the SDK.
 */
export const USERS = {
  ada: { id: 'ada', name: 'Ada Obi' },
  tunde: { id: 'tunde', name: 'Tunde Bello' },
};

// Signs the cookie so it can't be edited to impersonate the other user.
// Kept in data/ (git-ignored) so a restart doesn't sign everyone out.
const SECRET_FILE = 'data/session-secret';
if (!existsSync(SECRET_FILE)) {
  mkdirSync('data', { recursive: true });
  writeFileSync(SECRET_FILE, randomBytes(32).toString('hex'), { mode: 0o600 });
}
const SECRET = readFileSync(SECRET_FILE, 'utf8');
const COOKIE = 'demo_user';

const sign = (value) => createHmac('sha256', SECRET).update(value).digest('base64url');

export function signIn(res, userId) {
  res.cookie(COOKIE, `${userId}.${sign(userId)}`, { httpOnly: true, sameSite: 'lax', path: '/' });
}

export function signOut(res) {
  res.clearCookie(COOKIE, { path: '/' });
}

/** The signed-in user, or undefined. */
export function currentUser(req) {
  const raw = (req.headers.cookie ?? '')
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${COOKIE}=`))
    ?.slice(COOKIE.length + 1);
  if (!raw) return undefined;
  const [userId, signature] = decodeURIComponent(raw).split('.');
  const expected = sign(userId ?? '');
  const ok =
    signature &&
    signature.length === expected.length &&
    timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  return ok ? USERS[userId] : undefined;
}
