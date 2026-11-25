import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  User
} from 'firebase/auth';
import { auth } from '../lib/firebase';
import type { ClientBooking } from '../types';

export const DRIVE_SCOPES = ['https://www.googleapis.com/auth/drive'];

export const DEFAULT_MAIN_DRIVE_URL =
  'https://drive.google.com/drive/folders/17x17CBaPrr-BSAgvBDPsjhb7mVJniacj';
export const DEFAULT_ANNOUNCEMENT_TEMPLATE_URL =
  'https://drive.google.com/drive/folders/1hc1B8BZ3_xavHI48ENnOe8Rf-mPvykjq';

const INDO_MONTHS = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember'
];

const provider = new GoogleAuthProvider();
DRIVE_SCOPES.forEach(scope => provider.addScope(scope));

let isSigningIn = false;
// In-memory only per security guidelines (never store access tokens in localStorage/sessionStorage)
let cachedAccessToken: string | null = null;

export const initDriveAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, (user: User | null) => {
    if (user && cachedAccessToken) {
      onAuthSuccess?.(user, cachedAccessToken);
    } else if (!isSigningIn) {
      if (!user) {
        cachedAccessToken = null;
      }
      onAuthFailure?.();
    }
  });
};

export const googleDriveSignIn = async (): Promise<{
  user: User;
  accessToken: string;
} | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Gagal mendapatkan token akses Google Drive.');
    }
    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } finally {
    isSigningIn = false;
  }
};

export const googleDriveSignOut = async () => {
  await auth.signOut();
  cachedAccessToken = null;
};

export const getDriveAccessToken = (): string | null => {
  return cachedAccessToken;
};

export const extractDriveFolderId = (folderUrl?: string): string | null => {
  if (!folderUrl) return null;
  const trimmed = folderUrl.trim();
  if (!trimmed) return null;

  const foldersMatch = trimmed.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (foldersMatch?.[1]) {
    return foldersMatch[1];
  }

  const idParamMatch = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (idParamMatch?.[1]) {
    return idParamMatch[1];
  }

  if (/^[a-zA-Z0-9_-]{18,}$/.test(trimmed)) {
    return trimmed;
  }

  return null;
};

export const isPlaceholderDriveFolder = (folderUrl?: string): boolean => {
  const folderId = extractDriveFolderId(folderUrl);
  if (!folderId) return true;
  return (
    folderId.startsWith('sample-') ||
    folderId.startsWith('bestari-2027-') ||
    folderId.startsWith('folder_')
  );
};

export interface ClientDrivePathParts {
  yearFolder: string;
  monthFolder: string;
  dateFolder: string;
  dateAlternates: string[];
  clientFolder: string;
  clientAlternates: string[];
  fullPath: string;
}

export function buildClientDrivePathParts(
  client: Pick<ClientBooking, 'client_name' | 'campus' | 'photo_date' | 'booking_date' | 'booking_year'>
): ClientDrivePathParts {
  const rawDate = (client.photo_date || client.booking_date || '').trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(rawDate);

  let yearNum = client.booking_year || new Date().getFullYear();
  let monthNum = 1;
  let dayNum = 1;
  let hasExactDate = false;

  if (match) {
    yearNum = Number(match[1]);
    monthNum = Math.min(12, Math.max(1, Number(match[2])));
    dayNum = Math.min(31, Math.max(1, Number(match[3])));
    hasExactDate = true;
  }

  const monthName = INDO_MONTHS[monthNum - 1] || 'Januari';
  const yearFolder = String(yearNum);
  const monthFolder = `${monthNum}. ${monthName}`;
  const dayPadded = String(dayNum).padStart(2, '0');
  const dateFolder = hasExactDate ? `${dayPadded} ${monthName}` : 'Belum Terjadwal';
  const dateAlternates = hasExactDate
    ? [`${dayNum} ${monthName}`, `${dayPadded} ${monthName} ${yearFolder}`, dayPadded, String(dayNum)]
    : [];

  const rawName = (client.client_name || 'Klien').trim();
  const nameWithGraduation = /graduation/i.test(rawName) ? rawName : `${rawName} Graduation`;
  const cleanCampus = (client.campus || 'Kampus').trim();

  const clientFolder = `${nameWithGraduation} // ${cleanCampus}`;
  const clientAlternates = [`${rawName} // ${cleanCampus}`];

  return {
    yearFolder,
    monthFolder,
    dateFolder,
    dateAlternates,
    clientFolder,
    clientAlternates,
    fullPath: `${yearFolder} / ${monthFolder} / ${dateFolder} / ${clientFolder}`
  };
}

