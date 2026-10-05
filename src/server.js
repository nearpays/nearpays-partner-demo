import express from 'express';
import { randomUUID } from 'node:crypto';
import { NearpaysError, NotConnectedError } from '@nearpays/partner';
import { config } from './config.js';
import { CONNECT_REQUEST, nearpays, store } from './nearpays.js';
import { currentUser, signIn, signOut, USERS } from './session.js';
import { dashboardPage, signInPage } from './views.js';

const app = express();

// ── Records this app keeps for itself ───────────────────────────────────────
// Your app would use its own database tables for these.
const save = (kind, record) => store.set(`app:${kind}:${record.userId ?? 'all'}:${record.id}`, JSON.stringify(record));
const list = async (kind, userId) =>
  (await store.list(`app:${kind}:${userId}:`)).sort((a, b) => (b.createdAt ?? b.receivedAt).localeCompare(a.createdAt ?? a.receivedAt));
const find = async (kind, userId, id) => {
  const raw = await store.get(`app:${kind}:${userId}:${id}`);
  return raw ? JSON.parse(raw) : undefined;
};
const profileKey = (userId) => `app:profile:${userId}`;

/** A one-time message for the next page view. */
const flashes = new Map();
const flash = (user, ok, message) => flashes.set(user.id, { ok, message });

/** Turns an SDK error into words for the user. */
function explain(error) {
  if (error instanceof NotConnectedError) return 'Your Nearpays connection has ended. Connect again to continue.';
  if (error instanceof NearpaysError) {
    if (error.code === 'mandate_limit_exceeded' && error.headroom) {
      return `That's over the limit you approved. Left today: ₦${error.headroom.today}, this month: ₦${error.headroom.thisMonth}.`;
    }
    if (error.code === 'mandate_unavailable') return 'Payments from Nearpays are paused for this connection. Resume them in the Nearpays app.';
    if (error.code === 'access_denied') return 'You declined the connection on Nearpays.';
    if (error.code === 'timeout') return 'Nearpays is taking a while. This updates when it confirms; paying again never charges twice.';
    return error.message;
  }
  return 'Something went wrong. Please try again.';
}

// ── Webhooks: mounted before the body parsers, because the signature check
// needs the raw body exactly as it arrived. ────────────────────────────────
const record = (event, summary) =>
  save('event', { id: event.id, userId: event.customer ?? 'unknown', type: event.type, summary, receivedAt: new Date().toISOString() });

app.post(
  config.webhookPath,
  express.raw({ type: 'application/json' }),
  nearpays.webhooks.express({
    'charge.completed': async (event) => {
      await settle('invoice', event.customer, event.data.reference, { status: 'PAID', error: null });
      await record(event, `${event.data.amount} charged for ${event.data.reference}`);
    },
    'charge.failed': async (event) => {
      await settle('invoice', event.customer, event.data.reference, { status: 'FAILED', error: event.data.failure?.message });
      await record(event, `Charge for ${event.data.reference} failed: ${event.data.failure?.code}`);
    },
    'bill.completed': async (event) => {
      await settle('topup', event.customer, event.data.reference, { status: 'COMPLETED' });
      await record(event, `Top-up ${event.data.reference} delivered`);
    },
    'bill.failed': async (event) => {
      await settle('topup', event.customer, event.data.reference, { status: 'FAILED', error: event.data.failure?.message });
      await record(event, `Top-up ${event.data.reference} failed`);
    },
    'bill.refunded': async (event) => {
      await settle('topup', event.customer, event.data.reference, { status: 'REFUNDED' });
      await record(event, `Top-up ${event.data.reference} refunded to the wallet`);
    },
    // The SDK has already forgotten the connection by the time this runs.
    'grant.revoked': (event) => record(event, `Connection ended (${event.data.reason})`),
    '*': (event) => record(event, 'Received'),
  }),
);

/** Updates one of this app's records from a webhook, found by its reference. */
async function settle(kind, userId, reference, changes) {
  if (!userId || !reference) return;
  const existing = await find(kind, userId, reference);
  if (existing) await save(kind, { ...existing, ...changes, updatedAt: new Date().toISOString() });
}

app.use(express.urlencoded({ extended: false }));

// ── Demo sign-in (stands in for your own login) ─────────────────────────────
app.post('/sign-in', (req, res) => {
  if (USERS[req.body.user]) signIn(res, req.body.user);
  res.redirect('/');
});
app.post('/sign-out', (_req, res) => {
  signOut(res);
  res.redirect('/');
});

const requireUser = (req, res, next) => {
  const user = currentUser(req);
  if (!user) return res.redirect('/');
  req.user = user;
  next();
};

// ── Connecting Nearpays ─────────────────────────────────────────────────────
app.post('/connect', requireUser, async (req, res) => {
  try {
    // The customer is your own user id: every later call names them by it.
    const { url } = await nearpays.connect({ customer: req.user.id, ...CONNECT_REQUEST });
    res.redirect(url);
  } catch (error) {
    flash(req.user, false, explain(error));
    res.redirect('/');
  }
});

// Nearpays sends the customer back here after they approve or decline.
app.get(config.redirectPath, requireUser, async (req, res) => {
  try {
    const connection = await nearpays.finish(req.originalUrl);
    if (connection.customer !== req.user.id) {
      // Someone else's sign-in landed in this browser: not ours to keep.
      await nearpays.disconnect(connection.customer);
      throw new Error('This connection was started by another user.');
    }
    await store.set(
      profileKey(req.user.id),
      JSON.stringify({ name: connection.profile.name, connectedAt: new Date().toISOString() }),
    );
    flash(req.user, true, 'Nearpays connected.');
  } catch (error) {
    flash(req.user, false, explain(error));
  }
  res.redirect('/');
});

