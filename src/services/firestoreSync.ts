import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
  type Unsubscribe
} from 'firebase/firestore';
import { signInWithPopup, type User } from 'firebase/auth';
import {
  ADMIN_EMAIL,
  auth,
  db,
  googleAuthProvider,
  sha256Hex
} from '../lib/firebase';
import { handleFirestoreError, OperationType } from '../lib/firestoreError';
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
} from '../types';

export interface BestariSnapshotPayload {
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
}

export interface PortalSubmissionDoc {
  id: string;
  card_hash: string;
  client_id: string;
  action:
    | 'start_selection'
    | 'submit_selection'
    | 'complete_final'
    | 'submit_feedback'
    | 'skip_feedback';
  selected_ids?: string[];
  rating?: number;
  comment?: string;
  created_at: string;
}

export interface FgFieldUpdateDoc {
  id: string;
  board_hash: string;
  client_id: string;
  action: 'mark_photo_session' | 'mark_jpg_uploaded';
  fg_name: string;
  created_at: string;
}

export interface PortalCardDoc {
  client_id: string;
  order_id: string;
  client_id_display: string;
  booking_year: number;
  client_name: string;
  campus: string;
  region_id: 'malang' | 'surabaya';
  photo_location: string;
  photo_date: string;
  session_time: string;
  package_name: string;
  package_price: number;
  total_price: number;
  selected_addons: string[];
  payment_status: ClientBooking['payment_status'];
  paid_amount: number;
  status: ClientBooking['status'];
  edit_quota: number;
  selected_photo_ids: string[];
  selection_deadline?: string;
  editing_deadline?: string;
  final_access_expires_at?: string;
  drive_folder_url?: string;
  drive_jpg_folder_url?: string;
  drive_edited_folder_url?: string;
  feedback_rating?: number;
  feedback_comment?: string;
  feedback_skipped?: boolean;
  invoice_number?: string;
  invoice_issued_at?: string;
  updated_at: string;
  portal_transactions: Array<{
    id: string;
    date: string;
    type: Transaction['type'];
    amount: number;
    payment_method: string;
    status: Transaction['status'];
  }>;
}

export interface FgSessionCardDoc {
  id: string;
  order_id: string;
  client_name: string;
  booking_year: number;
  region_id: 'malang' | 'surabaya';
  campus: string;
  photo_location: string;
  photo_date: string;
  session_time: string;
  package_name: string;
  edit_quota: number;
  photographer: string;
  status: ClientBooking['status'];
  notes?: string;
  drive_folder_url?: string;
  drive_jpg_folder_url?: string;
  drive_edited_folder_url?: string;
  selected_photo_ids: string[];
  editing_deadline?: string;
}

export function isFirebaseAdminUser(user: User | null | undefined): boolean {
  if (!user) return false;
  return Boolean(
    user.emailVerified && user.email && user.email.trim().toLowerCase() === ADMIN_EMAIL
  );
}

export function sanitizeForFirestore<T>(value: T): T {
  if (Array.isArray(value)) {
    return value
      .filter(item => item !== undefined)
      .map(item => sanitizeForFirestore(item)) as unknown as T;
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v !== undefined) {
        out[k] = sanitizeForFirestore(v);
      }
    }
    return out as T;
  }
  return value;
}

export async function signInAdminWithGoogle(): Promise<{
  user: User;
  idToken: string;
}> {
  const result = await signInWithPopup(auth, googleAuthProvider);
  const user = result.user;
  if (!isFirebaseAdminUser(user)) {
    await auth.signOut().catch(() => {});
    throw new Error(
      `Akun Google (${user.email || 'tidak diketahui'}) bukan akun Admin terdaftar (${ADMIN_EMAIL}).`
    );
  }

  const idToken = await user.getIdToken();

  // Upsert admin record in Firestore
  const adminPath = `admins/${user.uid}`;
  try {
    await setDoc(
      doc(db, 'admins', user.uid),
      {
        uid: user.uid,
        email: user.email || ADMIN_EMAIL,
        name: user.displayName || 'Bestari Admin',
        role: 'admin',
        server_created_at: serverTimestamp(),
        server_updated_at: serverTimestamp()
      },
      { merge: true }
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, adminPath);
  }

  return { user, idToken };
}

