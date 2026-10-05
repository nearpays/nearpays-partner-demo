import 'dotenv/config';
import { existsSync, readFileSync } from 'node:fs';

/** Settings from the environment (.env), checked once at start-up. */
function required(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing ${name}. Copy .env.example to .env and fill it in (see README).`);
    process.exit(1);
  }
  return value;
}

const keyFile = process.env.NEARPAYS_PRIVATE_KEY_FILE ?? '.keys/nearpays-private-key.json';
if (!existsSync(keyFile)) {
  console.error(`No private key at ${keyFile}. Run \`npm run keygen\` first (see README).`);
  process.exit(1);
}

const appUrl = (process.env.APP_URL ?? 'http://localhost:3000').replace(/\/+$/, '');

export const config = {
  baseUrl: required('NEARPAYS_BASE_URL'),
  clientId: required('NEARPAYS_CLIENT_ID'),
  webhookSecret: required('NEARPAYS_WEBHOOK_SECRET'),
  privateKey: JSON.parse(readFileSync(keyFile, 'utf8')),
  allowInsecureHttp: process.env.NEARPAYS_ALLOW_INSECURE_HTTP === 'true',
  appUrl,
  port: Number(process.env.PORT ?? new URL(appUrl).port ?? 3000),
  redirectPath: '/nearpays/callback',
  webhookPath: '/nearpays/webhooks',
};
