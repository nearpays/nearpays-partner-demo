/** Server-rendered pages. Everything shown is escaped. */

export const esc = (value) =>
  String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const naira = (value) =>
  value === null || value === undefined || value === '' ? '' : '₦' + Number(value).toLocaleString('en-NG', { maximumFractionDigits: 2 });

const when = (iso) => (iso ? new Date(iso).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : '');

const STATUS = {
  COMPLETED: 'ok', PAID: 'ok', CONNECTED: 'ok',
  PENDING: 'wait', PROCESSING: 'wait', UNPAID: 'wait',
  FAILED: 'bad', REFUNDED: 'bad',
};
const pill = (status) => `<span class="pill ${STATUS[status] ?? ''}">${esc(String(status).toLowerCase())}</span>`;

function layout(title, body, user) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(title)}</title>
<style>
  :root { --bg:#f6f7fb; --card:#fff; --fg:#141824; --muted:#5f6779; --line:#e4e7ef; --accent:#4f46e5; --accent-soft:#eef0ff;
          --ok:#0b7a55; --ok-soft:#e3f3ec; --wait:#9a5a00; --wait-soft:#fbf0dd; --bad:#b42318; --bad-soft:#fdecea }
  @media (prefers-color-scheme: dark) { :root { --bg:#0e1017; --card:#161925; --fg:#e8eaf2; --muted:#9aa1b5; --line:#262a3a; --accent:#8b85ff;
          --accent-soft:#1f1f3d; --ok:#36c08f; --ok-soft:#13291f; --wait:#f0b35a; --wait-soft:#2a2112; --bad:#ff8a7a; --bad-soft:#2c1714 } }
  * { box-sizing:border-box } body { margin:0; font:15px/1.5 ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif; background:var(--bg); color:var(--fg) }
  header { background:var(--card); border-bottom:1px solid var(--line) } .bar { max-width:880px; margin:0 auto; padding:14px 16px; display:flex; align-items:center; gap:12px }
  .logo { width:30px; height:30px; border-radius:8px; background:var(--accent); color:#fff; display:grid; place-items:center; font-weight:700 }
  .brand { font-weight:700 } .spacer { flex:1 } .who { color:var(--muted); font-size:14px }
  main { max-width:880px; margin:0 auto; padding:24px 16px 48px; display:grid; gap:16px }
  .grid { display:grid; gap:16px; grid-template-columns:repeat(auto-fit,minmax(300px,1fr)) }
  .card { background:var(--card); border:1px solid var(--line); border-radius:16px; padding:20px }
  h1 { font-size:22px; margin:0 } h2 { font-size:16px; margin:0 0 4px } .sub { color:var(--muted); font-size:13.5px; margin:0 0 14px }
  .row { display:flex; gap:8px; flex-wrap:wrap; align-items:center }
  button, .button { appearance:none; border:0; border-radius:10px; padding:10px 14px; font:inherit; font-weight:600; cursor:pointer; background:var(--accent); color:#fff; text-decoration:none; display:inline-block }
  button.ghost { background:transparent; color:var(--fg); border:1px solid var(--line) } button.small { padding:6px 10px; font-size:13px }
  button:disabled { opacity:.45; cursor:not-allowed }
  input, select { font:inherit; padding:9px 11px; border:1px solid var(--line); border-radius:10px; background:var(--bg); color:var(--fg); min-width:0 }
  form.inline { display:flex; gap:8px; flex-wrap:wrap } form.inline input { flex:1 1 120px }
  table { width:100%; border-collapse:collapse; font-size:14px } td, th { text-align:left; padding:8px 4px; border-top:1px solid var(--line); vertical-align:top } th { color:var(--muted); font-weight:600; font-size:12.5px }
  .pill { display:inline-block; padding:2px 8px; border-radius:999px; font-size:12px; font-weight:600; background:var(--line); color:var(--muted) }
  .pill.ok { background:var(--ok-soft); color:var(--ok) } .pill.wait { background:var(--wait-soft); color:var(--wait) } .pill.bad { background:var(--bad-soft); color:var(--bad) }
  .flash { padding:12px 14px; border-radius:12px; font-size:14px } .flash.ok { background:var(--ok-soft); color:var(--ok) } .flash.bad { background:var(--bad-soft); color:var(--bad) }
  .big { font-size:28px; font-weight:700; letter-spacing:-.02em } .muted { color:var(--muted); font-size:13.5px } .empty { color:var(--muted); font-size:14px; padding:6px 0 }
  code { font:12.5px ui-monospace,SFMono-Regular,Menlo,monospace; background:var(--bg); padding:1px 5px; border-radius:5px }
  ul.plain { margin:6px 0 0; padding-left:18px; color:var(--muted); font-size:14px }
  .users { display:grid; gap:10px; max-width:360px; margin:48px auto } .users button { width:100%; text-align:left; padding:14px 16px }
</style></head><body>
<header><div class="bar"><div class="logo">P</div><div class="brand">Partner Demo</div><div class="spacer"></div>
${user ? `<span class="who">${esc(user.name)}</span><form method="post" action="/sign-out"><button class="ghost small">Sign out</button></form>` : ''}
</div></header>
<main>${body}</main></body></html>`;
}

export function signInPage(users) {
  return layout(
    'Sign in · Partner Demo',
    `<div class="users card"><h1>Sign in</h1>
    <p class="sub">This stands in for your own app's login. Pick a demo user; each one connects their own Nearpays account.</p>
    ${Object.values(users)
      .map((u) => `<form method="post" action="/sign-in"><input type="hidden" name="user" value="${esc(u.id)}"><button class="ghost">${esc(u.name)}</button></form>`)
      .join('')}</div>`,
  );
}

export function dashboardPage({ user, flash, connection, balance, invoices, topups, events }) {
  const flashBox = flash ? `<div class="flash ${flash.ok ? 'ok' : 'bad'}">${esc(flash.message)}</div>` : '';

  const nearpaysCard = connection
    ? `<div class="card"><div class="row"><h2>Nearpays</h2>${pill('CONNECTED')}</div>
        <p class="sub">Connected ${esc(when(connection.connectedAt))} as ${esc(connection.name ?? 'your account')}.</p>
        ${balance
          ? `<div class="big">${esc(naira(balance.balance))}</div><p class="muted">Wallet balance${balance.locked && Number(balance.locked) ? `, ${esc(naira(balance.locked))} on hold` : ''}</p>`
          : `<p class="muted">Balance unavailable right now.</p>`}
        <ul class="plain">${(connection.scopes ?? []).map((s) => `<li><code>${esc(s)}</code></li>`).join('')}</ul>
        <form method="post" action="/disconnect" style="margin-top:14px"><button class="ghost">Disconnect Nearpays</button></form></div>`
    : `<div class="card"><h2>Nearpays</h2>
        <p class="sub">Connect your Nearpays wallet to pay invoices and buy airtime from it. You'll approve once, on Nearpays, with your PIN.</p>
        <ul class="plain"><li>Charges up to ₦5,000 a payment, ₦20,000 a day</li><li>Airtime and data up to ₦2,000 a payment</li><li>See your balance and email</li></ul>
        <form method="post" action="/connect" style="margin-top:14px"><button>Connect Nearpays</button></form></div>`;

  const disabled = connection ? '' : 'disabled';
  const invoiceRows = invoices.length
    ? `<table><tr><th>Invoice</th><th>Amount</th><th>Status</th><th></th></tr>${invoices
        .map((i) => `<tr><td><code>${esc(i.id)}</code><div class="muted">${esc(when(i.createdAt))}</div></td><td>${esc(naira(i.amount))}</td><td>${pill(i.status)}${i.error ? `<div class="muted">${esc(i.error)}</div>` : ''}</td>
          <td>${i.status !== 'PAID' ? `<form method="post" action="/invoices/${esc(i.id)}/pay"><button class="small ghost" ${disabled}>${i.status === 'UNPAID' ? 'Pay' : 'Retry'}</button></form>` : ''}</td></tr>`)
        .join('')}</table>`
    : '<p class="empty">No invoices yet.</p>';

  const topupRows = topups.length
    ? `<table><tr><th>Top-up</th><th>Amount</th><th>Status</th></tr>${topups
        .map((t) => `<tr><td>${esc(t.network)} · ${esc(t.phone)}<div class="muted">${esc(when(t.createdAt))}</div></td><td>${esc(naira(t.amount))}</td><td>${pill(t.status)}${t.error ? `<div class="muted">${esc(t.error)}</div>` : ''}</td></tr>`)
        .join('')}</table>`
    : '<p class="empty">No top-ups yet.</p>';

  const eventRows = events.length
    ? `<table>${events
        .map((e) => `<tr><td><code>${esc(e.type)}</code><div class="muted">${esc(when(e.receivedAt))}</div></td><td class="muted">${esc(e.summary)}</td></tr>`)
        .join('')}</table>`
    : '<p class="empty">Webhooks from Nearpays show up here.</p>';

  return layout(
    'Partner Demo',
    `${flashBox}
    <div class="grid">${nearpaysCard}
      <div class="card"><h2>Pro plan</h2><p class="sub">₦500 a month, paid from your Nearpays wallet.</p>
        <form method="post" action="/invoices"><button ${disabled}>Pay ₦500 now</button></form>
        <div style="margin-top:14px">${invoiceRows}</div></div>
    </div>
    <div class="card"><h2>Buy airtime</h2><p class="sub">Paid from your Nearpays wallet, within the limits you approved.</p>
      <form class="inline" method="post" action="/airtime">
        <select name="network"><option>MTN</option><option>Airtel</option><option>Glo</option><option>9mobile</option></select>
        <input name="phone" placeholder="Phone number" required inputmode="tel" value="08030000000">
        <input name="amount" placeholder="Amount (₦)" required inputmode="numeric" value="100">
        <button ${disabled}>Buy airtime</button>
      </form>
      <div style="margin-top:14px">${topupRows}</div></div>
    <div class="card"><h2>Webhooks</h2><p class="sub">Signed events Nearpays sent to <code>/nearpays/webhooks</code>, newest first.</p>${eventRows}</div>`,
    user,
  );
}
