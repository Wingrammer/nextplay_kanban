import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createCipheriv, randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { once } from 'node:events';

const secret = randomBytes(32);
const session = { access_token: 'private-access', refresh_token: 'private-refresh', expires_in: 3600, token_type: 'bearer', expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id: 'guest-123' } };
let guests = 0;
let refreshes = 0;
let failRefresh = false;
const mock = createServer(async (req, res) => {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const body = chunks.length ? JSON.parse(Buffer.concat(chunks)) : {};
  res.setHeader('Content-Type', 'application/json');
  if (req.url === '/auth/guest') { guests++; res.end(JSON.stringify(session)); return; }
  if (req.url === '/auth/refresh' || req.url.startsWith('/auth/v1/token?')) {
    refreshes++;
    assert.equal(body.refresh_token, session.refresh_token);
    res.statusCode = failRefresh ? 401 : 200;
    res.end(JSON.stringify(failRefresh ? { message: 'Invalid refresh token' } : session)); return;
  }
  assert.equal(req.headers.authorization, `Bearer ${session.access_token}`);
  if (req.url === '/auth/link') { res.end(JSON.stringify(session)); return; }
  if (req.url === '/tasks' && req.method === 'POST') {
    assert.equal(body.user_id, session.user.id);
    res.end(JSON.stringify(body)); return;
  }
  res.end(JSON.stringify([{ id: 'task-1', title: 'Test task' }]));
});
await new Promise(resolve => mock.listen(0, '127.0.0.1', resolve));
const backendPort = mock.address().port;
const port = 3197;
const origin = `http://localhost:${port}`;
const child = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '--port', String(port)], {
  env: { ...process.env, AUTH_SMOKE_TEST: '1', SESSION_SECRET: secret.toString('hex'), KANBAN_BACKEND_URL: `http://127.0.0.1:${backendPort}`, SUPABASE_URL: `http://127.0.0.1:${backendPort}`, SUPABASE_PUBLISHABLE_KEY: 'test-publishable-key', KANBAN_REFRESH_PATH: process.argv.includes('--supabase') ? '' : '/auth/refresh', NEXT_TELEMETRY_DISABLED: '1' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let logs = '';
child.stdout.on('data', chunk => { logs += chunk; });
child.stderr.on('data', chunk => { logs += chunk; });
let cookie = '';
async function call(path, method = 'GET', body, requestOrigin = origin) {
  const response = await fetch(origin + path, {
    method, headers: { Origin: requestOrigin, Cookie: cookie, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const set = response.headers.get('set-cookie');
  if (set) cookie = set.split(';')[0];
  const text = await response.text();
  assert.ok(!text.includes('private-access') && !text.includes('private-refresh'), 'tokens leaked');
  return { response, data: text ? JSON.parse(text) : null, set };
}
function expiredCookie() {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', secret, iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify({ ...session, expires_at: 1 })), cipher.final()]);
  return 'kanban_session=' + [iv, cipher.getAuthTag(), encrypted].map(b => b.toString('base64url')).join('.');
}
try {
  for (let i = 0; ; i++) {
    try { await fetch(origin + '/api/tasks'); break; }
    catch { if (i > 90 || child.exitCode !== null) throw new Error('Next.js did not start'); await new Promise(r => setTimeout(r, 500)); }
  }
  assert.equal((await call('/api/tasks')).response.status, 401);
  assert.equal((await call('/api/auth/guest', 'POST', undefined, 'https://other.example')).response.status, 403);
  const initial = await call('/api/auth/guest', 'POST');
  assert.equal(initial.response.status, 200);
  assert.match(initial.set, /HttpOnly/i);
  assert.match(initial.set, /SameSite=lax/i);
  assert.equal(initial.response.headers.get('cache-control'), 'no-store');
  assert.ok(!cookie.includes('private-'));
  await call('/api/auth/guest', 'POST');
  assert.equal(guests, 1);
  assert.equal((await call('/api/tasks')).response.status, 200);
  assert.equal((await call('/api/tasks/task-1')).response.status, 200);
  assert.equal((await call('/api/tasks', 'POST', { title: 'Task', user_id: 'attacker' })).data.user_id, session.user.id);
  assert.equal((await call('/api/auth/link', 'POST', { email: 'invalid', password: 'short' })).response.status, 400);
  assert.equal((await call('/api/auth/link', 'POST', { email: 'test@example.com', password: 'long-password' })).response.status, 200);
  cookie = expiredCookie();
  assert.equal((await call('/api/tasks')).response.status, 200);
  assert.equal(refreshes, 1);
  // Different refresh token avoids the process-local refresh grace cache.
  session.refresh_token = 'private-refresh-failure';
  failRefresh = true;
  cookie = expiredCookie();
  assert.equal((await call('/api/auth/guest', 'POST')).response.status, 401);
  assert.equal(guests, 1);
  cookie = 'kanban_session=tampered';
  assert.equal((await call('/api/auth/guest', 'POST')).response.status, 502);
  assert.equal(guests, 1);
  console.log('Auth smoke checks passed: guest reuse, encryption, CSRF, task ownership, linking, refresh, failure preservation, no token leakage.');
} catch (error) {
  console.error(logs);
  throw error;
} finally {
  child.kill();
  if (child.exitCode === null) await once(child, 'exit');
  await new Promise(resolve => mock.close(resolve));
}