export async function getFgBoardHashFromServer(): Promise<string> {
  try {
    const res = await fetch('/api/fg/board-key', { credentials: 'include' });
    if (res.ok) {
      const data = (await res.json()) as { boardHash?: string };
      if (data.boardHash && /^[a-f0-9]{64}$/.test(data.boardHash)) {
        return data.boardHash;
      }
    }
  } catch {
    // Fallback below only if server unreachable
  }
  return sha256Hex('fg:BestariFG2027');
}

function buildPortalCardPayload(
  c: ClientBooking,
  transactions: Transaction[]
): Omit<PortalCardDoc, 'server_updated_at'> {
  const clientTxs = transactions
    .filter(t => t.client_id === c.id || t.order_id === c.order_id)
    .slice(0, 20)
    .map(t => ({
      id: t.id,
      date: t.date,
      type: t.type,
      amount: Number(t.amount || 0),
      payment_method: t.payment_method || 'Transfer Bank',
      status: t.status
    }));

  return sanitizeForFirestore({
    client_id: c.id,
    order_id: c.order_id,
    client_id_display: c.client_id_display,
    booking_year: Math.round(Number(c.booking_year || 2027)),
    client_name: c.client_name,
    campus: c.campus,
    region_id: c.region_id === 'surabaya' ? 'surabaya' : 'malang',
    photo_location: c.photo_location || '',
    photo_date: c.photo_date || '',
    session_time: c.session_time || '',
    package_name: c.package_name,
    package_price: Number(c.package_price || 0),
    total_price: Number(c.total_price || c.package_price || 0),
    selected_addons: Array.isArray(c.selected_addons) ? c.selected_addons.slice(0, 30) : [],
    payment_status: c.payment_status,
    paid_amount: Number(c.paid_amount || 0),
    status: c.status,
    edit_quota: Math.max(0, Math.round(Number(c.edit_quota || 0))),
    selected_photo_ids: Array.isArray(c.selected_photo_ids)
      ? c.selected_photo_ids.slice(0, 200)
      : [],
    selection_deadline: c.selection_deadline,
    editing_deadline: c.editing_deadline,
    final_access_expires_at: c.final_access_expires_at,
    drive_folder_url: c.drive_folder_url,
    drive_jpg_folder_url: c.drive_jpg_folder_url,
    drive_edited_folder_url: c.drive_edited_folder_url,
    feedback_rating: c.feedback_rating,
    feedback_comment: c.feedback_comment,
    feedback_skipped: c.feedback_skipped,
    invoice_number: c.invoice_number,
    invoice_issued_at: c.invoice_issued_at,
    updated_at: c.updated_at || new Date().toISOString(),
    portal_transactions: clientTxs
  });
}

function buildFgSessionPayload(c: ClientBooking): FgSessionCardDoc {
  return sanitizeForFirestore({
    id: c.id,
    order_id: c.order_id,
    client_name: c.client_name,
    booking_year: Math.round(Number(c.booking_year || 2027)),
    region_id: c.region_id === 'surabaya' ? 'surabaya' : 'malang',
    campus: c.campus,
    photo_location: c.photo_location || '',
    photo_date: c.photo_date || '',
    session_time: c.session_time || '',
    package_name: c.package_name,
    edit_quota: Math.max(0, Math.round(Number(c.edit_quota || 0))),
    photographer: c.photographer || 'Belum Ditugaskan',
    status: c.status,
    notes: c.notes,
    drive_folder_url: c.drive_folder_url,
    drive_jpg_folder_url: c.drive_jpg_folder_url,
    drive_edited_folder_url: c.drive_edited_folder_url,
    selected_photo_ids: Array.isArray(c.selected_photo_ids)
      ? c.selected_photo_ids.slice(0, 200)
      : [],
    editing_deadline: c.editing_deadline
  });
}

type BatchOp =
  | { type: 'set'; path: [string, ...string[]]; data: Record<string, unknown> }
  | { type: 'delete'; path: [string, ...string[]] };

