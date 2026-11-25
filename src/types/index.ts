export type BookingStatus =
  | 'confirmed'
  | 'photo_session'
  | 'file_uploaded'
  | 'selection_pending'
  | 'selection_submitted'
  | 'editing'
  | 'final_access'
  | 'completed'
  | 'cancelled';

export type PaymentStatus = 'DP' | 'LUNAS';

export type Region = 'malang' | 'surabaya';

export interface ClientBooking {
  id: string;
  order_id: string; // e.g. INV001-120127
  client_id_display: string; // e.g. 001 (3-digit ID)
  booking_year: number;
  booking_sequence: number;
  status: BookingStatus;
  booking_date: string;
  photo_date: string;
  session_time: string;
  region_id: Region;
  package_id: string;
  package_name: string;
  package_price: number;
  total_price: number;
  selected_addons?: string[];
  client_name: string;
  campus: string;
  photo_location: string;
  photographer: string;
  phone: string;
  instagram?: string;
  payment_status: PaymentStatus;
  paid_amount: number;
  file_uploaded: boolean;
  selection_submitted: boolean;
  editing_finished: boolean;
  notes?: string;
  drive_folder_url?: string;
  drive_folder_id?: string;
  drive_jpg_folder_url?: string;
  drive_edited_folder_url?: string;
  drive_announcement_folder_url?: string;
  drive_folder_path?: string;
  drive_announcement_mirrored_count?: number;
  editing_deadline?: string;
  selection_deadline?: string;
  final_access_expires_at?: string;
  edit_quota: number;
  selected_photos_count?: number;
  selected_photo_ids?: string[];
  selection_submitted_at?: string;
  portal_pin_hash?: string;
  portal_pin_display?: string; // DDMM for client & admin view
  unique_token: string;
  feedback_rating?: number;
  feedback_comment?: string;
  feedback_skipped?: boolean;
  invoice_number?: string;
  invoice_issued_at?: string;
  invoice_drive_status?: 'uploaded' | 'pending_drive' | 'error';
  invoice_drive_file_id?: string;
  invoice_drive_file_url?: string;
  invoice_drive_error?: string;
  created_at: string;
  updated_at: string;
}

export interface BookingRequest {
  id: string;
  client_name: string;
  phone: string;
  instagram?: string;
  campus: string;
  region: Region;
  package_id: string;
  package_name: string;
  package_price: number;
  total_price: number;
  selected_addons?: string[];
  photo_date?: string;
  session_time?: string;
  photo_location?: string;
  notes?: string;
  status: 'new' | 'pending_dp' | 'confirmed' | 'expired' | 'extended';
  created_at: string;
  expires_at: string;
  dp_verified: boolean;
  warning_duplicate?: boolean;
  /** Diisi bila satu klien memesan lebih dari satu sesi dalam satu pengiriman formulir. */
  group_id?: string;
  session_no?: number;
  session_total?: number;
}

export interface Transaction {
  id: string;
  date: string;
  client_id: string;
  client_name: string;
  order_id: string;
  type: 'DP' | 'Pelunasan' | 'Add-on';
  amount: number;
  payment_method: string;
  status: 'verified' | 'pending' | 'rejected';
  admin_notes?: string;
  created_at: string;
}

export interface AddOnItem {
  id: string;
  name: string;
  price: number;
  edit_quota_addition?: number;
  requires_approval: boolean;
  description: string;
}

export type AuditEventType =
  | 'state_transition'
  | 'data_update'
  | 'payment'
  | 'booking'
  | 'portal_action';

export interface AdminOperator {
  id: string;
  name: string;
  role: string;
}

export interface ActivityLogItem {
  id: string;
  timestamp: string;
  action: string;
  actor: string;
  admin_user_id: string;
  event_type?: AuditEventType;
  from_status?: string;
  to_status?: string;
  details: string;
  order_id?: string;
  client_id?: string;
  client_name?: string;
  changed_fields?: string[];
}

export interface PackagePlan {
  id: string;
  region: Region;
  year: number;
  name: string;
  price: number;
  edit_quota: number;
  description: string;
  is_active: boolean;
}

export interface SystemNotification {
  id: string;
  type: 'booking_request' | 'pending_dp' | 'upcoming_session' | 'jpg_pending' | 'selection_pending' | 'selection_submitted' | 'editing_deadline' | 'overdue' | 'final_access' | 'payment_pending' | 'feedback_submitted';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  order_id?: string;
  client_id?: string;
}

export interface MessageTemplates {
  dp_followup: string;
  booking_confirmed_copy: string;
  pelunasan_fg_reminder: string;
  /** Nomor WhatsApp admin (08xx...). Dipakai semua tombol "Hubungi Admin". */
  admin_whatsapp?: string;
}

export interface DriveConfigSettings {
  main_drive_url: string;
  announcement_template_url: string;
}