interface DriveFileEntry {
  id: string;
  name: string;
  mimeType: string;
  webViewLink?: string;
}

async function listChildFolders(
  parentId: string,
  accessToken: string
): Promise<DriveFileEntry[]> {
  const query = encodeURIComponent(
    `'${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`
  );
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,mimeType,webViewLink)&pageSize=200&supportsAllDrives=true&includeItemsFromAllDrives=true`,
    {
      headers: { Authorization: `Bearer ${accessToken}` }
    }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.error?.message || `Gagal membaca folder Drive (HTTP ${res.status}).`);
  }
  const data = (await res.json()) as { files?: DriveFileEntry[] };
  return data.files || [];
}

async function listChildItems(
  parentId: string,
  accessToken: string
): Promise<DriveFileEntry[]> {
  const query = encodeURIComponent(`'${parentId}' in parents and trashed=false`);
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,mimeType,webViewLink)&pageSize=200&supportsAllDrives=true&includeItemsFromAllDrives=true`,
    {
      headers: { Authorization: `Bearer ${accessToken}` }
    }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.error?.message || `Gagal membaca isi folder Drive (HTTP ${res.status}).`);
  }
  const data = (await res.json()) as { files?: DriveFileEntry[] };
  return data.files || [];
}

async function createDriveFolder(
  parentId: string,
  folderName: string,
  accessToken: string
): Promise<DriveFileEntry> {
  const res = await fetch(
    'https://www.googleapis.com/drive/v3/files?fields=id,name,mimeType,webViewLink&supportsAllDrives=true',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [parentId]
      })
    }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.error?.message || `Gagal membuat folder "${folderName}" (HTTP ${res.status}).`);
  }
  return (await res.json()) as DriveFileEntry;
}

async function findOrCreateFolder(
  parentId: string,
  targetName: string,
  accessToken: string,
  alternateNames: string[] = []
): Promise<{ folder: DriveFileEntry; created: boolean }> {
  const existing = await listChildFolders(parentId, accessToken);
  const candidates = [targetName, ...alternateNames].map(n => n.trim().toLowerCase());

  for (const candidate of candidates) {
    const match = existing.find(f => f.name.trim().toLowerCase() === candidate);
    if (match) {
      return { folder: match, created: false };
    }
  }

  const folder = await createDriveFolder(parentId, targetName, accessToken);
  return { folder, created: true };
}