async function commitBatchOps(ops: BatchOp[]): Promise<void> {
  if (ops.length === 0) return;
  const CHUNK_SIZE = 380;
  for (let i = 0; i < ops.length; i += CHUNK_SIZE) {
    const chunk = ops.slice(i, i + CHUNK_SIZE);
    const batch = writeBatch(db);
    for (const op of chunk) {
      const ref = doc(db, ...op.path);
      if (op.type === 'set') {
        batch.set(ref, op.data);
      } else {
        batch.delete(ref);
      }
    }
    try {
      await batch.commit();
    } catch (err) {
      const samplePath = chunk[0]?.path.join('/') || 'unknown';
      handleFirestoreError(err, OperationType.WRITE, samplePath);
    }
  }
}

export interface KnownFirestoreIds {
  clients: Map<string, string>;
  requests: Map<string, string>;
  transactions: Map<string, string>;
  packages: Map<string, string>;
  addons: Map<string, string>;
  logs: Map<string, string>;
  notifications: Map<string, string>;
  portalCards: Map<string, string>;
  fgSessions: Map<string, string>;
  settingsSig: string;
  fgBoardSig: string;
}

export function createEmptyKnownIds(): KnownFirestoreIds {
  return {
    clients: new Map(),
    requests: new Map(),
    transactions: new Map(),
    packages: new Map(),
    addons: new Map(),
    logs: new Map(),
    notifications: new Map(),
    portalCards: new Map(),
    fgSessions: new Map(),
    settingsSig: '',
    fgBoardSig: ''
  };
}

