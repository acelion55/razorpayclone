import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { runMigrations } from '../packages/db/src/migrate.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const PORT = Number(process.env.PORT || 10000);
const API_PORT = Number(process.env.PAYMENT_API_PORT || 6100);

const resolvedPublicUrl = (
  process.env.RAZORPAY_PUBLIC_URL
  || process.env.RENDER_EXTERNAL_URL
  || (process.env.RENDER_EXTERNAL_HOSTNAME ? `https://${process.env.RENDER_EXTERNAL_HOSTNAME}` : '')
).trim().replace(/\/+$/, '');

if (!resolvedPublicUrl) {
  console.error('\n[render] FATAL: Could not determine the public URL.');
  console.error('[render] Set RAZORPAY_PUBLIC_URL (e.g. https://razorpay.onrender.com).\n');
  process.exit(1);
}

process.env.RAZORPAY_PUBLIC_URL = resolvedPublicUrl;
process.env.BASE_CHECKOUT_URL = resolvedPublicUrl;
process.env.BASE_PAYMENT_API_URL = `http://127.0.0.1:${API_PORT}`;
process.env.PAYMENT_API_PORT = String(API_PORT);
process.env.CHECKOUT_PORTAL_PORT = String(PORT);

console.log('====================================================');
console.log('🚀 RAZORPAY V2 — Single-URL (Render) Gateway');
console.log('====================================================');
console.log(`[✓] Public URL    : ${resolvedPublicUrl}`);
console.log(`[✓] Checkout/API  : 0.0.0.0:${PORT}  (checkout portal, /api proxied internally)`);
console.log(`[✓] Internal API  : 127.0.0.1:${API_PORT}\n`);

console.log('[1/2] Running database migrations...');
try {
  runMigrations();
  console.log('[✓] Database ready.\n');
} catch (err) {
  console.error('[render] Migration failed:', err?.message || err);
  process.exit(1);
}

const children = [];
let shuttingDown = false;

function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    if (child && child.pid && child.exitCode === null) {
      try { child.kill('SIGTERM'); } catch {}
    }
  }
  setTimeout(() => process.exit(code), 300);
}

function launch(name, scriptRelPath) {
  const scriptPath = path.join(rootDir, scriptRelPath);
  const child = spawn(process.execPath, [scriptPath], {
    stdio: 'inherit',
    env: process.env,
    cwd: rootDir
  });
  child.on('exit', (code, signal) => {
    if (shuttingDown) return;
    console.error(`[render] Service "${name}" exited (code=${code}, signal=${signal}). Shutting down.`);
    shutdown(code ?? 1);
  });
  child.on('error', (err) => {
    console.error(`[render] Failed to start "${name}":`, err.message);
    shutdown(1);
  });
  children.push(child);
  console.log(`[render] Started "${name}" (pid ${child.pid}) -> ${scriptRelPath}`);
  return child;
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

console.log('[2/2] Starting services...');
launch('payment-api', 'apps/payment-api/src/index.js');
launch('checkout-portal', 'apps/checkout-portal/src/index.js');

console.log('\n🟢 RAZORPAY V2 ONLINE (single-URL mode).');
console.log('Press Ctrl+C to stop all services gracefully.');
