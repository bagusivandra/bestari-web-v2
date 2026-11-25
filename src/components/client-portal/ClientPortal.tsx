import React, { useState, useEffect, useMemo } from 'react';
import {
  Sparkles,
  Lock,
  Calendar,
  Clock,
  MapPin,
  CheckCircle2,
  Camera,
  Download,
  Phone,
  FileText,
  ChevronRight,
  X,
  Check,
  ArrowLeft,
  Star,
  Send,
  LogOut,
  AlertTriangle,
  HelpCircle,
  ExternalLink
} from 'lucide-react';
import { ClientBooking, BookingStatus, Transaction, AddOnItem } from '../../types';
import { formatRupiah, formatDateIndo, buildWhatsAppLink } from '../../utils/formatters';
import { useAdminWhatsapp } from '../../utils/adminContact';
import { downloadInvoicePdf } from '../../utils/invoiceGenerator';
import { ClientHelpCenter } from './ClientHelpCenter';
import {
  listDriveFolderImages,
  fetchDriveImageBlobUrl,
  DriveGalleryPhoto
} from '../../services/googleDriveAuth';
import {
  fetchPortalCardByCredentials,
  submitPortalActionToFirestore
} from '../../services/firestoreSync';

interface ClientPortalProps {
  clients: ClientBooking[];
  transactions?: Transaction[];
  addons?: AddOnItem[];
  activeClientId?: string;
  initialClientIdQuery?: string;
  onExitPortal: () => void;
  onStartPhotoSelection: (clientId: string) => void;
  onSubmitPhotoSelection: (clientId: string, selectedIds: string[]) => void;
  onCompleteFinalAccess: (clientId: string) => void;
  onSubmitFeedback: (clientId: string, rating: number | undefined, comment: string) => void;
  onSkipFeedback: (clientId: string) => void;
}

const PORTAL_STEPS = [
  { step: 1, label: '01 Booking Confirmed' },
  { step: 2, label: '02 Photo Session' },
  { step: 3, label: '03 Photo Gallery' },
  { step: 4, label: '04 Photo Selection' },
  { step: 5, label: '05 Editing Process' },
  { step: 6, label: '06 Final Delivery' },
  { step: 7, label: '07 Finished' }
];

const SAMPLE_TITLES = [
  'Portrait Toga Halaman Rektorat',
  'Siluet Wisudawan Golden Hour',
  'Tawa Bersama Keluarga & Rekan',
  'Momentum Couple Graduation',
  'Detail Medali & Ijazah',
  'Lempar Topi Toga Langit Cerah',
  'Langkah Bangga Menuju Masa Depan',
  'Pose Elegan Tangga Utama'
];

const SAMPLE_IMAGES = [
  '/images/bestari/graduation-portrait-01.svg',
  '/images/bestari/hero-graduation.svg',
  '/images/bestari/graduation-group-01.svg',
  '/images/bestari/graduation-couple-01.svg'
];

function getStepNumberFromStatus(status: BookingStatus): number {
  switch (status) {
    case 'confirmed':
      return 1;
    case 'photo_session':
      return 2;
    case 'file_uploaded':
      return 3;
    case 'selection_pending':
    case 'selection_submitted':
      return 4;
    case 'editing':
      return 5;
    case 'final_access':
      return 6;
    case 'completed':
      return 7;
    default:
      return 1;
  }
}