async function copyFileToFolder(
  sourceFileId: string,
  fileName: string,
  targetFolderId: string,
  accessToken: string
): Promise<void> {
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${sourceFileId}/copy?supportsAllDrives=true`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: fileName,
        parents: [targetFolderId]
      })
    }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(
      err?.error?.message || `Gagal menyalin file "${fileName}" ke folder Announcement.`
    );
  }
}

async function mirrorFolderContents(
  sourceFolderId: string,
  targetFolderId: string,
  accessToken: string
): Promise<number> {
  const sourceItems = await listChildItems(sourceFolderId, accessToken);
  if (sourceItems.length === 0) return 0;

  const existingTargets = await listChildItems(targetFolderId, accessToken);
  const existingNames = new Set(existingTargets.map(item => item.name.trim().toLowerCase()));

  let copiedCount = 0;
  for (const item of sourceItems) {
    if (item.mimeType === 'application/vnd.google-apps.folder') {
      const { folder: nestedTarget } = await findOrCreateFolder(
        targetFolderId,
        item.name,
        accessToken
      );
      copiedCount += await mirrorFolderContents(item.id, nestedTarget.id, accessToken);
    } else if (!existingNames.has(item.name.trim().toLowerCase())) {
      await copyFileToFolder(item.id, item.name, targetFolderId, accessToken);
      copiedCount += 1;
    }
  }
  return copiedCount;
}

export interface ProvisionClientDriveResult {
  ok: boolean;
  reason?: 'no_token' | 'invalid_config' | 'api_error';
  clientFolderId?: string;
  clientFolderUrl?: string;
  jpgFolderUrl?: string;
  editedFolderUrl?: string;
  announcementFolderUrl?: string;
  fullPath?: string;
  mirroredCount?: number;
  errorMessage?: string;
}

export async function createStructuredClientDriveFolders({
  client,
  mainDriveUrl = DEFAULT_MAIN_DRIVE_URL,
  announcementTemplateUrl = DEFAULT_ANNOUNCEMENT_TEMPLATE_URL
}: {
  client: ClientBooking;
  mainDriveUrl?: string;
  announcementTemplateUrl?: string;
}): Promise<ProvisionClientDriveResult> {
  const accessToken = getDriveAccessToken();
  if (!accessToken) {
    return {
      ok: false,
      reason: 'no_token',
      errorMessage: 'Akun Google Drive belum terhubung. Silakan Sign in with Google terlebih dahulu.'
    };
  }

  const mainRootId = extractDriveFolderId(mainDriveUrl);
  if (!mainRootId) {
    return {
      ok: false,
      reason: 'invalid_config',
      errorMessage: 'URL Main Drive Root tidak valid.'
    };
  }

  const announcementSourceId = extractDriveFolderId(announcementTemplateUrl);
  const parts = buildClientDrivePathParts(client);

  try {
    // 1. Tahun (2026 / 2027)
    const { folder: yearFolder } = await findOrCreateFolder(
      mainRootId,
      parts.yearFolder,
      accessToken
    );

    // 2. Bulan (misal: 2. Februari)
    const { folder: monthFolder } = await findOrCreateFolder(
      yearFolder.id,
      parts.monthFolder,
      accessToken
    );

    // 3. Tanggal (misal: 08 Februari)
    const { folder: dateFolder } = await findOrCreateFolder(
      monthFolder.id,
      parts.dateFolder,
      accessToken,
      parts.dateAlternates
    );

    // 4. Nama Klien // Kampus (misal: Amara Graduation // Universitas Brawijaya)
    const { folder: clientFolder } = await findOrCreateFolder(
      dateFolder.id,
      parts.clientFolder,
      accessToken,
      parts.clientAlternates
    );

    // 5. Tiga Subfolder: JPG, Edited Files, Announcement
    const { folder: jpgFolder } = await findOrCreateFolder(clientFolder.id, 'JPG', accessToken);
    const { folder: editedFolder } = await findOrCreateFolder(
      clientFolder.id,
      'Edited Files',
      accessToken
    );
    const { folder: announcementFolder } = await findOrCreateFolder(
      clientFolder.id,
      'Announcement',
      accessToken
    );

    // 6. Mirror isi folder Announcement template
    let mirroredCount = 0;
    if (announcementSourceId) {
      mirroredCount = await mirrorFolderContents(
        announcementSourceId,
        announcementFolder.id,
        accessToken
      );
    }

    const toFolderUrl = (id: string, webViewLink?: string) =>
      webViewLink || `https://drive.google.com/drive/folders/${id}`;

    return {
      ok: true,
      clientFolderId: clientFolder.id,
      clientFolderUrl: toFolderUrl(clientFolder.id, clientFolder.webViewLink),
      jpgFolderUrl: toFolderUrl(jpgFolder.id, jpgFolder.webViewLink),
      editedFolderUrl: toFolderUrl(editedFolder.id, editedFolder.webViewLink),
      announcementFolderUrl: toFolderUrl(announcementFolder.id, announcementFolder.webViewLink),
      fullPath: parts.fullPath,
      mirroredCount
    };
  } catch (err) {
    return {
      ok: false,
      reason: 'api_error',
      fullPath: parts.fullPath,
      errorMessage:
        err instanceof Error
          ? err.message
          : 'Terjadi kesalahan saat membuat struktur folder Google Drive.'
    };
  }
}

export interface DriveUploadResult {
  ok: boolean;
  fileId?: string;
  webViewLink?: string;
  errorMessage?: string;
  reason?: 'no_token' | 'invalid_folder' | 'api_error';
}

