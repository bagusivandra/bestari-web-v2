import { createClient } from '@supabase/supabase-js';

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  isConfigured: boolean;
}

const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL || '';
const supabaseAnonKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || '';

export const supabaseConfig: SupabaseConfig = {
  url: supabaseUrl,
  anonKey: supabaseAnonKey,
  isConfigured: Boolean(supabaseUrl && supabaseAnonKey)
};

export const supabase = supabaseConfig.isConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

export const DB_PHASE_INFO = {
  phase: 'Phase 1 - Project Foundation & Interactive Operational Engine',
  isLiveDatabaseConnected: supabaseConfig.isConfigured,
  environmentNotice: supabaseConfig.isConfigured
    ? 'Terkoneksi ke Supabase PostgreSQL instance'
    : 'Mode Preview Foundation (Storage Lokal Aktif & Siap Sambung Supabase Migration)'
};