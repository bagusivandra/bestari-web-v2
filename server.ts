/// <reference types="node" />
import 'dotenv/config';
import express from 'express';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GoogleGenAI } from '@google/genai';
import type {
  ActivityLogItem,
  AddOnItem,
  BookingRequest,
  ClientBooking,
  DriveConfigSettings,
  MessageTemplates,
  PackagePlan,
  SystemNotification,
  Transaction
} from './src/types/index.ts';
import { INITIAL_ADDONS, INITIAL_PACKAGES } from './src/services/mockData.ts';
import firebaseConfig from './firebase-applet-config.json' with { type: 'json' };

interface PersistedBestariState {
  clients: ClientBooking[];
  requests: BookingRequest[];
  transactions: Transaction[];
  packages: PackagePlan[];
  addons: AddOnItem[];
  logs: ActivityLogItem[];
  notifications: SystemNotification[];
  selectedYear: number;
  photographers: string[];
  messageTemplates: MessageTemplates;
  driveConfig: DriveConfigSettings;
  updatedAt: string;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE_PATH = path.join(DATA_DIR, 'bestari-db.json');
const PENDING_PUBLIC_REQUESTS_PATH = path.join(DATA_DIR, 'pending-public-requests.json');

// Server-only credentials (never bundled into client JavaScript)
const ADMIN_USERNAME = process.env.ADMIN_USERNAME?.trim() || 'Bestarigraduation';
const ADMIN_PASSWORD_EXPECTED = process.env.ADMIN_PASSWORD || 'Bestari123';
const ADMIN_GOOGLE_EMAIL = (process.env.ADMIN_GOOGLE_EMAIL || 'bestarigraduation@gmail.com')
  .trim()
  .toLowerCase();
const FG_ACCESS_PIN = process.env.FG_ACCESS_PIN?.trim() || 'BestariFG2027';

// Cached Google public x509 certificates for verifying Firebase Auth ID tokens (no IAM required)
let cachedGoogleCerts: { certs: Record<string, string>; expiresAt: number } | null = null;

async function getGooglePublicCerts(): Promise<Record<string, string>> {
  if (cachedGoogleCerts && cachedGoogleCerts.expiresAt > Date.now()) {
    return cachedGoogleCerts.certs;
  }
  const resp = await fetch(
    'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com'
  );
  if (!resp.ok) {
    throw new Error('Gagal mengambil sertifikat verifikasi Google Auth.');
  }
  const cacheControl = resp.headers.get('cache-control') || '';
  const maxAgeMatch = cacheControl.match(/max-age=(\d+)/i);
  const ttlMs = maxAgeMatch ? Number(maxAgeMatch[1]) * 1000 : 30 * 60 * 1000;
  const certs = (await resp.json()) as Record<string, string>;
  cachedGoogleCerts = { certs, expiresAt: Date.now() + ttlMs };
  return certs;
}

async function verifyFirebaseAdminIdToken(
  idToken: string
): Promise<{ uid: string; email: string } | null> {
  const parts = idToken.split('.');
  if (parts.length !== 3) return null;
  const [headerB64, payloadB64, signatureB64] = parts;

  try {
    const header = JSON.parse(Buffer.from(headerB64, 'base64url').toString('utf-8')) as {
      alg?: string;
      kid?: string;
    };
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf-8')) as {
      aud?: string;
      iss?: string;
      sub?: string;
      exp?: number;
      iat?: number;
      email?: string;
      email_verified?: boolean;
    };

    if (header.alg !== 'RS256' || !header.kid) return null;
    const projectId = firebaseConfig.projectId;
    if (payload.aud !== projectId) return null;
    if (payload.iss !== `https://securetoken.google.com/${projectId}`) return null;

    const nowSec = Math.floor(Date.now() / 1000);
    if (!payload.exp || payload.exp <= nowSec) return null;
    if (!payload.iat || payload.iat > nowSec + 300) return null;
    if (!payload.sub || !payload.email || payload.email_verified !== true) return null;
    if (payload.email.trim().toLowerCase() !== ADMIN_GOOGLE_EMAIL) return null;

    const certs = await getGooglePublicCerts();
    const certPem = certs[header.kid];
    if (!certPem) return null;

    const verifier = crypto.createVerify('RSA-SHA256');
    verifier.update(`${headerB64}.${payloadB64}`);
    verifier.end();

    const sigBuffer = Buffer.from(signatureB64, 'base64url');
    if (!verifier.verify(certPem, sigBuffer)) return null;

    return { uid: payload.sub, email: payload.email };
  } catch {
    return null;
  }
}

// Signed HttpOnly cookie secret (ephemeral random fallback if SESSION_SECRET is unset)
const SESSION_SIGNING_SECRET =
  process.env.SESSION_SECRET?.trim() ||
  process.env.GEMINI_API_KEY?.trim() ||
  crypto.randomBytes(32).toString('hex');

const ADMIN_COOKIE_NAME = 'bestari_admin_session';
const PORTAL_COOKIE_NAME = 'bestari_portal_session';
const FG_COOKIE_NAME = 'bestari_fg_session';

// Simple in-memory rate limiter for authentication endpoints
const loginAttempts = new Map<string, { count: number; resetAt: number }>();

