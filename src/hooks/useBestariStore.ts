import { setAdminWhatsapp } from '../utils/adminContact';
import { useState, useEffect, useRef, useCallback } from 'react';
import {
  ClientBooking,
  BookingRequest,
  Transaction,
  AddOnItem,
  ActivityLogItem,
  AuditEventType,
  PackagePlan,
  SystemNotification,
  PaymentStatus,
  MessageTemplates,
  DriveConfigSettings
} from '../types';
import {
  INITIAL_CLIENTS,
  SAMPLE_25_CLIENTS,
  INITIAL_REQUESTS,
  INITIAL_TRANSACTIONS,
  INITIAL_NOTIFICATIONS,
  INITIAL_ACTIVITY_LOGS,
  INITIAL_PACKAGES,
  INITIAL_ADDONS
} from '../services/mockData';
import {
  generateBookingId,
  generatePinFromDate,
  getAuditStatusLabel
} from '../utils/formatters';
import {
  initDriveAuth,
  googleDriveSignIn,
  googleDriveSignOut,
  getDriveAccessToken,
  uploadInvoicePdfToDriveFolder,
  createStructuredClientDriveFolders,
  buildClientDrivePathParts,
  DEFAULT_MAIN_DRIVE_URL,
  DEFAULT_ANNOUNCEMENT_TEMPLATE_URL
} from '../services/googleDriveAuth';
import {
  buildInvoiceFileName,
  buildInvoiceNumber,
  generateInvoicePdfBlob
} from '../utils/invoiceGenerator';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth } from '../lib/firebase';
import {
  createEmptyKnownIds,
  deleteProcessedQueueDocs,
  getFgBoardHashFromServer,
  isFirebaseAdminUser,
  loadInitialFirestoreState,
  sanitizeForFirestore,
  subscribeAdminLiveQueues,
  syncSnapshotToFirestore,
  type FgFieldUpdateDoc,
  type KnownFirestoreIds,
  type PortalSubmissionDoc
} from '../services/firestoreSync';

const STORAGE_KEYS = {
  CLIENTS: 'bestari_clients_v1',
  SAMPLE_25_SEEDED: 'bestari_sample25_seeded_v1',
  REQUESTS: 'bestari_requests_v1',
  TRANSACTIONS: 'bestari_transactions_v1',
  PACKAGES: 'bestari_packages_v1',
  ADDONS: 'bestari_addons_v1',
  LOGS: 'bestari_logs_v2',
  NOTIFICATIONS: 'bestari_notifications_v1',
  SELECTED_YEAR: 'bestari_selected_year_v1',
  PHOTOGRAPHERS: 'bestari_photographers_v1',
  MESSAGE_TEMPLATES: 'bestari_message_templates_v1',
  DRIVE_CONFIG: 'bestari_drive_config_v1'
};

export const DEFAULT_DRIVE_CONFIG: DriveConfigSettings = {
  main_drive_url: DEFAULT_MAIN_DRIVE_URL,
  announcement_template_url: DEFAULT_ANNOUNCEMENT_TEMPLATE_URL
};

export const DEFAULT_PHOTOGRAPHERS: string[] = [
  'Dimas Prasetyo',
  'Ryan Firmansyah',
  'Fajar Nugraha',
  'Bima Satria'
];

export const DEFAULT_MESSAGE_TEMPLATES: MessageTemplates = {
  dp_followup:
    'Halo Kak {client_name}, terima kasih sudah mengisi formulir booking Bestari Graduation untuk paket {package_name} di kampus {campus}.\n\nUntuk mengamankan jadwal sesi foto, silakan melakukan pembayaran DP sebesar Rp 100.000 ke rekening:\nSeaBank 901507540052 a/n Ivandra Bagus Pranata.\n\nSetelah transfer, kirimkan bukti ke sini ya kak. Terima kasih! #WhereDreamsMeetReality',
  booking_confirmed_copy: [
    '✨ *BOOKING BERHASIL DIKONFIRMASI!*',
    '',
    'Halo, Kak {client_name}! 👋',
    '',
    'Terima kasih sudah booking dan melakukan pembayaran DP bersama *Bestari Graduation*. Slot Kakak sudah aman terjadwal! 🎓✨',
    '',
    'Berikut akses *Client Portal* pribadi Kakak:',
    '',
    '🔗 {portal_url}',
    '🪪 *ID Klien:* {client_id}',
    '🔐 *PIN Akses:* {pin}',
    '',
    'Melalui portal ini, Kakak bisa memantau jadwal, mengakses galeri foto, dan memilih foto untuk diedit.',
    '',
    'Ada beberapa hal yang perlu diperhatikan, ya, Kak:',
    '',
    '1. Jadwal masih bisa berubah maksimal H-7, selama slot pengganti tersedia.',
    '2. Pelunasan dilakukan maksimal H-1 sebelum sesi foto.',
    '3. Tim fotografer kami akan menghubungi Kakak H-1 untuk koordinasi sesi. Jika belum dihubungi, silakan kabari admin kembali.',
    '',
    'Simpan informasi akses portalnya baik-baik, ya!',
    '',
    'Semoga nanti sesinya berjalan lancar dan jadi pengalaman yang menyenangkan bersama Bestari! 🤗'
  ].join('\n'),
  pelunasan_fg_reminder:
    'Halo Kak {client_name}, mengingatkan jadwal sesi foto wisuda Bestari Graduation pada {photo_date} pukul {session_time} WIB di {photo_location}.\n\nFotografer bertugas: {photographer}.\nSisa pelunasan paket: {remaining_balance} ke SeaBank 901507540052 a/n Ivandra Bagus Pranata. Terima kasih!'
};

const FIELD_LABELS: Record<string, string> = {
  client_name: 'Nama Klien',
  phone: 'WhatsApp',
  instagram: 'Instagram',
  campus: 'Kampus',
  region_id: 'Wilayah',
  photo_location: 'Lokasi Foto',
  photo_date: 'Tanggal Foto',
  session_time: 'Jam Sesi',
  photographer: 'Fotografer (FG)',
  package_name: 'Paket',
  edit_quota: 'Kuota Edit',
  drive_folder_url: 'Link Drive',
  notes: 'Catatan',
  selected_photo_ids: 'Pilihan Foto',
  feedback_rating: 'Rating Bintang',
  feedback_comment: 'Komentar Ulasan',
  feedback_skipped: 'Status Ulasan'
};

export interface AuditLogInput {
  action: string;
  details: string;
  event_type?: AuditEventType;
  from_status?: string;
  to_status?: string;
  order_id?: string;
  client_id?: string;
  client_name?: string;
  actor?: string;
  admin_user_id?: string;
  changed_fields?: string[];
}

function safeStorageParse<T>(key: string, fallback: T): T {
  try {
    const saved = localStorage.getItem(key);
    if (!saved) return fallback;
    return JSON.parse(saved) as T;
  } catch {
    return fallback;
  }
}