export const ClientPortal: React.FC<ClientPortalProps> = ({
  clients,
  transactions = [],
  addons = [],
  activeClientId,
  initialClientIdQuery = '',
  onExitPortal,
  onStartPhotoSelection,
  onSubmitPhotoSelection,
  onCompleteFinalAccess,
  onSubmitFeedback,
  onSkipFeedback
}) => {
  const adminWaNumber = useAdminWhatsapp();
  // Auto-open directly if opened via Admin ("Buka Portal" with activeClientId), otherwise require ID & PIN
  useEffect(() => {
    if (activeClientId && clients.some(c => c.id === activeClientId)) {
      setSelectedClientId(activeClientId);
      setIsLoggedIn(true);
      setLoginError('');
    } else {
      setIsLoggedIn(false);
      setSelectedClientId('');
      setInputOrderId(initialClientIdQuery || '');
      setInputPin('');
      setLoginError('');
    }
  }, [activeClientId, initialClientIdQuery]);

  const [selectedClientId, setSelectedClientId] = useState<string>(() =>
    activeClientId && clients.some(c => c.id === activeClientId) ? activeClientId : ''
  );
  const [serverClient, setServerClient] = useState<ClientBooking | null>(null);
  const [serverTransactions, setServerTransactions] = useState<Transaction[] | null>(null);
  const [serverAddons, setServerAddons] = useState<AddOnItem[] | null>(null);
  const [portalCardHash, setPortalCardHash] = useState<string | null>(null);
  const [inputOrderId, setInputOrderId] = useState(() => initialClientIdQuery || '');
  const [inputPin, setInputPin] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(() =>
    Boolean(activeClientId && clients.some(c => c.id === activeClientId))
  );

  const client = useMemo(() => {
    const localMatch = clients.find(c => c.id === selectedClientId) || null;
    if (localMatch && serverClient && serverClient.id === localMatch.id) {
      return new Date(serverClient.updated_at).getTime() >= new Date(localMatch.updated_at).getTime()
        ? serverClient
        : localMatch;
    }
    return localMatch || serverClient;
  }, [clients, selectedClientId, serverClient]);

  // Sub-view inside Stage 4 (`selection_pending`) after clicking "Let's Choose"
  const [isPickingPhotos, setIsPickingPhotos] = useState(false);
  const [showLoginHelpCenter, setShowLoginHelpCenter] = useState(true);

  // Photo selection state synced with logged-in client
  const editQuota = client?.edit_quota || 15;
  const [selectedPhotos, setSelectedPhotos] = useState<string[]>([]);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  // Phase 2: Live Google Drive JPG subfolder photos (when Drive token is connected & folder populated)
  const [drivePhotos, setDrivePhotos] = useState<Array<{ id: string; title: string; src: string }>>([]);
  const [isLoadingDriveGallery, setIsLoadingDriveGallery] = useState(false);
  const [isUsingLiveDriveGallery, setIsUsingLiveDriveGallery] = useState(false);

  // Review & Rating state for Finished stage (Opsional)
  const [rating, setRating] = useState<number>(0);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [feedbackComment, setFeedbackComment] = useState<string>('');
  const [reviewSubmitted, setReviewSubmitted] = useState<boolean>(false);
  const [reviewSkipped, setReviewSkipped] = useState<boolean>(false);

  // Sync local interactive states whenever client changes or updates from Admin
  useEffect(() => {
    if (!client) return;
    setSelectedPhotos(client.selected_photo_ids || []);
    setRating(client.feedback_rating || 0);
    setFeedbackComment(client.feedback_comment || '');
    setReviewSubmitted(Boolean(client.feedback_rating || client.feedback_comment));
    setReviewSkipped(Boolean(client.feedback_skipped && !client.feedback_rating && !client.feedback_comment));
    if (client.status !== 'selection_pending' && client.status !== 'file_uploaded') {
      setIsPickingPhotos(false);
    }
  }, [
    client?.id,
    client?.status,
    client?.feedback_rating,
    client?.feedback_comment,
    client?.feedback_skipped
  ]);

  // Load real images from client's Google Drive JPG folder if connected
  useEffect(() => {
    let active = true;
    const createdBlobUrls: string[] = [];

    const loadGallery = async () => {
      const targetFolder = client?.drive_jpg_folder_url || client?.drive_folder_url;
      const inGalleryStage =
        isLoggedIn &&
        client &&
        (client.status === 'file_uploaded' || client.status === 'selection_pending');

      if (!inGalleryStage || !targetFolder) {
        setDrivePhotos([]);
        setIsUsingLiveDriveGallery(false);
        return;
      }

      setIsLoadingDriveGallery(true);
      const listing = await listDriveFolderImages(targetFolder);
      if (!active) return;

      if (!listing.ok || listing.photos.length === 0) {
        setDrivePhotos([]);
        setIsUsingLiveDriveGallery(false);
        setIsLoadingDriveGallery(false);
        return;
      }

      const resolved = await Promise.all(
        listing.photos.slice(0, 48).map(async (item: DriveGalleryPhoto) => {
          const blobUrl = await fetchDriveImageBlobUrl(item.id);
          if (blobUrl) createdBlobUrls.push(blobUrl);
          return {
            id: item.code || item.name,
            title: item.name,
            src: blobUrl || item.thumbnailLink || SAMPLE_IMAGES[0]
          };
        })
      );

      if (!active) {
        createdBlobUrls.forEach(url => URL.revokeObjectURL(url));
        return;
      }

      setDrivePhotos(resolved);
      setIsUsingLiveDriveGallery(true);
      setIsLoadingDriveGallery(false);
    };

    void loadGallery();

    return () => {
      active = false;
      createdBlobUrls.forEach(url => URL.revokeObjectURL(url));
    };
  }, [isLoggedIn, client?.id, client?.status, client?.drive_jpg_folder_url, client?.drive_folder_url]);

  // Generate photo gallery cards (live Drive photos if available, else sample preview cards)
  const samplePhotoGallery = useMemo(() => {
    if (isUsingLiveDriveGallery && drivePhotos.length > 0) {
      return drivePhotos;
    }
    const totalCount = Math.max(16, Math.min(editQuota + 4, 48));
    return Array.from({ length: totalCount }, (_, i) => {
      const code = `BG-${String(i + 1).padStart(3, '0')}`;
      return {
        id: code,
        title: SAMPLE_TITLES[i % SAMPLE_TITLES.length],
        src: SAMPLE_IMAGES[i % SAMPLE_IMAGES.length]
      };
    });
  }, [editQuota, isUsingLiveDriveGallery, drivePhotos]);

  // Calculate dynamic H-X days remaining for Editing Process (Stage 5)
  const editingDaysRemaining = useMemo(() => {
    if (!client?.editing_deadline) return 10;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const deadline = new Date(client.editing_deadline);
    deadline.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return Math.max(0, Math.min(10, diffDays));
  }, [client?.editing_deadline]);

  // Calculate dynamic days remaining for Final Delivery 7-day link expiry (Stage 6)
  const finalAccessDaysRemaining = useMemo(() => {
    if (!client?.final_access_expires_at) return 7;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expiry = new Date(client.final_access_expires_at);
    expiry.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return Math.max(0, Math.min(7, diffDays));
  }, [client?.final_access_expires_at]);

  // Auto-close Stage 6 access & advance to Stage 7 once 7 days have passed
  useEffect(() => {
    if (
      isLoggedIn &&
      client &&
      client.status === 'final_access' &&
      client.final_access_expires_at &&
      finalAccessDaysRemaining <= 0
    ) {
      onCompleteFinalAccess(client.id);
    }
  }, [isLoggedIn, client?.id, client?.status, client?.final_access_expires_at, finalAccessDaysRemaining]);

  // Multi-device ID & PIN Authentication (Cloud Firestore + Express API + local fallback)
  const handleManualLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');

    const query = inputOrderId.trim().toLowerCase();
    const pin = inputPin.trim();

    if (!query || !pin) {
      setLoginError('Masukkan ID Klien dan PIN akses terlebih dahulu.');
      return;
    }

    setIsLoggingIn(true);
    try {
      const [apiRes, cloudRes] = await Promise.all([
        fetch('/api/portal/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ clientIdQuery: query, pin })
        }).catch(() => null),
        fetchPortalCardByCredentials(query, pin).catch(() => null)
      ]);

      let apiClient: ClientBooking | null = null;
      let apiTxs: Transaction[] | null = null;
      let apiAddons: AddOnItem[] | null = null;

      if (apiRes && apiRes.ok) {
        const data = (await apiRes.json()) as {
          ok?: boolean;
          client?: ClientBooking;
          transactions?: Transaction[];
          addons?: AddOnItem[];
        };
        if (data.ok && data.client) {
          apiClient = data.client;
          apiTxs = Array.isArray(data.transactions) ? data.transactions : null;
          apiAddons = Array.isArray(data.addons) ? data.addons : null;
        }
      }

      if (cloudRes?.card) {
        const c = cloudRes.card;
        const cloudClient: ClientBooking = {
          id: c.client_id,
          order_id: c.order_id,
          client_id_display: c.client_id_display,
          booking_year: c.booking_year,
          booking_sequence: 0,
          status: c.status,
          booking_date: '',
          photo_date: c.photo_date,
          session_time: c.session_time,
          region_id: c.region_id,
          package_id: '',
          package_name: c.package_name,
          package_price: c.package_price,
          total_price: c.total_price,
          selected_addons: c.selected_addons,
          client_name: c.client_name,
          campus: c.campus,
          photo_location: c.photo_location,
          photographer: 'Tim Bestari',
          phone: '',
          payment_status: c.payment_status,
          paid_amount: c.paid_amount,
          file_uploaded: c.status !== 'confirmed' && c.status !== 'photo_session',
          selection_submitted:
            c.status === 'selection_submitted' ||
            c.status === 'editing' ||
            c.status === 'final_access' ||
            c.status === 'completed',
          editing_finished: c.status === 'final_access' || c.status === 'completed',
          notes: '',
          drive_folder_url: c.drive_folder_url || '',
          drive_jpg_folder_url: c.drive_jpg_folder_url,
          drive_edited_folder_url: c.drive_edited_folder_url,
          edit_quota: c.edit_quota,
          selected_photo_ids: c.selected_photo_ids || [],
          selection_deadline: c.selection_deadline,
          editing_deadline: c.editing_deadline,
          final_access_expires_at: c.final_access_expires_at,
          feedback_rating: c.feedback_rating,
          feedback_comment: c.feedback_comment,
          feedback_skipped: c.feedback_skipped,
          invoice_number: c.invoice_number,
          invoice_issued_at: c.invoice_issued_at,
          portal_pin_hash: '',
          portal_pin_display: pin,
          unique_token: '',
          created_at: '',
          updated_at: c.updated_at
        };

        const cloudTxs: Transaction[] = (c.portal_transactions || []).map(t => ({
          id: t.id,
          date: t.date,
          client_id: c.client_id,
          client_name: c.client_name,
          order_id: c.order_id,
          type: t.type,
          amount: t.amount,
          payment_method: t.payment_method,
          status: t.status,
          created_at: t.date
        }));

        const useCloud =
          !apiClient ||
          new Date(cloudClient.updated_at).getTime() >= new Date(apiClient.updated_at).getTime();

        setPortalCardHash(cloudRes.cardHash);
        const chosen = useCloud ? cloudClient : apiClient!;
        setServerClient(chosen);
        setServerTransactions(useCloud ? cloudTxs : apiTxs);
        setServerAddons(cloudRes.addons.length > 0 ? cloudRes.addons : apiAddons);
        setSelectedClientId(chosen.id);
        setIsLoggedIn(true);
        setIsPickingPhotos(false);
        return;
      }

      if (apiClient) {
        setPortalCardHash(null);
        setServerClient(apiClient);
        setServerTransactions(apiTxs);
        setServerAddons(apiAddons);
        setSelectedClientId(apiClient.id);
        setIsLoggedIn(true);
        setIsPickingPhotos(false);
        return;
      }

      const found = clients.find(c => {
        const matchesId =
          c.client_id_display.toLowerCase() === query ||
          c.order_id.toLowerCase() === query;
        const matchesPin = c.portal_pin_display === pin;
        return matchesId && matchesPin;
      });

      if (found) {
        setPortalCardHash(null);
        setServerClient(found);
        setSelectedClientId(found.id);
        setIsLoggedIn(true);
        setIsPickingPhotos(false);
      } else {
        setLoginError(
          'ID Klien atau PIN akses tidak valid. Pastikan ID (contoh: 001 / INV001-120127) dan PIN 4-digit tanggal booking (DDMM) sudah benar.'
        );
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const syncPortalActionToServer = async (
    action: 'start_selection' | 'submit_selection' | 'complete_final' | 'submit_feedback' | 'skip_feedback',
    payload: Record<string, unknown> = {}
  ) => {
    if (!client) return;

    if (portalCardHash) {
      void submitPortalActionToFirestore({
        cardHash: portalCardHash,
        clientId: client.id,
        action,
        selectedIds: Array.isArray(payload.selectedIds)
          ? (payload.selectedIds as string[])
          : undefined,
        rating: typeof payload.rating === 'number' ? payload.rating : undefined,
        comment: typeof payload.comment === 'string' ? payload.comment : undefined
      }).catch(() => {});
    }

    try {
      const res = await fetch('/api/portal/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ clientId: client.id, action, ...payload })
      });
      if (res.ok) {
        const data = (await res.json()) as { ok?: boolean; client?: ClientBooking };
        if (data.ok && data.client) {
          setServerClient(data.client);
        }
      }
    } catch {
      // Cloud Firestore submission and local callback still apply cleanly
    }
  };

  const handleLogoutPortal = () => {
    setIsLoggedIn(false);
    setSelectedClientId('');
    setPortalCardHash(null);
    setServerClient(null);
    setServerTransactions(null);
    setServerAddons(null);
    setInputOrderId('');
    setInputPin('');
    setLoginError('');
    setIsPickingPhotos(false);
  };

  // Toggle photo selection up to package quota
  const handleToggleSelectPhoto = (photoId: string) => {
    if (!client || (client.status !== 'selection_pending' && client.status !== 'file_uploaded')) return;

    if (selectedPhotos.includes(photoId)) {
      setSelectedPhotos(prev => prev.filter(id => id !== photoId));
    } else {
      if (selectedPhotos.length >= editQuota) {
        return;
      }
      setSelectedPhotos(prev => [...prev, photoId]);
    }
  };

  // Submit selected photo list -> directly moves client into Stage 5 (05 Editing Process)
  const handleSubmitPhotoList = () => {
    if (!client || (client.status !== 'selection_pending' && client.status !== 'file_uploaded')) return;
    if (selectedPhotos.length === 0) return;

    void syncPortalActionToServer('submit_selection', { selectedIds: selectedPhotos });
    onSubmitPhotoSelection(client.id, selectedPhotos);
    setIsPickingPhotos(false);
  };

  // Submit optional review & rating -> automatically ensures status is 07 Completed in Main Database
  const handleSaveReview = () => {
    if (!client || (client.status !== 'completed' && client.status !== 'final_access')) return;
    if (rating === 0 && !feedbackComment.trim()) return;
    const cleanComment = feedbackComment.trim();
    const validRating = rating > 0 ? rating : undefined;
    void syncPortalActionToServer('submit_feedback', { rating: validRating, comment: cleanComment });
    onSubmitFeedback(client.id, validRating, cleanComment);
    setReviewSubmitted(true);
    setReviewSkipped(false);
  };

  // Skip optional review in Stage 7
  const handleSkipReview = () => {
    if (!client || (client.status !== 'completed' && client.status !== 'final_access')) return;
    void syncPortalActionToServer('skip_feedback');
    onSkipFeedback(client.id);
    setReviewSkipped(true);
    setReviewSubmitted(false);
  };

  // 1. MANDATORY LOGIN SCREEN (No demo bypass, no auto-login)
  if (!isLoggedIn || !client) {
    return (
      <div className="min-h-screen bestari-canvas-bg text-[#F2F1ED] flex flex-col justify-between p-4 sm:p-8 relative overflow-hidden font-['DM_Sans']">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[28rem] h-[28rem] bg-[#C5A572]/10 rounded-full blur-[140px] pointer-events-none" />

        <header className="flex items-center justify-between max-w-5xl w-full mx-auto z-10">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#171A20] border border-[#C5A572]/40 flex items-center justify-center text-[#C5A572]">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <span className="text-sm font-bold tracking-widest uppercase font-['Plus_Jakarta_Sans'] text-[#F2F1ED]">
                Bestari Graduation
              </span>
              <span className="block text-[10px] text-[#C5A572] font-mono">CLIENT PORTAL 2027</span>
            </div>
          </div>

          <button
            onClick={onExitPortal}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#9296A0] hover:text-[#F2F1ED] bg-[#171A20] hover:bg-[#1D2027] border border-[#292D35] rounded-lg transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Kembali ke Admin</span>
          </button>
        </header>

        <div className="max-w-md w-full mx-auto my-12 bg-[#171A20] border border-[#292D35] rounded-3xl p-7 sm:p-8 shadow-2xl relative z-10 space-y-6">
          <div className="text-center space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#C5A572]/15 text-[#D8C49D] text-xs font-semibold rounded-full border border-[#C5A572]/30">
              <Lock className="w-3.5 h-3.5 text-[#C5A572]" />
              <span>Akses Terkunci · ID &amp; PIN Diperlukan</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-[#F2F1ED] tracking-tight">
              Masuk Portal Wisudawan
            </h1>
            <p className="text-xs text-[#9296A0] leading-relaxed">
              Masukkan <strong>ID Klien (3 angka awal)</strong> dan <strong>PIN 4-digit (tanggal booking DDMM)</strong> yang dikirim oleh Admin Bestari melalui WhatsApp.
            </p>
          </div>

          <form onSubmit={handleManualLogin} className="space-y-4 text-xs">
            {loginError && (
              <div className="p-3 bg-rose-950/60 border border-rose-800 text-rose-300 rounded-xl text-xs leading-relaxed">
                {loginError}
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-[#9296A0] font-semibold uppercase tracking-wider block">
                ID Klien (3 Angka Awal atau Order ID)
              </label>
              <input
                type="text"
                placeholder="Contoh: 001 atau INV001-120127"
                value={inputOrderId}
                onChange={e => setInputOrderId(e.target.value)}
                required
                autoComplete="off"
                className="w-full px-3.5 py-2.5 bg-[#111318] border border-[#292D35] rounded-xl text-[#F2F1ED] font-mono text-sm focus:outline-none focus:border-[#C5A572] transition-colors"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[#9296A0] font-semibold uppercase tracking-wider block">
                PIN Akses 4-Digit (Tanggal Booking DDMM)
              </label>
              <input
                type="password"
                placeholder="Masukkan 4 digit PIN (contoh: 1201)"
                maxLength={6}
                value={inputPin}
                onChange={e => setInputPin(e.target.value)}
                required
                autoComplete="off"
                className="w-full px-3.5 py-2.5 bg-[#111318] border border-[#292D35] rounded-xl text-[#F2F1ED] font-mono text-sm tracking-widest focus:outline-none focus:border-[#C5A572] transition-colors"
              />
            </div>

            <button
              type="submit"
              disabled={isLoggingIn}
              className="w-full py-3 px-4 text-xs font-bold text-[#0B0C0F] bg-gradient-to-r from-[#C5A572] to-[#D8C49D] hover:from-[#D8C49D] hover:to-[#C5A572] rounded-xl shadow-lg transition-all active:scale-98 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>{isLoggingIn ? 'Memverifikasi...' : 'Verifikasi & Masuk Portal'}</span>
            </button>
          </form>

          <div className="pt-2 border-t border-[#252A36] text-center">
            <button
              type="button"
              onClick={() => setShowLoginHelpCenter(!showLoginHelpCenter)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#C5A572] hover:text-[#D8C49D] transition-colors"
            >
              <HelpCircle className="w-3.5 h-3.5" />
              <span>
                {showLoginHelpCenter
                  ? 'Tutup Client Help Center (FAQ)'
                  : 'Butuh Bantuan? Buka Client Help Center (FAQ)'}
              </span>
            </button>
          </div>
        </div>

        {showLoginHelpCenter && (
          <div className="max-w-3xl w-full mx-auto mb-10 relative z-10 animate-in fade-in duration-200">
            <ClientHelpCenter compact />
          </div>
        )}

        <footer className="text-center text-xs text-[#666B76] z-10">
          BESTARI GRADUATION · #WhereDreamsMeetReality
        </footer>
      </div>
    );
  }

  // 2. LOGGED-IN PORTAL — STRICTLY LOCKED TO CLIENT'S CURRENT ADMIN-APPROVED STAGE
  const currentStep = getStepNumberFromStatus(client.status);
  const remainingBalance = Math.max(0, (client.total_price || client.package_price) - client.paid_amount);

  return (
    <div className="min-h-screen bestari-canvas-bg text-[#F2F1ED] font-['DM_Sans'] pb-24 selection:bg-[#C5A572]/20">
      {/* Top Navbar */}
      <div className="sticky top-0 z-40 bg-[#090B10]/85 backdrop-blur-xl border-b border-[#252A36] px-4 lg:px-8 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#171A20] border border-[#C5A572]/40 flex items-center justify-center text-[#C5A572]">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-bold tracking-widest uppercase font-['Plus_Jakarta_Sans'] text-[#F2F1ED]">
                Bestari Graduation
              </span>
              <span className="block text-[10px] text-[#C5A572] font-mono">
                {client.client_name} · ID {client.client_id_display} ({client.order_id})
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                downloadInvoicePdf(
                  client,
                  serverTransactions ?? transactions,
                  serverAddons ?? addons
                );
              }}
              className="px-3 py-1.5 text-xs font-semibold text-[#D8C49D] bg-[#12151D] hover:bg-[#1D2027] border border-[#C5A572]/35 rounded-lg transition-colors flex items-center gap-1.5"
            >
              <FileText className="w-3.5 h-3.5 text-[#C5A572]" />
              <span className="hidden sm:inline">Invoice PDF</span>
            </button>

            <button
              type="button"
              onClick={() => {
                document
                  .getElementById('client-help-center')
                  ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
              className="px-3 py-1.5 text-xs font-semibold text-[#D8C49D] bg-[#12151D] hover:bg-[#1D2027] border border-[#C5A572]/35 rounded-lg transition-colors flex items-center gap-1.5"
            >
              <HelpCircle className="w-3.5 h-3.5 text-[#C5A572]" />
              <span className="hidden sm:inline">Help Center</span>
            </button>

            <button
              onClick={handleLogoutPortal}
              className="px-3 py-1.5 text-xs font-semibold text-[#F2F1ED] bg-[#171A20] hover:bg-[#1D2027] border border-[#292D35] rounded-lg transition-colors flex items-center gap-1.5"
            >
              <LogOut className="w-3.5 h-3.5 text-[#C5A572]" />
              <span>Keluar Portal</span>
            </button>

            <button
              onClick={onExitPortal}
              className="px-3 py-1.5 text-xs font-semibold text-[#0B0C0F] bg-[#C5A572] hover:bg-[#D8C49D] rounded-lg transition-colors flex items-center gap-1.5"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Kembali ke Admin</span>
            </button>
          </div>
        </div>
      </div>

      {/* NON-INTERACTIVE 7-STAGE LOCKED PROGRESS TRACKER (All stage transitions controlled by Admin) */}
      <div className="bg-[#0D1017]/85 backdrop-blur-md border-b border-[#252A36] px-4 py-3 overflow-x-auto">
        <div className="max-w-5xl mx-auto flex items-center gap-2 text-xs">
          {PORTAL_STEPS.map(s => {
            const isCompleted = s.step < currentStep;
            const isActive = s.step === currentStep;
            const isLocked = s.step > currentStep;

            return (
              <div
                key={s.step}
                title={
                  isActive
                    ? 'Tahap aktif Anda saat ini'
                    : isCompleted
                    ? 'Tahap ini sudah selesai (tidak dapat kembali)'
                    : 'Tahap ini terkunci — menunggu persetujuan Admin'
                }
                className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold whitespace-nowrap border flex items-center gap-1.5 select-none ${
                  isActive
                    ? 'bg-[#C5A572] text-[#0B0C0F] border-[#C5A572] shadow-sm font-bold'
                    : isCompleted
                    ? 'bg-emerald-950/40 text-emerald-400 border-emerald-800/50'
                    : 'bg-[#111318] text-[#666B76] border-[#292D35]/70 opacity-65'
                }`}
              >
                {isCompleted && <Check className="w-3 h-3 shrink-0" />}
                {isLocked && <Lock className="w-3 h-3 shrink-0" />}
                <span>{s.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-8 space-y-8">
        {/* =========================================================================
            STAGE 1: "01 Booking Confirmed" (status === 'confirmed')
            Hanya menampilkan tanggal kapan sesi foto akan dimulai
           ========================================================================= */}
        {currentStep === 1 && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div className="bg-[#171A20] border border-[#292D35] rounded-3xl p-8 sm:p-12 text-center space-y-6 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 left-0 h-1 bg-gradient-to-r from-transparent via-[#C5A572] to-transparent" />

              <div className="w-16 h-16 rounded-full bg-[#C5A572]/15 border border-[#C5A572]/40 flex items-center justify-center text-[#C5A572] mx-auto shadow-lg">
                <Calendar className="w-8 h-8" />
              </div>

              <div className="space-y-2 max-w-lg mx-auto">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#C5A572]/15 text-[#D8C49D] text-xs font-bold rounded-full border border-[#C5A572]/30">
                  <Sparkles className="w-3.5 h-3.5 text-[#C5A572]" />
                  <span>01 Booking Confirmed</span>
                </span>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-[#F2F1ED] tracking-tight font-['Plus_Jakarta_Sans']">
                  Sesi Foto Anda Akan Dimulai Pada:
                </h1>
              </div>

              <div className="p-6 sm:p-8 bg-[#111318] border border-[#C5A572]/40 rounded-2xl max-w-md mx-auto space-y-3 shadow-inner">
                <div className="text-2xl sm:text-3xl font-extrabold text-[#C5A572] font-mono">
                  {formatDateIndo(client.photo_date)}
                </div>
                <div className="text-base sm:text-lg font-bold text-[#F2F1ED] font-mono">
                  Pukul {client.session_time} WIB
                </div>
                <div className="text-xs text-[#9296A0] pt-2 border-t border-[#292D35]/50 flex items-center justify-center gap-1.5">
                  <MapPin className="w-4 h-4 text-[#C5A572] shrink-0" />
                  <span>{client.campus}</span>
                </div>
              </div>

              <p className="text-[11px] text-[#666B76] flex items-center justify-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-[#666B76]" />
                <span>Tahap selanjutnya hanya dapat dibuka oleh Admin Bestari saat sesi foto dimulai.</span>
              </p>
            </div>
          </div>
        )}

        {/* =========================================================================
            STAGE 2: "02 Photo Session" (status === 'photo_session')
            Mohon pelunasan dan mohon bersabar nanti akan dihubungi oleh tim FG kami
           ========================================================================= */}
        {currentStep === 2 && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div className="bg-[#171A20] border border-[#292D35] rounded-3xl p-8 sm:p-12 text-center space-y-6 shadow-2xl relative overflow-hidden">
              <div className="w-16 h-16 rounded-full bg-blue-950/60 border border-blue-500/40 flex items-center justify-center text-blue-400 mx-auto shadow-lg">
                <Camera className="w-8 h-8" />
              </div>

              <div className="space-y-2 max-w-lg mx-auto">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-950/60 text-blue-300 text-xs font-bold rounded-full border border-blue-800/50">
                  <Camera className="w-3.5 h-3.5 text-blue-400" />
                  <span>02 Photo Session</span>
                </span>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-[#F2F1ED] tracking-tight font-['Plus_Jakarta_Sans']">
                  Mohon Pelunasan &amp; Persiapan Sesi Foto
                </h1>
                <p className="text-sm font-semibold text-[#D8C49D]">
                  Mohon untuk segera melakukan pelunasan sisa pembayaran paket Anda.
                </p>
                <p className="text-xs text-[#9296A0] leading-relaxed">
                  Mohon bersabar, nanti akan segera dihubungi oleh tim fotografer (FG) kami untuk koordinasi di lokasi.
                </p>
              </div>

              <div className="p-6 bg-[#111318] border border-[#292D35] rounded-2xl max-w-md mx-auto space-y-4 text-xs text-left">
                <div className="flex items-center justify-between pb-2 border-b border-[#292D35]/50">
                  <span className="text-[#9296A0]">Status Pembayaran:</span>
                  {client.payment_status === 'LUNAS' ? (
                    <span className="px-2.5 py-0.5 rounded bg-emerald-950/60 border border-emerald-700/50 text-emerald-400 font-bold">
                      LUNAS
                    </span>
                  ) : (
                    <span className="font-mono text-base font-extrabold text-amber-300">
                      Sisa {formatRupiah(remainingBalance)}
                    </span>
                  )}
                </div>

                {client.payment_status !== 'LUNAS' && (
                  <div className="space-y-1">
                    <span className="text-[#666B76] block text-[10px] uppercase font-bold">
                      Rekening Resmi Pelunasan:
                    </span>
                    <div className="font-mono text-sm font-bold text-[#C5A572]">
                      SeaBank: 901507540052
                    </div>
                    <div className="text-[#F2F1ED] font-medium text-xs">
                      a/n Ivandra Bagus Pranata
                    </div>
                  </div>
                )}

                <div className="pt-2 border-t border-[#292D35]/50 flex items-center justify-between text-[11px] text-[#9296A0]">
                  <span>Fotografer Bertugas:</span>
                  <span className="text-[#F2F1ED] font-semibold">
                    {client.photographer?.trim() && client.photographer !== 'Belum Ditugaskan'
                      ? client.photographer
                      : 'Menunggu penugasan tim FG'}
                  </span>
                </div>
              </div>

              <div className="pt-2">
                <a
                  href={buildWhatsAppLink(
                    adminWaNumber,
                    `Halo Admin Bestari, saya ${client.client_name} (${client.order_id}) ingin konfirmasi pelunasan sesi foto wisuda.`
                  )}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 px-5 py-3 text-xs font-bold text-emerald-400 bg-emerald-950/70 hover:bg-emerald-950 border border-emerald-700/60 rounded-xl transition-colors shadow-md"
                >
                  <Phone className="w-4 h-4" />
                  <span>Konfirmasi Pelunasan ke Admin (WhatsApp)</span>
                </a>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
            STAGE 3: "03 Photo Gallery" (status === 'file_uploaded')
            Klien langsung bisa akses Let's Choose, Download All, dan Buka Link Google Drive tanpa tunggu Admin
           ========================================================================= */}
        {currentStep === 3 && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div className="p-6 bg-[#171A20] border border-[#C5A572]/40 rounded-3xl space-y-4 shadow-xl">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
                <div className="space-y-1.5 text-center lg:text-left">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#C5A572]/15 text-[#D8C49D] text-xs font-bold rounded-full border border-[#C5A572]/30">
                    <Sparkles className="w-3.5 h-3.5 text-[#C5A572]" />
                    <span>03 Photo Gallery</span>
                  </span>
                  <h2 className="text-xl font-bold text-[#F2F1ED]">
                    Hasil Foto Sesi Wisuda Anda Telah Diunggah!
                  </h2>
                  <p className="text-xs text-[#9296A0] leading-relaxed max-w-xl">
                    Mohon untuk segera memilih file editnya <strong>maksimal H+5</strong> setelah distribusi foto ini agar tim editor dapat langsung memproses foto Anda. Kuota edit Anda: <strong className="text-[#C5A572]">{editQuota} foto</strong>.
                  </p>
                </div>

                <div className="flex flex-wrap items-center justify-center lg:justify-end gap-2.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      void syncPortalActionToServer('start_selection');
                      onStartPhotoSelection(client.id);
                      setIsPickingPhotos(true);
                    }}
                    className="py-3 px-5 text-xs font-extrabold text-[#0B0C0F] bg-gradient-to-r from-[#C5A572] via-[#D8C49D] to-[#C5A572] hover:opacity-95 rounded-2xl transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>Let&apos;s Choose</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>

                  <a
                    href={client.drive_jpg_folder_url || client.drive_folder_url || 'https://drive.google.com'}
                    target="_blank"
                    rel="noreferrer"
                    className="py-3 px-4 text-xs font-bold text-emerald-300 bg-emerald-950/60 hover:bg-emerald-950 border border-emerald-700/60 rounded-2xl transition-colors flex items-center justify-center gap-2"
                    title="Unduh seluruh foto mentah (JPG) dari Google Drive"
                  >
                    <Download className="w-4 h-4 text-emerald-400" />
                    <span>Download All</span>
                  </a>

                  <a
                    href={client.drive_folder_url || 'https://drive.google.com'}
                    target="_blank"
                    rel="noreferrer"
                    className="py-3 px-4 text-xs font-semibold text-[#F2F1ED] bg-[#111318] hover:bg-[#1D2027] border border-[#292D35] hover:border-[#C5A572]/50 rounded-2xl transition-colors flex items-center justify-center gap-2"
                    title="Buka folder Google Drive Anda di tab baru"
                  >
                    <ExternalLink className="w-4 h-4 text-[#C5A572]" />
                    <span>Buka Link Drive</span>
                  </a>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {samplePhotoGallery.slice(0, 8).map(photo => (
                <div
                  key={photo.id}
                  onClick={() => setLightboxImage(photo.src)}
                  className="group relative aspect-[4/5] rounded-2xl overflow-hidden bg-[#171A20] border border-[#292D35] hover:border-[#C5A572]/60 transition-all cursor-pointer shadow-md"
                >
                  <img
                    src={photo.src}
                    alt={photo.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-80" />
                  <div className="absolute bottom-3 left-3 right-3 text-xs">
                    <span className="font-mono text-[10px] text-[#C5A572] block">{photo.id}</span>
                    <span className="font-medium text-[#F2F1ED] truncate block">{photo.title}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* =========================================================================
            STAGE 4: "04 Photo Selection" (status === 'selection_pending' | 'selection_submitted')
           ========================================================================= */}
        {currentStep === 4 && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {!isPickingPhotos ? (
              <div className="space-y-6">
                <div className="p-6 bg-[#171A20] border border-[#C5A572]/40 rounded-3xl space-y-4 shadow-xl">
                  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
                    <div className="space-y-1.5 text-center lg:text-left">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#C5A572]/15 text-[#D8C49D] text-xs font-bold rounded-full border border-[#C5A572]/30">
                        <Sparkles className="w-3.5 h-3.5 text-[#C5A572]" />
                        <span>04 Photo Gallery &amp; Selection Terbuka</span>
                      </span>
                      <h2 className="text-xl font-bold text-[#F2F1ED]">
                        Hasil Foto Anda Siap Dipilih!
                      </h2>
                      <p className="text-xs text-[#9296A0] leading-relaxed max-w-xl">
                        Mohon untuk segera memilih file editnya <strong>maksimal H+5</strong> setelah distribusi foto ini. Kuota edit paket Anda adalah{' '}
                        <strong className="text-[#C5A572]">{editQuota} foto</strong>.
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center justify-center lg:justify-end gap-2.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => setIsPickingPhotos(true)}
                        className="py-3 px-5 text-xs font-extrabold text-[#0B0C0F] bg-gradient-to-r from-[#C5A572] via-[#D8C49D] to-[#C5A572] hover:opacity-95 rounded-2xl transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <span>Let&apos;s Choose</span>
                        <ChevronRight className="w-4 h-4" />
                      </button>

                      <a
                        href={client.drive_folder_url || 'https://drive.google.com'}
                        target="_blank"
                        rel="noreferrer"
                        className="py-3 px-4 text-xs font-bold text-emerald-300 bg-emerald-950/60 hover:bg-emerald-950 border border-emerald-700/60 rounded-2xl transition-colors flex items-center justify-center gap-2"
                      >
                        <Download className="w-4 h-4 text-emerald-400" />
                        <span>Download All</span>
                      </a>

                      <a
                        href={client.drive_folder_url || 'https://drive.google.com'}
                        target="_blank"
                        rel="noreferrer"
                        className="py-3 px-4 text-xs font-semibold text-[#F2F1ED] bg-[#111318] hover:bg-[#1D2027] border border-[#292D35] hover:border-[#C5A572]/50 rounded-2xl transition-colors flex items-center justify-center gap-2"
                      >
                        <ExternalLink className="w-4 h-4 text-[#C5A572]" />
                        <span>Buka Link Drive</span>
                      </a>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {samplePhotoGallery.slice(0, 8).map(photo => (
                    <div
                      key={photo.id}
                      onClick={() => setLightboxImage(photo.src)}
                      className="group relative aspect-[4/5] rounded-2xl overflow-hidden bg-[#171A20] border border-[#292D35] hover:border-[#C5A572]/60 transition-all cursor-pointer shadow-md"
                    >
                      <img
                        src={photo.src}
                        alt={photo.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-80" />
                      <div className="absolute bottom-3 left-3 right-3 text-xs">
                        <span className="font-mono text-[10px] text-[#C5A572] block">{photo.id}</span>
                        <span className="font-medium text-[#F2F1ED] truncate block">{photo.title}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="p-6 bg-[#171A20] border border-[#292D35] rounded-3xl space-y-2">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#C5A572]/15 text-[#D8C49D] text-xs font-bold rounded-full border border-[#C5A572]/30">
                      <Check className="w-3.5 h-3.5 text-[#C5A572]" />
                      <span>04 Photo Selection</span>
                    </span>
                    <span className="text-xs font-mono text-[#9296A0]">
                      Maksimal Paket: {client.package_name} ({editQuota} Foto)
                    </span>
                  </div>
                  <h2 className="text-xl font-bold text-[#F2F1ED]">
                    Pilih Foto Terbaik Anda Untuk Diedit
                  </h2>
                  <p className="text-xs text-[#9296A0]">
                    Klik pada foto untuk memilih atau membatalkan pilihan. Jumlah maksimal foto edit sesuai paket Anda ({editQuota} foto). Setelah selesai, klik <strong>Kirim List Foto Edit</strong>.
                  </p>
                  <div className="text-[11px] font-mono text-[#C5A572]">
                    {isLoadingDriveGallery
                      ? 'Memuat daftar foto langsung dari Google Drive folder JPG...'
                      : isUsingLiveDriveGallery
                      ? `Terhubung Google Drive · ${drivePhotos.length} file foto asli ditemukan di folder JPG`
                      : 'Mode Pratinjau Galeri · Buka folder Drive JPG untuk melihat resolusi penuh'}
                  </div>
                </div>

                {/* Selectable Photos Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pb-24">
                  {samplePhotoGallery.map(photo => {
                    const isSelected = selectedPhotos.includes(photo.id);
                    const isLimitReached = !isSelected && selectedPhotos.length >= editQuota;

                    return (
                      <div
                        key={photo.id}
                        onClick={() => handleToggleSelectPhoto(photo.id)}
                        className={`group relative aspect-[4/5] rounded-2xl overflow-hidden bg-[#171A20] border-2 transition-all shadow-lg ${
                          isSelected
                            ? 'border-[#C5A572] ring-2 ring-[#C5A572]/50 scale-[1.02] cursor-pointer'
                            : isLimitReached
                            ? 'border-[#292D35] opacity-45 cursor-not-allowed'
                            : 'border-[#292D35] hover:border-[#C5A572]/40 cursor-pointer'
                        }`}
                      >
                        <img
                          src={photo.src}
                          alt={photo.title}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-80" />

                        <div className="absolute top-3 right-3">
                          <div
                            className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-extrabold transition-all shadow-md ${
                              isSelected
                                ? 'bg-[#C5A572] text-[#0B0C0F] scale-110'
                                : 'bg-black/60 border border-white/40 text-transparent'
                            }`}
                          >
                            ✓
                          </div>
                        </div>

                        <div className="absolute bottom-3 left-3 right-3 text-xs">
                          <span className="font-mono text-[10px] text-[#C5A572] block">{photo.id}</span>
                          <span className="font-medium text-[#F2F1ED] truncate block">{photo.title}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Fixed Bottom Selection Counter & Submit Bar */}
                <div className="fixed bottom-0 left-0 right-0 z-40 bg-[#101216]/95 backdrop-blur-md border-t border-[#292D35] p-4 shadow-2xl">
                  <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
                    <div className="space-y-0.5">
                      <div className="text-xs text-[#9296A0]">Total Foto Dipilih:</div>
                      <div className="text-base sm:text-lg font-extrabold font-mono text-[#F2F1ED]">
                        <span
                          className={
                            selectedPhotos.length === editQuota ? 'text-emerald-400' : 'text-[#C5A572]'
                          }
                        >
                          {selectedPhotos.length}
                        </span>{' '}
                        / {editQuota} Foto
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleSubmitPhotoList}
                      disabled={selectedPhotos.length === 0}
                      className="py-3 px-6 text-xs sm:text-sm font-bold text-[#0B0C0F] bg-gradient-to-r from-[#C5A572] to-[#D8C49D] hover:opacity-95 rounded-xl transition-all shadow-md active:scale-95 disabled:opacity-40 flex items-center gap-2"
                    >
                      <Send className="w-4 h-4" />
                      <span>Kirim List Foto Edit</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* =========================================================================
            STAGE 5: "05 Editing Process" (status === 'editing')
            Maks pengerjaan edit H+10 mohon bersabar (dinamis H-9, H-8, dst)
           ========================================================================= */}
        {currentStep === 5 && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div className="bg-[#171A20] border border-[#292D35] rounded-3xl p-8 sm:p-12 text-center space-y-6 shadow-2xl relative overflow-hidden">
              <div className="w-16 h-16 rounded-full bg-amber-950/60 border border-amber-500/40 flex items-center justify-center text-amber-400 mx-auto shadow-lg">
                <Clock className="w-8 h-8" />
              </div>

              <div className="space-y-2 max-w-lg mx-auto">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-950/60 text-amber-300 text-xs font-bold rounded-full border border-amber-800/50">
                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                  <span>05 Editing Process</span>
                </span>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-[#F2F1ED] tracking-tight font-['Plus_Jakarta_Sans']">
                  Foto Sedang Dalam Proses Editing
                </h1>
                <p className="text-base font-bold text-[#C5A572]">
                  Maksimal pengerjaan edit H+10 (Sisa H-{editingDaysRemaining} hari lagi), mohon bersabar.
                </p>
                <p className="text-xs text-[#9296A0] leading-relaxed">
                  Tim editor Bestari sedang melakukan color grading, retouching, dan finishing pada{' '}
                  <strong>{(client.selected_photo_ids || []).length || client.edit_quota} foto</strong> pilihan Anda.
                </p>
              </div>

              <div className="p-6 bg-[#111318] border border-[#292D35] rounded-2xl max-w-md mx-auto space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#9296A0]">SLA Pengerjaan:</span>
                  <span className="font-mono text-[#F2F1ED] font-bold">Maksimal H+10</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#9296A0]">Hitung Mundur Hari Ini:</span>
                  <span className="font-mono text-amber-400 font-extrabold text-sm">
                    H-{editingDaysRemaining}
                  </span>
                </div>
                <div className="w-full bg-[#1D2027] h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-[#C5A572] to-amber-400 h-full transition-all"
                    style={{ width: `${Math.max(10, ((10 - editingDaysRemaining) / 10) * 100)}%` }}
                  />
                </div>
                {client.editing_deadline && (
                  <span className="text-[11px] text-[#666B76] block text-center font-mono">
                    Estimasi Selesai: {formatDateIndo(client.editing_deadline)}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
            STAGE 6: "06 Final Delivery" (status === 'final_access')
           ========================================================================= */}
        {currentStep === 6 && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div className="bg-[#171A20] border border-[#C5A572]/50 rounded-3xl p-8 sm:p-12 text-center space-y-6 shadow-2xl relative overflow-hidden">
              <div className="w-16 h-16 rounded-full bg-[#C5A572]/20 border border-[#C5A572]/40 flex items-center justify-center text-[#C5A572] mx-auto shadow-lg">
                <Sparkles className="w-8 h-8" />
              </div>

              <div className="space-y-3 max-w-xl mx-auto">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#C5A572]/15 text-[#D8C49D] text-xs font-bold rounded-full border border-[#C5A572]/30">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#C5A572]" />
                  <span>06 Final Delivery</span>
                </span>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-[#F2F1ED] tracking-tight font-['Plus_Jakarta_Sans']">
                  Foto Edit Anda Sudah Selesai!
                </h1>
                <p className="text-sm font-semibold text-[#F2F1ED] leading-relaxed">
                  Seluruh foto pada folder <strong>JPG</strong> dan <strong>Edited Files</strong> sudah tersedia di Google Drive pribadi Anda.
                </p>
                <div className="p-3.5 bg-amber-950/50 border border-amber-800/60 rounded-xl text-xs font-semibold text-amber-300 max-w-lg mx-auto flex items-center justify-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>
                    Mohon segera download &amp; amankan file pribadi Anda — akses akan otomatis ditutup dalam{' '}
                    <strong className="font-mono">{finalAccessDaysRemaining} hari</strong> (batas 7 hari) dan otomatis lanjut ke tahap Review.
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-xl mx-auto pt-2">
                <a
                  href={client.drive_folder_url || 'https://drive.google.com'}
                  target="_blank"
                  rel="noreferrer"
                  className="py-3.5 px-5 bg-gradient-to-r from-[#C5A572] to-[#D8C49D] text-[#0B0C0F] font-bold text-xs rounded-xl shadow-lg hover:opacity-95 transition-all flex items-center justify-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  <span>Download All (JPG &amp; Edited Files)</span>
                </a>

                <button
                  type="button"
                  onClick={() => {
                    void syncPortalActionToServer('complete_final');
                    onCompleteFinalAccess(client.id);
                  }}
                  className="py-3.5 px-5 bg-emerald-500 hover:bg-emerald-400 text-[#0B0C0F] font-bold text-xs rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Sudah Didownload → Isi Review</span>
                </button>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-2.5 pt-1">
                {client.drive_jpg_folder_url && (
                  <a
                    href={client.drive_jpg_folder_url}
                    target="_blank"
                    rel="noreferrer"
                    className="py-2.5 px-3.5 bg-[#111318] hover:bg-[#252932] border border-[#292D35] text-[#F2F1ED] font-semibold text-xs rounded-xl transition-colors inline-flex items-center gap-1.5"
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-[#C5A572]" />
                    <span>Subfolder JPG</span>
                  </a>
                )}

                {client.drive_edited_folder_url && (
                  <a
                    href={client.drive_edited_folder_url}
                    target="_blank"
                    rel="noreferrer"
                    className="py-2.5 px-3.5 bg-[#111318] hover:bg-[#252932] border border-[#292D35] text-[#F2F1ED] font-semibold text-xs rounded-xl transition-colors inline-flex items-center gap-1.5"
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-[#C5A572]" />
                    <span>Subfolder Edited Files</span>
                  </a>
                )}

                {client.drive_announcement_folder_url && (
                  <a
                    href={client.drive_announcement_folder_url}
                    target="_blank"
                    rel="noreferrer"
                    className="py-2.5 px-3.5 bg-[#111318] hover:bg-[#252932] border border-[#292D35] text-[#F2F1ED] font-semibold text-xs rounded-xl transition-colors inline-flex items-center gap-1.5"
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-[#C5A572]" />
                    <span>Announcement</span>
                  </a>
                )}

                <a
                  href={client.drive_folder_url || 'https://drive.google.com'}
                  target="_blank"
                  rel="noreferrer"
                  className="py-2.5 px-4 bg-[#111318] hover:bg-[#252932] border border-[#292D35] text-[#D8C49D] font-semibold text-xs rounded-xl transition-colors inline-flex items-center gap-2"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-[#C5A572]" />
                  <span>Buka Link Google Drive</span>
                </a>

                <a
                  href={buildWhatsAppLink(
                    adminWaNumber,
                    `Halo Admin Bestari, saya ${client.client_name} (${client.order_id}) sudah menerima link final delivery dan ingin konfirmasi.`
                  )}
                  target="_blank"
                  rel="noreferrer"
                  className="py-2.5 px-4 bg-[#111318] hover:bg-[#252932] border border-[#292D35] text-[#F2F1ED] font-semibold text-xs rounded-xl transition-colors inline-flex items-center gap-2"
                >
                  <Phone className="w-3.5 h-3.5 text-[#C5A572]" />
                  <span>Hubungi Admin Bestari</span>
                </a>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
            STAGE 7: "07 Finished" (status === 'completed')
            Ucapan terima kasih + penilaian opsional (tidak wajib) yang masuk ke vendor & FG
           ========================================================================= */}
        {currentStep === 7 && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div className="bg-[#171A20] border border-[#292D35] rounded-3xl p-8 sm:p-12 text-center space-y-6 shadow-2xl relative overflow-hidden">
              <div className="w-16 h-16 rounded-full bg-emerald-950/60 border border-emerald-500/50 flex items-center justify-center text-emerald-400 mx-auto shadow-lg">
                <CheckCircle2 className="w-8 h-8" />
              </div>

              <div className="space-y-2 max-w-lg mx-auto">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-950/60 text-emerald-300 text-xs font-bold rounded-full border border-emerald-800/50">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                  <span>07 Finished</span>
                </span>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-[#F2F1ED] tracking-tight font-['Plus_Jakarta_Sans']">
                  Terima kasih sudah menggunakan jasa layanan Bestari!
                </h1>
                <p className="text-xs text-[#9296A0] leading-relaxed">
                  Suatu kehormatan bagi kami dapat mengabadikan momen kelulusan Anda. #WhereDreamsMeetReality
                </p>
              </div>

              <div className="p-6 sm:p-8 bg-[#111318] border border-[#292D35] rounded-2xl max-w-md mx-auto space-y-5 text-left">
                <div className="flex items-center justify-between gap-2 pb-3 border-b border-[#292D35]/70">
                  <div>
                    <span className="text-xs font-bold text-[#F2F1ED] block">
                      Penilaian Layanan &amp; Fotografer
                    </span>
                    <span className="text-[11px] text-[#9296A0]">
                      Bersifat opsional — isi hanya jika berkenan
                    </span>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#1D2027] text-[#D8C49D] border border-[#C5A572]/35 shrink-0">
                    Opsional
                  </span>
                </div>

                {client.photographer?.trim() && client.photographer !== 'Belum Ditugaskan' && (
                  <div className="px-3 py-2 bg-[#171A20] border border-[#292D35] rounded-xl flex items-center justify-between text-[11px]">
                    <span className="text-[#9296A0]">Fotografer yang bertugas:</span>
                    <span className="font-bold text-[#D8C49D] flex items-center gap-1.5">
                      <Camera className="w-3.5 h-3.5 text-[#C5A572]" />
                      <span>{client.photographer}</span>
                    </span>
                  </div>
                )}

                {reviewSkipped ? (
                  <div className="p-4 bg-[#171A20] border border-[#292D35] rounded-xl text-center space-y-2.5">
                    <p className="text-xs text-[#F2F1ED] font-medium">
                      Anda memilih untuk melewati pengisian rating. Terima kasih telah mempercayakan momen wisuda bersama Bestari!
                    </p>
                    <button
                      type="button"
                      onClick={() => setReviewSkipped(false)}
                      className="text-[11px] font-semibold text-[#C5A572] hover:underline cursor-pointer"
                    >
                      Ingin memberi rating sekarang?
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="space-y-2 text-center">
                      <span className="text-xs font-semibold text-[#9296A0] block">
                        Pilih Bintang (1 - 5 · Opsional):
                      </span>
                      <div className="flex items-center justify-center gap-2">
                        {[1, 2, 3, 4, 5].map(star => {
                          const isFilled = (hoverRating || rating) >= star;
                          return (
                            <button
                              key={star}
                              type="button"
                              disabled={reviewSubmitted}
                              onMouseEnter={() => !reviewSubmitted && setHoverRating(star)}
                              onMouseLeave={() => setHoverRating(0)}
                              onClick={() =>
                                !reviewSubmitted && setRating(prev => (prev === star ? 0 : star))
                              }
                              className="p-1 transition-transform hover:scale-125 focus:outline-none disabled:hover:scale-100 cursor-pointer"
                              title={`Beri ${star} bintang`}
                            >
                              <Star
                                className={`w-7 h-7 transition-colors ${
                                  isFilled ? 'fill-[#C5A572] text-[#C5A572]' : 'text-[#292D35]'
                                }`}
                              />
                            </button>
                          );
                        })}
                      </div>
                      <span className="text-[11px] font-mono font-bold text-[#C5A572] block min-h-[16px]">
                        {rating === 0 && 'Belum memilih bintang (Opsional)'}
                        {rating === 5 && '★★★★★ Sangat Memuaskan'}
                        {rating === 4 && '★★★★☆ Bagus'}
                        {rating === 3 && '★★★☆☆ Cukup Baik'}
                        {rating === 2 && '★★☆☆☆ Kurang'}
                        {rating === 1 && '★☆☆☆☆ Perlu Evaluasi'}
                      </span>
                      <p className="text-[10px] text-[#666B76] leading-relaxed">
                        Rating yang Anda berikan akan masuk ke rekapan penilaian Bestari Graduation &amp; evaluasi performa fotografer.
                      </p>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[#9296A0] font-semibold text-xs uppercase tracking-wider block">
                        Komentar, Kritik &amp; Saran (Opsional):
                      </label>
                      <textarea
                        rows={3}
                        disabled={reviewSubmitted}
                        placeholder="Tuliskan kritik, saran, atau kesan Anda menggunakan layanan Bestari..."
                        value={feedbackComment}
                        onChange={e => setFeedbackComment(e.target.value)}
                        className="w-full p-3 bg-[#171A20] border border-[#292D35] rounded-xl text-xs text-[#F2F1ED] focus:outline-none focus:border-[#C5A572] transition-colors disabled:opacity-75"
                      />
                    </div>

                    {reviewSubmitted ? (
                      <div className="p-3 bg-emerald-950/60 border border-emerald-800 text-emerald-300 text-xs font-semibold text-center rounded-xl">
                        ✓ Terima kasih! Ulasan Anda telah tersimpan ke rekapan layanan Bestari
                        {client.photographer?.trim() && client.photographer !== 'Belum Ditugaskan'
                          ? ` & performa FG ${client.photographer}.`
                          : '.'}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <button
                          type="button"
                          onClick={handleSaveReview}
                          disabled={rating === 0 && !feedbackComment.trim()}
                          className="w-full py-3 px-4 text-xs font-bold text-[#0B0C0F] bg-gradient-to-r from-[#C5A572] to-[#D8C49D] hover:opacity-95 rounded-xl transition-all shadow-md active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>Kirim Penilaian &amp; Kritik Saran</span>
                        </button>

                        <button
                          type="button"
                          onClick={handleSkipReview}
                          className="w-full py-2.5 px-4 text-xs font-semibold text-[#9296A0] hover:text-[#F2F1ED] bg-[#171A20] hover:bg-[#1D2027] border border-[#292D35] rounded-xl transition-colors cursor-pointer"
                        >
                          Lewati (Tidak Perlu Memberi Rating)
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* CLIENT HELP CENTER (FAQ) */}
        <ClientHelpCenter clientName={client.client_name} orderId={client.order_id} />
      </div>

      {/* Lightbox Modal */}
      {lightboxImage && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 cursor-pointer"
          onClick={() => setLightboxImage(null)}
        >
          <button
            onClick={() => setLightboxImage(null)}
            className="absolute top-5 right-5 p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
          <img
            src={lightboxImage}
            alt="Preview Fullscreen"
            className="max-w-4xl max-h-[85vh] object-contain rounded-xl shadow-2xl"
          />
        </div>
      )}
    </div>
  );
};