function checkAuthRateLimit(ipKey: string, maxAttempts = 15, windowMs = 5 * 60 * 1000): boolean {
  const now = Date.now();
  const entry = loginAttempts.get(ipKey);
  if (!entry || entry.resetAt <= now) {
    loginAttempts.set(ipKey, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= maxAttempts) {
    return false;
  }
  entry.count += 1;
  return true;
}

function timingSafeTextEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf-8');
  const bufB = Buffer.from(b, 'utf-8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function signToken(payloadObj: Record<string, unknown>, ttlMs: number): string {
  const payload = Buffer.from(
    JSON.stringify({ ...payloadObj, exp: Date.now() + ttlMs }),
    'utf-8'
  ).toString('base64url');
  const sig = crypto
    .createHmac('sha256', SESSION_SIGNING_SECRET)
    .update(payload)
    .digest('base64url');
  return `${payload}.${sig}`;
}

function verifyToken<T extends Record<string, unknown>>(token: string | undefined): T | null {
  if (!token || !token.includes('.')) return null;
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return null;

  const expectedSig = crypto
    .createHmac('sha256', SESSION_SIGNING_SECRET)
    .update(payload)
    .digest('base64url');

  if (!timingSafeTextEqual(sig, expectedSig)) return null;

  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8')) as T & {
      exp?: number;
    };
    if (!parsed || typeof parsed.exp !== 'number' || parsed.exp < Date.now()) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function parseCookies(req: express.Request): Record<string, string> {
  const header = req.headers.cookie;
  if (!header) return {};
  const result: Record<string, string> = {};
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    if (key) {
      try {
        result[key] = decodeURIComponent(val);
      } catch {
        result[key] = val;
      }
    }
  }
  return result;
}

function buildCookieString(
  req: express.Request,
  name: string,
  value: string,
  maxAgeSeconds: number
): string {
  const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https';
  const attrs = [
    `${name}=${encodeURIComponent(value)}`,
    'Path=/',
    'HttpOnly',
    `Max-Age=${maxAgeSeconds}`,
    isHttps ? 'SameSite=None; Secure' : 'SameSite=Lax'
  ];
  return attrs.join('; ');
}

function getAuthenticatedAdmin(req: express.Request): { role: string; user: string } | null {
  const cookies = parseCookies(req);
  const decoded = verifyToken<{ role?: string; user?: string }>(cookies[ADMIN_COOKIE_NAME]);
  if (!decoded || decoded.role !== 'admin') return null;
  return { role: 'admin', user: String(decoded.user || ADMIN_USERNAME) };
}

function getAuthenticatedPortalClient(req: express.Request): { clientId: string } | null {
  const cookies = parseCookies(req);
  const decoded = verifyToken<{ role?: string; clientId?: string }>(cookies[PORTAL_COOKIE_NAME]);
  if (!decoded || decoded.role !== 'portal' || !decoded.clientId) return null;
  return { clientId: String(decoded.clientId) };
}

function getAuthenticatedFg(req: express.Request): { role: string } | null {
  const cookies = parseCookies(req);
  const decoded = verifyToken<{ role?: string }>(cookies[FG_COOKIE_NAME]);
  if (!decoded || decoded.role !== 'fg') return null;
  return { role: 'fg' };
}

function requireAdminSession(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
): void {
  const admin = getAuthenticatedAdmin(req);
  if (!admin) {
    res.status(401).json({
      ok: false,
      error: 'Sesi admin tidak valid atau sudah berakhir. Silakan login kembali.'
    });
    return;
  }
  next();
}

let writeQueue: Promise<void> = Promise.resolve();

async function ensureDataDir(): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

async function readServerState(): Promise<PersistedBestariState | null> {
  try {
    const raw = await fs.readFile(DB_FILE_PATH, 'utf-8');
    const parsed = JSON.parse(raw) as PersistedBestariState;
    if (!parsed || !Array.isArray(parsed.clients)) return null;
    return parsed;
  } catch {
    return null;
  }
}