export function useBestariStore(isAdminAuthenticated: boolean = false) {
  const [selectedYear, setSelectedYear] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.SELECTED_YEAR);
      const parsed = saved ? parseInt(saved, 10) : 2027;
      return Number.isFinite(parsed) ? parsed : 2027;
    } catch {
      return 2027;
    }
  });

  const activeAdmin = {
    id: 'ADM-001',
    name: 'Bestari Admin',
    role: 'Admin'
  };

  const [clients, setClients] = useState<ClientBooking[]>(() => {
    const loaded = safeStorageParse<ClientBooking[]>(STORAGE_KEYS.CLIENTS, INITIAL_CLIENTS);
    let baseList = Array.isArray(loaded) ? loaded : INITIAL_CLIENTS;

    try {
      const hasSeededSample25 = localStorage.getItem(STORAGE_KEYS.SAMPLE_25_SEEDED) === 'true';
      if (!hasSeededSample25) {
        const existingIds = new Set(baseList.map(c => c.id));
        const existingOrderIds = new Set(baseList.map(c => c.order_id));
        const missingSamples = SAMPLE_25_CLIENTS.filter(
          sc => !existingIds.has(sc.id) && !existingOrderIds.has(sc.order_id)
        );
        if (missingSamples.length > 0) {
          baseList = [...baseList, ...missingSamples];
        }
        localStorage.setItem(STORAGE_KEYS.SAMPLE_25_SEEDED, 'true');
      }
    } catch {
      // Ignore storage write errors
    }

    return baseList.map((c, idx) => ({
      ...c,
      total_price: c.total_price || c.package_price || 0,
      selected_addons: Array.isArray(c.selected_addons) ? c.selected_addons : [],
      selected_photo_ids: Array.isArray(c.selected_photo_ids) ? c.selected_photo_ids : [],
      client_id_display:
        c.client_id_display ||
        c.order_id?.match(/INV(\d{3})/i)?.[1] ||
        String(idx + 1).padStart(3, '0'),
      portal_pin_display: c.portal_pin_display || generatePinFromDate(c.booking_date || '2027-01-12')
    }));
  });

  const [requests, setRequests] = useState<BookingRequest[]>(() => {
    const loaded = safeStorageParse<BookingRequest[]>(STORAGE_KEYS.REQUESTS, INITIAL_REQUESTS);
    return Array.isArray(loaded) ? loaded : INITIAL_REQUESTS;
  });

  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    const loaded = safeStorageParse<Transaction[]>(STORAGE_KEYS.TRANSACTIONS, INITIAL_TRANSACTIONS);
    return Array.isArray(loaded) ? loaded : INITIAL_TRANSACTIONS;
  });

  const [packages, setPackages] = useState<PackagePlan[]>(() => {
    const loaded = safeStorageParse<PackagePlan[]>(STORAGE_KEYS.PACKAGES, INITIAL_PACKAGES);
    return Array.isArray(loaded) ? loaded : INITIAL_PACKAGES;
  });

  const [addons, setAddons] = useState<AddOnItem[]>(() => {
    const loaded = safeStorageParse<AddOnItem[]>(STORAGE_KEYS.ADDONS, INITIAL_ADDONS);
    return Array.isArray(loaded) ? loaded : INITIAL_ADDONS;
  });

  const [logs, setLogs] = useState<ActivityLogItem[]>(() => {
    const loaded = safeStorageParse<ActivityLogItem[]>(STORAGE_KEYS.LOGS, INITIAL_ACTIVITY_LOGS);
    if (!Array.isArray(loaded)) return INITIAL_ACTIVITY_LOGS;
    return loaded.map(item => ({
      ...item,
      admin_user_id: item.admin_user_id || 'ADM-001'
    }));
  });

  const [notifications, setNotifications] = useState<SystemNotification[]>(() => {
    const loaded = safeStorageParse<SystemNotification[]>(
      STORAGE_KEYS.NOTIFICATIONS,
      INITIAL_NOTIFICATIONS
    );
    return Array.isArray(loaded) ? loaded : INITIAL_NOTIFICATIONS;
  });

  const [photographers, setPhotographers] = useState<string[]>(() => {
    const loaded = safeStorageParse<string[]>(
      STORAGE_KEYS.PHOTOGRAPHERS,
      DEFAULT_PHOTOGRAPHERS
    );
    return Array.isArray(loaded) && loaded.length > 0 ? loaded : DEFAULT_PHOTOGRAPHERS;
  });

  const [messageTemplates, setMessageTemplates] = useState<MessageTemplates>(() => {
    const loaded = safeStorageParse<Partial<MessageTemplates>>(
      STORAGE_KEYS.MESSAGE_TEMPLATES,
      DEFAULT_MESSAGE_TEMPLATES
    );
    return {
      ...DEFAULT_MESSAGE_TEMPLATES,
      ...(loaded && typeof loaded === 'object' ? loaded : {})
    };
  });

  // Google Drive Root & Announcement Template config
  const [driveConfig, setDriveConfig] = useState<DriveConfigSettings>(() => {
    const loaded = safeStorageParse<Partial<DriveConfigSettings>>(
      STORAGE_KEYS.DRIVE_CONFIG,
      DEFAULT_DRIVE_CONFIG
    );
    return {
      main_drive_url: loaded?.main_drive_url?.trim() || DEFAULT_MAIN_DRIVE_URL,
      announcement_template_url:
        loaded?.announcement_template_url?.trim() || DEFAULT_ANNOUNCEMENT_TEMPLATE_URL
    };
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.DRIVE_CONFIG, JSON.stringify(driveConfig));
  }, [driveConfig]);

  // Google Drive Auth state (access token is kept strictly in memory by googleDriveAuth)
  const [driveUser, setDriveUser] = useState<User | null>(null);
  const [isDriveConnected, setIsDriveConnected] = useState<boolean>(false);
  const [isConnectingDrive, setIsConnectingDrive] = useState<boolean>(false);
  const [driveAuthError, setDriveAuthError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = initDriveAuth(
      user => {
        setDriveUser(user);
        setIsDriveConnected(Boolean(getDriveAccessToken()));
        setDriveAuthError(null);
      },
      () => {
        setDriveUser(null);
        setIsDriveConnected(false);
      }
    );
    return () => unsubscribe();
  }, []);

  // Sync to local storage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.SELECTED_YEAR, selectedYear.toString());
  }, [selectedYear]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.CLIENTS, JSON.stringify(clients));
  }, [clients]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.REQUESTS, JSON.stringify(requests));
  }, [requests]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(transactions));
  }, [transactions]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.PACKAGES, JSON.stringify(packages));
  }, [packages]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.ADDONS, JSON.stringify(addons));
  }, [addons]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify(logs));
  }, [logs]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(notifications));
  }, [notifications]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.PHOTOGRAPHERS, JSON.stringify(photographers));
  }, [photographers]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.MESSAGE_TEMPLATES, JSON.stringify(messageTemplates));
    setAdminWhatsapp(messageTemplates.admin_whatsapp);
  }, [messageTemplates]);

  // Phase 2 + Cloud Firestore Synchronization
  const hasHydratedFromServerRef = useRef(false);
  const skipNextServerSyncRef = useRef(false);
  const knownFirestoreRef = useRef<KnownFirestoreIds>(createEmptyKnownIds());
  const fgBoardHashRef = useRef<string>('');
  const processedCloudReqIdsRef = useRef<Set<string>>(new Set(requests.map(r => r.id)));
  const processingQueueIdsRef = useRef<Set<string>>(new Set());

  const [isCloudAdminReady, setIsCloudAdminReady] = useState<boolean>(() =>
    isFirebaseAdminUser(auth.currentUser)
  );

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, user => {
      setIsCloudAdminReady(isFirebaseAdminUser(user));
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    requests.forEach(r => processedCloudReqIdsRef.current.add(r.id));
  }, [requests]);

  const pushStateToServer = useCallback(
    async (snapshot: {
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
    }) => {
      try {
        await fetch('/api/state', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(snapshot)
        });
      } catch {
        // Offline / transient network errors fall back gracefully to localStorage
      }
    },
    []
  );

  const applyServerStateSnapshot = useCallback((s: any) => {
    skipNextServerSyncRef.current = true;
    if (Array.isArray(s.clients)) setClients(s.clients);
    if (Array.isArray(s.requests)) {
      s.requests.forEach((r: BookingRequest) => processedCloudReqIdsRef.current.add(r.id));
      setRequests(s.requests);
    }
    if (Array.isArray(s.transactions)) setTransactions(s.transactions);
    if (Array.isArray(s.packages) && s.packages.length > 0) setPackages(s.packages);
    if (Array.isArray(s.addons)) setAddons(s.addons);
    if (Array.isArray(s.logs)) setLogs(s.logs);
    if (Array.isArray(s.notifications)) setNotifications(s.notifications);
    if (typeof s.selectedYear === 'number') setSelectedYear(s.selectedYear);
    if (Array.isArray(s.photographers) && s.photographers.length > 0) {
      setPhotographers(s.photographers);
    }
    if (s.messageTemplates && typeof s.messageTemplates === 'object') {
      setMessageTemplates({ ...DEFAULT_MESSAGE_TEMPLATES, ...s.messageTemplates });
    }
    if (s.driveConfig && typeof s.driveConfig === 'object') {
      setDriveConfig({
        main_drive_url: s.driveConfig.main_drive_url?.trim() || DEFAULT_MAIN_DRIVE_URL,
        announcement_template_url:
          s.driveConfig.announcement_template_url?.trim() || DEFAULT_ANNOUNCEMENT_TEMPLATE_URL
      });
    }
  }, []);

  const refreshFromServer = useCallback(async () => {
    if (!isAdminAuthenticated) return;
    try {
      const res = await fetch('/api/state', { credentials: 'include' });
      if (!res.ok) return;
      const data = (await res.json()) as { initialized?: boolean; state?: any };
      if (data.initialized && data.state) {
        applyServerStateSnapshot(data.state);
      }
    } catch {
      // Ignore transient offline error
    }
  }, [applyServerStateSnapshot, isAdminAuthenticated]);

  // Initial server + Cloud Firestore hydration & automatic one-time migration
  useEffect(() => {
    if (!isAdminAuthenticated) {
      hasHydratedFromServerRef.current = false;
      knownFirestoreRef.current = createEmptyKnownIds();
      return;
    }

    let cancelled = false;
    (async () => {
      let baseSnapshot = {
        clients,
        requests,
        transactions,
        packages,
        addons,
        logs,
        notifications,
        selectedYear,
        photographers,
        messageTemplates,
        driveConfig
      };

      try {
        const res = await fetch('/api/state', { credentials: 'include' });
        if (res.ok && !cancelled) {
          const data = (await res.json()) as { initialized?: boolean; state?: any };
          if (data.initialized && data.state) {
            baseSnapshot = {
              clients: Array.isArray(data.state.clients) ? data.state.clients : baseSnapshot.clients,
              requests: Array.isArray(data.state.requests) ? data.state.requests : baseSnapshot.requests,
              transactions: Array.isArray(data.state.transactions)
                ? data.state.transactions
                : baseSnapshot.transactions,
              packages:
                Array.isArray(data.state.packages) && data.state.packages.length > 0
                  ? data.state.packages
                  : baseSnapshot.packages,
              addons: Array.isArray(data.state.addons) ? data.state.addons : baseSnapshot.addons,
              logs: Array.isArray(data.state.logs) ? data.state.logs : baseSnapshot.logs,
              notifications: Array.isArray(data.state.notifications)
                ? data.state.notifications
                : baseSnapshot.notifications,
              selectedYear:
                typeof data.state.selectedYear === 'number'
                  ? data.state.selectedYear
                  : baseSnapshot.selectedYear,
              photographers:
                Array.isArray(data.state.photographers) && data.state.photographers.length > 0
                  ? data.state.photographers
                  : baseSnapshot.photographers,
              messageTemplates: data.state.messageTemplates
                ? { ...DEFAULT_MESSAGE_TEMPLATES, ...data.state.messageTemplates }
                : baseSnapshot.messageTemplates,
              driveConfig: data.state.driveConfig
                ? {
                    main_drive_url:
                      data.state.driveConfig.main_drive_url?.trim() || DEFAULT_MAIN_DRIVE_URL,
                    announcement_template_url:
                      data.state.driveConfig.announcement_template_url?.trim() ||
                      DEFAULT_ANNOUNCEMENT_TEMPLATE_URL
                  }
                : baseSnapshot.driveConfig
            };
            applyServerStateSnapshot(baseSnapshot);
          } else {
            await pushStateToServer(baseSnapshot);
          }
        }
      } catch {
        // Continue cleanly with localStorage if server unreachable
      }

      if (cancelled) return;

      if (isCloudAdminReady && isFirebaseAdminUser(auth.currentUser)) {
        try {
          const boardHash = await getFgBoardHashFromServer();
          if (cancelled) return;
          fgBoardHashRef.current = boardHash;

          const { hasCloudData, partial } = await loadInitialFirestoreState(
            knownFirestoreRef.current,
            boardHash
          );
          if (cancelled) return;

          if (hasCloudData) {
            const mergedSnapshot = {
              ...baseSnapshot,
              ...partial
            };
            applyServerStateSnapshot(mergedSnapshot);
            await pushStateToServer(mergedSnapshot);
          } else {
            await syncSnapshotToFirestore(
              baseSnapshot,
              knownFirestoreRef.current,
              boardHash
            );
          }
        } catch (err) {
          console.error('Firestore hydration warning:', err);
        }
      }

      if (!cancelled) {
        hasHydratedFromServerRef.current = true;
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isAdminAuthenticated, isCloudAdminReady]);

  // Real-time Firestore queue listeners (Public Bookings, Client Portal actions, FG Field Updates)
  useEffect(() => {
    if (!isAdminAuthenticated || !isCloudAdminReady) return;

    const unsub = subscribeAdminLiveQueues({
      onNewPublicRequest: (cloudReqs: BookingRequest[]) => {
        const unseen = cloudReqs.filter(r => !processedCloudReqIdsRef.current.has(r.id));
        if (unseen.length === 0) return;

        unseen.forEach(r => {
          processedCloudReqIdsRef.current.add(r.id);
          knownFirestoreRef.current.requests.set(
            r.id,
            JSON.stringify(sanitizeForFirestore(r))
          );
        });

        setRequests(prev => {
          const existingIds = new Set(prev.map(x => x.id));
          const fresh = unseen.filter(u => !existingIds.has(u.id));
          return fresh.length > 0 ? [...fresh, ...prev] : prev;
        });

        setNotifications(prev => [
          ...unseen.map(r => ({
            id: `notif-fs-${r.id}`,
            type: 'booking_request' as const,
            title: `Booking Request Baru · ${r.client_name}`,
            message: `${r.client_name} (${r.campus}) mengajukan paket ${r.package_name} via Form Publik.`,
            timestamp: r.created_at || new Date().toISOString(),
            read: false
          })),
          ...prev
        ].slice(0, 100));
      },
      onPortalSubmissions: (items: PortalSubmissionDoc[]) => {
        const pending = items.filter(it => !processingQueueIdsRef.current.has(it.id));
        if (pending.length === 0) return;
        pending.forEach(it => processingQueueIdsRef.current.add(it.id));

        const nowIso = new Date().toISOString();
        const todayStr = nowIso.split('T')[0];

        setClients(prev =>
          prev.map(c => {
            const matches = pending.filter(p => p.client_id === c.id);
            if (matches.length === 0) return c;
            let updated = { ...c };
            for (const sub of matches) {
              if (sub.action === 'start_selection') {
                const deadline = new Date();
                deadline.setDate(deadline.getDate() + 5);
                updated = {
                  ...updated,
                  status: 'selection_pending',
                  file_uploaded: true,
                  selection_deadline: deadline.toISOString().split('T')[0],
                  updated_at: nowIso
                };
              } else if (sub.action === 'submit_selection') {
                const ids = Array.isArray(sub.selected_ids) ? sub.selected_ids : [];
                const editingDeadline = new Date();
                editingDeadline.setDate(editingDeadline.getDate() + 10);
                updated = {
                  ...updated,
                  selection_submitted: true,
                  status: 'editing',
                  selected_photos_count: ids.length,
                  selected_photo_ids: ids,
                  selection_submitted_at: todayStr,
                  editing_deadline: editingDeadline.toISOString().split('T')[0],
                  updated_at: nowIso
                };
              } else if (sub.action === 'complete_final') {
                updated = { ...updated, status: 'completed', updated_at: nowIso };
              } else if (sub.action === 'submit_feedback') {
                updated = {
                  ...updated,
                  status: 'completed',
                  ...(typeof sub.rating === 'number' ? { feedback_rating: sub.rating } : {}),
                  feedback_comment: sub.comment || '',
                  feedback_skipped: false,
                  updated_at: nowIso
                };
              } else if (sub.action === 'skip_feedback') {
                updated = {
                  ...updated,
                  status: 'completed',
                  feedback_skipped: true,
                  updated_at: nowIso
                };
              }
            }
            return updated;
          })
        );

        void deleteProcessedQueueDocs(
          'portal_submissions',
          pending.map(p => p.id)
        );
      },
      onFgUpdates: (items: FgFieldUpdateDoc[]) => {
        const pending = items.filter(it => !processingQueueIdsRef.current.has(it.id));
        if (pending.length === 0) return;
        pending.forEach(it => processingQueueIdsRef.current.add(it.id));

        const nowIso = new Date().toISOString();
        setClients(prev =>
          prev.map(c => {
            const matches = pending.filter(u => u.client_id === c.id);
            if (matches.length === 0) return c;
            let updated = { ...c };
            for (const u of matches) {
              if (u.action === 'mark_photo_session' && updated.status === 'confirmed') {
                updated = { ...updated, status: 'photo_session', updated_at: nowIso };
              } else if (
                u.action === 'mark_jpg_uploaded' &&
                (updated.status === 'confirmed' || updated.status === 'photo_session')
              ) {
                updated = {
                  ...updated,
                  status: 'file_uploaded',
                  file_uploaded: true,
                  updated_at: nowIso
                };
              }
            }
            return updated;
          })
        );

        void deleteProcessedQueueDocs(
          'fg_updates',
          pending.map(p => p.id)
        );
      }
    });

    return () => unsub();
  }, [isAdminAuthenticated, isCloudAdminReady]);

  // Sync any local mutations back to Express cache & Cloud Firestore (debounced 250ms)
  const hasPendingLocalWriteRef = useRef(false);

  useEffect(() => {
    if (!isAdminAuthenticated || !hasHydratedFromServerRef.current) return;
    if (skipNextServerSyncRef.current) {
      skipNextServerSyncRef.current = false;
      return;
    }

    const snapshot = {
      clients,
      requests,
      transactions,
      packages,
      addons,
      logs,
      notifications,
      selectedYear,
      photographers,
      messageTemplates,
      driveConfig
    };

    hasPendingLocalWriteRef.current = true;
    const timer = window.setTimeout(() => {
      const serverPromise = pushStateToServer(snapshot);
      const cloudPromise =
        isCloudAdminReady && fgBoardHashRef.current
          ? syncSnapshotToFirestore(
              snapshot,
              knownFirestoreRef.current,
              fgBoardHashRef.current
            )
          : Promise.resolve();

      void Promise.allSettled([serverPromise, cloudPromise]).finally(() => {
        hasPendingLocalWriteRef.current = false;
      });
    }, 250);

    return () => window.clearTimeout(timer);
  }, [
    isAdminAuthenticated,
    isCloudAdminReady,
    clients,
    requests,
    transactions,
    packages,
    addons,
    logs,
    notifications,
    selectedYear,
    photographers,
    messageTemplates,
    driveConfig,
    pushStateToServer
  ]);

  // Keep Admin dashboard synced with server cache (focus + 20s poll)
  useEffect(() => {
    if (!isAdminAuthenticated) return;

    const handleSyncCheck = () => {
      if (document.visibilityState !== 'visible' || hasPendingLocalWriteRef.current) return;
      void refreshFromServer();
    };

    window.addEventListener('focus', handleSyncCheck);
    document.addEventListener('visibilitychange', handleSyncCheck);
    const intervalId = window.setInterval(handleSyncCheck, 20000);

    return () => {
      window.removeEventListener('focus', handleSyncCheck);
      document.removeEventListener('visibilitychange', handleSyncCheck);
      window.clearInterval(intervalId);
    };
  }, [isAdminAuthenticated, refreshFromServer]);

  // Auto-close Final Access and move to 07 Completed once 7 days expire
  useEffect(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const expiredClients = clients.filter(c => {
      if (c.status !== 'final_access' || !c.final_access_expires_at) return false;
      const expiry = new Date(c.final_access_expires_at);
      expiry.setHours(0, 0, 0, 0);
      return expiry.getTime() <= today.getTime();
    });

    if (expiredClients.length > 0) {
      const expiredIds = new Set(expiredClients.map(c => c.id));
      const nowIso = new Date().toISOString();
      setClients(prev =>
        prev.map(c =>
          expiredIds.has(c.id)
            ? { ...c, status: 'completed', updated_at: nowIso }
            : c
        )
      );
      expiredClients.forEach(c => {
        addLog({
          action: 'State Transition',
          event_type: 'state_transition',
          from_status: 'final_access',
          to_status: 'completed',
          details: 'Akses 7 hari Final Delivery berakhir — status otomatis masuk 07 Completed untuk ulasan klien',
          order_id: c.order_id,
          client_id: c.id,
          client_name: c.client_name,
          actor: 'Sistem Otomatis'
        });
      });
    }
  }, [clients]);

  // Helper to log structured audit events with second-precision timestamp & Admin User ID
  const addLog = (input: AuditLogInput) => {
    const now = new Date();
    const formattedTime = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(
      2,
      '0'
    )}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(
      2,
      '0'
    )}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

    const newLog: ActivityLogItem = {
      id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: formattedTime,
      actor: input.actor || activeAdmin.name,
      admin_user_id: input.admin_user_id || activeAdmin.id,
      event_type: input.event_type || 'data_update',
      from_status: input.from_status,
      to_status: input.to_status,
      action: input.action,
      details: input.details,
      order_id: input.order_id,
      client_id: input.client_id,
      client_name: input.client_name,
      changed_fields: input.changed_fields
    };

    setLogs(prev => [newLog, ...prev]);
  };

  // 1. Confirm Booking Request into Main Database & Auto-Create Structured Google Drive Folder
  const confirmBookingRequest = (requestId: string) => {
    const req = requests.find(r => r.id === requestId);
    if (!req) return null;

    const yearClients = clients.filter(c => c.booking_year === selectedYear);
    const nextSeq = yearClients.length + 1;
    const bookingDateStr = new Date().toISOString().split('T')[0];
    const newOrderId = generateBookingId(nextSeq, bookingDateStr);
    const pin = generatePinFromDate(bookingDateStr);
    const pkg = packages.find(p => p.id === req.package_id) || {
      name: req.package_name,
      price: 325000,
      edit_quota: 30
    };

    const client3DigitId = String(nextSeq).padStart(3, '0');

    const extraAddonQuota = (req.selected_addons || []).reduce((sum, addonName) => {
      const matched = addons.find(a => a.name === addonName);
      return sum + (matched?.edit_quota_addition || 0);
    }, 0);

    const draftForPath: ClientBooking = {
      id: `c-${Date.now()}`,
      order_id: newOrderId,
      client_id_display: client3DigitId,
      booking_year: selectedYear,
      booking_sequence: nextSeq,
      status: 'confirmed',
      booking_date: bookingDateStr,
      photo_date: req.photo_date || '',
      session_time: req.session_time || '10:00 - 11:30',
      region_id: req.region,
      package_id: req.package_id,
      package_name: req.package_name,
      package_price: pkg.price,
      total_price: req.total_price || pkg.price,
      selected_addons: req.selected_addons || [],
      client_name: req.client_name,
      campus: req.campus,
      photo_location: req.photo_location || `Kampus ${req.campus}`,
      photographer: 'Belum Ditugaskan',
      phone: req.phone,
      instagram: req.instagram || '',
      payment_status: 'DP',
      paid_amount: 100000,
      file_uploaded: false,
      selection_submitted: false,
      editing_finished: false,
      notes: req.notes || '',
      drive_folder_url: `https://drive.google.com/drive/folders/bestari-2027-${encodeURIComponent(
        req.client_name
      )}`,
      drive_folder_id: `folder_${newOrderId}`,
      edit_quota: pkg.edit_quota + extraAddonQuota,
      portal_pin_hash: `hash_${pin}`,
      portal_pin_display: pin,
      unique_token: `token_${Math.random().toString(36).substring(2, 10)}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const pathParts = buildClientDrivePathParts(draftForPath);
    const newClient: ClientBooking = {
      ...draftForPath,
      drive_folder_path: pathParts.fullPath
    };

    const dpTx: Transaction = {
      id: `tx-${Date.now()}`,
      date: bookingDateStr,
      client_id: newClient.id,
      client_name: newClient.client_name,
      order_id: newOrderId,
      type: 'DP',
      amount: 100000,
      payment_method: 'Transfer Bank (Verified)',
      status: 'verified',
      admin_notes: 'DP Booking awal diverifikasi otomatis saat konfirmasi',
      created_at: new Date().toISOString()
    };

    setClients(prev => [newClient, ...prev]);
    setRequests(prev => prev.filter(r => r.id !== requestId));
    setTransactions(prev => [dpTx, ...prev]);

    addLog({
      action: 'State Transition',
      event_type: 'state_transition',
      from_status: 'booking_request',
      to_status: 'confirmed',
      details: `Status changed from Booking Request to Booking Confirmed (PIN Portal: ${pin})`,
      order_id: newOrderId,
      client_id: newClient.id,
      client_name: newClient.client_name
    });

    // Automatically create structured Google Drive folder & mirror Announcement on Booking Confirmed
    const drivePromise = provisionClientDriveFolder(newClient.id, newClient);

    return { client: newClient, drivePromise };
  };

  // 2. Update Client Details & Track Every State Transition Cleanly
  const updateClient = (
    clientId: string,
    updates: Partial<ClientBooking>,
    auditMeta?: { actor?: string; adminUserId?: string }
  ) => {
    const existingClient = clients.find(c => c.id === clientId);
    if (!existingClient) return;

    const nowIso = new Date().toISOString();
    setClients(prev =>
      prev.map(c => (c.id === clientId ? { ...c, ...updates, updated_at: nowIso } : c))
    );

    const hasStatusChange =
      Boolean(updates.status) && updates.status !== existingClient.status;

    const changedFieldLabels: string[] = [];
    (Object.keys(FIELD_LABELS) as Array<keyof ClientBooking>).forEach(field => {
      if (field in updates) {
        const oldVal = JSON.stringify(existingClient[field] ?? '');
        const newVal = JSON.stringify(updates[field] ?? '');
        if (oldVal !== newVal) {
          changedFieldLabels.push(FIELD_LABELS[field as string]);
        }
      }
    });

    if (hasStatusChange && updates.status) {
      const fromLabel = getAuditStatusLabel(existingClient.status);
      const toLabel = getAuditStatusLabel(updates.status);
      const extraSuffix =
        updates.status === 'selection_submitted' && updates.selected_photos_count
          ? ` (${updates.selected_photos_count} foto dikirim klien)`
          : '';

      addLog({
        action: 'State Transition',
        event_type: 'state_transition',
        from_status: existingClient.status,
        to_status: updates.status,
        details: `Status changed from ${fromLabel} to ${toLabel}${extraSuffix}`,
        order_id: existingClient.order_id,
        client_id: existingClient.id,
        client_name: existingClient.client_name,
        actor: auditMeta?.actor,
        admin_user_id: auditMeta?.adminUserId,
        changed_fields: changedFieldLabels.length > 0 ? changedFieldLabels : undefined
      });

      if (
        updates.status === 'selection_submitted' ||
        (updates.status === 'editing' && auditMeta?.actor === 'Client Portal')
      ) {
        const selectionNotif: SystemNotification = {
          id: `notif-${Date.now()}`,
          type: 'selection_pending',
          title: 'Daftar Pilihan Foto Masuk',
          message: `${existingClient.client_name} (${existingClient.order_id}) mengirim ${
            updates.selected_photos_count || existingClient.edit_quota
          } foto pilihan dan langsung masuk tahap 05 Editing.`,
          timestamp: nowIso,
          read: false,
          order_id: existingClient.order_id,
          client_id: existingClient.id
        };
        setNotifications(prev => [selectionNotif, ...prev]);
      }
    }

    const hasFeedbackChange =
      (updates.feedback_rating !== undefined && updates.feedback_rating !== existingClient.feedback_rating) ||
      (updates.feedback_comment !== undefined && updates.feedback_comment !== existingClient.feedback_comment) ||
      (updates.feedback_skipped !== undefined && updates.feedback_skipped !== existingClient.feedback_skipped);

    if (hasFeedbackChange) {
      const assignedFg =
        existingClient.photographer &&
        existingClient.photographer.trim() !== '' &&
        existingClient.photographer !== 'Belum Ditugaskan'
          ? existingClient.photographer
          : null;

      let feedbackDetails = 'Klien memperbarui ulasan opsional.';
      if (updates.feedback_skipped && !updates.feedback_rating) {
        feedbackDetails = 'Klien memilih melewati pengisian rating/ulasan (Opsional)';
      } else if (typeof updates.feedback_rating === 'number' && updates.feedback_rating > 0) {
        const fgNote = assignedFg
          ? ` (Masuk ke Overall Vendor & Performa FG: ${assignedFg})`
          : ' (Masuk ke Overall Vendor; FG belum ditugaskan)';
        feedbackDetails = `Klien memberikan rating ${updates.feedback_rating}/5 bintang${fgNote}${
          updates.feedback_comment ? ` — "${updates.feedback_comment}"` : ''
        }`;
      } else if (updates.feedback_comment) {
        feedbackDetails = `Klien mengirimkan komentar saran tanpa rating bintang: "${updates.feedback_comment}"`;
      }

      addLog({
        action: updates.feedback_skipped && !updates.feedback_rating ? 'Ulasan Dilewati (Opsional)' : 'Client Feedback Submitted',
        event_type: 'portal_action',
        details: feedbackDetails,
        order_id: existingClient.order_id,
        client_id: existingClient.id,
        client_name: existingClient.client_name,
        actor: auditMeta?.actor || 'Client Portal',
        admin_user_id: auditMeta?.adminUserId || `CLIENT-${existingClient.client_id_display}`,
        changed_fields: changedFieldLabels
      });
      return;
    }

    if (!hasStatusChange && changedFieldLabels.length > 0) {
      addLog({
        action: 'Update Data Klien',
        event_type: 'data_update',
        details: `Memperbarui ${changedFieldLabels.join(', ')} untuk ${existingClient.client_name}`,
        order_id: existingClient.order_id,
        client_id: existingClient.id,
        client_name: existingClient.client_name,
        actor: auditMeta?.actor,
        admin_user_id: auditMeta?.adminUserId,
        changed_fields: changedFieldLabels
      });
    }
  };

  // 3. Single-Click "EDITING SELESAI & BUKA FINAL ACCESS" (7 hari kalender)
  const finishEditingAndOpenFinalAccess = (clientId: string) => {
    const client = clients.find(c => c.id === clientId);
    if (!client) return;

    const expiresDate = new Date();
    expiresDate.setDate(expiresDate.getDate() + 7);
    const expiresStr = expiresDate.toISOString().split('T')[0];

    const previousStatus = client.status;

    setClients(prev =>
      prev.map(c => {
        if (c.id === clientId) {
          return {
            ...c,
            status: 'final_access',
            editing_finished: true,
            final_access_expires_at: expiresStr,
            updated_at: new Date().toISOString()
          };
        }
        return c;
      })
    );

    addLog({
      action: 'State Transition',
      event_type: 'state_transition',
      from_status: previousStatus,
      to_status: 'final_access',
      details: `Status changed from ${getAuditStatusLabel(previousStatus)} to Final Access (Akses aktif 7 hari hingga ${expiresStr})`,
      order_id: client.order_id,
      client_id: client.id,
      client_name: client.client_name
    });
  };

  // 3c. Delete Client from Main Database
  const deleteClient = (clientId: string) => {
    const target = clients.find(c => c.id === clientId);
    if (!target) return;

    setClients(prev => prev.filter(c => c.id !== clientId));
    setNotifications(prev =>
      prev.filter(n => n.client_id !== clientId && n.order_id !== target.order_id)
    );

    addLog({
      action: 'Hapus Klien',
      event_type: 'data_update',
      details: `Menghapus data klien ${target.client_name} (${target.order_id}) dari Main Database`,
      order_id: target.order_id,
      client_id: target.id,
      client_name: target.client_name
    });
  };

  // Google Drive Connect / Disconnect actions
  const connectGoogleDrive = async (): Promise<boolean> => {
    setIsConnectingDrive(true);
    setDriveAuthError(null);
    try {
      const res = await googleDriveSignIn();
      if (res) {
        setDriveUser(res.user);
        setIsDriveConnected(true);
        return true;
      }
      return false;
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Gagal menghubungkan akun Google Drive.';
      setDriveAuthError(msg);
      return false;
    } finally {
      setIsConnectingDrive(false);
    }
  };

  const disconnectGoogleDrive = async () => {
    await googleDriveSignOut();
    setDriveUser(null);
    setIsDriveConnected(false);
  };

  // Generate PDF Invoice & upload directly to client's existing Google Drive folder
  const sendInvoiceToClientDrive = async (
    clientId: string,
    overrideClient?: ClientBooking,
    overrideTransactions?: Transaction[]
  ) => {
    const targetClient = overrideClient || clients.find(c => c.id === clientId);
    if (!targetClient) return { ok: false, errorMessage: 'Klien tidak ditemukan.' };

    const txSource = overrideTransactions || transactions;
    const pdfBlob = generateInvoicePdfBlob(targetClient, txSource, addons);
    const fileName = buildInvoiceFileName(targetClient);
    const result = await uploadInvoicePdfToDriveFolder({
      folderUrl: targetClient.drive_folder_url,
      fileName,
      pdfBlob
    });

    const nowIso = new Date().toISOString();

    if (result.ok) {
      setClients(prev =>
        prev.map(c =>
          c.id === clientId
            ? {
                ...c,
                invoice_number: targetClient.invoice_number || buildInvoiceNumber(targetClient),
                invoice_issued_at:
                  targetClient.invoice_issued_at || nowIso.split('T')[0],
                invoice_drive_status: 'uploaded',
                invoice_drive_file_id: result.fileId,
                invoice_drive_file_url: result.webViewLink,
                invoice_drive_error: undefined,
                updated_at: nowIso
              }
            : c
        )
      );

      addLog({
        action: 'Invoice Terkirim ke Google Drive',
        event_type: 'payment',
        details: `Invoice ${buildInvoiceNumber(targetClient)} (${fileName}) otomatis dibuat dan diunggah ke folder Drive ${targetClient.client_name}`,
        order_id: targetClient.order_id,
        client_id: targetClient.id,
        client_name: targetClient.client_name
      });
    } else {
      const statusToSet = result.reason === 'no_token' ? 'pending_drive' : 'error';
      setClients(prev =>
        prev.map(c =>
          c.id === clientId
            ? {
                ...c,
                invoice_number: targetClient.invoice_number || buildInvoiceNumber(targetClient),
                invoice_issued_at:
                  targetClient.invoice_issued_at || nowIso.split('T')[0],
                invoice_drive_status: statusToSet,
                invoice_drive_error: result.errorMessage,
                updated_at: nowIso
              }
            : c
        )
      );

      addLog({
        action:
          result.reason === 'no_token'
            ? 'Invoice Dibuat (Menunggu Koneksi Drive)'
            : 'Invoice Dibuat (Drive Belum Terunggah)',
        event_type: 'payment',
        details: `Invoice ${buildInvoiceNumber(targetClient)} siap. ${result.errorMessage || ''}`,
        order_id: targetClient.order_id,
        client_id: targetClient.id,
        client_name: targetClient.client_name
      });
    }

    return result;
  };

  // Provision structured client folder: Main Drive / Year / Month / Date / Name Graduation // Campus -> [JPG, Edited Files, Announcement (mirrored)]
  const provisionClientDriveFolder = async (
    clientId: string,
    overrideClient?: ClientBooking
  ) => {
    const targetClient = overrideClient || clients.find(c => c.id === clientId);
    if (!targetClient) {
      return { ok: false, errorMessage: 'Klien tidak ditemukan.' };
    }

    const res = await createStructuredClientDriveFolders({
      client: targetClient,
      mainDriveUrl: driveConfig.main_drive_url,
      announcementTemplateUrl: driveConfig.announcement_template_url
    });

    const nowIso = new Date().toISOString();
    if (res.ok && res.clientFolderUrl) {
      setClients(prev =>
        prev.map(c =>
          c.id === clientId
            ? {
                ...c,
                drive_folder_url: res.clientFolderUrl,
                drive_folder_id: res.clientFolderId,
                drive_jpg_folder_url: res.jpgFolderUrl,
                drive_edited_folder_url: res.editedFolderUrl,
                drive_announcement_folder_url: res.announcementFolderUrl,
                drive_folder_path: res.fullPath,
                drive_announcement_mirrored_count: res.mirroredCount,
                updated_at: nowIso
              }
            : c
        )
      );

      addLog({
        action: 'Folder Drive Klien Dibuat Otomatis',
        event_type: 'data_update',
        details: `Struktur folder "${res.fullPath}" (JPG, Edited Files, Announcement + ${res.mirroredCount ?? 0} file announcement) otomatis dibuat saat Booking Confirmed.`,
        order_id: targetClient.order_id,
        client_id: targetClient.id,
        client_name: targetClient.client_name,
        changed_fields: ['Link Drive']
      });
    } else if (res.reason !== 'no_token') {
      addLog({
        action: 'Gagal Buat Folder Drive Otomatis',
        event_type: 'data_update',
        details: `Gagal membuat folder Drive untuk ${targetClient.client_name}: ${res.errorMessage || 'Periksa koneksi Drive.'}`,
        order_id: targetClient.order_id,
        client_id: targetClient.id,
        client_name: targetClient.client_name
      });
    }

    return res;
  };

  const updateDriveConfig = (updates: Partial<DriveConfigSettings>) => {
    setDriveConfig(prev => ({
      main_drive_url: updates.main_drive_url?.trim() || prev.main_drive_url,
      announcement_template_url:
        updates.announcement_template_url?.trim() || prev.announcement_template_url
    }));
    addLog({
      action: 'Update Pengaturan Google Drive',
      event_type: 'data_update',
      details: 'Memperbarui link Main Drive & folder template Announcement.'
    });
  };

  const resetDriveConfig = () => {
    setDriveConfig(DEFAULT_DRIVE_CONFIG);
  };

  // 3b. Verify Full Payment ("Verifikasi Pelunasan (Tandai LUNAS)") + Auto-generate & send Invoice
  const verifyFullPayment = async (clientId: string) => {
    const client = clients.find(c => c.id === clientId);
    if (!client) return null;

    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const nowIso = now.toISOString();
    const targetTotal = client.total_price || client.package_price;
    const remaining = Math.max(0, targetTotal - client.paid_amount);
    const invoiceNo = buildInvoiceNumber(client);

    let nextTransactions = transactions;
    if (remaining > 0) {
      const fullTx: Transaction = {
        id: `tx-${Date.now()}`,
        date: todayStr,
        client_id: client.id,
        client_name: client.client_name,
        order_id: client.order_id,
        type: 'Pelunasan',
        amount: remaining,
        payment_method: 'Transfer SeaBank (Verified)',
        status: 'verified',
        admin_notes: `Pelunasan diverifikasi oleh Admin · Invoice ${invoiceNo}`,
        created_at: nowIso
      };
      nextTransactions = [fullTx, ...transactions];
      setTransactions(nextTransactions);
    }

    const updatedClient: ClientBooking = {
      ...client,
      paid_amount: targetTotal,
      payment_status: 'LUNAS' as PaymentStatus,
      invoice_number: invoiceNo,
      invoice_issued_at: client.invoice_issued_at || todayStr,
      invoice_drive_status: client.invoice_drive_status || 'pending_drive',
      updated_at: nowIso
    };

    setClients(prev => prev.map(c => (c.id === clientId ? updatedClient : c)));

    addLog({
      action: 'Verifikasi Pelunasan (LUNAS)',
      event_type: 'payment',
      details: `Pelunasan sebesar Rp ${remaining.toLocaleString('id-ID')} diverifikasi (LUNAS) & Invoice ${invoiceNo} diterbitkan untuk ${client.client_name}`,
      order_id: client.order_id,
      client_id: client.id,
      client_name: client.client_name
    });

    const driveResult = await sendInvoiceToClientDrive(
      clientId,
      updatedClient,
      nextTransactions
    );
    return { client: updatedClient, driveResult };
  };

  // 3d. Bulk Verify Full Payment + Auto-generate & send Invoices
  const bulkVerifyFullPayment = async (clientIds: string[]) => {
    const idSet = new Set(clientIds);
    const targets = clients.filter(c => idSet.has(c.id));
    if (targets.length === 0) {
      return { totalProcessed: 0, uploadedCount: 0, pendingDriveCount: 0, errorCount: 0 };
    }

    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const nowIso = now.toISOString();

    const newTxs: Transaction[] = [];
    const updatedMap = new Map<string, ClientBooking>();

    targets.forEach((c, idx) => {
      const targetTotal = c.total_price || c.package_price;
      const remaining = Math.max(0, targetTotal - c.paid_amount);
      const invoiceNo = buildInvoiceNumber(c);

      if (remaining > 0) {
        newTxs.push({
          id: `tx-${Date.now()}-${idx}`,
          date: todayStr,
          client_id: c.id,
          client_name: c.client_name,
          order_id: c.order_id,
          type: 'Pelunasan',
          amount: remaining,
          payment_method: 'Transfer SeaBank (Verified)',
          status: 'verified',
          admin_notes: `Verifikasi pelunasan massal · Invoice ${invoiceNo}`,
          created_at: nowIso
        });
      }

      updatedMap.set(c.id, {
        ...c,
        paid_amount: targetTotal,
        payment_status: 'LUNAS' as PaymentStatus,
        invoice_number: invoiceNo,
        invoice_issued_at: c.invoice_issued_at || todayStr,
        invoice_drive_status: c.invoice_drive_status || 'pending_drive',
        updated_at: nowIso
      });
    });

    const nextTransactions = newTxs.length > 0 ? [...newTxs, ...transactions] : transactions;
    if (newTxs.length > 0) {
      setTransactions(nextTransactions);
    }

    setClients(prev => prev.map(c => updatedMap.get(c.id) || c));

    addLog({
      action: 'Verifikasi Pelunasan Massal',
      event_type: 'payment',
      details: `Memverifikasi pelunasan (LUNAS) & membuat invoice untuk ${targets.length} klien terpilih.`,
      changed_fields: ['Status Pembayaran', 'Invoice']
    });

    let uploadedCount = 0;
    let pendingDriveCount = 0;
    let errorCount = 0;

    for (const updated of updatedMap.values()) {
      const res = await sendInvoiceToClientDrive(updated.id, updated, nextTransactions);
      if (res.ok) {
        uploadedCount += 1;
      } else if (res.reason === 'no_token') {
        pendingDriveCount += 1;
      } else {
        errorCount += 1;
      }
    }

    return {
      totalProcessed: targets.length,
      uploadedCount,
      pendingDriveCount,
      errorCount
    };
  };

  // 3e. Bulk Workflow Stage Transition (High-Season Batch Action)
  const bulkUpdateWorkflowStatus = (
    clientIds: string[],
    targetStatus: 'photo_session' | 'file_uploaded' | 'selection_pending' | 'final_access' | 'completed'
  ) => {
    const idSet = new Set(clientIds);
    const targets = clients.filter(c => idSet.has(c.id));
    if (targets.length === 0) return 0;

    const now = new Date();
    const nowIso = now.toISOString();

    const selectionDeadline = new Date();
    selectionDeadline.setDate(selectionDeadline.getDate() + 5);
    const selectionDeadlineStr = selectionDeadline.toISOString().split('T')[0];

    const finalExpires = new Date();
    finalExpires.setDate(finalExpires.getDate() + 7);
    const finalExpiresStr = finalExpires.toISOString().split('T')[0];

    setClients(prev =>
      prev.map(c => {
        if (!idSet.has(c.id)) return c;
        const patch: Partial<ClientBooking> = {
          status: targetStatus,
          updated_at: nowIso
        };
        if (targetStatus === 'file_uploaded') {
          patch.file_uploaded = true;
        } else if (targetStatus === 'selection_pending') {
          patch.file_uploaded = true;
          patch.selection_deadline = c.selection_deadline || selectionDeadlineStr;
        } else if (targetStatus === 'final_access') {
          patch.editing_finished = true;
          patch.final_access_expires_at = c.final_access_expires_at || finalExpiresStr;
        }
        return { ...c, ...patch };
      })
    );

    const toLabel = getAuditStatusLabel(targetStatus);
    addLog({
      action: `Update Massal → ${toLabel}`,
      event_type: 'state_transition',
      to_status: targetStatus,
      details: `Memperbarui tahap ${targets.length} klien terpilih menjadi ${toLabel}.`
    });

    return targets.length;
  };

  // 3f. Bulk Assign Photographer (FG)
  const bulkAssignPhotographer = (clientIds: string[], photographerName: string) => {
    const idSet = new Set(clientIds);
    const cleanedFg = photographerName.trim();
    if (!cleanedFg) return 0;

    const targets = clients.filter(c => idSet.has(c.id));
    if (targets.length === 0) return 0;

    const nowIso = new Date().toISOString();
    setClients(prev =>
      prev.map(c =>
        idSet.has(c.id) ? { ...c, photographer: cleanedFg, updated_at: nowIso } : c
      )
    );

    addLog({
      action: 'Penugasan FG Massal',
      event_type: 'data_update',
      details: `Menugaskan fotografer ${cleanedFg} untuk ${targets.length} klien terpilih.`,
      changed_fields: ['Fotografer (FG)']
    });

    return targets.length;
  };

  // 4. Record New Transaction
  const addTransaction = (newTx: Omit<Transaction, 'id' | 'created_at'>) => {
    const fullTx: Transaction = {
      ...newTx,
      id: `tx-${Date.now()}`,
      created_at: new Date().toISOString()
    };
    setTransactions(prev => [fullTx, ...prev]);

    const client = clients.find(
      c => c.id === newTx.client_id || c.order_id === newTx.order_id
    );

    if (newTx.status === 'verified' && client) {
      const clientTxTotal =
        transactions
          .filter(
            t =>
              (t.client_id === client.id || t.order_id === client.order_id) &&
              t.status === 'verified'
          )
          .reduce((sum, t) => sum + t.amount, 0) + newTx.amount;

      const targetTotal = client.total_price || client.package_price;
      const isLunas = clientTxTotal >= targetTotal;
      const todayStr = new Date().toISOString().split('T')[0];
      const invoiceNo = buildInvoiceNumber(client);
      setClients(prev =>
        prev.map(c => {
          if (c.id === client.id) {
            return {
              ...c,
              paid_amount: clientTxTotal,
              payment_status: isLunas ? ('LUNAS' as PaymentStatus) : ('DP' as PaymentStatus),
              ...(isLunas
                ? {
                    invoice_number: c.invoice_number || invoiceNo,
                    invoice_issued_at: c.invoice_issued_at || todayStr,
                    invoice_drive_status: c.invoice_drive_status || 'pending_drive'
                  }
                : {})
            };
          }
          return c;
        })
      );
    }

    if (newTx.status === 'pending') {
      const paymentNotif: SystemNotification = {
        id: `notif-${Date.now()}`,
        type: 'payment_pending',
        title: 'Pembayaran Menunggu Verifikasi',
        message: `Transaksi ${newTx.type} sebesar Rp ${newTx.amount.toLocaleString('id-ID')} dari ${newTx.client_name} perlu diverifikasi.`,
        timestamp: new Date().toISOString(),
        read: false,
        order_id: newTx.order_id,
        client_id: client?.id
      };
      setNotifications(prev => [paymentNotif, ...prev]);
    }

    addLog({
      action: 'Catat Transaksi',
      event_type: 'payment',
      details: `Transaksi ${newTx.type} sebesar Rp ${newTx.amount.toLocaleString('id-ID')} untuk ${newTx.client_name}`,
      order_id: newTx.order_id,
      client_id: client?.id,
      client_name: newTx.client_name
    });
  };

  // 5. Add New Booking Request
  const addBookingRequest = (
    formData: Omit<BookingRequest, 'id' | 'created_at' | 'expires_at' | 'dp_verified' | 'status'>
  ) => {
    const now = new Date();
    const expires = new Date();
    expires.setDate(now.getDate() + 3);

    const newReq: BookingRequest = {
      ...formData,
      id: `req-${Date.now()}`,
      status: 'new',
      created_at: now.toISOString(),
      expires_at: expires.toISOString(),
      dp_verified: false,
      warning_duplicate: clients.some(c => c.phone === formData.phone)
    };

    setRequests(prev => [newReq, ...prev]);

    const newNotif: SystemNotification = {
      id: `notif-${Date.now()}`,
      type: 'booking_request',
      title: 'Permintaan Booking Baru',
      message: `${formData.client_name} (${formData.package_name} - ${formData.campus}) menunggu konfirmasi DP Rp 100.000.`,
      timestamp: now.toISOString(),
      read: false
    };
    setNotifications(prev => [newNotif, ...prev]);

    addLog({
      action: 'Booking Request Masuk',
      event_type: 'booking',
      details: `Permintaan booking baru dari ${formData.client_name} (${formData.campus})`
    });
    return newReq;
  };

  const markNotificationRead = (notifId: string) => {
    setNotifications(prev =>
      prev.map(n => (n.id === notifId ? { ...n, read: true } : n))
    );
  };

  const markAllNotificationsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  // 6. Settings CRUD: Photographers, Packages, Message Templates
  const addPhotographer = (name: string): boolean => {
    const cleaned = name.trim();
    if (!cleaned) return false;
    if (photographers.some(fg => fg.toLowerCase() === cleaned.toLowerCase())) return false;
    setPhotographers(prev => [...prev, cleaned]);
    addLog({
      action: 'Tambah Fotografer (FG)',
      event_type: 'data_update',
      details: `Menambahkan fotografer baru ke daftar resmi: ${cleaned}`
    });
    return true;
  };

  const updatePhotographer = (oldName: string, newName: string): boolean => {
    const cleaned = newName.trim();
    if (!cleaned) return false;
    if (
      oldName.toLowerCase() !== cleaned.toLowerCase() &&
      photographers.some(fg => fg.toLowerCase() === cleaned.toLowerCase())
    ) {
      return false;
    }
    setPhotographers(prev => prev.map(fg => (fg === oldName ? cleaned : fg)));
    setClients(prev =>
      prev.map(c => (c.photographer === oldName ? { ...c, photographer: cleaned } : c))
    );
    addLog({
      action: 'Edit Nama Fotografer',
      event_type: 'data_update',
      details: `Mengubah nama fotografer ${oldName} menjadi ${cleaned}`
    });
    return true;
  };

  const deletePhotographer = (name: string) => {
    setPhotographers(prev => prev.filter(fg => fg !== name));
    addLog({
      action: 'Hapus Fotografer (FG)',
      event_type: 'data_update',
      details: `Menghapus fotografer ${name} dari daftar pilihan`
    });
  };

  const addPackage = (pkg: Omit<PackagePlan, 'id'>): PackagePlan => {
    const prefix = pkg.region === 'malang' ? 'mlg' : 'sby';
    const newPkg: PackagePlan = {
      ...pkg,
      id: `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`
    };
    setPackages(prev => [...prev, newPkg]);
    addLog({
      action: 'Tambah Paket Baru',
      event_type: 'data_update',
      details: `Menambahkan paket baru "${newPkg.name}" (${newPkg.region.toUpperCase()}): Rp ${newPkg.price.toLocaleString('id-ID')} · ${newPkg.edit_quota} Foto Edit`
    });
    return newPkg;
  };

  const updatePackage = (pkgId: string, updates: Partial<PackagePlan>) => {
    const target = packages.find(p => p.id === pkgId);
    if (!target) return;
    setPackages(prev =>
      prev.map(p => (p.id === pkgId ? { ...p, ...updates } : p))
    );
    addLog({
      action: 'Update Harga / Detail Paket',
      event_type: 'data_update',
      details: `Memperbarui paket ${updates.name ?? target.name} (${target.region.toUpperCase()}): Rp ${(updates.price ?? target.price).toLocaleString('id-ID')} · ${updates.edit_quota ?? target.edit_quota} Foto`
    });
  };

  const deletePackage = (pkgId: string) => {
    const target = packages.find(p => p.id === pkgId);
    if (!target) return;
    setPackages(prev => prev.filter(p => p.id !== pkgId));
    addLog({
      action: 'Hapus Paket',
      event_type: 'data_update',
      details: `Menghapus paket "${target.name}" (${target.region.toUpperCase()}) dari daftar paket`
    });
  };

  const addAddon = (addon: Omit<AddOnItem, 'id'>): AddOnItem => {
    const newAddon: AddOnItem = {
      ...addon,
      id: `addon-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`
    };
    setAddons(prev => [...prev, newAddon]);
    addLog({
      action: 'Tambah Add-on Baru',
      event_type: 'data_update',
      details: `Menambahkan add-on "${newAddon.name}": Rp ${newAddon.price.toLocaleString('id-ID')}${
        newAddon.edit_quota_addition ? ` (+${newAddon.edit_quota_addition} Foto Edit)` : ''
      }`
    });
    return newAddon;
  };

  const updateAddon = (addonId: string, updates: Partial<AddOnItem>) => {
    const target = addons.find(a => a.id === addonId);
    if (!target) return;
    setAddons(prev =>
      prev.map(a => (a.id === addonId ? { ...a, ...updates } : a))
    );
    addLog({
      action: 'Update Detail Add-on',
      event_type: 'data_update',
      details: `Memperbarui add-on "${updates.name ?? target.name}": Rp ${(updates.price ?? target.price).toLocaleString('id-ID')}`
    });
  };

  const deleteAddon = (addonId: string) => {
    const target = addons.find(a => a.id === addonId);
    if (!target) return;
    setAddons(prev => prev.filter(a => a.id !== addonId));
    addLog({
      action: 'Hapus Add-on',
      event_type: 'data_update',
      details: `Menghapus add-on "${target.name}" dari daftar layanan`
    });
  };

  const updateMessageTemplates = (updates: Partial<MessageTemplates>) => {
    setMessageTemplates(prev => ({ ...prev, ...updates }));
    addLog({
      action: 'Update Message Template',
      event_type: 'data_update',
      details: 'Memperbarui template pesan komunikasi WhatsApp / konfirmasi klien'
    });
  };

  const resetMessageTemplates = () => {
    // Reset hanya mengembalikan teks template; nomor WhatsApp admin tetap dipertahankan.
    setMessageTemplates(prev => ({ ...DEFAULT_MESSAGE_TEMPLATES, admin_whatsapp: prev.admin_whatsapp }));
    addLog({
      action: 'Reset Message Template',
      event_type: 'data_update',
      details: 'Mengembalikan seluruh template pesan ke format standar Bestari'
    });
  };

  // 7. Reset Data back to factory defaults
  const resetToFactoryDefaults = () => {
    localStorage.clear();
    localStorage.setItem(STORAGE_KEYS.SAMPLE_25_SEEDED, 'true');
    setClients(INITIAL_CLIENTS);
    setRequests(INITIAL_REQUESTS);
    setTransactions(INITIAL_TRANSACTIONS);
    setPackages(INITIAL_PACKAGES);
    setAddons(INITIAL_ADDONS);
    setLogs(INITIAL_ACTIVITY_LOGS);
    setNotifications(INITIAL_NOTIFICATIONS);
    setPhotographers(DEFAULT_PHOTOGRAPHERS);
    setMessageTemplates(DEFAULT_MESSAGE_TEMPLATES);
    setDriveConfig(DEFAULT_DRIVE_CONFIG);
    setSelectedYear(2027);
  };

  // 8. Import / Restore Backup JSON (Phase 2)
  const importBackupPayload = (rawBackup: any): { ok: boolean; message: string } => {
    const payload = rawBackup?.data && typeof rawBackup.data === 'object' ? rawBackup.data : rawBackup;
    if (!payload || !Array.isArray(payload.clients) || !Array.isArray(payload.packages)) {
      return {
        ok: false,
        message: 'Format file backup tidak valid. Pastikan menggunakan file JSON hasil Export Bestari.'
      };
    }

    const nextClients = payload.clients as ClientBooking[];
    const nextRequests = Array.isArray(payload.requests) ? (payload.requests as BookingRequest[]) : [];
    const nextTransactions = Array.isArray(payload.transactions)
      ? (payload.transactions as Transaction[])
      : [];
    const nextPackages = payload.packages as PackagePlan[];
    const nextAddons = Array.isArray(payload.addons) ? (payload.addons as AddOnItem[]) : addons;
    const nextLogs = Array.isArray(payload.logs) ? (payload.logs as ActivityLogItem[]) : logs;
    const nextPhotographers =
      Array.isArray(payload.photographers) && payload.photographers.length > 0
        ? (payload.photographers as string[])
        : photographers;
    const nextTemplates =
      payload.messageTemplates && typeof payload.messageTemplates === 'object'
        ? { ...DEFAULT_MESSAGE_TEMPLATES, ...payload.messageTemplates }
        : messageTemplates;
    const nextDriveConfig =
      payload.driveConfig && typeof payload.driveConfig === 'object'
        ? {
            main_drive_url: payload.driveConfig.main_drive_url || DEFAULT_MAIN_DRIVE_URL,
            announcement_template_url:
              payload.driveConfig.announcement_template_url || DEFAULT_ANNOUNCEMENT_TEMPLATE_URL
          }
        : driveConfig;

    setClients(nextClients);
    setRequests(nextRequests);
    setTransactions(nextTransactions);
    setPackages(nextPackages);
    setAddons(nextAddons);
    setPhotographers(nextPhotographers);
    setMessageTemplates(nextTemplates);
    setDriveConfig(nextDriveConfig);
    setLogs([
      {
        id: `log-${Date.now()}`,
        timestamp: new Date().toISOString(),
        action: 'Restore Backup JSON',
        actor: activeAdmin.name,
        admin_user_id: activeAdmin.id,
        event_type: 'data_update',
        details: `Berhasil merestore ${nextClients.length} data klien dan ${nextTransactions.length} transaksi dari file backup JSON.`
      },
      ...nextLogs
    ]);

    return {
      ok: true,
      message: `Backup dipulihkan: ${nextClients.length} klien & ${nextTransactions.length} transaksi.`
    };
  };

  return {
    selectedYear,
    setSelectedYear,
    activeAdmin,
    clients,
    requests,
    transactions,
    packages,
    addons,
    logs,
    notifications,
    photographers,
    messageTemplates,
    driveConfig,
    driveUser,
    isDriveConnected,
    isConnectingDrive,
    driveAuthError,
    clearDriveAuthError: () => setDriveAuthError(null),
    connectGoogleDrive,
    disconnectGoogleDrive,
    sendInvoiceToClientDrive,
    provisionClientDriveFolder,
    updateDriveConfig,
    resetDriveConfig,
    getClientDrivePathPreview: buildClientDrivePathParts,
    markNotificationRead,
    markAllNotificationsRead,
    confirmBookingRequest,
    updateClient,
    deleteClient,
    finishEditingAndOpenFinalAccess,
    verifyFullPayment,
    bulkVerifyFullPayment,
    bulkUpdateWorkflowStatus,
    bulkAssignPhotographer,
    addTransaction,
    addBookingRequest,
    addPhotographer,
    updatePhotographer,
    deletePhotographer,
    addPackage,
    updatePackage,
    deletePackage,
    addAddon,
    updateAddon,
    deleteAddon,
    updateMessageTemplates,
    resetMessageTemplates,
    resetToFactoryDefaults,
    importBackupPayload,
    refreshFromServer,
    setClients,
    setRequests
  };
}
