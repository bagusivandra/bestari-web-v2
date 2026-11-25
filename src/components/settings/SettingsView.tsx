import React, { useState, useEffect } from 'react';
import {
  Settings,
  Package,
  Layers,
  Clock,
  MessageSquare,
  Download,
  RotateCcw,
  Check,
  Shield,
  Camera,
  Edit3,
  Plus,
  Trash2,
  Save,
  X,
  FolderOpen,
  Folder,
  ChevronRight,
  ChevronDown,
  ArrowLeft,
  ExternalLink,
  AlertTriangle,
  FileText,
  Upload,
  Phone
} from 'lucide-react';
import {
  PackagePlan,
  AddOnItem,
  Region,
  MessageTemplates,
  DriveConfigSettings
} from '../../types';
import { formatRupiah } from '../../utils/formatters';
import { GoogleDriveButton } from '../common/GoogleDriveButton';
import {
  DEFAULT_ADMIN_WHATSAPP,
  formatWhatsappDisplay,
  isValidWhatsapp,
  normalizeWhatsapp
} from '../../utils/adminContact';
import { buildWhatsAppLink } from '../../utils/formatters';

interface SettingsViewProps {
  packages: PackagePlan[];
  addons: AddOnItem[];
  photographers: string[];
  messageTemplates: MessageTemplates;
  driveConfig: DriveConfigSettings;
  isDriveConnected: boolean;
  driveUserEmail?: string | null;
  isConnectingDrive?: boolean;
  driveAuthError?: string | null;
  selectedYear: number;
  onAddPackage: (pkg: Omit<PackagePlan, 'id'>) => PackagePlan;
  onUpdatePackage: (pkgId: string, updates: Partial<PackagePlan>) => void;
  onDeletePackage: (pkgId: string) => void;
  onAddAddon: (addon: Omit<AddOnItem, 'id'>) => AddOnItem;
  onUpdateAddon: (addonId: string, updates: Partial<AddOnItem>) => void;
  onDeleteAddon: (addonId: string) => void;
  onAddPhotographer: (name: string) => boolean;
  onUpdatePhotographer: (oldName: string, newName: string) => boolean;
  onDeletePhotographer: (name: string) => void;
  onUpdateMessageTemplates: (updates: Partial<MessageTemplates>) => void;
  onResetMessageTemplates: () => void;
  onUpdateDriveConfig: (updates: Partial<DriveConfigSettings>) => void;
  onResetDriveConfig: () => void;
  onDriveSignIn: () => void;
  onDriveSignOut: () => void;
  onResetToDefaults: () => void;
  onImportBackup?: (rawBackup: any) => { ok: boolean; message: string };
  fullDataPayload: any;
}

type SettingsFolderId =
  | 'packages'
  | 'addons'
  | 'photographers'
  | 'rules'
  | 'templates'
  | 'whatsapp'
  | 'backup'
  | 'drive';

