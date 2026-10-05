import { Nearpays } from '@nearpays/partner';
import { config } from './config.js';
import { FileStore } from './store.js';

/** Where the SDK keeps connections; this app keeps its own records beside them. */
export const store = new FileStore('data/store.json');

/**
 * The one Nearpays client for the whole app. It holds no per-request state,
 * so it is shared by every route.
 */
export const nearpays = new Nearpays({
  baseUrl: config.baseUrl,
  clientId: config.clientId,
  privateKey: config.privateKey,
  redirectUri: `${config.appUrl}${config.redirectPath}`,
  webhookSecret: config.webhookSecret,
  store,
  allowInsecureHttp: config.allowInsecureHttp,
});

/**
 * What this app asks each customer to approve. The customer approves all of
 * it or declines; they cannot trim it, so ask for what your service needs.
 * None of it may exceed the ceilings Nearpays set when it registered you.
 */
export const CONNECT_REQUEST = {
  balance: true,
  identity: ['email'],
  charge: { maxPerPayment: 5000, maxPerDay: 20000, maxPerMonth: 100000, maxPaymentsPerDay: 5 },
  bills: { maxPerPayment: 2000, maxPerDay: 5000, maxPerMonth: 20000, maxPaymentsPerDay: 3, channels: ['AIRTIME', 'DATA'] },
};