export async function syncSnapshotToFirestore(
  snapshot: BestariSnapshotPayload,
  known: KnownFirestoreIds,
  fgBoardHash: string
): Promise<void> {
  if (!isFirebaseAdminUser(auth.currentUser)) return;

  const ops: BatchOp[] = [];

  // 1. Clients & capability-hashed Portal Cards + FG Sessions
  const activeClientIds = new Set<string>();
  const activePortalHashes = new Set<string>();
  const activeFgSessionIds = new Set<string>();

  for (const c of snapshot.clients) {
    activeClientIds.add(c.id);
    const cleanClient = sanitizeForFirestore({
      ...c,
      booking_year: Math.round(Number(c.booking_year || 2027)),
      booking_sequence: Math.round(Number(c.booking_sequence || 0)),
      package_price: Number(c.package_price || 0),
      total_price: Number(c.total_price || c.package_price || 0),
      paid_amount: Number(c.paid_amount || 0),
      edit_quota: Math.max(0, Math.round(Number(c.edit_quota || 0))),
      selected_addons: Array.isArray(c.selected_addons) ? c.selected_addons.slice(0, 30) : [],
      selected_photo_ids: Array.isArray(c.selected_photo_ids)
        ? c.selected_photo_ids.slice(0, 200)
        : []
    });
    const clientSig = JSON.stringify(cleanClient);
    if (known.clients.get(c.id) !== clientSig) {
      known.clients.set(c.id, clientSig);
      ops.push({
        type: 'set',
        path: ['clients', c.id],
        data: { ...cleanClient, server_updated_at: serverTimestamp() }
      });
    }

    // Portal card (by client_id_display:pin AND order_id:pin)
    const pin = (c.portal_pin_display || '').trim();
    if (pin && c.status !== 'cancelled') {
      const cardData = buildPortalCardPayload(c, snapshot.transactions);
      const cardSig = JSON.stringify(cardData);
      const keys = Array.from(
        new Set([
          `${(c.client_id_display || '').trim().toLowerCase()}:${pin}`,
          `${(c.order_id || '').trim().toLowerCase()}:${pin}`
        ])
      ).filter(k => !k.startsWith(':'));

      for (const rawKey of keys) {
        const cardHash = await sha256Hex(rawKey);
        activePortalHashes.add(cardHash);
        if (known.portalCards.get(cardHash) !== cardSig) {
          known.portalCards.set(cardHash, cardSig);
          ops.push({
            type: 'set',
            path: ['portal_cards', cardHash],
            data: { ...cardData, server_updated_at: serverTimestamp() }
          });
        }
      }
    }

    // Non-financial FG session projection
    if (c.status !== 'cancelled') {
      activeFgSessionIds.add(c.id);
      const fgSession = buildFgSessionPayload(c);
      const fgSig = JSON.stringify(fgSession);
      if (known.fgSessions.get(c.id) !== fgSig) {
        known.fgSessions.set(c.id, fgSig);
        ops.push({
          type: 'set',
          path: ['fg_boards', fgBoardHash, 'sessions', c.id],
          data: { ...fgSession, server_updated_at: serverTimestamp() }
        });
      }
    }
  }

  for (const oldId of Array.from(known.clients.keys())) {
    if (!activeClientIds.has(oldId)) {
      known.clients.delete(oldId);
      ops.push({ type: 'delete', path: ['clients', oldId] });
    }
  }
  for (const oldHash of Array.from(known.portalCards.keys())) {
    if (!activePortalHashes.has(oldHash)) {
      known.portalCards.delete(oldHash);
      ops.push({ type: 'delete', path: ['portal_cards', oldHash] });
    }
  }
  for (const oldFgId of Array.from(known.fgSessions.keys())) {
    if (!activeFgSessionIds.has(oldFgId)) {
      known.fgSessions.delete(oldFgId);
      ops.push({ type: 'delete', path: ['fg_boards', fgBoardHash, 'sessions', oldFgId] });
    }
  }

  // 2. Booking Requests
  const activeReqIds = new Set<string>();
  for (const req of snapshot.requests) {
    activeReqIds.add(req.id);
    const cleanReq = sanitizeForFirestore({
      ...req,
      package_price: Number(req.package_price || 0),
      total_price: Number(req.total_price || req.package_price || 0),
      selected_addons: Array.isArray(req.selected_addons) ? req.selected_addons.slice(0, 20) : [],
      dp_verified: Boolean(req.dp_verified)
    });
    const sig = JSON.stringify(cleanReq);
    if (known.requests.get(req.id) !== sig) {
      known.requests.set(req.id, sig);
      ops.push({
        type: 'set',
        path: ['booking_requests', req.id],
        data: { ...cleanReq, server_created_at: serverTimestamp() }
      });
    }
  }
  for (const oldId of Array.from(known.requests.keys())) {
    if (!activeReqIds.has(oldId)) {
      known.requests.delete(oldId);
      ops.push({ type: 'delete', path: ['booking_requests', oldId] });
    }
  }

  // 3. Transactions
  const activeTxIds = new Set<string>();
  for (const tx of snapshot.transactions) {
    activeTxIds.add(tx.id);
    const cleanTx = sanitizeForFirestore({
      ...tx,
      amount: Number(tx.amount || 0)
    });
    const sig = JSON.stringify(cleanTx);
    if (known.transactions.get(tx.id) !== sig) {
      known.transactions.set(tx.id, sig);
      ops.push({
        type: 'set',
        path: ['transactions', tx.id],
        data: { ...cleanTx, server_updated_at: serverTimestamp() }
      });
    }
  }
  for (const oldId of Array.from(known.transactions.keys())) {
    if (!activeTxIds.has(oldId)) {
      known.transactions.delete(oldId);
      ops.push({ type: 'delete', path: ['transactions', oldId] });
    }
  }

  // 4. Packages
  const activePkgIds = new Set<string>();
  for (const pkg of snapshot.packages) {
    activePkgIds.add(pkg.id);
    const cleanPkg = sanitizeForFirestore({
      ...pkg,
      price: Number(pkg.price || 0),
      edit_quota: Math.max(0, Math.round(Number(pkg.edit_quota || 0))),
      is_active: Boolean(pkg.is_active)
    });
    const sig = JSON.stringify(cleanPkg);
    if (known.packages.get(pkg.id) !== sig) {
      known.packages.set(pkg.id, sig);
      ops.push({
        type: 'set',
        path: ['packages', pkg.id],
        data: { ...cleanPkg, server_updated_at: serverTimestamp() }
      });
    }
  }
  for (const oldId of Array.from(known.packages.keys())) {
    if (!activePkgIds.has(oldId)) {
      known.packages.delete(oldId);
      ops.push({ type: 'delete', path: ['packages', oldId] });
    }
  }

  // 5. Addons
  const activeAddonIds = new Set<string>();
  for (const addon of snapshot.addons) {
    activeAddonIds.add(addon.id);
    const cleanAddon = sanitizeForFirestore({
      ...addon,
      price: Number(addon.price || 0),
      edit_quota_addition: Math.max(0, Math.round(Number(addon.edit_quota_addition || 0)))
    });
    const sig = JSON.stringify(cleanAddon);
    if (known.addons.get(addon.id) !== sig) {
      known.addons.set(addon.id, sig);
      ops.push({
        type: 'set',
        path: ['addons', addon.id],
        data: { ...cleanAddon, server_updated_at: serverTimestamp() }
      });
    }
  }
  for (const oldId of Array.from(known.addons.keys())) {
    if (!activeAddonIds.has(oldId)) {
      known.addons.delete(oldId);
      ops.push({ type: 'delete', path: ['addons', oldId] });
    }
  }

  // 6. Activity Logs (cap latest 200 in cloud)
  const cappedLogs = snapshot.logs.slice(0, 200);
  const activeLogIds = new Set<string>();
  for (const logItem of cappedLogs) {
    activeLogIds.add(logItem.id);
    const cleanLog = sanitizeForFirestore(logItem);
    const sig = JSON.stringify(cleanLog);
    if (known.logs.get(logItem.id) !== sig) {
      known.logs.set(logItem.id, sig);
      ops.push({
        type: 'set',
        path: ['activity_logs', logItem.id],
        data: { ...cleanLog, server_created_at: serverTimestamp() }
      });
    }
  }
  for (const oldId of Array.from(known.logs.keys())) {
    if (!activeLogIds.has(oldId)) {
      known.logs.delete(oldId);
      ops.push({ type: 'delete', path: ['activity_logs', oldId] });
    }
  }

  // 7. Notifications (cap latest 80 in cloud)
  const cappedNotifs = snapshot.notifications.slice(0, 80);
  const activeNotifIds = new Set<string>();
  for (const notif of cappedNotifs) {
    activeNotifIds.add(notif.id);
    const cleanNotif = sanitizeForFirestore(notif);
    const sig = JSON.stringify(cleanNotif);
    if (known.notifications.get(notif.id) !== sig) {
      known.notifications.set(notif.id, sig);
      ops.push({
        type: 'set',
        path: ['notifications', notif.id],
        data: { ...cleanNotif, server_created_at: serverTimestamp() }
      });
    }
  }
  for (const oldId of Array.from(known.notifications.keys())) {
    if (!activeNotifIds.has(oldId)) {
      known.notifications.delete(oldId);
      ops.push({ type: 'delete', path: ['notifications', oldId] });
    }
  }

  // 8. Studio Settings & FG Board Header
  const settingsData = sanitizeForFirestore({
    selectedYear: Math.round(Number(snapshot.selectedYear || 2027)),
    photographers: snapshot.photographers.slice(0, 100),
    messageTemplates: snapshot.messageTemplates,
    driveConfig: snapshot.driveConfig
  });
  const settingsSig = JSON.stringify(settingsData);
  if (known.settingsSig !== settingsSig) {
    known.settingsSig = settingsSig;
    ops.push({
      type: 'set',
      path: ['settings', 'studio'],
      data: { ...settingsData, server_updated_at: serverTimestamp() }
    });
  }

  const fgBoardHeader = sanitizeForFirestore({
    selectedYear: Math.round(Number(snapshot.selectedYear || 2027)),
    photographers: snapshot.photographers.slice(0, 100)
  });
  const fgBoardSig = JSON.stringify(fgBoardHeader);
  if (known.fgBoardSig !== fgBoardSig) {
    known.fgBoardSig = fgBoardSig;
    ops.push({
      type: 'set',
      path: ['fg_boards', fgBoardHash],
      data: { ...fgBoardHeader, server_updated_at: serverTimestamp() }
    });
  }

  await commitBatchOps(ops);
}