async function readPendingPublicRequests(): Promise<BookingRequest[]> {
  try {
    const raw = await fs.readFile(PENDING_PUBLIC_REQUESTS_PATH, 'utf-8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as BookingRequest[]) : [];
  } catch {
    return [];
  }
}

async function writePendingPublicRequests(items: BookingRequest[]): Promise<void> {
  await ensureDataDir();
  if (items.length === 0) {
    await fs.unlink(PENDING_PUBLIC_REQUESTS_PATH).catch(() => {});
    return;
  }
  const tmpPath = `${PENDING_PUBLIC_REQUESTS_PATH}.${Date.now()}.tmp`;
  await fs.writeFile(tmpPath, JSON.stringify(items, null, 2), 'utf-8');
  await fs.rename(tmpPath, PENDING_PUBLIC_REQUESTS_PATH);
}

function writeServerState(nextState: PersistedBestariState): Promise<PersistedBestariState> {
  const payload: PersistedBestariState = {
    ...nextState,
    updatedAt: new Date().toISOString()
  };

  writeQueue = writeQueue.then(async () => {
    await ensureDataDir();
    const tmpPath = `${DB_FILE_PATH}.${Date.now()}.tmp`;
    await fs.writeFile(tmpPath, JSON.stringify(payload, null, 2), 'utf-8');
    await fs.rename(tmpPath, DB_FILE_PATH);
  });

  return writeQueue.then(() => payload);
}

function createGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build'
      }
    }
  });
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.use(express.json({ limit: '10mb' }));

  // Defensive security headers (compatible with AI Studio preview iframe)
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('X-XSS-Protection', '0');
    next();
  });

  // 1. Health & Phase 2 Capabilities
  app.get('/api/health', (_req, res) => {
    const hasGeminiKey = Boolean(
      process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY'
    );
    res.json({
      ok: true,
      phase: 2,
      geminiConfigured: hasGeminiKey,
      timestamp: new Date().toISOString()
    });
  });

  // 2. Admin Authentication (Server-Side Verification + Signed HttpOnly Session Cookie)
  app.get('/api/admin/session', (req, res) => {
    const admin = getAuthenticatedAdmin(req);
    if (!admin) {
      res.json({ authenticated: false });
      return;
    }
    res.json({
      authenticated: true,
      operator: { id: 'ADM-001', name: 'Bestari Admin', role: 'Admin' }
    });
  });

  app.post('/api/admin/login', (req, res) => {
    const ipKey = `admin:${req.ip || 'unknown'}`;
    if (!checkAuthRateLimit(ipKey)) {
      res.status(429).json({
        ok: false,
        error: 'Terlalu banyak percobaan login. Silakan tunggu beberapa menit lalu coba lagi.'
      });
      return;
    }

    const username = typeof req.body?.username === 'string' ? req.body.username.trim() : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';

    if (
      timingSafeTextEqual(username, ADMIN_USERNAME) &&
      timingSafeTextEqual(password, ADMIN_PASSWORD_EXPECTED)
    ) {
      loginAttempts.delete(ipKey);
      const token = signToken({ role: 'admin', user: ADMIN_USERNAME }, 12 * 60 * 60 * 1000);
      res.setHeader('Set-Cookie', buildCookieString(req, ADMIN_COOKIE_NAME, token, 12 * 60 * 60));
      res.json({ ok: true, operator: { id: 'ADM-001', name: 'Bestari Admin', role: 'Admin' } });
      return;
    }

    res.status(401).json({
      ok: false,
      error: 'Username atau password tidak sesuai. Akses database ditolak.'
    });
  });

  app.post('/api/admin/firebase-login', async (req, res) => {
    const ipKey = `admin-fb:${req.ip || 'unknown'}`;
    if (!checkAuthRateLimit(ipKey, 20, 5 * 60 * 1000)) {
      res.status(429).json({
        ok: false,
        error: 'Terlalu banyak percobaan login. Silakan tunggu beberapa menit lalu coba lagi.'
      });
      return;
    }

    const idToken = typeof req.body?.idToken === 'string' ? req.body.idToken.trim() : '';
    if (!idToken) {
      res.status(400).json({ ok: false, error: 'Token Firebase Admin tidak tersedia.' });
      return;
    }

    const verified = await verifyFirebaseAdminIdToken(idToken);
    if (!verified) {
      res.status(401).json({
        ok: false,
        error: `Akun Google tidak memiliki izin Admin terverifikasi (${ADMIN_GOOGLE_EMAIL}).`
      });
      return;
    }

    loginAttempts.delete(ipKey);
    const token = signToken({ role: 'admin', user: verified.email }, 12 * 60 * 60 * 1000);
    res.setHeader('Set-Cookie', buildCookieString(req, ADMIN_COOKIE_NAME, token, 12 * 60 * 60));
    res.json({ ok: true, operator: { id: 'ADM-001', name: 'Bestari Admin', role: 'Admin' } });
  });

  app.get('/api/fg/board-key', requireAdminSession, (_req, res) => {
    const boardHash = crypto
      .createHash('sha256')
      .update(`fg:${FG_ACCESS_PIN}`)
      .digest('hex');
    res.json({ ok: true, boardHash });
  });

  app.post('/api/admin/logout', (req, res) => {
    res.setHeader('Set-Cookie', buildCookieString(req, ADMIN_COOKIE_NAME, '', 0));
    res.json({ ok: true });
  });

  // 3. Shared Database State Hydration & Sync (Protected by Admin Session)
  app.get('/api/state', requireAdminSession, async (_req, res) => {
    try {
      const state = await readServerState();
      const pendingPublic = await readPendingPublicRequests();
      if (!state) {
        res.json({ initialized: false, state: null, pendingPublicRequests: pendingPublic });
        return;
      }

      if (pendingPublic.length > 0) {
        const existingIds = new Set(state.requests.map(r => r.id));
        const newPending = pendingPublic.filter(r => !existingIds.has(r.id));
        if (newPending.length > 0) {
          const mergedNotifs: SystemNotification[] = [
            ...newPending.map(r => ({
              id: `notif-pub-${r.id}`,
              type: 'booking_request' as const,
              title: `Booking Request Baru · ${r.client_name}`,
              message: `${r.client_name} (${r.campus}) mengajukan paket ${r.package_name} via Form Publik.`,
              timestamp: r.created_at,
              read: false
            })),
            ...state.notifications
          ].slice(0, 100);

          const updated = await writeServerState({
            ...state,
            requests: [...newPending, ...state.requests],
            notifications: mergedNotifs
          });
          await writePendingPublicRequests([]);
          res.json({ initialized: true, state: updated });
          return;
        }
        await writePendingPublicRequests([]);
      }

      res.json({ initialized: true, state });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Gagal membaca database server.'
      });
    }
  });

  app.put('/api/state', requireAdminSession, async (req, res) => {
    try {
      const body = req.body as Partial<PersistedBestariState>;
      if (!body || !Array.isArray(body.clients) || !Array.isArray(body.packages)) {
        res.status(400).json({ error: 'Payload state tidak valid.' });
        return;
      }

      const pendingPublic = await readPendingPublicRequests();
      const incomingRequests = Array.isArray(body.requests) ? body.requests : [];
      const existingReqIds = new Set(incomingRequests.map(r => r.id));
      const mergedRequests = [
        ...pendingPublic.filter(r => !existingReqIds.has(r.id)),
        ...incomingRequests
      ];

      const saved = await writeServerState({
        clients: body.clients,
        requests: mergedRequests,
        transactions: Array.isArray(body.transactions) ? body.transactions : [],
        packages: body.packages,
        addons: Array.isArray(body.addons) ? body.addons : [],
        logs: Array.isArray(body.logs) ? body.logs : [],
        notifications: Array.isArray(body.notifications) ? body.notifications : [],
        selectedYear: typeof body.selectedYear === 'number' ? body.selectedYear : 2027,
        photographers: Array.isArray(body.photographers) ? body.photographers : [],
        messageTemplates: body.messageTemplates as MessageTemplates,
        driveConfig: body.driveConfig as DriveConfigSettings,
        updatedAt: new Date().toISOString()
      });

      if (pendingPublic.length > 0) {
        await writePendingPublicRequests([]);
      }

      res.json({ ok: true, updatedAt: saved.updatedAt });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Gagal menyimpan database server.'
      });
    }
  });

  // 3B. Public Reservation Catalog & Booking Submission (Zero PII exposed)
  app.get('/api/public/catalog', async (_req, res) => {
    try {
      const state = await readServerState();
      const packages = (state?.packages?.length ? state.packages : INITIAL_PACKAGES).filter(
        p => p.is_active
      );
      const addons = state?.addons?.length ? state.addons : INITIAL_ADDONS;
      const selectedYear = state?.selectedYear || 2027;
      const adminWa = String(state?.messageTemplates?.admin_whatsapp || '').replace(/\D/g, '');
      res.json({
        ok: true,
        selectedYear,
        packages,
        addons,
        ...(/^08[0-9]{8,11}$/.test(adminWa) ? { admin_whatsapp: adminWa } : {})
      });
    } catch {
      res.json({
        ok: true,
        selectedYear: 2027,
        packages: INITIAL_PACKAGES.filter(p => p.is_active),
        addons: INITIAL_ADDONS
      });
    }
  });

  app.post('/api/public/booking', async (req, res) => {
    try {
      const ipKey = `public-booking:${req.ip || 'unknown'}`;
      if (!checkAuthRateLimit(ipKey, 12, 10 * 60 * 1000)) {
        res.status(429).json({
          error: 'Terlalu banyak pengiriman formulir dalam waktu singkat. Coba lagi beberapa menit.'
        });
        return;
      }

      const body = (req.body || {}) as Record<string, unknown>;
      const clientName = typeof body.client_name === 'string' ? body.client_name.trim() : '';
      const rawPhone = typeof body.phone === 'string' ? body.phone.trim() : '';
      const normalizedPhoneDigits = rawPhone.replace(/\D/g, '');
      const instagram = typeof body.instagram === 'string' ? body.instagram.trim() : '';
      const campus = typeof body.campus === 'string' ? body.campus.trim() : '';
      const region = body.region === 'surabaya' ? 'surabaya' : 'malang';
      const packageId = typeof body.package_id === 'string' ? body.package_id.trim() : '';
      const photoDate = typeof body.photo_date === 'string' ? body.photo_date.trim() : '';
      const sessionTime = typeof body.session_time === 'string' ? body.session_time.trim() : '';
      const photoLocation = typeof body.photo_location === 'string' ? body.photo_location.trim() : '';
      const notes = typeof body.notes === 'string' ? body.notes.trim() : '';
      // Booking multi-sesi: beberapa request dari satu pengiriman formulir berbagi group_id.
      const groupId =
        typeof body.booking_group_id === 'string' && /^grp-[A-Za-z0-9-]{4,60}$/.test(body.booking_group_id)
          ? body.booking_group_id
          : '';
      const sessionNo = Number.isInteger(body.session_no) ? Number(body.session_no) : 0;
      const sessionTotal = Number.isInteger(body.session_total) ? Number(body.session_total) : 0;
      const validSessionInfo =
        groupId !== '' && sessionTotal >= 2 && sessionTotal <= 5 && sessionNo >= 1 && sessionNo <= sessionTotal;
      const requestedAddons = Array.isArray(body.selected_addons)
        ? (body.selected_addons as unknown[]).filter((a): a is string => typeof a === 'string')
        : [];

      if (clientName.length < 2) {
        res.status(400).json({ error: 'Nama lengkap wajib diisi (minimal 2 karakter).' });
        return;
      }
      if (normalizedPhoneDigits.length < 8) {
        res.status(400).json({ error: 'Nomor WhatsApp tidak valid.' });
        return;
      }
      if (campus.length < 2) {
        res.status(400).json({ error: 'Nama kampus wajib diisi.' });
        return;
      }

      const state = await readServerState();
      const catalogPackages = (state?.packages?.length ? state.packages : INITIAL_PACKAGES).filter(
        p => p.is_active
      );
      const catalogAddons = state?.addons?.length ? state.addons : INITIAL_ADDONS;

      const selectedPkg = catalogPackages.find(p => p.id === packageId && p.region === region);
      if (!selectedPkg) {
        res.status(400).json({ error: 'Paket foto tidak valid atau tidak tersedia untuk area dipilih.' });
        return;
      }

      // Compute price strictly server-side
      const validAddons = catalogAddons.filter(a => requestedAddons.includes(a.name));
      const addonsTotal = validAddons.reduce((sum, a) => sum + a.price, 0);
      const totalPrice = selectedPkg.price + addonsTotal;

      const now = new Date();
      const expiresAt = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

      const hasDuplicate = Boolean(
        state &&
          (state.clients.some(
            c =>
              c.phone.replace(/\D/g, '') === normalizedPhoneDigits ||
              c.client_name.toLowerCase() === clientName.toLowerCase()
          ) ||
            state.requests.some(
              r =>
                r.phone.replace(/\D/g, '') === normalizedPhoneDigits &&
                // sesi lain dari pengiriman yang sama bukan duplikat
                !(validSessionInfo && r.group_id === groupId)
            ))
      );

      const newRequest: BookingRequest = {
        id: `req-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        client_name: clientName,
        phone: rawPhone,
        instagram: instagram || undefined,
        campus,
        region,
        package_id: selectedPkg.id,
        package_name: selectedPkg.name,
        package_price: selectedPkg.price,
        total_price: totalPrice,
        selected_addons: validAddons.map(a => a.name),
        photo_date: photoDate || undefined,
        session_time: sessionTime || undefined,
        photo_location: photoLocation || undefined,
        notes: notes || undefined,
        status: 'new',
        created_at: now.toISOString(),
        expires_at: expiresAt.toISOString(),
        dp_verified: false,
        warning_duplicate: hasDuplicate,
        ...(validSessionInfo ? { group_id: groupId, session_no: sessionNo, session_total: sessionTotal } : {})
      };

      if (state) {
        const newNotif: SystemNotification = {
          id: `notif-pub-${Date.now()}`,
          type: 'booking_request',
          title: `Booking Request Baru · ${clientName}`,
          message: `${clientName} (${campus}) mengirim reservasi paket ${selectedPkg.name} via Form Publik.`,
          timestamp: now.toISOString(),
          read: false
        };
        const newLog: ActivityLogItem = {
          id: `log-pub-${Date.now()}`,
          timestamp: now.toISOString(),
          action: 'Reservasi Publik Diterima',
          actor: 'Form Reservasi Publik',
          admin_user_id: 'PUBLIC-FORM',
          event_type: 'booking',
          details: `${clientName} (${campus}, ${region}) mengajukan paket ${selectedPkg.name}.`,
          client_name: clientName
        };
        await writeServerState({
          ...state,
          requests: [newRequest, ...state.requests],
          notifications: [newNotif, ...state.notifications].slice(0, 100),
          logs: [newLog, ...state.logs].slice(0, 300)
        });
      } else {
        const pending = await readPendingPublicRequests();
        await writePendingPublicRequests([newRequest, ...pending]);
      }

      res.status(201).json({ ok: true, request: newRequest });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Gagal mengirim formulir reservasi.'
      });
    }
  });

  // 4. Client Portal Login (Multi-device ID + PIN verification + Scoped Portal Session Cookie)
  app.post('/api/portal/login', async (req, res) => {
    try {
      const ipKey = `portal:${req.ip || 'unknown'}`;
      if (!checkAuthRateLimit(ipKey, 20, 5 * 60 * 1000)) {
        res.status(429).json({
          error: 'Terlalu banyak percobaan PIN. Silakan tunggu beberapa menit.'
        });
        return;
      }

      const query =
        typeof req.body?.clientIdQuery === 'string' ? req.body.clientIdQuery.trim().toLowerCase() : '';
      const pin = typeof req.body?.pin === 'string' ? req.body.pin.trim() : '';

      if (!query || !pin) {
        res.status(400).json({ error: 'Masukkan ID Klien dan PIN akses terlebih dahulu.' });
        return;
      }

      const state = await readServerState();
      if (!state) {
        res.status(404).json({ error: 'Database server belum diinisialisasi.' });
        return;
      }

      const matched = state.clients.find(c => {
        const matchesId =
          c.client_id_display.toLowerCase() === query || c.order_id.toLowerCase() === query;
        const matchesPin = c.portal_pin_display === pin;
        return matchesId && matchesPin;
      });

      if (!matched) {
        res.status(401).json({
          error:
            'ID Klien atau PIN akses tidak valid. Pastikan ID (contoh: 001 / INV001-120127) dan PIN 4-digit tanggal booking (DDMM) sudah benar.'
        });
        return;
      }

      loginAttempts.delete(ipKey);
      const portalToken = signToken(
        { role: 'portal', clientId: matched.id },
        4 * 60 * 60 * 1000
      );
      res.setHeader(
        'Set-Cookie',
        buildCookieString(req, PORTAL_COOKIE_NAME, portalToken, 4 * 60 * 60)
      );
      const clientTransactions = state.transactions.filter(
        t => t.client_id === matched.id || t.order_id === matched.order_id
      );

      res.json({
        ok: true,
        client: matched,
        transactions: clientTransactions,
        addons: state.addons
      });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Gagal memverifikasi akses portal.'
      });
    }
  });

  // 5. Client Portal Actions (Protected by Scoped Portal Cookie OR Admin Cookie)
  app.post('/api/portal/action', async (req, res) => {
    try {
      const clientId = typeof req.body?.clientId === 'string' ? req.body.clientId : '';
      const action = typeof req.body?.action === 'string' ? req.body.action : '';

      const admin = getAuthenticatedAdmin(req);
      const portalSession = getAuthenticatedPortalClient(req);
      const isAuthorizedForClient =
        Boolean(admin) || Boolean(portalSession && portalSession.clientId === clientId);

      if (!isAuthorizedForClient) {
        res.status(401).json({
          error: 'Sesi portal tidak valid. Silakan masuk ulang dengan ID Klien dan PIN Anda.'
        });
        return;
      }

      const state = await readServerState();
      if (!state) {
        res.status(404).json({ error: 'Database server belum siap.' });
        return;
      }

      const idx = state.clients.findIndex(c => c.id === clientId);
      if (idx === -1) {
        res.status(404).json({ error: 'Data klien tidak ditemukan.' });
        return;
      }

      const current = state.clients[idx];
      const nowIso = new Date().toISOString();
      const todayStr = nowIso.split('T')[0];
      let updated: ClientBooking = { ...current, updated_at: nowIso };
      let notifTitle = '';
      let notifMsg = '';
      let notifType: SystemNotification['type'] = 'selection_submitted';
      let logAction = 'Portal Client Action';
      let logDetails = '';

      if (action === 'start_selection') {
        const deadline = new Date();
        deadline.setDate(deadline.getDate() + 5);
        updated = {
          ...updated,
          status: 'selection_pending',
          file_uploaded: true,
          selection_deadline: deadline.toISOString().split('T')[0]
        };
        logAction = 'Tahap Seleksi Foto Dibuka';
        logDetails = `${current.client_name} membuka tahap pemilihan foto di Client Portal.`;
      } else if (action === 'submit_selection') {
        const selectedIds = Array.isArray(req.body?.selectedIds)
          ? (req.body.selectedIds as unknown[]).filter((x): x is string => typeof x === 'string')
          : [];
        const editingDeadline = new Date();
        editingDeadline.setDate(editingDeadline.getDate() + 10);
        updated = {
          ...updated,
          selection_submitted: true,
          status: 'editing',
          selected_photos_count: selectedIds.length,
          selected_photo_ids: selectedIds,
          selection_submitted_at: todayStr,
          editing_deadline: editingDeadline.toISOString().split('T')[0]
        };
        notifType = 'selection_submitted';
        notifTitle = `Pilihan Foto Dikirim · ${current.client_name}`;
        notifMsg = `${current.client_name} (${current.order_id}) mengirim ${selectedIds.length} foto pilihan untuk diedit (SLA H+10).`;
        logAction = 'Klien Submit Pilihan Foto';
        logDetails = `${current.client_name} memilih ${selectedIds.length} foto & masuk antrean 05 Editing.`;
      } else if (action === 'complete_final') {
        updated = { ...updated, status: 'completed' };
        logAction = 'Final Delivery Diselesaikan Klien';
        logDetails = `${current.client_name} menyelesaikan unduhan dan masuk ke tahap 07 Completed.`;
      } else if (action === 'submit_feedback') {
        const rating =
          typeof req.body?.rating === 'number' && req.body.rating >= 1 && req.body.rating <= 5
            ? req.body.rating
            : undefined;
        const comment = typeof req.body?.comment === 'string' ? req.body.comment.trim() : '';
        updated = {
          ...updated,
          status: 'completed',
          ...(rating !== undefined ? { feedback_rating: rating } : {}),
          feedback_comment: comment,
          feedback_skipped: false
        };
        notifType = 'feedback_submitted';
        notifTitle = `Ulasan Baru · ${current.client_name}`;
        notifMsg = `${current.client_name} memberikan ulasan${rating ? ` (${rating}★)` : ''} melalui Client Portal.`;
        logAction = 'Ulasan Klien Diterima';
        logDetails = `${current.client_name} mengirim ulasan${rating ? ` ${rating} bintang` : ''}.`;
      } else if (action === 'skip_feedback') {
        updated = {
          ...updated,
          status: 'completed',
          feedback_skipped: true
        };
        logAction = 'Ulasan Dilewati Klien';
        logDetails = `${current.client_name} menyelesaikan sesi tanpa memberi rating.`;
      } else {
        res.status(400).json({ error: 'Aksi portal tidak dikenali.' });
        return;
      }

      const nextClients = [...state.clients];
      nextClients[idx] = updated;

      const newLog: ActivityLogItem = {
        id: `log-${Date.now()}`,
        timestamp: nowIso,
        action: logAction,
        actor: 'Client Portal',
        admin_user_id: `CLIENT-${current.client_id_display}`,
        event_type: 'portal_action',
        from_status: current.status,
        to_status: updated.status,
        details: logDetails,
        order_id: current.order_id,
        client_id: current.id,
        client_name: current.client_name
      };

      const nextLogs: ActivityLogItem[] = [newLog, ...state.logs].slice(0, 300);

      const nextNotifications = notifTitle
        ? [
            {
              id: `notif-${Date.now()}`,
              type: notifType,
              title: notifTitle,
              message: notifMsg,
              timestamp: nowIso,
              read: false,
              order_id: current.order_id,
              client_id: current.id
            },
            ...state.notifications
          ].slice(0, 100)
        : state.notifications;

      await writeServerState({
        ...state,
        clients: nextClients,
        logs: nextLogs,
        notifications: nextNotifications
      });

      res.json({ ok: true, client: updated });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Gagal memproses aksi portal klien.'
      });
    }
  });

  // 5B. Photographer (FG) Field Portal (PIN Auth + Non-Financial Schedule Feed + Field Milestone Sync)
  app.get('/api/fg/session', (req, res) => {
    const isAuthed = Boolean(getAuthenticatedFg(req) || getAuthenticatedAdmin(req));
    res.json({ authenticated: isAuthed });
  });

  app.post('/api/fg/login', (req, res) => {
    const ipKey = `fg:${req.ip || 'unknown'}`;
    if (!checkAuthRateLimit(ipKey, 15, 5 * 60 * 1000)) {
      res.status(429).json({
        ok: false,
        error: 'Terlalu banyak percobaan kode akses. Silakan tunggu beberapa menit.'
      });
      return;
    }

    const pin = typeof req.body?.pin === 'string' ? req.body.pin.trim() : '';
    if (timingSafeTextEqual(pin, FG_ACCESS_PIN)) {
      loginAttempts.delete(ipKey);
      const token = signToken({ role: 'fg' }, 12 * 60 * 60 * 1000);
      res.setHeader('Set-Cookie', buildCookieString(req, FG_COOKIE_NAME, token, 12 * 60 * 60));
      res.json({ ok: true });
      return;
    }

    res.status(401).json({ ok: false, error: 'Kode akses Tim Fotografer tidak sesuai.' });
  });

  app.post('/api/fg/logout', (req, res) => {
    res.setHeader('Set-Cookie', buildCookieString(req, FG_COOKIE_NAME, '', 0));
    res.json({ ok: true });
  });

  app.get('/api/fg/schedule', async (req, res) => {
    if (!getAuthenticatedFg(req) && !getAuthenticatedAdmin(req)) {
      res.status(401).json({ error: 'Silakan masukkan Kode Akses Tim FG terlebih dahulu.' });
      return;
    }

    try {
      const state = await readServerState();
      if (!state) {
        res.status(404).json({ error: 'Database jadwal belum tersedia. Hubungi Admin.' });
        return;
      }

      const sessions = state.clients
        .filter(c => c.status !== 'cancelled')
        .map(c => ({
          id: c.id,
          order_id: c.order_id,
          client_name: c.client_name,
          booking_year: c.booking_year,
          region_id: c.region_id,
          campus: c.campus,
          photo_location: c.photo_location,
          photo_date: c.photo_date,
          session_time: c.session_time,
          package_name: c.package_name,
          edit_quota: c.edit_quota,
          photographer: c.photographer,
          status: c.status,
          notes: c.notes,
          drive_folder_url: c.drive_folder_url,
          drive_jpg_folder_url: c.drive_jpg_folder_url,
          drive_edited_folder_url: c.drive_edited_folder_url,
          selected_photo_ids: c.selected_photo_ids || [],
          editing_deadline: c.editing_deadline
        }));

      res.json({
        ok: true,
        selectedYear: state.selectedYear,
        photographers: state.photographers,
        sessions
      });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Gagal memuat jadwal fotografer.'
      });
    }
  });

  app.post('/api/fg/status', async (req, res) => {
    if (!getAuthenticatedFg(req) && !getAuthenticatedAdmin(req)) {
      res.status(401).json({ error: 'Sesi Tim FG tidak valid.' });
      return;
    }

    try {
      const clientId = typeof req.body?.clientId === 'string' ? req.body.clientId : '';
      const action = typeof req.body?.action === 'string' ? req.body.action : '';
      const fgName = typeof req.body?.fgName === 'string' ? req.body.fgName.trim() : 'Tim FG';

      const state = await readServerState();
      if (!state) {
        res.status(404).json({ error: 'Database belum siap.' });
        return;
      }

      const idx = state.clients.findIndex(c => c.id === clientId);
      if (idx === -1) {
        res.status(404).json({ error: 'Jadwal sesi tidak ditemukan.' });
        return;
      }

      const current = state.clients[idx];
      const nowIso = new Date().toISOString();
      let updated: ClientBooking = { ...current, updated_at: nowIso };
      let logAction = '';
      let logDetails = '';
      let notifTitle = '';
      let notifMsg = '';

      if (action === 'mark_photo_session' && current.status === 'confirmed') {
        updated = { ...updated, status: 'photo_session' };
        logAction = 'FG Memulai Sesi Foto';
        logDetails = `${fgName || current.photographer} menandai sesi foto ${current.client_name} dimulai.`;
        notifTitle = `Sesi Foto Dimulai · ${current.client_name}`;
        notifMsg = `${fgName || current.photographer} memulai sesi pemotretan di ${current.campus}.`;
      } else if (
        action === 'mark_jpg_uploaded' &&
        (current.status === 'confirmed' || current.status === 'photo_session')
      ) {
        updated = { ...updated, status: 'file_uploaded', file_uploaded: true };
        logAction = 'FG Selesai Unggah JPG Mentah';
        logDetails = `${fgName || current.photographer} mengunggah file JPG mentah untuk ${current.client_name}.`;
        notifTitle = `JPG Mentah Terunggah · ${current.client_name}`;
        notifMsg = `${fgName || current.photographer} melaporkan folder JPG ${current.order_id} siap diseleksi.`;
      } else {
        res.status(400).json({ error: 'Transisi tahap lapangan tidak berlaku untuk status sesi saat ini.' });
        return;
      }

      const nextClients = [...state.clients];
      nextClients[idx] = updated;

      const newLog: ActivityLogItem = {
        id: `log-fg-${Date.now()}`,
        timestamp: nowIso,
        action: logAction,
        actor: fgName || 'Portal Tim FG',
        admin_user_id: 'FG-PORTAL',
        event_type: 'state_transition',
        from_status: current.status,
        to_status: updated.status,
        details: logDetails,
        order_id: current.order_id,
        client_id: current.id,
        client_name: current.client_name
      };

      const nextNotifications = [
        {
          id: `notif-fg-${Date.now()}`,
          type: 'jpg_pending' as const,
          title: notifTitle,
          message: notifMsg,
          timestamp: nowIso,
          read: false,
          order_id: current.order_id,
          client_id: current.id
        },
        ...state.notifications
      ].slice(0, 100);

      await writeServerState({
        ...state,
        clients: nextClients,
        logs: [newLog, ...state.logs].slice(0, 300),
        notifications: nextNotifications
      });

      res.json({ ok: true, status: updated.status });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Gagal memperbarui status sesi lapangan.'
      });
    }
  });

  // 6. Server-Side Gemini AI Operational Insights (Protected by Admin Session)
  app.post('/api/ai/insights', requireAdminSession, async (req, res) => {
    const ai = createGeminiClient();
    if (!ai) {
      res.status(503).json({
        error:
          'GEMINI_API_KEY belum dikonfigurasi. Tambahkan API key Gemini Anda di panel Settings > Secrets untuk mengaktifkan AI Insights.'
      });
      return;
    }

    try {
      const body = (req.body || {}) as Record<string, unknown>;
      const selectedYear = Number(body.selectedYear || new Date().getFullYear());
      const totalClients = Number(body.totalClients || 0);
      const totalRevenue = Number(body.totalRevenue || 0);
      const avgOrderValue = Number(body.avgOrderValue || 0);
      const completedCount = Number(body.completedCount || 0);
      const unassignedFgCount = Number(body.unassignedFgCount || 0);
      const editingOverdueCount = Number(body.editingOverdueCount || 0);
      const outstandingCount = Number(body.outstandingCount || 0);
      const outstandingAmount = Number(body.outstandingAmount || 0);
      const ratedCount = Number(body.ratedCount || 0);
      const overallVendorAvg = Number(body.overallVendorAvg || 0);
      const topPackages = Array.isArray(body.topPackages)
        ? (body.topPackages as Array<{ name?: string; count?: number }>)
        : [];
      const topCampuses = Array.isArray(body.topCampuses)
        ? (body.topCampuses as Array<{ name?: string; count?: number }>)
        : [];
      const leaderboard = Array.isArray(body.leaderboard)
        ? (body.leaderboard as Array<{
            name?: string;
            sessions?: number;
            completedUpload?: number;
            ratedCount?: number;
            avgRating?: number;
          }>)
        : [];
      const recentReviews = Array.isArray(body.recentReviews)
        ? (body.recentReviews as Array<{
            clientName?: string;
            campus?: string;
            photographer?: string;
            rating?: number;
            comment?: string;
          }>)
        : [];

      const prompt = `Analisis data operasional bisnis fotografi wisuda **Bestari Graduation** (Area Malang & Surabaya) untuk periode tahun ${selectedYear}:

RINGKASAN METRIK:
- Total Klien Aktif: ${totalClients}
- Total Nilai Booking: Rp ${Math.round(totalRevenue).toLocaleString('id-ID')}
- Average Order Value (AOV): Rp ${Math.round(avgOrderValue).toLocaleString('id-ID')}
- Klien Tahap Final/Selesai: ${completedCount}
- Klien Belum Ada Fotografer (FG): ${unassignedFgCount}
- Antrean Editing Melewati SLA (Overdue): ${editingOverdueCount}
- Klien Belum Lunas: ${outstandingCount} klien (Total Outstanding: Rp ${Math.round(outstandingAmount).toLocaleString('id-ID')})
- Rating Vendor Keseluruhan: ${ratedCount > 0 ? `${overallVendorAvg.toFixed(2)}/5.0 dari ${ratedCount} ulasan` : 'Belum ada rating'}

PAKET TERPOPULER:
${topPackages.map(p => `- ${p.name || '-'}: ${Number(p.count || 0)} order`).join('\n') || '- Belum ada data'}

KAMPUS TERBANYAK:
${topCampuses.map(c => `- ${c.name || '-'}: ${Number(c.count || 0)} klien`).join('\n') || '- Belum ada data'}

PERFORMA TIM FOTOGRAFER (FG):
${leaderboard.map(fg => `- ${fg.name || '-'}: ${Number(fg.sessions || 0)} sesi, ${Number(fg.completedUpload || 0)} upload galeri selesai, rating ${Number(fg.ratedCount || 0) > 0 ? `${Number(fg.avgRating || 0).toFixed(1)}/5 (${Number(fg.ratedCount || 0)} ulasan)` : 'belum ada ulasan'}`).join('\n') || '- Belum ada data FG'}

ULASAN KLIEN TERBARU:
${recentReviews.map(r => `- ${r.clientName || 'Klien'} (${r.campus || '-'}, FG: ${r.photographer || '-'}) [${r.rating ?? '-'}★]: "${r.comment || '-'}"`).join('\n') || '- Belum ada komentar ulasan'}`;

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
        config: {
          systemInstruction:
            'Anda adalah analis operasional senior untuk studio fotografi wisuda Bestari Graduation. Berikan analisis tajam, konkret, berbasis angka yang diberikan, dalam Bahasa Indonesia profesional yang ringkas (maksimal 4 poin bernomor dengan bold heading: 1. Performa Pendapatan & Paket, 2. Kapasitas Kampus & Tim FG, 3. Evaluasi Kepuasan & Kualitas Layanan, 4. Rekomendasi Aksi Prioritas). Jangan mengarang angka di luar data.'
        }
      });

      const report = (response.text || '').trim();
      if (!report) {
        res.status(502).json({ error: 'Gemini API tidak mengembalikan isi laporan.' });
        return;
      }

      res.json({
        ok: true,
        model: 'gemini-4-hydrogen',
        generatedAt: new Date().toISOString(),
        report
      });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Terjadi kesalahan saat memanggil Gemini API.';
      const statusCode =
        message.includes('403') || message.includes('PERMISSION_DENIED')
          ? 403
          : message.includes('429') || message.includes('RESOURCE_EXHAUSTED')
          ? 429
          : message.includes('400') || message.includes('API_KEY_INVALID')
          ? 400
          : 500;
      res.status(statusCode).json({ error: message });
    }
  });

  // Vite dev middleware vs Production static assets
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.join(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Bestari Graduation Phase 2 server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('Failed to start Bestari Graduation server:', err);
  process.exit(1);
});