app.post('/disconnect', requireUser, async (req, res) => {
  try {
    await nearpays.disconnect(req.user.id);
    flash(req.user, true, 'Nearpays disconnected.');
  } catch (error) {
    flash(req.user, false, explain(error));
  }
  res.redirect('/');
});

// ── Charging: an invoice paid from the customer's wallet ────────────────────
app.post('/invoices', requireUser, async (req, res) => {
  const invoice = { id: `inv_${randomUUID().slice(0, 8)}`, userId: req.user.id, amount: '500', status: 'UNPAID', createdAt: new Date().toISOString() };
  await save('invoice', invoice);
  await pay(req.user, invoice);
  res.redirect('/');
});

app.post('/invoices/:id/pay', requireUser, async (req, res) => {
  const invoice = await find('invoice', req.user.id, req.params.id);
  if (invoice && invoice.status !== 'PAID') await pay(req.user, invoice);
  res.redirect('/');
});

/**
 * The invoice id is the charge's `reference`. Paying again, whether a retry
 * after a timeout or a double click, sends the same reference, so the SDK
 * sends the same Idempotency-Key and Nearpays never charges twice.
 */
async function pay(user, invoice) {
  try {
    const charge = await nearpays.charges.create(user.id, {
      amount: invoice.amount,
      reference: invoice.id,
      description: 'Partner Demo Pro plan',
    });
    const status = charge.status === 'COMPLETED' ? 'PAID' : charge.status;
    await save('invoice', { ...invoice, status, chargeId: charge.id, error: null });
    flash(user, true, charge.replayed ? `${invoice.id} was already paid; nothing was charged twice.` : `Paid ${invoice.id}.`);
  } catch (error) {
    // A timeout isn't a failure: the charge may still go through, and the
    // webhook will say. Paying again sends the same reference.
    const status = error.code === 'timeout' ? 'PROCESSING' : 'FAILED';
    await save('invoice', { ...invoice, status, error: explain(error) });
    flash(user, false, explain(error));
  }
}

// ── Paying a bill: airtime ──────────────────────────────────────────────────
app.post('/airtime', requireUser, async (req, res) => {
  const topup = {
    id: `top_${randomUUID().slice(0, 8)}`,
    userId: req.user.id,
    network: req.body.network,
    // Nearpays takes phone numbers in +234 form.
    phone: String(req.body.phone ?? '').trim().replace(/^0(?=\d{10}$)/, '+234'),
    amount: String(Number(req.body.amount) || 0),
    status: 'PROCESSING',
    createdAt: new Date().toISOString(),
  };
  await save('topup', topup);
  try {
    // Finds the network by name, validates the number, then pays.
    const { payment } = await nearpays.bills.buy(req.user.id, {
      channel: 'AIRTIME',
      category: topup.network,
      customerId: topup.phone,
      amount: Number(topup.amount),
      reference: topup.id,
    });
    await save('topup', { ...topup, status: payment.status, billPaymentId: payment.id });
    flash(
      req.user,
      payment.status !== 'FAILED',
      payment.status === 'PENDING' ? 'Top-up sent. Waiting for the network to confirm.' : `Top-up ${payment.status.toLowerCase()}.`,
    );
  } catch (error) {
    // A timeout isn't a failure: the top-up may still go through, and the
    // webhook will say.
    const status = error.code === 'timeout' ? 'PROCESSING' : 'FAILED';
    // Webhooks can arrive before this answer does; keep what they settled.
    const latest = (await find('topup', topup.userId, topup.id)) ?? topup;
    const settled = ['COMPLETED', 'REFUNDED'].includes(latest.status);
    await save('topup', { ...latest, status: settled ? latest.status : status, error: explain(error) });
    flash(req.user, false, explain(error));
  }
  res.redirect('/');
});

// ── The dashboard ───────────────────────────────────────────────────────────
app.get('/', async (req, res) => {
  const user = currentUser(req);
  if (!user) return res.send(signInPage(USERS));

  let connection = null;
  let balance = null;
  if (await nearpays.isConnected(user.id)) {
    const profile = JSON.parse((await store.get(profileKey(user.id))) ?? '{}');
    try {
      // Both calls refresh the access token by themselves when it is due.
      const [info, balances] = await Promise.all([nearpays.connection(user.id), nearpays.balance(user.id)]);
      connection = { ...profile, scopes: info.scopes };
      balance = balances.find((b) => b.currency === 'NGN') ?? balances[0] ?? null;
    } catch (error) {
      if (!(error instanceof NotConnectedError)) connection = { ...profile, scopes: [] };
    }
  }

  const message = flashes.get(user.id);
  flashes.delete(user.id);
  res.send(
    dashboardPage({
      user,
      flash: message,
      connection,
      balance,
      invoices: await list('invoice', user.id),
      topups: await list('topup', user.id),
      events: (await list('event', user.id)).slice(0, 10),
    }),
  );
});

app.listen(config.port, () => {
  console.log(`Partner Demo on ${config.appUrl}`);
  console.log(`  redirect URI  ${config.appUrl}${config.redirectPath}`);
  console.log(`  webhook URL   ${config.appUrl}${config.webhookPath}`);
  console.log(`  Nearpays API  ${config.baseUrl}`);
});