export const uploadInvoicePdfToDriveFolder = async ({
  folderUrl,
  fileName,
  pdfBlob
}: {
  folderUrl?: string;
  fileName: string;
  pdfBlob: Blob;
}): Promise<DriveUploadResult> => {
  const accessToken = getDriveAccessToken();
  if (!accessToken) {
    return {
      ok: false,
      reason: 'no_token',
      errorMessage: 'Akun Google Drive belum terhubung. Silakan Sign in with Google terlebih dahulu.'
    };
  }

  const folderId = extractDriveFolderId(folderUrl);
  if (!folderId || isPlaceholderDriveFolder(folderUrl)) {
    return {
      ok: false,
      reason: 'invalid_folder',
      errorMessage:
        'Link folder Google Drive klien masih berupa placeholder/belum dibuat di Google Drive.'
    };
  }

  try {
    const metadata = {
      name: fileName,
      mimeType: 'application/pdf',
      parents: [folderId]
    };

    const boundary = `bestari_invoice_${Date.now()}`;
    const metadataPart =
      `--${boundary}\r\n` +
      `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
      `${JSON.stringify(metadata)}\r\n` +
      `--${boundary}\r\n` +
      `Content-Type: application/pdf\r\n\r\n`;
    const closingBoundary = `\r\n--${boundary}--`;

    const multipartBody = new Blob([metadataPart, pdfBlob, closingBoundary], {
      type: `multipart/related; boundary=${boundary}`
    });

    const response = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink&supportsAllDrives=true',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`
        },
        body: multipartBody
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      const message =
        errorData?.error?.message || `Gagal mengunggah invoice ke Drive (HTTP ${response.status}).`;
      return {
        ok: false,
        reason: 'api_error',
        errorMessage: message
      };
    }

    const uploaded = (await response.json()) as {
      id: string;
      name: string;
      webViewLink?: string;
    };

    return {
      ok: true,
      fileId: uploaded.id,
      webViewLink:
        uploaded.webViewLink || `https://drive.google.com/file/d/${uploaded.id}/view`
    };
  } catch (err) {
    return {
      ok: false,
      reason: 'api_error',
      errorMessage:
        err instanceof Error ? err.message : 'Terjadi kesalahan jaringan saat mengunggah ke Drive.'
    };
  }
};

export interface DriveGalleryPhoto {
  id: string;
  name: string;
  code: string;
  mimeType: string;
  webViewLink?: string;
  thumbnailLink?: string;
}

export const listDriveFolderImages = async (
  folderUrl?: string
): Promise<{
  ok: boolean;
  reason?: 'no_token' | 'invalid_folder' | 'api_error';
  photos: DriveGalleryPhoto[];
  errorMessage?: string;
}> => {
  const accessToken = getDriveAccessToken();
  if (!accessToken) {
    return { ok: false, reason: 'no_token', photos: [] };
  }

  const folderId = extractDriveFolderId(folderUrl);
  if (!folderId || isPlaceholderDriveFolder(folderUrl)) {
    return { ok: false, reason: 'invalid_folder', photos: [] };
  }

  try {
    const query = encodeURIComponent(
      `'${folderId}' in parents and mimeType contains 'image/' and trashed=false`
    );
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${query}&orderBy=name&fields=files(id,name,mimeType,webViewLink,thumbnailLink)&pageSize=200&supportsAllDrives=true&includeItemsFromAllDrives=true`,
      {
        headers: { Authorization: `Bearer ${accessToken}` }
      }
    );

    if (!res.ok) {
      const err = await res.json().catch(() => null);
      return {
        ok: false,
        reason: 'api_error',
        photos: [],
        errorMessage: err?.error?.message || `Gagal memuat foto Drive (HTTP ${res.status}).`
      };
    }

    const data = (await res.json()) as { files?: DriveGalleryPhoto[] };
    const photos = (data.files || []).map(f => ({
      ...f,
      code: f.name.replace(/\.[^.]+$/, '')
    }));

    return { ok: true, photos };
  } catch (err) {
    return {
      ok: false,
      reason: 'api_error',
      photos: [],
      errorMessage:
        err instanceof Error ? err.message : 'Terjadi kesalahan jaringan saat membaca galeri Drive.'
    };
  }
};

export const fetchDriveImageBlobUrl = async (fileId: string): Promise<string | null> => {
  const accessToken = getDriveAccessToken();
  if (!accessToken || !fileId) return null;
  try {
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&supportsAllDrives=true`,
      {
        headers: { Authorization: `Bearer ${accessToken}` }
      }
    );
    if (!res.ok) return null;
    const blob = await res.blob();
    return URL.createObjectURL(blob);
  } catch {
    return null;
  }
};