export async function loadInitialFirestoreState(
  known: KnownFirestoreIds,
  fgBoardHash: string
): Promise<{ hasCloudData: boolean; partial: Partial<BestariSnapshotPayload> }> {
  if (!isFirebaseAdminUser(auth.currentUser)) {
    return { hasCloudData: false, partial: {} };
  }

  try {
    const [
      clientsSnap,
      reqSnap,
      txSnap,
      pkgSnap,
      addonSnap,
      logSnap,
      notifSnap,
      settingsSnap,
      portalSnap,
      fgSessionsSnap
    ] = await Promise.all([
      getDocs(collection(db, 'clients')),
      getDocs(collection(db, 'booking_requests')),
      getDocs(collection(db, 'transactions')),
      getDocs(collection(db, 'packages')),
      getDocs(collection(db, 'addons')),
      getDocs(collection(db, 'activity_logs')),
      getDocs(collection(db, 'notifications')),
      getDoc(doc(db, 'settings', 'studio')),
      getDocs(collection(db, 'portal_cards')),
      getDocs(collection(db, 'fg_boards', fgBoardHash, 'sessions'))
    ]);

    const stripMeta = <T extends Record<string, unknown>>(raw: T): T => {
      const clone = { ...raw };
      delete clone.server_updated_at;
      delete clone.server_created_at;
      return clone;
    };

    const clients = clientsSnap.docs.map(d => {
      const clean = stripMeta(d.data()) as unknown as ClientBooking;
      known.clients.set(d.id, JSON.stringify(sanitizeForFirestore(clean)));
      return clean;
    });

    const requests = reqSnap.docs
      .map(d => {
        const clean = stripMeta(d.data()) as unknown as BookingRequest;
        known.requests.set(d.id, JSON.stringify(sanitizeForFirestore(clean)));
        return clean;
      })
      .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));

    const transactions = txSnap.docs
      .map(d => {
        const clean = stripMeta(d.data()) as unknown as Transaction;
        known.transactions.set(d.id, JSON.stringify(sanitizeForFirestore(clean)));
        return clean;
      })
      .sort((a, b) => (b.created_at || b.date || '').localeCompare(a.created_at || a.date || ''));

    const packages = pkgSnap.docs.map(d => {
      const clean = stripMeta(d.data()) as unknown as PackagePlan;
      known.packages.set(d.id, JSON.stringify(sanitizeForFirestore(clean)));
      return clean;
    });

    const addons = addonSnap.docs.map(d => {
      const clean = stripMeta(d.data()) as unknown as AddOnItem;
      known.addons.set(d.id, JSON.stringify(sanitizeForFirestore(clean)));
      return clean;
    });

    const logs = logSnap.docs
      .map(d => {
        const clean = stripMeta(d.data()) as unknown as ActivityLogItem;
        known.logs.set(d.id, JSON.stringify(sanitizeForFirestore(clean)));
        return clean;
      })
      .sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));

    const notifications = notifSnap.docs
      .map(d => {
        const clean = stripMeta(d.data()) as unknown as SystemNotification;
        known.notifications.set(d.id, JSON.stringify(sanitizeForFirestore(clean)));
        return clean;
      })
      .sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));

    portalSnap.docs.forEach(d => {
      const clean = stripMeta(d.data());
      known.portalCards.set(d.id, JSON.stringify(sanitizeForFirestore(clean)));
    });

    fgSessionsSnap.docs.forEach(d => {
      const clean = stripMeta(d.data());
      known.fgSessions.set(d.id, JSON.stringify(sanitizeForFirestore(clean)));
    });

    const partial: Partial<BestariSnapshotPayload> = {};
    if (clients.length > 0) partial.clients = clients;
    if (requests.length > 0 || clients.length > 0) partial.requests = requests;
    if (transactions.length > 0 || clients.length > 0) partial.transactions = transactions;
    if (packages.length > 0) partial.packages = packages;
    if (addons.length > 0) partial.addons = addons;
    if (logs.length > 0) partial.logs = logs;
    if (notifications.length > 0) partial.notifications = notifications;

    if (settingsSnap.exists()) {
      const sData = stripMeta(settingsSnap.data());
      known.settingsSig = JSON.stringify(sanitizeForFirestore(sData));
      if (typeof sData.selectedYear === 'number') partial.selectedYear = sData.selectedYear;
      if (Array.isArray(sData.photographers)) {
        partial.photographers = sData.photographers as string[];
      }
      if (sData.messageTemplates) {
        partial.messageTemplates = sData.messageTemplates as MessageTemplates;
      }
      if (sData.driveConfig) {
        partial.driveConfig = sData.driveConfig as DriveConfigSettings;
      }
    }

    const hasCloudData =
      clients.length > 0 || packages.length > 0 || settingsSnap.exists() || requests.length > 0;

    return { hasCloudData, partial };
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, 'clients');
  }
}