export const SettingsView: React.FC<SettingsViewProps> = ({
  packages,
  addons,
  photographers,
  messageTemplates,
  driveConfig,
  isDriveConnected,
  driveUserEmail,
  isConnectingDrive = false,
  driveAuthError,
  selectedYear,
  onAddPackage,
  onUpdatePackage,
  onDeletePackage,
  onAddAddon,
  onUpdateAddon,
  onDeleteAddon,
  onAddPhotographer,
  onUpdatePhotographer,
  onDeletePhotographer,
  onUpdateMessageTemplates,
  onResetMessageTemplates,
  onUpdateDriveConfig,
  onResetDriveConfig,
  onDriveSignIn,
  onDriveSignOut,
  onResetToDefaults,
  onImportBackup,
  fullDataPayload
}) => {
  // Folder-based navigation: null = ringkas root directory
  const [activeFolder, setActiveFolder] = useState<SettingsFolderId | null>(null);

  const [activeRegion, setActiveRegion] = useState<Region>('malang');
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [importStatus, setImportStatus] = useState<{ ok: boolean; message: string } | null>(null);

  // Package edit & create states
  const [editingPkgId, setEditingPkgId] = useState<string | null>(null);
  const [pkgNameInput, setPkgNameInput] = useState<string>('');
  const [pkgPriceInput, setPkgPriceInput] = useState<string>('');
  const [pkgQuotaInput, setPkgQuotaInput] = useState<string>('');
  const [pkgDescInput, setPkgDescInput] = useState<string>('');
  const [pkgSavedId, setPkgSavedId] = useState<string | null>(null);
  const [confirmDeletePkgId, setConfirmDeletePkgId] = useState<string | null>(null);

  const [isCreatingPkg, setIsCreatingPkg] = useState(false);
  const [newPkgName, setNewPkgName] = useState('');
  const [newPkgRegion, setNewPkgRegion] = useState<Region>('malang');
  const [newPkgPrice, setNewPkgPrice] = useState('350000');
  const [newPkgQuota, setNewPkgQuota] = useState('25');
  const [newPkgDesc, setNewPkgDesc] = useState('');
  const [pkgFormError, setPkgFormError] = useState('');

  // Add-on edit & create states
  const [editingAddonId, setEditingAddonId] = useState<string | null>(null);
  const [addonNameInput, setAddonNameInput] = useState<string>('');
  const [addonPriceInput, setAddonPriceInput] = useState<string>('');
  const [addonQuotaInput, setAddonQuotaInput] = useState<string>('0');
  const [addonApprovalInput, setAddonApprovalInput] = useState<boolean>(false);
  const [addonDescInput, setAddonDescInput] = useState<string>('');
  const [addonSavedId, setAddonSavedId] = useState<string | null>(null);
  const [confirmDeleteAddonId, setConfirmDeleteAddonId] = useState<string | null>(null);

  const [isCreatingAddon, setIsCreatingAddon] = useState(false);
  const [newAddonName, setNewAddonName] = useState('');
  const [newAddonPrice, setNewAddonPrice] = useState('50000');
  const [newAddonQuota, setNewAddonQuota] = useState('0');
  const [newAddonApproval, setNewAddonApproval] = useState(false);
  const [newAddonDesc, setNewAddonDesc] = useState('');
  const [addonFormError, setAddonFormError] = useState('');

  // Photographer management states
  const [newFgName, setNewFgName] = useState('');
  const [fgError, setFgError] = useState('');
  const [editingFgOriginal, setEditingFgOriginal] = useState<string | null>(null);
  const [editingFgValue, setEditingFgValue] = useState('');

  // Message templates draft state & active sub-template selector
  const [templateDraft, setTemplateDraft] = useState<MessageTemplates>(messageTemplates);
  const [templateSavedToast, setTemplateSavedToast] = useState(false);
  const [activeTemplateKey, setActiveTemplateKey] = useState<
    'dp_followup' | 'booking_confirmed_copy' | 'pelunasan_fg_reminder'
  >('dp_followup');

  // Google Drive config draft state & blueprint collapse toggle
  const [waDraft, setWaDraft] = useState<string>(
    messageTemplates.admin_whatsapp || DEFAULT_ADMIN_WHATSAPP
  );
  const [waSavedToast, setWaSavedToast] = useState(false);
  useEffect(() => {
    setWaDraft(messageTemplates.admin_whatsapp || DEFAULT_ADMIN_WHATSAPP);
  }, [messageTemplates.admin_whatsapp]);
  const waIsValid = isValidWhatsapp(waDraft);
  const waIsSaved = normalizeWhatsapp(waDraft) === (messageTemplates.admin_whatsapp || '');
  const handleSaveWa = () => {
    if (!waIsValid) return;
    onUpdateMessageTemplates({ admin_whatsapp: normalizeWhatsapp(waDraft) });
    setWaSavedToast(true);
    setTimeout(() => setWaSavedToast(false), 2500);
  };
  const [driveConfigDraft, setDriveConfigDraft] = useState<DriveConfigSettings>(driveConfig);
  const [driveSavedToast, setDriveSavedToast] = useState(false);
  const [showDriveBlueprint, setShowDriveBlueprint] = useState(false);

  useEffect(() => {
    setTemplateDraft(messageTemplates);
  }, [messageTemplates]);

  useEffect(() => {
    setDriveConfigDraft(driveConfig);
  }, [driveConfig]);

  const regionPackages = packages.filter(p => p.region === activeRegion);

  const folders: Array<{
    id: SettingsFolderId;
    title: string;
    meta: string;
    icon: React.ComponentType<{ className?: string }>;
  }> = [
    {
      id: 'packages',
      title: 'Paket Fotografi',
      meta: `${packages.length} paket · Malang & Surabaya`,
      icon: Package
    },
    {
      id: 'addons',
      title: 'Layanan Add-on',
      meta: `${addons.length} layanan tambahan`,
      icon: Layers
    },
    {
      id: 'photographers',
      title: 'Tim Fotografer (FG)',
      meta: `${photographers.length} fotografer aktif`,
      icon: Camera
    },
    {
      id: 'rules',
      title: 'Aturan SLA & Operasional',
      meta: '4 batas waktu otomatis',
      icon: Clock
    },
    {
      id: 'templates',
      title: 'Template Pesan WhatsApp',
      meta: '3 template siap pakai',
      icon: MessageSquare
    },
    {
      id: 'whatsapp',
      title: 'Nomor WhatsApp Admin',
      meta: messageTemplates.admin_whatsapp
        ? formatWhatsappDisplay(messageTemplates.admin_whatsapp)
        : 'Belum diatur · masih nomor contoh',
      icon: Phone
    },
    {
      id: 'drive',
      title: 'Google Drive & Folder',
      meta: `${isDriveConnected ? 'Terhubung' : 'Belum terhubung'} · Root & Mirror`,
      icon: FolderOpen
    },
    {
      id: 'backup',
      title: 'Backup, Panduan & Reset',
      meta: 'JSON, PDF Panduan & Factory Reset',
      icon: Shield
    }
  ];

  const activeFolderMeta = folders.find(f => f.id === activeFolder);

  const handleExportBackup = () => {
    const backupData = {
      export_version: '2027.1',
      generated_at: new Date().toISOString(),
      business: 'BESTARI GRADUATION (#WhereDreamsMeetReality)',
      data: fullDataPayload
    };

    const blob = new Blob([JSON.stringify(backupData, null, 2)], {
      type: 'application/json'
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `bestari_graduation_backup_${selectedYear}_${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);

    setDownloadSuccess(true);
    setTimeout(() => setDownloadSuccess(false), 3000);
  };

  const handleImportFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !onImportBackup) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result || '{}'));
        const result = onImportBackup(parsed);
        setImportStatus(result);
        setTimeout(() => setImportStatus(null), 4000);
      } catch {
        setImportStatus({ ok: false, message: 'File JSON rusak atau tidak dapat dibaca.' });
        setTimeout(() => setImportStatus(null), 4000);
      }
    };
    reader.readAsText(file);
  };

  const handleStartEditPackage = (pkg: PackagePlan) => {
    setEditingPkgId(pkg.id);
    setConfirmDeletePkgId(null);
    setPkgFormError('');
    setPkgNameInput(pkg.name);
    setPkgPriceInput(String(pkg.price));
    setPkgQuotaInput(String(pkg.edit_quota));
    setPkgDescInput(pkg.description);
  };

  const handleSavePackage = (pkgId: string) => {
    const cleanedName = pkgNameInput.trim();
    if (!cleanedName) {
      setPkgFormError('Nama paket tidak boleh kosong.');
      return;
    }
    const parsedPrice = Math.max(0, Number(pkgPriceInput) || 0);
    const parsedQuota = Math.max(0, Number(pkgQuotaInput) || 0);
    onUpdatePackage(pkgId, {
      name: cleanedName,
      price: parsedPrice,
      edit_quota: parsedQuota,
      description: pkgDescInput.trim()
    });
    setPkgFormError('');
    setEditingPkgId(null);
    setPkgSavedId(pkgId);
    setTimeout(() => setPkgSavedId(null), 2000);
  };

  const handleCreatePackageSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanedName = newPkgName.trim();
    if (!cleanedName) {
      setPkgFormError('Nama paket baru wajib diisi.');
      return;
    }
    const created = onAddPackage({
      region: newPkgRegion,
      year: selectedYear,
      name: cleanedName,
      price: Math.max(0, Number(newPkgPrice) || 0),
      edit_quota: Math.max(0, Number(newPkgQuota) || 0),
      description:
        newPkgDesc.trim() || `${Math.max(0, Number(newPkgQuota) || 0)} edited photos, graduation session`,
      is_active: true
    });
    setActiveRegion(newPkgRegion);
    setIsCreatingPkg(false);
    setNewPkgName('');
    setNewPkgPrice('350000');
    setNewPkgQuota('25');
    setNewPkgDesc('');
    setPkgFormError('');
    setPkgSavedId(created.id);
    setTimeout(() => setPkgSavedId(null), 2000);
  };

  const handleStartEditAddon = (add: AddOnItem) => {
    setEditingAddonId(add.id);
    setConfirmDeleteAddonId(null);
    setAddonFormError('');
    setAddonNameInput(add.name);
    setAddonPriceInput(String(add.price));
    setAddonQuotaInput(String(add.edit_quota_addition ?? 0));
    setAddonApprovalInput(Boolean(add.requires_approval));
    setAddonDescInput(add.description);
  };

  const handleSaveAddon = (addonId: string) => {
    const cleanedName = addonNameInput.trim();
    if (!cleanedName) {
      setAddonFormError('Nama add-on tidak boleh kosong.');
      return;
    }
    const parsedPrice = Math.max(0, Number(addonPriceInput) || 0);
    const parsedQuota = Math.max(0, Number(addonQuotaInput) || 0);
    onUpdateAddon(addonId, {
      name: cleanedName,
      price: parsedPrice,
      edit_quota_addition: parsedQuota > 0 ? parsedQuota : 0,
      requires_approval: addonApprovalInput,
      description: addonDescInput.trim()
    });
    setAddonFormError('');
    setEditingAddonId(null);
    setAddonSavedId(addonId);
    setTimeout(() => setAddonSavedId(null), 2000);
  };

  const handleCreateAddonSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanedName = newAddonName.trim();
    if (!cleanedName) {
      setAddonFormError('Nama add-on baru wajib diisi.');
      return;
    }
    const parsedQuota = Math.max(0, Number(newAddonQuota) || 0);
    const created = onAddAddon({
      name: cleanedName,
      price: Math.max(0, Number(newAddonPrice) || 0),
      edit_quota_addition: parsedQuota > 0 ? parsedQuota : 0,
      requires_approval: newAddonApproval,
      description: newAddonDesc.trim() || 'Layanan tambahan sesi foto wisuda Bestari.'
    });
    setIsCreatingAddon(false);
    setNewAddonName('');
    setNewAddonPrice('50000');
    setNewAddonQuota('0');
    setNewAddonApproval(false);
    setNewAddonDesc('');
    setAddonFormError('');
    setAddonSavedId(created.id);
    setTimeout(() => setAddonSavedId(null), 2000);
  };

  const handleAddFgSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFgError('');
    if (!newFgName.trim()) {
      setFgError('Nama fotografer tidak boleh kosong.');
      return;
    }
    const ok = onAddPhotographer(newFgName);
    if (!ok) {
      setFgError('Nama fotografer sudah terdaftar di daftar resmi.');
      return;
    }
    setNewFgName('');
  };

  const handleSaveFgEdit = (originalName: string) => {
    setFgError('');
    if (!editingFgValue.trim()) {
      setFgError('Nama fotografer tidak boleh kosong.');
      return;
    }
    const ok = onUpdatePhotographer(originalName, editingFgValue);
    if (!ok) {
      setFgError('Nama fotografer tersebut sudah digunakan.');
      return;
    }
    setEditingFgOriginal(null);
    setEditingFgValue('');
  };

  const handleSaveTemplates = () => {
    onUpdateMessageTemplates(templateDraft);
    setTemplateSavedToast(true);
    setTimeout(() => setTemplateSavedToast(false), 2500);
  };

  const handleSaveDriveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateDriveConfig(driveConfigDraft);
    setDriveSavedToast(true);
    setTimeout(() => setDriveSavedToast(false), 2500);
  };

  return (
    <div className="space-y-5 max-w-6xl mx-auto">
      {/* Compact Top Bar */}
      <div className="p-4 sm:p-5 bg-[#171A20] border border-[#292D35] rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Settings className="w-4 h-4 text-[#C5A572]" />
            <h2 className="text-base font-bold text-[#F2F1ED]">
              Pengaturan Sistem
            </h2>
          </div>
          <p className="text-xs text-[#9296A0]">
            Pilih subfolder konfigurasi di bawah untuk mengelola paket, tim, template, atau koneksi Drive.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <a
            href="/Panduan_Lengkap_Bestari_Graduation.pdf"
            download="Panduan_Lengkap_Bestari_Graduation.pdf"
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-[#D8C49D] bg-[#1D2027] hover:bg-[#252932] border border-[#C5A572]/40 rounded-xl whitespace-nowrap shrink-0"
          >
            <FileText className="w-3.5 h-3.5 text-[#C5A572]" />
            <span>Unduh Panduan (PDF)</span>
          </a>

          <button
            type="button"
            onClick={handleExportBackup}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-bold text-[#0B0C0F] bg-[#C5A572] hover:bg-[#D8C49D] rounded-xl shadow-md whitespace-nowrap shrink-0"
          >
            {downloadSuccess ? <Check className="w-3.5 h-3.5" /> : <Download className="w-3.5 h-3.5" />}
            <span>{downloadSuccess ? 'Backup Terunduh' : 'Export Backup'}</span>
          </button>
        </div>
      </div>

      {/* LEVEL 1: Ringkas Subfolder Directory */}
      {activeFolder === null ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {folders.map(folder => {
            const Icon = folder.icon;
            return (
              <button
                key={folder.id}
                type="button"
                onClick={() => setActiveFolder(folder.id)}
                className="group p-4 bg-[#171A20] hover:bg-[#1B1F27] border border-[#292D35] hover:border-[#C5A572]/50 rounded-2xl text-left flex items-center justify-between gap-3 transition-colors"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-[#111318] border border-[#292D35] group-hover:border-[#C5A572]/40 flex items-center justify-center shrink-0 relative">
                    <Folder className="w-4 h-4 text-[#C5A572]/80 group-hover:hidden" />
                    <Icon className="w-4 h-4 text-[#C5A572] hidden group-hover:block" />
                  </div>
                  <div className="min-w-0 space-y-0.5">
                    <h3 className="text-sm font-semibold text-[#F2F1ED] truncate">
                      {folder.title}
                    </h3>
                    <p className="text-xs text-[#9296A0] truncate tabular-nums">
                      {folder.meta}
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-[#666B76] group-hover:text-[#C5A572] shrink-0" />
              </button>
            );
          })}
        </div>
      ) : (
        /* LEVEL 2: Opened Subfolder View with Breadcrumb */
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-[#12151D] border border-[#252A36] rounded-xl">
            <div className="flex items-center gap-2.5 text-xs">
              <button
                type="button"
                onClick={() => setActiveFolder(null)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#181C26] hover:bg-[#222735] text-[#D8C49D] border border-[#292D35] font-semibold whitespace-nowrap shrink-0"
              >
                <ArrowLeft className="w-3.5 h-3.5 text-[#C5A572]" />
                <span>Semua Folder</span>
              </button>
              <span className="text-[#666B76]">/</span>
              <span className="font-bold text-[#F2F1ED] truncate">
                {activeFolderMeta?.title}
              </span>
            </div>

            <span className="text-xs text-[#9296A0] tabular-nums">
              {activeFolderMeta?.meta}
            </span>
          </div>

          {/* Subfolder 1: Package Management (Compact List Rows) */}
          {activeFolder === 'packages' && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-1 p-1 bg-[#12151D] border border-[#252A36] rounded-xl">
                  {(['malang', 'surabaya'] as Region[]).map(r => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => {
                        setActiveRegion(r);
                        setEditingPkgId(null);
                        setConfirmDeletePkgId(null);
                      }}
                      className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider whitespace-nowrap ${
                        activeRegion === r
                          ? 'bg-[#C5A572] text-[#0B0C0F]'
                          : 'text-[#9296A0] hover:text-[#F2F1ED]'
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setNewPkgRegion(activeRegion);
                    setPkgFormError('');
                    setIsCreatingPkg(!isCreatingPkg);
                  }}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold text-[#0B0C0F] bg-[#C5A572] hover:bg-[#D8C49D] flex items-center gap-1.5 whitespace-nowrap shrink-0"
                >
                  {isCreatingPkg ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                  <span>{isCreatingPkg ? 'Tutup Form' : 'Paket Baru'}</span>
                </button>
              </div>

              {pkgFormError && (
                <div className="p-3 bg-rose-950/60 border border-rose-800 text-rose-300 rounded-xl text-xs">
                  {pkgFormError}
                </div>
              )}

              {isCreatingPkg && (
                <form
                  onSubmit={handleCreatePackageSubmit}
                  className="p-4 bg-[#171A20] border border-[#C5A572]/50 rounded-2xl space-y-3 text-xs"
                >
                  <div className="flex items-center justify-between border-b border-[#292D35] pb-2">
                    <span className="font-bold text-sm text-[#C5A572]">
                      Tambah Paket Fotografi Baru
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setIsCreatingPkg(false);
                        setPkgFormError('');
                      }}
                      className="text-[#9296A0] hover:text-[#F2F1ED] p-1"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div className="space-y-1">
                      <label className="text-[#9296A0] font-semibold block">Nama Paket *</label>
                      <input
                        type="text"
                        placeholder="Contoh: Signature Gold"
                        value={newPkgName}
                        onChange={e => setNewPkgName(e.target.value)}
                        required
                        className="w-full px-3 py-2 bg-[#111318] border border-[#292D35] rounded-lg text-[#F2F1ED] focus:outline-none focus:border-[#C5A572]"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[#9296A0] font-semibold block">Wilayah</label>
                      <select
                        value={newPkgRegion}
                        onChange={e => setNewPkgRegion(e.target.value as Region)}
                        className="w-full px-3 py-2 bg-[#111318] border border-[#292D35] rounded-lg text-[#F2F1ED] focus:outline-none focus:border-[#C5A572]"
                      >
                        <option value="malang">Malang</option>
                        <option value="surabaya">Surabaya</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[#9296A0] font-semibold block">Harga (Rp)</label>
                      <input
                        type="number"
                        min={0}
                        step={5000}
                        value={newPkgPrice}
                        onChange={e => setNewPkgPrice(e.target.value)}
                        className="w-full px-3 py-2 bg-[#111318] border border-[#292D35] rounded-lg text-[#F2F1ED] font-mono focus:outline-none focus:border-[#C5A572]"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[#9296A0] font-semibold block">Kuota Edit</label>
                      <input
                        type="number"
                        min={0}
                        value={newPkgQuota}
                        onChange={e => setNewPkgQuota(e.target.value)}
                        className="w-full px-3 py-2 bg-[#111318] border border-[#292D35] rounded-lg text-[#F2F1ED] font-mono focus:outline-none focus:border-[#C5A572]"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[#9296A0] font-semibold block">Deskripsi</label>
                    <input
                      type="text"
                      placeholder="Contoh: 25 edited photos, raw preview JPG, 1.5 jam sesi"
                      value={newPkgDesc}
                      onChange={e => setNewPkgDesc(e.target.value)}
                      className="w-full px-3 py-2 bg-[#111318] border border-[#292D35] rounded-lg text-[#F2F1ED] focus:outline-none focus:border-[#C5A572]"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setIsCreatingPkg(false);
                        setPkgFormError('');
                      }}
                      className="px-3.5 py-2 rounded-xl text-[#9296A0] bg-[#111318] border border-[#292D35]"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 rounded-xl font-bold text-[#0B0C0F] bg-[#C5A572] hover:bg-[#D8C49D] flex items-center gap-1.5"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>Simpan Paket</span>
                    </button>
                  </div>
                </form>
              )}

              {regionPackages.length === 0 ? (
                <div className="p-8 bg-[#171A20] border border-[#292D35] rounded-xl text-center text-xs text-[#9296A0]">
                  Belum ada paket untuk wilayah {activeRegion.toUpperCase()}.
                </div>
              ) : (
                <div className="bg-[#171A20] border border-[#292D35] rounded-2xl divide-y divide-[#252A36] overflow-hidden">
                  {regionPackages.map(pkg => {
                    const isEditing = editingPkgId === pkg.id;
                    const isJustSaved = pkgSavedId === pkg.id;
                    const isConfirmingDelete = confirmDeletePkgId === pkg.id;

                    return (
                      <div key={pkg.id} className="p-4 text-xs">
                        {isEditing ? (
                          <div className="space-y-3">
                            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                              <input
                                type="text"
                                value={pkgNameInput}
                                onChange={e => setPkgNameInput(e.target.value)}
                                placeholder="Nama Paket"
                                className="px-3 py-2 bg-[#111318] border border-[#292D35] rounded-lg text-[#F2F1ED] font-semibold focus:outline-none focus:border-[#C5A572]"
                              />
                              <input
                                type="number"
                                min={0}
                                step={5000}
                                value={pkgPriceInput}
                                onChange={e => setPkgPriceInput(e.target.value)}
                                placeholder="Harga (Rp)"
                                className="px-3 py-2 bg-[#111318] border border-[#292D35] rounded-lg text-[#F2F1ED] font-mono focus:outline-none focus:border-[#C5A572]"
                              />
                              <input
                                type="number"
                                min={0}
                                value={pkgQuotaInput}
                                onChange={e => setPkgQuotaInput(e.target.value)}
                                placeholder="Kuota Edit"
                                className="px-3 py-2 bg-[#111318] border border-[#292D35] rounded-lg text-[#F2F1ED] font-mono focus:outline-none focus:border-[#C5A572]"
                              />
                              <input
                                type="text"
                                value={pkgDescInput}
                                onChange={e => setPkgDescInput(e.target.value)}
                                placeholder="Deskripsi singkat"
                                className="px-3 py-2 bg-[#111318] border border-[#292D35] rounded-lg text-[#F2F1ED] focus:outline-none focus:border-[#C5A572]"
                              />
                            </div>
                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => setEditingPkgId(null)}
                                className="px-3 py-1.5 rounded-lg text-[#9296A0] bg-[#111318] border border-[#292D35]"
                              >
                                Batal
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSavePackage(pkg.id)}
                                className="px-3 py-1.5 rounded-lg font-bold text-[#0B0C0F] bg-[#C5A572] hover:bg-[#D8C49D] flex items-center gap-1"
                              >
                                <Save className="w-3.5 h-3.5" />
                                <span>Simpan</span>
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="min-w-0 space-y-0.5">
                              <div className="flex items-center gap-2.5 flex-wrap">
                                <span className="font-bold text-sm text-[#F2F1ED]">
                                  {pkg.name}
                                </span>
                                <span className="text-[#666B76]">·</span>
                                <span className="text-[#C5A572] font-mono tabular-nums">
                                  {pkg.edit_quota} Foto Edit
                                </span>
                                {isJustSaved && (
                                  <>
                                    <span className="text-[#666B76]">·</span>
                                    <span className="text-emerald-400 font-semibold flex items-center gap-1">
                                      <Check className="w-3 h-3" />
                                      Tersimpan
                                    </span>
                                  </>
                                )}
                              </div>
                              <p className="text-[#9296A0] truncate max-w-2xl">
                                {pkg.description}
                              </p>
                            </div>

                            <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                              <span className="font-bold text-sm text-[#F2F1ED] font-tabular">
                                {formatRupiah(pkg.price)}
                              </span>

                              {isConfirmingDelete ? (
                                <div className="flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      onDeletePackage(pkg.id);
                                      setConfirmDeletePkgId(null);
                                    }}
                                    className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold"
                                  >
                                    Hapus
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setConfirmDeletePkgId(null)}
                                    className="px-2.5 py-1 rounded-lg bg-[#111318] text-[#9296A0] border border-[#292D35]"
                                  >
                                    Batal
                                  </button>
                                </div>
                              ) : (
                                <div className="flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => handleStartEditPackage(pkg)}
                                    className="px-2.5 py-1.5 rounded-lg bg-[#1D2027] hover:bg-[#252932] text-[#D8C49D] border border-[#292D35] font-semibold flex items-center gap-1 whitespace-nowrap"
                                  >
                                    <Edit3 className="w-3 h-3 text-[#C5A572]" />
                                    <span>Ubah</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setConfirmDeletePkgId(pkg.id)}
                                    className="p-1.5 rounded-lg bg-[#111318] hover:bg-rose-950/60 text-[#9296A0] hover:text-rose-400 border border-[#292D35]"
                                    title="Hapus paket"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Subfolder 2: Add-on Management (Compact List Rows) */}
          {activeFolder === 'addons' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs text-[#9296A0]">
                  {addons.length} layanan tambahan terdaftar
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setAddonFormError('');
                    setIsCreatingAddon(!isCreatingAddon);
                  }}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold text-[#0B0C0F] bg-[#C5A572] hover:bg-[#D8C49D] flex items-center gap-1.5 whitespace-nowrap"
                >
                  {isCreatingAddon ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                  <span>{isCreatingAddon ? 'Tutup Form' : 'Add-on Baru'}</span>
                </button>
              </div>

              {addonFormError && (
                <div className="p-3 bg-rose-950/60 border border-rose-800 text-rose-300 rounded-xl text-xs">
                  {addonFormError}
                </div>
              )}

              {isCreatingAddon && (
                <form
                  onSubmit={handleCreateAddonSubmit}
                  className="p-4 bg-[#171A20] border border-[#C5A572]/50 rounded-2xl space-y-3 text-xs"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <label className="text-[#9296A0] font-semibold block">Nama Add-on *</label>
                      <input
                        type="text"
                        placeholder="Contoh: Extra Edit 10 Foto"
                        value={newAddonName}
                        onChange={e => setNewAddonName(e.target.value)}
                        required
                        className="w-full px-3 py-2 bg-[#111318] border border-[#292D35] rounded-lg text-[#F2F1ED] focus:outline-none focus:border-[#C5A572]"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[#9296A0] font-semibold block">Harga (Rp)</label>
                      <input
                        type="number"
                        min={0}
                        step={5000}
                        value={newAddonPrice}
                        onChange={e => setNewAddonPrice(e.target.value)}
                        className="w-full px-3 py-2 bg-[#111318] border border-[#292D35] rounded-lg text-[#F2F1ED] font-mono focus:outline-none focus:border-[#C5A572]"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[#9296A0] font-semibold block">Tambahan Edit</label>
                      <input
                        type="number"
                        min={0}
                        value={newAddonQuota}
                        onChange={e => setNewAddonQuota(e.target.value)}
                        className="w-full px-3 py-2 bg-[#111318] border border-[#292D35] rounded-lg text-[#F2F1ED] font-mono focus:outline-none focus:border-[#C5A572]"
                      />
                    </div>
                  </div>
                  <input
                    type="text"
                    placeholder="Deskripsi layanan tambahan..."
                    value={newAddonDesc}
                    onChange={e => setNewAddonDesc(e.target.value)}
                    className="w-full px-3 py-2 bg-[#111318] border border-[#292D35] rounded-lg text-[#F2F1ED] focus:outline-none focus:border-[#C5A572]"
                  />
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <label className="flex items-center gap-2 text-[#D8C49D] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newAddonApproval}
                        onChange={e => setNewAddonApproval(e.target.checked)}
                        className="rounded bg-[#111318] border-[#292D35] text-[#C5A572]"
                      />
                      <span>Wajib konfirmasi FG/Editor sebelum aktif</span>
                    </label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setIsCreatingAddon(false);
                          setAddonFormError('');
                        }}
                        className="px-3 py-1.5 rounded-lg text-[#9296A0] bg-[#111318] border border-[#292D35]"
                      >
                        Batal
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-1.5 rounded-lg font-bold text-[#0B0C0F] bg-[#C5A572] hover:bg-[#D8C49D] flex items-center gap-1"
                      >
                        <Save className="w-3.5 h-3.5" />
                        <span>Simpan Add-on</span>
                      </button>
                    </div>
                  </div>
                </form>
              )}

              <div className="bg-[#171A20] border border-[#292D35] rounded-2xl divide-y divide-[#252A36] overflow-hidden">
                {addons.map(add => {
                  const isEditing = editingAddonId === add.id;
                  const isJustSaved = addonSavedId === add.id;
                  const isConfirmingDelete = confirmDeleteAddonId === add.id;

                  return (
                    <div key={add.id} className="p-4 text-xs">
                      {isEditing ? (
                        <div className="space-y-3">
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                            <input
                              type="text"
                              value={addonNameInput}
                              onChange={e => setAddonNameInput(e.target.value)}
                              className="px-3 py-2 bg-[#111318] border border-[#292D35] rounded-lg text-[#F2F1ED] font-semibold focus:outline-none focus:border-[#C5A572]"
                            />
                            <input
                              type="number"
                              min={0}
                              step={5000}
                              value={addonPriceInput}
                              onChange={e => setAddonPriceInput(e.target.value)}
                              className="px-3 py-2 bg-[#111318] border border-[#292D35] rounded-lg text-[#F2F1ED] font-mono focus:outline-none focus:border-[#C5A572]"
                            />
                            <input
                              type="number"
                              min={0}
                              value={addonQuotaInput}
                              onChange={e => setAddonQuotaInput(e.target.value)}
                              className="px-3 py-2 bg-[#111318] border border-[#292D35] rounded-lg text-[#F2F1ED] font-mono focus:outline-none focus:border-[#C5A572]"
                            />
                          </div>
                          <input
                            type="text"
                            value={addonDescInput}
                            onChange={e => setAddonDescInput(e.target.value)}
                            className="w-full px-3 py-2 bg-[#111318] border border-[#292D35] rounded-lg text-[#F2F1ED] focus:outline-none focus:border-[#C5A572]"
                          />
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <label className="flex items-center gap-2 text-[#D8C49D] cursor-pointer">
                              <input
                                type="checkbox"
                                checked={addonApprovalInput}
                                onChange={e => setAddonApprovalInput(e.target.checked)}
                                className="rounded bg-[#111318] border-[#292D35] text-[#C5A572]"
                              />
                              <span>Wajib konfirmasi FG/Editor</span>
                            </label>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => setEditingAddonId(null)}
                                className="px-3 py-1.5 rounded-lg text-[#9296A0] bg-[#111318] border border-[#292D35]"
                              >
                                Batal
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSaveAddon(add.id)}
                                className="px-3 py-1.5 rounded-lg font-bold text-[#0B0C0F] bg-[#C5A572] hover:bg-[#D8C49D] flex items-center gap-1"
                              >
                                <Save className="w-3.5 h-3.5" />
                                <span>Simpan</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="min-w-0 space-y-0.5">
                            <div className="flex items-center gap-2.5 flex-wrap">
                              <span className="font-bold text-sm text-[#F2F1ED]">{add.name}</span>
                              {(add.edit_quota_addition ?? 0) > 0 && (
                                <>
                                  <span className="text-[#666B76]">·</span>
                                  <span className="text-[#C5A572] font-mono tabular-nums">
                                    +{add.edit_quota_addition} Foto Edit
                                  </span>
                                </>
                              )}
                              <span className="text-[#666B76]">·</span>
                              <span className="text-[#9296A0]">
                                {add.requires_approval ? 'Wajib approval' : 'Otomatis aktif'}
                              </span>
                              {isJustSaved && (
                                <>
                                  <span className="text-[#666B76]">·</span>
                                  <span className="text-emerald-400 font-semibold">Tersimpan</span>
                                </>
                              )}
                            </div>
                            <p className="text-[#9296A0] truncate max-w-2xl">{add.description}</p>
                          </div>

                          <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                            <span className="font-bold text-sm text-emerald-400 font-tabular">
                              {formatRupiah(add.price)}
                            </span>

                            {isConfirmingDelete ? (
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => {
                                    onDeleteAddon(add.id);
                                    setConfirmDeleteAddonId(null);
                                  }}
                                  className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold"
                                >
                                  Hapus
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteAddonId(null)}
                                  className="px-2.5 py-1 rounded-lg bg-[#111318] text-[#9296A0] border border-[#292D35]"
                                >
                                  Batal
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleStartEditAddon(add)}
                                  className="px-2.5 py-1.5 rounded-lg bg-[#1D2027] hover:bg-[#252932] text-[#D8C49D] border border-[#292D35] font-semibold flex items-center gap-1 whitespace-nowrap"
                                >
                                  <Edit3 className="w-3 h-3 text-[#C5A572]" />
                                  <span>Ubah</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteAddonId(add.id)}
                                  className="p-1.5 rounded-lg bg-[#111318] hover:bg-rose-950/60 text-[#9296A0] hover:text-rose-400 border border-[#292D35]"
                                  title="Hapus add-on"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Subfolder 3: Tim Fotografer */}
          {activeFolder === 'photographers' && (
            <div className="p-5 bg-[#171A20] border border-[#292D35] rounded-2xl space-y-4 text-xs">
              {fgError && (
                <div className="p-3 bg-rose-950/60 border border-rose-800 text-rose-300 rounded-xl">
                  {fgError}
                </div>
              )}

              <form onSubmit={handleAddFgSubmit} className="flex flex-col sm:flex-row gap-2.5">
                <input
                  type="text"
                  value={newFgName}
                  onChange={e => setNewFgName(e.target.value)}
                  placeholder="Ketik nama fotografer baru..."
                  className="flex-1 px-3.5 py-2 bg-[#111318] border border-[#292D35] rounded-xl text-[#F2F1ED] placeholder-[#666B76] focus:outline-none focus:border-[#C5A572]"
                />
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl font-bold text-[#0B0C0F] bg-[#C5A572] hover:bg-[#D8C49D] flex items-center justify-center gap-1.5 shrink-0 whitespace-nowrap"
                >
                  <Plus className="w-4 h-4" />
                  <span>Tambah FG</span>
                </button>
              </form>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {photographers.map((fg, idx) => {
                  const isEditing = editingFgOriginal === fg;
                  return (
                    <div
                      key={fg}
                      className="px-3.5 py-2.5 bg-[#1D2027] border border-[#292D35] rounded-xl flex items-center justify-between gap-3"
                    >
                      {isEditing ? (
                        <div className="flex-1 flex items-center gap-2">
                          <input
                            type="text"
                            value={editingFgValue}
                            onChange={e => setEditingFgValue(e.target.value)}
                            className="flex-1 px-2.5 py-1.5 bg-[#111318] border border-[#C5A572] rounded-lg text-[#F2F1ED] focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => handleSaveFgEdit(fg)}
                            className="px-2.5 py-1.5 rounded-lg bg-[#C5A572] text-[#0B0C0F] font-bold"
                          >
                            Simpan
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingFgOriginal(null);
                              setEditingFgValue('');
                            }}
                            className="px-2.5 py-1.5 rounded-lg bg-[#111318] text-[#9296A0] border border-[#292D35]"
                          >
                            Batal
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className="text-[#C5A572] font-mono tabular-nums shrink-0">
                              {String(idx + 1).padStart(2, '0')}.
                            </span>
                            <span className="font-semibold text-[#F2F1ED] truncate">{fg}</span>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingFgOriginal(fg);
                                setEditingFgValue(fg);
                                setFgError('');
                              }}
                              className="p-1.5 rounded-lg bg-[#111318] hover:bg-[#252932] text-[#D8C49D] border border-[#292D35]"
                              title="Edit nama fotografer"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onDeletePhotographer(fg)}
                              className="p-1.5 rounded-lg bg-[#111318] hover:bg-rose-950/60 text-[#9296A0] hover:text-rose-400 border border-[#292D35]"
                              title="Hapus FG"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Subfolder 4: Operational Rules */}
          {activeFolder === 'rules' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
              <div className="p-4 bg-[#171A20] border border-[#292D35] rounded-xl space-y-1">
                <span className="font-bold text-[#C5A572] block">
                  1. Booking Request Expiry (3 Hari)
                </span>
                <p className="text-[#9296A0] leading-relaxed">
                  Masa berlaku 3 hari sejak formulir dikirim. Otomatis kedaluwarsa jika DP Rp100.000 belum diverifikasi.
                </p>
              </div>
              <div className="p-4 bg-[#171A20] border border-[#292D35] rounded-xl space-y-1">
                <span className="font-bold text-[#C5A572] block">
                  2. Deadline Seleksi Klien (Maksimal H+5)
                </span>
                <p className="text-[#9296A0] leading-relaxed">
                  Klien memilih foto edit sesuai kuota paket maksimal H+5 setelah foto mentah tersedia.
                </p>
              </div>
              <div className="p-4 bg-[#171A20] border border-[#292D35] rounded-xl space-y-1">
                <span className="font-bold text-[#C5A572] block">
                  3. Deadline Editing Foto (Maksimal H+10)
                </span>
                <p className="text-[#9296A0] leading-relaxed">
                  Dihitung sejak pilihan foto dikirim klien. Portal menampilkan hitung mundur dinamis.
                </p>
              </div>
              <div className="p-4 bg-[#171A20] border border-[#292D35] rounded-xl space-y-1">
                <span className="font-bold text-[#C5A572] block">
                  4. Final Access Expiration (7 Hari Kalender)
                </span>
                <p className="text-[#9296A0] leading-relaxed">
                  Akses download aktif 7 hari kalender sebelum ditutup otomatis dan berpindah ke 07 Completed.
                </p>
              </div>
            </div>
          )}

          {/* Subfolder: Nomor WhatsApp Admin */}
          {activeFolder === 'whatsapp' && (
            <div className="p-5 bg-[#171A20] border border-[#292D35] rounded-2xl space-y-4 text-xs">
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-[#F2F1ED]">Nomor WhatsApp Admin</h3>
                <p className="text-[#9296A0] leading-relaxed">
                  Satu nomor ini dipakai semua tombol "Hubungi Admin": form booking, FAQ, Client Portal,
                  dan pesan konfirmasi. Ganti di sini, tidak perlu mengubah kode.
                </p>
              </div>
              {!messageTemplates.admin_whatsapp && (
                <div className="px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>
                    Nomor belum diatur. Saat ini tombol WhatsApp memakai nomor contoh{' '}
                    {formatWhatsappDisplay(DEFAULT_ADMIN_WHATSAPP)}. Isi nomor aslimu lalu simpan.
                  </span>
                </div>
              )}
              <div className="space-y-1.5">
                <label htmlFor="admin-wa-input" className="text-[#9296A0] font-semibold block">
                  Nomor WhatsApp (format 08xx atau +62xx)
                </label>
                <input
                  id="admin-wa-input"
                  type="tel"
                  inputMode="tel"
                  value={waDraft}
                  onChange={e => setWaDraft(e.target.value)}
                  placeholder="0812-3456-7890"
                  className={`w-full sm:max-w-sm px-3 py-2.5 rounded-xl bg-[#0F1117] border text-[#F2F1ED] font-mono text-sm focus:outline-none focus:border-[#C5A572] ${
                    waDraft && !waIsValid ? 'border-red-500/60' : 'border-[#292D35]'
                  }`}
                />
                {waDraft && !waIsValid && (
                  <p className="text-red-400">
                    Nomor tidak valid. Gunakan nomor seluler Indonesia, misalnya 081234567890.
                  </p>
                )}
                {waIsValid && (
                  <p className="text-[#9296A0]">
                    Akan tampil sebagai <span className="text-[#D8C49D] font-mono">{formatWhatsappDisplay(waDraft)}</span>
                    {' '}dan membuka wa.me/62{normalizeWhatsapp(waDraft).slice(1)}
                  </p>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleSaveWa}
                  disabled={!waIsValid || (waIsSaved && !waSavedToast)}
                  className="px-4 py-2 rounded-xl bg-[#C5A572] hover:bg-[#D8C49D] disabled:opacity-40 disabled:cursor-not-allowed text-[#0B0C0F] font-bold flex items-center gap-1.5"
                >
                  {waSavedToast ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
                  <span>{waSavedToast ? 'Tersimpan!' : 'Simpan nomor'}</span>
                </button>
                <a
                  href={waIsValid ? buildWhatsAppLink(waDraft, 'Tes nomor admin Bestari Graduation.') : undefined}
                  target="_blank"
                  rel="noreferrer"
                  aria-disabled={!waIsValid}
                  className={`px-4 py-2 rounded-xl border border-[#292D35] font-medium flex items-center gap-1.5 ${
                    waIsValid
                      ? 'bg-[#1D2027] hover:bg-[#252932] text-[#F2F1ED]'
                      : 'opacity-40 pointer-events-none text-[#9296A0]'
                  }`}
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Tes buka WhatsApp</span>
                </a>
              </div>
            </div>
          )}

          {/* Subfolder 5: Message Templates (Focused 1-at-a-time Editor) */}
          {activeFolder === 'templates' && (
            <div className="p-5 bg-[#171A20] border border-[#292D35] rounded-2xl space-y-4 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#292D35]">
                <div className="flex flex-wrap items-center gap-1 p-1 bg-[#111318] border border-[#252A36] rounded-xl">
                  {[
                    { id: 'dp_followup', label: '1. Follow Up DP' },
                    { id: 'booking_confirmed_copy', label: '2. Konfirmasi Portal' },
                    { id: 'pelunasan_fg_reminder', label: '3. Pelunasan & FG' }
                  ].map(item => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setActiveTemplateKey(item.id as any)}
                      className={`px-3 py-1.5 rounded-lg font-semibold whitespace-nowrap ${
                        activeTemplateKey === item.id
                          ? 'bg-[#C5A572] text-[#0B0C0F]'
                          : 'text-[#9296A0] hover:text-[#F2F1ED]'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={onResetMessageTemplates}
                    className="px-3 py-2 rounded-xl bg-[#1D2027] hover:bg-[#252932] text-[#9296A0] hover:text-[#F2F1ED] border border-[#292D35] font-medium flex items-center gap-1.5"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reset Default</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveTemplates}
                    className="px-4 py-2 rounded-xl bg-[#C5A572] hover:bg-[#D8C49D] text-[#0B0C0F] font-bold flex items-center gap-1.5"
                  >
                    {templateSavedToast ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
                    <span>{templateSavedToast ? 'Tersimpan!' : 'Simpan'}</span>
                  </button>
                </div>
              </div>

              {activeTemplateKey === 'dp_followup' && (
                <div className="space-y-2">
                  <div className="text-[11px] font-mono text-[#9296A0]">
                    Variabel: {'{client_name}'}, {'{package_name}'}, {'{campus}'}, {'{total_price}'}
                  </div>
                  <textarea
                    rows={8}
                    value={templateDraft.dp_followup}
                    onChange={e => setTemplateDraft({ ...templateDraft, dp_followup: e.target.value })}
                    className="w-full p-3.5 bg-[#111318] border border-[#292D35] rounded-xl font-mono text-[11px] text-[#F2F1ED] leading-relaxed focus:outline-none focus:border-[#C5A572]"
                  />
                </div>
              )}

              {activeTemplateKey === 'booking_confirmed_copy' && (
                <div className="space-y-2">
                  <div className="text-[11px] font-mono text-[#9296A0]">
                    Variabel: {'{client_name}'}, {'{portal_url}'}, {'{client_id}'}, {'{pin}'}, {'{order_id}'}
                  </div>
                  <textarea
                    rows={12}
                    value={templateDraft.booking_confirmed_copy}
                    onChange={e =>
                      setTemplateDraft({ ...templateDraft, booking_confirmed_copy: e.target.value })
                    }
                    className="w-full p-3.5 bg-[#111318] border border-[#292D35] rounded-xl font-mono text-[11px] text-[#F2F1ED] leading-relaxed focus:outline-none focus:border-[#C5A572]"
                  />
                </div>
              )}

              {activeTemplateKey === 'pelunasan_fg_reminder' && (
                <div className="space-y-2">
                  <div className="text-[11px] font-mono text-[#9296A0]">
                    Variabel: {'{client_name}'}, {'{photo_date}'}, {'{session_time}'}, {'{photo_location}'},{' '}
                    {'{photographer}'}, {'{remaining_balance}'}, {'{order_id}'}, {'{campus}'}
                  </div>
                  <textarea
                    rows={7}
                    value={templateDraft.pelunasan_fg_reminder}
                    onChange={e =>
                      setTemplateDraft({ ...templateDraft, pelunasan_fg_reminder: e.target.value })
                    }
                    className="w-full p-3.5 bg-[#111318] border border-[#292D35] rounded-xl font-mono text-[11px] text-[#F2F1ED] leading-relaxed focus:outline-none focus:border-[#C5A572]"
                  />
                </div>
              )}
            </div>
          )}

          {/* Subfolder 6: Backup, Panduan & Reset */}
          {activeFolder === 'backup' && (
            <div className="bg-[#171A20] border border-[#292D35] rounded-2xl divide-y divide-[#252A36] text-xs">
              <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h4 className="font-bold text-sm text-[#F2F1ED]">Buku Panduan Sistem (PDF)</h4>
                  <p className="text-[#9296A0] mt-0.5">
                    Dokumentasi alur kerja Admin &amp; Portal Klien lengkap dalam format PDF.
                  </p>
                </div>
                <a
                  href="/Panduan_Lengkap_Bestari_Graduation.pdf"
                  download="Panduan_Lengkap_Bestari_Graduation.pdf"
                  className="px-4 py-2 font-bold text-[#D8C49D] bg-[#1D2027] hover:bg-[#252932] border border-[#C5A572]/40 rounded-xl flex items-center gap-2 whitespace-nowrap shrink-0"
                >
                  <FileText className="w-4 h-4 text-[#C5A572]" />
                  <span>Unduh PDF</span>
                </a>
              </div>

              <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h4 className="font-bold text-sm text-[#F2F1ED]">Arsip Backup JSON</h4>
                  <p className="text-[#9296A0] mt-0.5">
                    Unduh seluruh data klien, transaksi, paket, template, dan audit log.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleExportBackup}
                  className="px-4 py-2 font-bold text-[#0B0C0F] bg-[#C5A572] hover:bg-[#D8C49D] rounded-xl flex items-center gap-2 whitespace-nowrap shrink-0"
                >
                  <Download className="w-4 h-4" />
                  <span>Download JSON</span>
                </button>
              </div>

              {onImportBackup && (
                <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <h4 className="font-bold text-sm text-[#F2F1ED]">Restore Backup JSON</h4>
                    <p className="text-[#9296A0]">
                      Pulihkan checkpoint data Phase 1 atau arsip JSON sebelumnya ke database server Phase 2.
                    </p>
                    {importStatus && (
                      <p
                        className={`font-semibold ${
                          importStatus.ok ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {importStatus.message}
                      </p>
                    )}
                  </div>
                  <label className="btn-interactive cursor-pointer px-4 py-2 font-bold text-[#D8C49D] bg-[#1D2027] hover:bg-[#252932] border border-[#C5A572]/40 rounded-xl flex items-center gap-2 whitespace-nowrap shrink-0">
                    <Upload className="w-4 h-4 text-[#C5A572]" />
                    <span>Import JSON</span>
                    <input
                      type="file"
                      accept="application/json,.json"
                      onChange={handleImportFileChange}
                      className="hidden"
                    />
                  </label>
                </div>
              )}

              <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h4 className="font-bold text-sm text-[#F2F1ED]">Reset Data Contoh</h4>
                  <p className="text-[#9296A0] mt-0.5">
                    Kembalikan database ke data simulasi awal pabrik.
                  </p>
                </div>
                {confirmReset ? (
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        onResetToDefaults();
                        setConfirmReset(false);
                      }}
                      className="px-3.5 py-2 font-bold text-white bg-rose-600 hover:bg-rose-500 rounded-xl"
                    >
                      Ya, Reset Sekarang
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmReset(false)}
                      className="px-3.5 py-2 font-medium text-[#9296A0] hover:text-[#F2F1ED] bg-[#1D2027] border border-[#292D35] rounded-xl"
                    >
                      Batal
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmReset(true)}
                    className="px-4 py-2 font-medium text-[#9296A0] hover:text-rose-400 bg-[#1D2027] hover:bg-rose-950/30 border border-[#292D35] rounded-xl flex items-center gap-2 whitespace-nowrap shrink-0"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>Reset Data Contoh</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Subfolder 7: Google Drive & Folder */}
          {activeFolder === 'drive' && (
            <div className="p-5 bg-[#171A20] border border-[#292D35] rounded-2xl space-y-4 text-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#292D35]">
                <div>
                  <h3 className="text-sm font-bold text-[#F2F1ED]">
                    Koneksi Akun &amp; Folder Induk Google Drive
                  </h3>
                  <p className="text-[#9296A0] mt-0.5">
                    Folder klien dan isi Announcement dibuat otomatis saat booking dikonfirmasi.
                  </p>
                </div>
                <GoogleDriveButton
                  isConnected={isDriveConnected}
                  userEmail={driveUserEmail}
                  isConnecting={isConnectingDrive}
                  onSignIn={onDriveSignIn}
                  onSignOut={onDriveSignOut}
                />
              </div>

              {driveAuthError && (
                <div className="p-3 bg-rose-950/50 border border-rose-700/60 rounded-xl flex items-start gap-2 text-rose-200">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <span>{driveAuthError}</span>
                </div>
              )}

              <form onSubmit={handleSaveDriveConfig} className="space-y-3.5">
                <div className="space-y-1">
                  <label className="text-[#D8C49D] font-bold block">
                    Link Main Drive Root
                  </label>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="url"
                      required
                      value={driveConfigDraft.main_drive_url}
                      onChange={e =>
                        setDriveConfigDraft({ ...driveConfigDraft, main_drive_url: e.target.value })
                      }
                      className="flex-1 px-3 py-2 bg-[#111318] border border-[#292D35] rounded-xl text-[#F2F1ED] font-mono focus:outline-none focus:border-[#C5A572]"
                    />
                    <a
                      href={driveConfigDraft.main_drive_url}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3.5 py-2 rounded-xl bg-[#1D2027] hover:bg-[#252932] border border-[#292D35] text-[#C5A572] font-semibold flex items-center justify-center gap-1.5 shrink-0"
                    >
                      <span>Buka</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[#D8C49D] font-bold block">
                    Link Folder Template Announcement
                  </label>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="url"
                      required
                      value={driveConfigDraft.announcement_template_url}
                      onChange={e =>
                        setDriveConfigDraft({
                          ...driveConfigDraft,
                          announcement_template_url: e.target.value
                        })
                      }
                      className="flex-1 px-3 py-2 bg-[#111318] border border-[#292D35] rounded-xl text-[#F2F1ED] font-mono focus:outline-none focus:border-[#C5A572]"
                    />
                    <a
                      href={driveConfigDraft.announcement_template_url}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3.5 py-2 rounded-xl bg-[#1D2027] hover:bg-[#252932] border border-[#292D35] text-[#C5A572] font-semibold flex items-center justify-center gap-1.5 shrink-0"
                    >
                      <span>Buka</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowDriveBlueprint(prev => !prev)}
                    className="px-3 py-2 rounded-xl bg-[#111318] hover:bg-[#1D2027] text-[#9296A0] hover:text-[#F2F1ED] border border-[#292D35] flex items-center gap-1.5"
                  >
                    <ChevronDown
                      className={`w-3.5 h-3.5 transition-transform ${
                        showDriveBlueprint ? 'rotate-180' : ''
                      }`}
                    />
                    <span>Blueprint Struktur Folder</span>
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={onResetDriveConfig}
                      className="px-3 py-2 rounded-xl bg-[#1D2027] hover:bg-[#252932] text-[#9296A0] hover:text-[#F2F1ED] border border-[#292D35] font-medium flex items-center gap-1.5"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Reset Default</span>
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 rounded-xl bg-[#C5A572] hover:bg-[#D8C49D] text-[#0B0C0F] font-bold flex items-center gap-1.5"
                    >
                      {driveSavedToast ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
                      <span>{driveSavedToast ? 'Tersimpan!' : 'Simpan'}</span>
                    </button>
                  </div>
                </div>
              </form>

              {showDriveBlueprint && (
                <div className="p-3.5 bg-[#111318] border border-[#292D35] rounded-xl font-mono text-[11px] text-[#D8C49D] space-y-1">
                  <div>Main Drive Root</div>
                  <div className="pl-4">└─ 2027 / 2. Februari / 08 Februari / Nama Graduation // Kampus</div>
                  <div className="pl-8 text-[#F2F1ED]">├─ JPG</div>
                  <div className="pl-8 text-[#F2F1ED]">├─ Edited Files</div>
                  <div className="pl-8 text-emerald-300">└─ Announcement (Auto-mirror template)</div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
