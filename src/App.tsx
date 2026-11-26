/**
 * BESTARI GRADUATION — 2027 OPERATIONAL COMMAND CENTER & CLIENT PORTAL
 * Tagline: #WhereDreamsMeetReality
 * Areas: Malang & Surabaya
 */

import React, { useEffect, useRef, useState } from 'react';
import { Sidebar } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { CommandCenter } from './components/dashboard/CommandCenter';
import { MainDatabase } from './components/main-database/MainDatabase';
import { BookingRequestsView } from './components/booking-requests/BookingRequestsView';
import { ScheduleView } from './components/schedule/ScheduleView';
import { FinanceView } from './components/finance/FinanceView';
import { AnalyticsView } from './components/analytics/AnalyticsView';
import { SettingsView } from './components/settings/SettingsView';
import { ClientPortal } from './components/client-portal/ClientPortal';
import { PublicBookingForm } from './components/booking-requests/PublicBookingForm';
import { FgFieldPortal } from './components/schedule/FgFieldPortal';
import { AdminLoginGate } from './components/auth/AdminLoginGate';
import { NewBookingModal } from './components/modals/NewBookingModal';
import { NewTransactionModal } from './components/modals/NewTransactionModal';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './lib/firebase';
import { isFirebaseAdminUser } from './services/firestoreSync';
import { useBestariStore } from './hooks/useBestariStore';
import { ClientBooking, SystemNotification } from './types';