export function subscribeAdminLiveQueues(callbacks: {
  onNewPublicRequest: (reqs: BookingRequest[]) => void;
  onPortalSubmissions: (items: PortalSubmissionDoc[]) => void;
  onFgUpdates: (items: FgFieldUpdateDoc[]) => void;
}): Unsubscribe {
  const unsubs: Unsubscribe[] = [];

  unsubs.push(
    onSnapshot(
      collection(db, 'booking_requests'),
      snap => {
        const list = snap.docs
          .map(d => {
            const raw = { ...d.data() } as Record<string, unknown>;
            delete raw.server_created_at;
            return raw as unknown as BookingRequest;
          })
          .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
        callbacks.onNewPublicRequest(list);
      },
      err => handleFirestoreError(err, OperationType.LIST, 'booking_requests')
    )
  );

  unsubs.push(
    onSnapshot(
      collection(db, 'portal_submissions'),
      snap => {
        if (snap.empty) return;
        const items = snap.docs.map(d => {
          const raw = { ...d.data() } as Record<string, unknown>;
          delete raw.server_created_at;
          return raw as unknown as PortalSubmissionDoc;
        });
        callbacks.onPortalSubmissions(items);
      },
      err => handleFirestoreError(err, OperationType.LIST, 'portal_submissions')
    )
  );

  unsubs.push(
    onSnapshot(
      collection(db, 'fg_updates'),
      snap => {
        if (snap.empty) return;
        const items = snap.docs.map(d => {
          const raw = { ...d.data() } as Record<string, unknown>;
          delete raw.server_created_at;
          return raw as unknown as FgFieldUpdateDoc;
        });
        callbacks.onFgUpdates(items);
      },
      err => handleFirestoreError(err, OperationType.LIST, 'fg_updates')
    )
  );

  return () => {
    unsubs.forEach(fn => fn());
  };
}

