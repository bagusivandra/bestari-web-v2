import React, { useState } from 'react';
import {
  CreditCard,
  DollarSign,
  TrendingUp,
  AlertCircle,
  Plus,
  Filter,
  CheckCircle2,
  Clock,
  Send,
  FileText,
  Download
} from 'lucide-react';
import { Transaction, ClientBooking } from '../../types';
import { formatRupiah, formatDateIndo, buildWhatsAppLink } from '../../utils/formatters';
import { CountUp } from '../common/CountUp';

interface FinanceViewProps {
  transactions: Transaction[];
  clients: ClientBooking[];
  selectedYear: number;
  onOpenNewTransactionModal: () => void;
}

export const FinanceView: React.FC<FinanceViewProps> = ({
  transactions,
  clients,
  selectedYear,
  onOpenNewTransactionModal
}) => {
  const [filterType, setFilterType] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<'transactions' | 'outstanding'>('transactions');

  // Filter clients by selected year
  const yearClients = clients.filter(c => c.booking_year === selectedYear);

  // Metrics
  const bookingRevenue = yearClients.reduce(
    (sum, c) => sum + (c.total_price || c.package_price),
    0
  );

  // Cash Received: ONLY verified transactions
  const verifiedTransactions = transactions.filter(t => t.status === 'verified');
  const cashReceived = verifiedTransactions.reduce((sum, t) => sum + t.amount, 0);

  // Outstanding
  const outstandingAmount = Math.max(0, bookingRevenue - cashReceived);

  // Filtered transactions
  const filteredTransactions = transactions.filter(t => {
    if (filterType === 'all') return true;
    return t.type === filterType;
  });

  // Outstanding clients list
  const outstandingClients = yearClients.filter(
    c => c.payment_status === 'DP' && c.paid_amount < (c.total_price || c.package_price)
  );

  const handleExportCsv = () => {
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    let csvContent = '';
    let filename = '';

    if (activeTab === 'transactions') {
      const headers = [
        'Tanggal',
        'ID Pesanan',
        'Nama Klien',
        'Tipe',
        'Metode Pembayaran',
        'Nominal (IDR)',
        'Status',
        'Catatan'
      ];
      const rows = filteredTransactions.map(tx => [
        tx.date,
        tx.order_id,
        tx.client_name,
        tx.type,
        tx.payment_method,
        tx.amount,
        tx.status,
        tx.admin_notes || ''
      ]);
      csvContent = [headers, ...rows].map(row => row.map(esc).join(',')).join('\n');
      filename = `bestari-transaksi-${selectedYear}.csv`;
    } else {
      const headers = [
        'ID Pesanan',
        'Nama Klien',
        'Kampus',
        'Paket',
        'Total Harga (IDR)',
        'Sudah Dibayar (IDR)',
        'Sisa Tagihan (IDR)',
        'Status Pembayaran',
        'WhatsApp'
      ];
      const rows = outstandingClients.map(c => {
        const total = c.total_price || c.package_price;
        return [
          c.order_id,
          c.client_name,
          c.campus,
          c.package_name,
          total,
          c.paid_amount,
          Math.max(0, total - c.paid_amount),
          c.payment_status,
          c.phone
        ];
      });
      csvContent = [headers, ...rows].map(row => row.map(esc).join(',')).join('\n');
      filename = `bestari-piutang-${selectedYear}.csv`;
    }

    const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* 1. Header & Quick Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 bg-[#171A20] border border-[#292D35] rounded-2xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-[#C5A572]" />
            <h2 className="text-base font-bold text-[#F2F1ED]">
              Keuangan &amp; Arus Kas Masuk ({selectedYear})
            </h2>
          </div>
          <p className="text-xs text-[#9296A0]">
            Sistem pencatatan pemasukan bisnis fotografi Bestari. Hanya pembayaran yang telah diverifikasi yang dihitung sebagai Cash Received.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-semibold text-[#D8C49D] bg-[#111318] hover:bg-[#1D2027] border border-[#292D35] rounded-xl transition-all shrink-0"
          >
            <Download className="w-4 h-4 text-[#C5A572]" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={onOpenNewTransactionModal}
            className="flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-[#0B0C0F] bg-gradient-to-r from-[#C5A572] to-[#D8C49D] hover:from-[#D8C49D] hover:to-[#C5A572] rounded-xl transition-all shadow-md active:scale-95 shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Catat Transaksi Baru</span>
          </button>
        </div>
      </div>

      {/* 2. Three Primary Financial Metric Cards (Section 15) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Metric 1: Booking Revenue */}
        <div className="p-5 bg-[#171A20] border border-[#292D35] rounded-2xl space-y-2">
          <div className="flex items-center justify-between text-xs text-[#9296A0] uppercase font-semibold">
            <span>Booking Revenue</span>
            <TrendingUp className="w-4 h-4 text-[#C5A572]" />
          </div>
          <div className="text-2xl lg:text-3xl font-extrabold text-[#F2F1ED] font-tabular">
            <CountUp value={bookingRevenue} format="rupiah" />
          </div>
          <p className="text-xs text-[#666B76]">
            Total nilai paket dari {yearClients.length} booking resmi
          </p>
        </div>

        {/* Metric 2: Cash Received */}
        <div className="p-5 bg-[#171A20] border border-emerald-900/40 rounded-2xl space-y-2">
          <div className="flex items-center justify-between text-xs text-emerald-400 uppercase font-semibold">
            <span>Cash Received</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl lg:text-3xl font-extrabold text-emerald-400 font-tabular">
            <CountUp value={cashReceived} format="rupiah" />
          </div>
          <p className="text-xs text-[#666B76]">
            Dana masuk terverifikasi m-Banking / Rekening
          </p>
        </div>

        {/* Metric 3: Outstanding */}
        <div className="p-5 bg-[#171A20] border border-amber-900/40 rounded-2xl space-y-2">
          <div className="flex items-center justify-between text-xs text-amber-400 uppercase font-semibold">
            <span>Outstanding (Piutang)</span>
            <AlertCircle className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl lg:text-3xl font-extrabold text-amber-300 font-tabular">
            <CountUp value={outstandingAmount} format="rupiah" />
          </div>
          <p className="text-xs text-[#666B76]">
            {outstandingClients.length} klien dalam proses pelunasan
          </p>
        </div>
      </div>

      {/* 3. Sub-navigation tabs: Transactions vs Outstanding */}
      <div className="flex items-center gap-2 border-b border-[#292D35] pb-2">
        <button
          onClick={() => setActiveTab('transactions')}
          className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors ${
            activeTab === 'transactions'
              ? 'text-[#0B0C0F] bg-[#C5A572]'
              : 'text-[#9296A0] hover:text-[#F2F1ED] hover:bg-[#171A20]'
          }`}
        >
          Semua Transaksi ({transactions.length})
        </button>

        <button
          onClick={() => setActiveTab('outstanding')}
          className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors ${
            activeTab === 'outstanding'
              ? 'text-[#0B0C0F] bg-[#C5A572]'
              : 'text-[#9296A0] hover:text-[#F2F1ED] hover:bg-[#171A20]'
          }`}
        >
          Tagihan Outstanding ({outstandingClients.length})
        </button>
      </div>

      {/* Tab 1: Transactions List */}
      {activeTab === 'transactions' && (
        <div className="bg-[#171A20] border border-[#292D35] rounded-xl overflow-hidden space-y-4 p-4">
          {/* Filter row */}
          <div className="flex items-center justify-between gap-3 text-xs">
            <span className="text-[#9296A0] font-medium">Filter Tipe Transaksi:</span>
            <div className="flex items-center gap-1.5">
              {['all', 'DP', 'Pelunasan', 'Add-on'].map(t => (
                <button
                  key={t}
                  onClick={() => setFilterType(t)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                    filterType === t
                      ? 'bg-[#C5A572] text-[#0B0C0F] font-bold'
                      : 'bg-[#1D2027] text-[#9296A0] hover:text-[#F2F1ED]'
                  }`}
                >
                  {t === 'all' ? 'Semua' : t}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#101216] border-b border-[#292D35] text-[#666B76] uppercase tracking-wider">
                  <th className="py-3 px-4 font-mono">Tanggal</th>
                  <th className="py-3 px-4">Klien &amp; Order ID</th>
                  <th className="py-3 px-4">Tipe Transaksi</th>
                  <th className="py-3 px-4">Metode Bayar</th>
                  <th className="py-3 px-4 font-tabular text-right">Jumlah</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4">Catatan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#292D35]/50">
                {filteredTransactions.map(tx => (
                  <tr key={tx.id} className="hover:bg-[#1D2027]/60 transition-colors">
                    <td className="py-3 px-4 font-mono text-[#F2F1ED]">
                      {formatDateIndo(tx.date)}
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-semibold text-[#F2F1ED] block">{tx.client_name}</span>
                      <span className="text-[10px] font-mono text-[#C5A572]">{tx.order_id}</span>
                    </td>
                    <td className="py-3 px-4 font-medium text-[#F2F1ED]">{tx.type}</td>
                    <td className="py-3 px-4 text-[#9296A0]">{tx.payment_method}</td>
                    <td className="py-3 px-4 font-tabular font-bold text-emerald-400 text-right">
                      {formatRupiah(tx.amount)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-950/70 text-emerald-300 border border-emerald-700/50 rounded">
                        VERIFIED
                      </span>
                    </td>
                    <td className="py-3 px-4 text-[#666B76] text-[11px] truncate max-w-xs">
                      {tx.admin_notes || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Outstanding Payments */}
      {activeTab === 'outstanding' && (
        <div className="bg-[#171A20] border border-[#292D35] rounded-xl p-4 space-y-3">
          <p className="text-xs text-[#9296A0]">
            Sesuai aturan operasional: Hasil foto utama terkunci di Client Portal sampai paket dilunasi (kecuali diberikan pengecualian khusus oleh Admin).
          </p>

          <div className="space-y-3">
            {outstandingClients.map(c => {
              const targetTotal = c.total_price || c.package_price;
              const remaining = Math.max(0, targetTotal - c.paid_amount);
              const waText = `Halo Kak ${c.client_name}, mengingatkan kembali terkait sesi foto wisuda di ${c.campus} (${c.order_id}). Sisa tagihan paket Anda sebesar ${formatRupiah(remaining)}. Pembayaran dapat ditransfer ke rekening SeaBank 901507540052 a/n Ivandra Bagus Pranata. Terima kasih!`;
              const waLink = buildWhatsAppLink(c.phone, waText);

              return (
                <div
                  key={c.id}
                  className="p-4 bg-[#1D2027] border border-[#292D35] rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-[#C5A572]">{c.order_id}</span>
                      <span className="font-bold text-sm text-[#F2F1ED]">{c.client_name}</span>
                      <span className="text-xs text-[#666B76]">· {c.campus}</span>
                    </div>
                    <div className="mt-1 flex items-center gap-4 text-xs text-[#9296A0]">
                      <span>Paket: {c.package_name} ({formatRupiah(targetTotal)})</span>
                      <span>Sudah DP: {formatRupiah(c.paid_amount)}</span>
                      <span className="font-bold text-amber-300">
                        Sisa: {formatRupiah(remaining)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <a
                      href={waLink}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3.5 py-1.5 text-xs font-semibold text-emerald-300 bg-emerald-950/60 hover:bg-emerald-950 border border-emerald-800/60 rounded-lg transition-colors flex items-center gap-1.5"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Reminder WA</span>
                    </a>

                    <button
                      onClick={onOpenNewTransactionModal}
                      className="px-3.5 py-1.5 text-xs font-semibold text-[#0B0C0F] bg-[#C5A572] hover:bg-[#D8C49D] rounded-lg transition-colors"
                    >
                      Catat Pelunasan
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