export default function App() {
  // Admin access gate state (verified against signed HttpOnly cookie OR Firebase Google Admin)
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState<boolean>(false);
  const store = useBestariStore(isAdminAuthenticated);

  useEffect(() => {
    let active = true;
    fetch('/api/admin/session', { credentials: 'include' })
      .then(res => (res.ok ? res.json() : null))
      .then((data: { authenticated?: boolean } | null) => {
        if (active && data?.authenticated) {
          setIsAdminAuthenticated(true);
        }
      })
      .catch(() => {
        // Require login when offline or unverified
      });

    const unsub = onAuthStateChanged(auth, async user => {
      if (!active || !isFirebaseAdminUser(user) || !user) return;
      try {
        const idToken = await user.getIdToken();
        const res = await fetch('/api/admin/firebase-login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ idToken })
        });
        if (active && res.ok) {
          setIsAdminAuthenticated(true);
        }
      } catch {
        // Keep current session check
      }
    });

    return () => {
      active = false;
      unsub();
    };
  }, []);

  const handleAdminLoginSuccess = () => {
    setIsAdminAuthenticated(true);
  };

  const handleAdminLogout = () => {
    setIsAdminAuthenticated(false);
    setSelectedClientForDatabase(null);
    void auth.signOut().catch(() => {});
    void fetch('/api/admin/logout', {
      method: 'POST',
      credentials: 'include'
    }).catch(() => {});
  };

  // Deep-link detection (?client_id=001 or ?portal=1) for direct wisudawan Client Portal URL
  const [initialPortalClientIdQuery, setInitialPortalClientIdQuery] = useState<string>(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      return (params.get('client_id') || params.get('order_id') || '').trim();
    } catch {
      return '';
    }
  });

  // Navigation states
  const [currentTab, setCurrentTab] = useState<string>('dashboard');
  const [viewMode, setViewMode] = useState<'admin' | 'portal' | 'public_booking' | 'fg_portal'>(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get('fg') === '1') {
        return 'fg_portal';
      }
      if (params.get('book') === '1' || params.get('booking') === '1') {
        return 'public_booking';
      }
      if (params.get('client_id') || params.get('order_id') || params.get('portal') === '1') {
        return 'portal';
      }
    } catch {
      // Ignore URL parse issues
    }
    return 'admin';
  });
  const [selectedClientForPortal, setSelectedClientForPortal] = useState<string | undefined>();
  const [selectedClientForDatabase, setSelectedClientForDatabase] = useState<ClientBooking | null>(null);

  // Animasi muncul saat di-scroll: hanya bagian yang masih di bawah layar yang disembunyikan dulu.
  const mainRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const main = mainRef.current;
    if (!main || typeof IntersectionObserver === 'undefined') return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const io = new IntersectionObserver(
      entries => {
        entries.forEach(en => {
          if (!en.isIntersecting) return;
          const el = en.target as HTMLElement;
          el.classList.remove('rv-hidden');
          el.classList.add('rv-in');
          io.unobserve(el);
        });
      },
      { threshold: 0.08 }
    );
    const timer = window.setTimeout(() => {
      main.querySelectorAll<HTMLElement>(':scope > * > *').forEach(el => {
        if (el.getBoundingClientRect().top > window.innerHeight * 0.92) {
          el.classList.add('rv-hidden');
          io.observe(el);
        }
      });
    }, 60);
    return () => {
      window.clearTimeout(timer);
      io.disconnect();
    };
  }, [currentTab, isAdminAuthenticated, viewMode]);


  // Sidebar responsive states
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Modals
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);

  // Handlers for switching views
  const handleOpenClientPortal = (clientId?: string) => {
    setSelectedClientForPortal(clientId);
    setViewMode('portal');
  };

  const handleOpenPublicBooking = () => {
    setSelectedClientForPortal(undefined);
    setViewMode('public_booking');
  };

  const handleOpenFgPortal = () => {
    setSelectedClientForPortal(undefined);
    setViewMode('fg_portal');
  };

  const handleExitPortal = () => {
    setSelectedClientForPortal(undefined);
    setInitialPortalClientIdQuery('');
    setViewMode('admin');
    try {
      if (window.location.search) {
        window.history.replaceState({}, '', window.location.pathname);
      }
    } catch {
      // Ignore history errors
    }
    void store.refreshFromServer();
  };

  const handleSelectClientFromDashboard = (client: ClientBooking) => {
    setSelectedClientForDatabase(client);
    setCurrentTab('database');
  };

  const handleNotificationClick = (notif: SystemNotification) => {
    store.markNotificationRead(notif.id);

    if (notif.type === 'booking_request' || notif.type === 'pending_dp') {
      setSelectedClientForDatabase(null);
      setCurrentTab('requests');
      return;
    }

    if (notif.type === 'payment_pending') {
      setSelectedClientForDatabase(null);
      setCurrentTab('finance');
      return;
    }

    const matchedClient = store.clients.find(
      c =>
        (notif.client_id && c.id === notif.client_id) ||
        (notif.order_id && c.order_id === notif.order_id)
    );

    if (matchedClient) {
      if (matchedClient.booking_year !== store.selectedYear) {
        store.setSelectedYear(matchedClient.booking_year);
      }
      setSelectedClientForDatabase(matchedClient);
    } else {
      setSelectedClientForDatabase(null);
    }
    setCurrentTab('database');
  };

  // If in Client Portal mode
  if (viewMode === 'portal') {
    return (
      <ClientPortal
        clients={store.clients}
        transactions={store.transactions}
        addons={store.addons}
        activeClientId={selectedClientForPortal}
        initialClientIdQuery={initialPortalClientIdQuery}
        onExitPortal={handleExitPortal}
        onStartPhotoSelection={clientId => {
          const target = store.clients.find(c => c.id === clientId);
          const deadline = new Date();
          deadline.setDate(deadline.getDate() + 5);
          store.updateClient(
            clientId,
            {
              status: 'selection_pending',
              file_uploaded: true,
              selection_deadline: deadline.toISOString().split('T')[0]
            },
            {
              actor: 'Client Portal',
              adminUserId: `CLIENT-${target?.client_id_display || 'PORTAL'}`
            }
          );
        }}
        onSubmitPhotoSelection={(clientId, selectedIds) => {
          const target = store.clients.find(c => c.id === clientId);
          const editingDeadline = new Date();
          editingDeadline.setDate(editingDeadline.getDate() + 10);
          store.updateClient(
            clientId,
            {
              selection_submitted: true,
              status: 'editing',
              selected_photos_count: selectedIds.length,
              selected_photo_ids: selectedIds,
              selection_submitted_at: new Date().toISOString().split('T')[0],
              editing_deadline: editingDeadline.toISOString().split('T')[0]
            },
            {
              actor: 'Client Portal',
              adminUserId: `CLIENT-${target?.client_id_display || 'PORTAL'}`
            }
          );
        }}
        onCompleteFinalAccess={clientId => {
          const target = store.clients.find(c => c.id === clientId);
          store.updateClient(
            clientId,
            {
              status: 'completed'
            },
            {
              actor: 'Client Portal',
              adminUserId: `CLIENT-${target?.client_id_display || 'PORTAL'}`
            }
          );
        }}
        onSubmitFeedback={(clientId, rating, comment) => {
          const target = store.clients.find(c => c.id === clientId);
          store.updateClient(
            clientId,
            {
              status: 'completed',
              ...(rating !== undefined ? { feedback_rating: rating } : {}),
              feedback_comment: comment,
              feedback_skipped: false
            },
            {
              actor: 'Client Portal',
              adminUserId: `CLIENT-${target?.client_id_display || 'PORTAL'}`
            }
          );
        }}
        onSkipFeedback={clientId => {
          const target = store.clients.find(c => c.id === clientId);
          store.updateClient(
            clientId,
            {
              status: 'completed',
              feedback_skipped: true
            },
            {
              actor: 'Client Portal',
              adminUserId: `CLIENT-${target?.client_id_display || 'PORTAL'}`
            }
          );
        }}
      />
    );
  }

  // If in Public Booking Form mode
  if (viewMode === 'public_booking') {
    return (
      <PublicBookingForm
        onExitBooking={handleExitPortal}
        onOpenClientPortal={() => handleOpenClientPortal()}
      />
    );
  }

  // If in FG Field Portal mode
  if (viewMode === 'fg_portal') {
    return <FgFieldPortal onExitPortal={handleExitPortal} />;
  }

  // Require Admin username & password before entering Admin Workspace / Main Database
  if (!isAdminAuthenticated) {
    return (
      <AdminLoginGate
        onLoginSuccess={handleAdminLoginSuccess}
        onOpenClientPortal={() => handleOpenClientPortal()}
        onOpenPublicBooking={handleOpenPublicBooking}
        onOpenFgPortal={handleOpenFgPortal}
      />
    );
  }

  // Active year filtered clients count & schedule alerts for sidebar
  const yearClients = store.clients.filter(c => c.booking_year === store.selectedYear);
  const yearClientsCount = yearClients.length;
  const scheduleAlertsCount = yearClients.filter(
    c =>
      c.status !== 'cancelled' &&
      c.status !== 'completed' &&
      (!c.photographer || c.photographer.toLowerCase().includes('belum'))
  ).length;

  return (
    <div className="min-h-screen bestari-canvas-bg text-[#F2F1ED] flex font-['DM_Sans'] antialiased">
      {/* Sidebar Navigation */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        pendingRequestsCount={store.requests.length}
        totalClientsCount={yearClientsCount}
        scheduleAlertsCount={scheduleAlertsCount}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        isMobileOpen={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
        onOpenClientPortal={() => handleOpenClientPortal()}
      />

      {/* Main Layout Area */}
      <div
        className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ease-in-out ${
          isSidebarCollapsed ? 'lg:pl-20' : 'lg:pl-64'
        }`}
      >
        {/* Sticky Top Header */}
        <Header
          currentTab={currentTab}
          selectedYear={store.selectedYear}
          onSelectYear={store.setSelectedYear}
          notifications={store.notifications}
          onNotificationClick={handleNotificationClick}
          onMarkAllNotificationsRead={store.markAllNotificationsRead}
          onToggleMobileSidebar={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
          onAdminLogout={handleAdminLogout}
          isDriveConnected={store.isDriveConnected}
          driveUserEmail={store.driveUser?.email || null}
          isConnectingDrive={store.isConnectingDrive}
          onDriveSignIn={store.connectGoogleDrive}
          onDriveSignOut={store.disconnectGoogleDrive}
        />

        {/* Content Viewport */}
        <main ref={mainRef} key={currentTab} className="page-enter flex-1 p-4 sm:p-6 lg:p-8">
          {currentTab === 'dashboard' && (
            <CommandCenter
              clients={store.clients}
              requests={store.requests}
              transactions={store.transactions}
              logs={store.logs}
              selectedYear={store.selectedYear}
              onNavigateTab={setCurrentTab}
              onSelectClient={handleSelectClientFromDashboard}
              onOpenNewBookingModal={() => setIsBookingModalOpen(true)}
              onOpenNewTransactionModal={() => setIsTransactionModalOpen(true)}
              onFinishEditingAndOpenFinalAccess={store.finishEditingAndOpenFinalAccess}
            />
          )}

          {currentTab === 'database' && (
            <MainDatabase
              clients={store.clients}
              transactions={store.transactions}
              packages={store.packages}
              addons={store.addons}
              photographers={store.photographers}
              messageTemplates={store.messageTemplates}
              selectedYear={store.selectedYear}
              isDriveConnected={store.isDriveConnected}
              driveUserEmail={store.driveUser?.email || null}
              isConnectingDrive={store.isConnectingDrive}
              driveAuthError={store.driveAuthError}
              onClearDriveAuthError={store.clearDriveAuthError}
              onDriveSignIn={store.connectGoogleDrive}
              onDriveSignOut={store.disconnectGoogleDrive}
              onUpdateClient={store.updateClient}
              onDeleteClient={store.deleteClient}
              onFinishEditingAndOpenFinalAccess={store.finishEditingAndOpenFinalAccess}
              onVerifyFullPayment={store.verifyFullPayment}
              onBulkVerifyFullPayment={store.bulkVerifyFullPayment}
              onBulkUpdateWorkflowStatus={store.bulkUpdateWorkflowStatus}
              onBulkAssignPhotographer={store.bulkAssignPhotographer}
              onBulkDeleteClients={store.bulkDeleteClients}
              onSendInvoiceToDrive={store.sendInvoiceToClientDrive}
              onOpenNewTransactionModal={() => setIsTransactionModalOpen(true)}
              onOpenClientPortalPreview={clientId => handleOpenClientPortal(clientId)}
              selectedClientFromParent={selectedClientForDatabase}
              onClearSelectedClient={() => setSelectedClientForDatabase(null)}
            />
          )}

          {currentTab === 'requests' && (
            <BookingRequestsView
              requests={store.requests}
              packages={store.packages}
              messageTemplates={store.messageTemplates}
              selectedYear={store.selectedYear}
              isDriveConnected={store.isDriveConnected}
              driveUserEmail={store.driveUser?.email || null}
              isConnectingDrive={store.isConnectingDrive}
              driveAuthError={store.driveAuthError}
              onDriveSignIn={store.connectGoogleDrive}
              onDriveSignOut={store.disconnectGoogleDrive}
              onProvisionClientDriveFolder={store.provisionClientDriveFolder}
              onConfirmRequest={store.confirmBookingRequest}
              onOpenNewBookingModal={() => setIsBookingModalOpen(true)}
            />
          )}

          {currentTab === 'schedule' && (
            <ScheduleView
              clients={store.clients}
              photographers={store.photographers}
              selectedYear={store.selectedYear}
              onUpdateClient={store.updateClient}
              onSelectClient={handleSelectClientFromDashboard}
            />
          )}

          {currentTab === 'finance' && (
            <FinanceView
              transactions={store.transactions}
              clients={store.clients}
              selectedYear={store.selectedYear}
              onOpenNewTransactionModal={() => setIsTransactionModalOpen(true)}
            />
          )}

          {currentTab === 'analytics' && (
            <AnalyticsView
              clients={store.clients}
              transactions={store.transactions}
              photographers={store.photographers}
              selectedYear={store.selectedYear}
            />
          )}

          {currentTab === 'settings' && (
            <SettingsView
              packages={store.packages}
              addons={store.addons}
              photographers={store.photographers}
              messageTemplates={store.messageTemplates}
              driveConfig={store.driveConfig}
              isDriveConnected={store.isDriveConnected}
              driveUserEmail={store.driveUser?.email || null}
              isConnectingDrive={store.isConnectingDrive}
              driveAuthError={store.driveAuthError}
              selectedYear={store.selectedYear}
              onAddPackage={store.addPackage}
              onUpdatePackage={store.updatePackage}
              onDeletePackage={store.deletePackage}
              onAddAddon={store.addAddon}
              onUpdateAddon={store.updateAddon}
              onDeleteAddon={store.deleteAddon}
              onAddPhotographer={store.addPhotographer}
              onUpdatePhotographer={store.updatePhotographer}
              onDeletePhotographer={store.deletePhotographer}
              onUpdateMessageTemplates={store.updateMessageTemplates}
              onResetMessageTemplates={store.resetMessageTemplates}
              onUpdateDriveConfig={store.updateDriveConfig}
              onResetDriveConfig={store.resetDriveConfig}
              onDriveSignIn={store.connectGoogleDrive}
              onDriveSignOut={store.disconnectGoogleDrive}
              onResetToDefaults={store.resetToFactoryDefaults}
              onImportBackup={store.importBackupPayload}
              fullDataPayload={{
                clients: store.clients,
                requests: store.requests,
                transactions: store.transactions,
                packages: store.packages,
                addons: store.addons,
                photographers: store.photographers,
                messageTemplates: store.messageTemplates,
                driveConfig: store.driveConfig,
                logs: store.logs
              }}
            />
          )}
        </main>
      </div>

      {/* Global Modals */}
      <NewBookingModal
        packages={store.packages}
        addons={store.addons}
        isOpen={isBookingModalOpen}
        onClose={() => setIsBookingModalOpen(false)}
        onSubmit={formData => {
          store.addBookingRequest(formData);
        }}
      />

      <NewTransactionModal
        clients={store.clients}
        isOpen={isTransactionModalOpen}
        onClose={() => setIsTransactionModalOpen(false)}
        onSubmit={txData => {
          store.addTransaction(txData);
        }}
      />
    </div>
  );
}