export async function deleteProcessedQueueDocs(
  collectionName: 'portal_submissions' | 'fg_updates',
  ids: string[]
): Promise<void> {
  for (const id of ids) {
    try {
      await deleteDoc(doc(db, collectionName, id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `${collectionName}/${id}`);
    }
  }
}

// ============================================================================
// PUBLIC RESERVATION FORM (?book=1), CLIENT PORTAL, & FG PORTAL FIRESTORE APIs
// ============================================================================

export async function fetchPublicCatalogFromFirestore(): Promise<{
  packages: PackagePlan[];
  addons: AddOnItem[];
} | null> {
  try {
    const [pkgSnap, addonSnap] = await Promise.all([
      getDocs(query(collection(db, 'packages'), where('is_active', '==', true))),
      getDocs(query(collection(db, 'addons'), where('price', '>=', 0)))
    ]);

    const packages = pkgSnap.docs.map(d => {
      const raw = { ...d.data() } as Record<string, unknown>;
      delete raw.server_updated_at;
      return raw as unknown as PackagePlan;
    });

    const addons = addonSnap.docs.map(d => {
      const raw = { ...d.data() } as Record<string, unknown>;
      delete raw.server_updated_at;
      return raw as unknown as AddOnItem;
    });

    if (packages.length === 0) return null;
    return { packages, addons };
  } catch {
    return null;
  }
}

export async function submitPublicBookingToFirestore(
  reqData: BookingRequest
): Promise<void> {
  const path = `booking_requests/${reqData.id}`;
  const cleanPayload = sanitizeForFirestore({
    id: reqData.id,
    client_name: reqData.client_name.slice(0, 120),
    phone: reqData.phone.slice(0, 32),
    instagram: reqData.instagram ? reqData.instagram.slice(0, 80) : undefined,
    campus: reqData.campus.slice(0, 120),
    region: reqData.region,
    package_id: reqData.package_id.slice(0, 64),
    package_name: reqData.package_name.slice(0, 120),
    package_price: Number(reqData.package_price || 0),
    total_price: Number(reqData.total_price || reqData.package_price || 0),
    selected_addons: Array.isArray(reqData.selected_addons)
      ? reqData.selected_addons.slice(0, 20)
      : [],
    photo_date: reqData.photo_date ? reqData.photo_date.slice(0, 32) : undefined,
    session_time: reqData.session_time ? reqData.session_time.slice(0, 64) : undefined,
    photo_location: reqData.photo_location ? reqData.photo_location.slice(0, 160) : undefined,
    notes: reqData.notes ? reqData.notes.slice(0, 500) : undefined,
    status: 'new',
    created_at: reqData.created_at,
    expires_at: reqData.expires_at,
    dp_verified: false,
    warning_duplicate: Boolean(reqData.warning_duplicate)
  });

  try {
    await setDoc(doc(db, 'booking_requests', reqData.id), {
      ...cleanPayload,
      server_created_at: serverTimestamp()
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function fetchPortalCardByCredentials(
  clientIdQuery: string,
  pin: string
): Promise<{
  cardHash: string;
  card: PortalCardDoc;
  addons: AddOnItem[];
} | null> {
  const normalizedQuery = clientIdQuery.trim().toLowerCase();
  const normalizedPin = pin.trim();
  if (!normalizedQuery || !normalizedPin) return null;

  const cardHash = await sha256Hex(`${normalizedQuery}:${normalizedPin}`);
  try {
    const snap = await getDoc(doc(db, 'portal_cards', cardHash));
    if (!snap.exists()) return null;

    const raw = { ...snap.data() } as Record<string, unknown>;
    delete raw.server_updated_at;

    let addons: AddOnItem[] = [];
    try {
      const addonSnap = await getDocs(query(collection(db, 'addons'), where('price', '>=', 0)));
      addons = addonSnap.docs.map(d => {
        const a = { ...d.data() } as Record<string, unknown>;
        delete a.server_updated_at;
        return a as unknown as AddOnItem;
      });
    } catch {
      // Optional catalog lookup
    }

    return {
      cardHash,
      card: raw as unknown as PortalCardDoc,
      addons
    };
  } catch {
    return null;
  }
}

export async function submitPortalActionToFirestore(params: {
  cardHash: string;
  clientId: string;
  action: PortalSubmissionDoc['action'];
  selectedIds?: string[];
  rating?: number;
  comment?: string;
}): Promise<void> {
  const id = `psub-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const path = `portal_submissions/${id}`;
  const payload = sanitizeForFirestore({
    id,
    card_hash: params.cardHash,
    client_id: params.clientId,
    action: params.action,
    selected_ids: params.selectedIds ? params.selectedIds.slice(0, 200) : undefined,
    rating:
      typeof params.rating === 'number' && params.rating >= 1 && params.rating <= 5
        ? Math.round(params.rating)
        : undefined,
    comment: params.comment ? params.comment.slice(0, 600) : undefined,
    created_at: new Date().toISOString()
  });

  try {
    await setDoc(doc(db, 'portal_submissions', id), {
      ...payload,
      server_created_at: serverTimestamp()
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function fetchFgBoardByPin(pin: string): Promise<{
  boardHash: string;
  selectedYear: number;
  photographers: string[];
  sessions: FgSessionCardDoc[];
} | null> {
  const cleanPin = pin.trim();
  if (!cleanPin) return null;

  const boardHash = await sha256Hex(`fg:${cleanPin}`);
  try {
    const boardSnap = await getDoc(doc(db, 'fg_boards', boardHash));
    if (!boardSnap.exists()) return null;

    const boardData = boardSnap.data() as {
      selectedYear?: number;
      photographers?: string[];
    };
    const sessionsSnap = await getDocs(collection(db, 'fg_boards', boardHash, 'sessions'));
    const sessions = sessionsSnap.docs.map(d => {
      const raw = { ...d.data() } as Record<string, unknown>;
      delete raw.server_updated_at;
      return raw as unknown as FgSessionCardDoc;
    });

    return {
      boardHash,
      selectedYear: typeof boardData.selectedYear === 'number' ? boardData.selectedYear : 2027,
      photographers: Array.isArray(boardData.photographers) ? boardData.photographers : [],
      sessions
    };
  } catch {
    return null;
  }
}

export async function submitFgUpdateToFirestore(params: {
  boardHash: string;
  clientId: string;
  action: 'mark_photo_session' | 'mark_jpg_uploaded';
  fgName: string;
}): Promise<void> {
  const id = `fgu-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const path = `fg_updates/${id}`;
  try {
    await setDoc(doc(db, 'fg_updates', id), {
      id,
      board_hash: params.boardHash,
      client_id: params.clientId,
      action: params.action,
      fg_name: (params.fgName || 'Tim FG').slice(0, 120),
      created_at: new Date().toISOString(),
      server_created_at: serverTimestamp()
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}
