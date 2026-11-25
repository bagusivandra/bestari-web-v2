import { BookingStatus, PaymentStatus } from '../types';

export function formatRupiah(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount).replace(/\s+/g, ' ');
}

function parseCalendarDate(dateStr?: string): Date | null {
  if (!dateStr) return null;
  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr.trim());
  if (dateOnlyMatch) {
    const year = Number(dateOnlyMatch[1]);
    const month = Number(dateOnlyMatch[2]);
    const day = Number(dateOnlyMatch[3]);
    const d = new Date(year, month - 1, day);
    return isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : d;
}

export function formatDateIndo(dateStr?: string): string {
  if (!dateStr) return '-';
  try {
    const d = parseCalendarDate(dateStr);
    if (!d) return dateStr;
    return new Intl.DateTimeFormat('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    }).format(d);
  } catch {
    return dateStr;
  }
}

export function formatDateIndoLong(dateStr?: string): string {
  if (!dateStr) return '-';
  try {
    const d = parseCalendarDate(dateStr);
    if (!d) return dateStr;
    return new Intl.DateTimeFormat('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    }).format(d);
  } catch {
    return dateStr;
  }
}

export function formatDayDateIndoLong(dateStr?: string): string {
  if (!dateStr) return '-';
  try {
    const d = parseCalendarDate(dateStr);
    if (!d) return dateStr;
    const dayName = new Intl.DateTimeFormat('id-ID', { weekday: 'long' }).format(d);
    const fullDate = new Intl.DateTimeFormat('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    }).format(d);
    return `${dayName}, ${fullDate}`;
  } catch {
    return dateStr;
  }
}

export function generateBookingId(sequence: number, bookingDate: string): string {
  // Format: INV###-ddmmyy (e.g. INV001-120127)
  const padSeq = String(sequence).padStart(3, '0');
  const d = new Date(bookingDate);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const yearTwoDigits = String(d.getFullYear()).slice(-2);
  return `INV${padSeq}-${day}${month}${yearTwoDigits}`;
}

export function generatePinFromDate(bookingDate: string): string {
  // Format: DDMM based on booking date
  const d = new Date(bookingDate);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${day}${month}`;
}

export function getStatusDetails(status: BookingStatus): {
  label: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
} {
  switch (status) {
    case 'confirmed':
      return {
        label: '01 Booking Confirmed',
        badgeBg: 'bg-sky-950/60',
        badgeText: 'text-sky-300',
        badgeBorder: 'border-sky-700/60'
      };
    case 'photo_session':
      return {
        label: '02 Photo Session',
        badgeBg: 'bg-blue-950/60',
        badgeText: 'text-blue-400',
        badgeBorder: 'border-blue-800/60'
      };
    case 'file_uploaded':
      return {
        label: '03 Photo Gallery',
        badgeBg: 'bg-indigo-950/60',
        badgeText: 'text-indigo-400',
        badgeBorder: 'border-indigo-800/60'
      };
    case 'selection_pending':
      return {
        label: '04 Photo Selection',
        badgeBg: 'bg-amber-950/60',
        badgeText: 'text-amber-400',
        badgeBorder: 'border-amber-800/60'
      };
    case 'selection_submitted':
      return {
        label: '04 Photo Selection',
        badgeBg: 'bg-purple-950/60',
        badgeText: 'text-purple-400',
        badgeBorder: 'border-purple-800/60'
      };
    case 'editing':
      return {
        label: '05 Editing',
        badgeBg: 'bg-amber-950/70',
        badgeText: 'text-amber-300',
        badgeBorder: 'border-amber-700/60'
      };
    case 'final_access':
      return {
        label: '06 Final Access',
        badgeBg: 'bg-yellow-950/60',
        badgeText: 'text-[#D8C49D]',
        badgeBorder: 'border-[#C5A572]/60'
      };
    case 'completed':
      return {
        label: '07 Completed',
        badgeBg: 'bg-emerald-950/60',
        badgeText: 'text-emerald-300',
        badgeBorder: 'border-emerald-700/60'
      };
    case 'cancelled':
      return {
        label: 'Dibatalkan',
        badgeBg: 'bg-rose-950/60',
        badgeText: 'text-rose-400',
        badgeBorder: 'border-rose-800/60'
      };
    default:
      return {
        label: status,
        badgeBg: 'bg-slate-900',
        badgeText: 'text-slate-400',
        badgeBorder: 'border-slate-800'
      };
  }
}

export function getAuditStatusLabel(status?: string): string {
  switch (status) {
    case 'booking_request':
      return 'Booking Request';
    case 'confirmed':
      return 'Booking Confirmed';
    case 'photo_session':
      return 'Photo Session';
    case 'file_uploaded':
      return 'Photo Gallery';
    case 'selection_pending':
      return 'Photo Selection';
    case 'selection_submitted':
      return 'Selection Submitted';
    case 'editing':
      return 'Editing Process';
    case 'final_access':
      return 'Final Access';
    case 'completed':
      return 'Completed';
    case 'cancelled':
      return 'Cancelled';
    default:
      return status || '-';
  }
}

export function getPaymentBadge(status: PaymentStatus): {
  label: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
} {
  if (status === 'LUNAS') {
    return {
      label: 'LUNAS',
      badgeBg: 'bg-emerald-950/70',
      badgeText: 'text-emerald-300',
      badgeBorder: 'border-emerald-700/50'
    };
  }
  return {
    label: 'DP (Pending)',
    badgeBg: 'bg-amber-950/60',
    badgeText: 'text-amber-300',
    badgeBorder: 'border-amber-800/50'
  };
}

export function buildWhatsAppLink(phone: string, text: string): string {
  // Normalize phone number e.g. 08123... -> 628123...
  let cleanPhone = phone.replace(/[^0-9]/g, '');
  if (cleanPhone.startsWith('0')) {
    cleanPhone = '62' + cleanPhone.slice(1);
  } else if (!cleanPhone.startsWith('62')) {
    cleanPhone = '62' + cleanPhone;
  }
  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`;
}

export function renderMessageTemplate(
  template: string,
  variables: Record<string, string>
): string {
  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (match, key) => {
    return key in variables ? variables[key] : match;
  });
}

export function formatDayMonthIndo(dateStr?: string): string {
  if (!dateStr) return '-';
  try {
    const d = parseCalendarDate(dateStr);
    if (!d) return dateStr;
    return new Intl.DateTimeFormat('id-ID', {
      day: 'numeric',
      month: 'short'
    }).format(d);
  } catch {
    return dateStr;
  }
}

export function extractLastThreeDigits(code: string): string {
  const digits = code.replace(/\D/g, '');
  if (!digits) return code.trim();
  return digits.length >= 3 ? digits.slice(-3) : digits.padStart(3, '0');
}

export function sortPhotoCodesAscending(codes: string[]): string[] {
  return [...codes].sort((a, b) => {
    const numA = parseInt(extractLastThreeDigits(a), 10);
    const numB = parseInt(extractLastThreeDigits(b), 10);
    if (!isNaN(numA) && !isNaN(numB) && numA !== numB) {
      return numA - numB;
    }
    return a.localeCompare(b);
  });
}
