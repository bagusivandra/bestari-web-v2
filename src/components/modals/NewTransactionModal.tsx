import React, { useState } from 'react';
import { X, DollarSign, Calendar, User, CheckCircle2 } from 'lucide-react';
import { ClientBooking, Transaction } from '../../types';
import { formatRupiah } from '../../utils/formatters';

interface NewTransactionModalProps {
  clients: ClientBooking[];
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (transaction: Omit<Transaction, 'id' | 'created_at'>) => void;
}

export const NewTransactionModal: React.FC<NewTransactionModalProps> = ({
  clients,
  isOpen,
  onClose,
  onSubmit
}) => {
  const [selectedClientId, setSelectedClientId] = useState(clients[0]?.id || '');
  const [type, setType] = useState<'DP' | 'Pelunasan' | 'Add-on'>('Pelunasan');
  const [amount, setAmount] = useState<number>(295000);
  const [paymentMethod, setPaymentMethod] = useState('Transfer SeaBank');
  const [adminNotes, setAdminNotes] = useState('');

  React.useEffect(() => {
    if (!selectedClientId && clients[0]?.id) {
      setSelectedClientId(clients[0].id);
    }
  }, [clients, selectedClientId]);

  if (!isOpen) return null;

  const selectedClient = clients.find(c => c.id === selectedClientId) || clients[0];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClient) return;

    onSubmit({
      date: new Date().toISOString().split('T')[0],
      client_id: selectedClient.id,
      client_name: selectedClient.client_name,
      order_id: selectedClient.order_id,
      type,
      amount: Number(amount),
      payment_method: paymentMethod,
      status: 'verified',
      admin_notes: adminNotes || `Pembayaran ${type} via ${paymentMethod}`
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-[#171A20] border border-[#292D35] rounded-3xl max-w-md w-full p-6 space-y-5 shadow-2xl animate-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-3 border-b border-[#292D35]">
          <div className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-emerald-400" />
            <h2 className="text-base font-bold text-[#F2F1ED]">Catat Transaksi Pembayaran</h2>
          </div>
          <button onClick={onClose} className="p-1.5 text-[#9296A0] hover:text-[#F2F1ED]">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Client select */}
          <div className="space-y-1.5">
            <label className="text-[#666B76] font-semibold uppercase tracking-wider block">
              Pilih Klien / Booking
            </label>
            <select
              value={selectedClient?.id || selectedClientId}
              onChange={e => {
                const nextId = e.target.value;
                setSelectedClientId(nextId);
                const c = clients.find(item => item.id === nextId);
                if (c && type === 'Pelunasan') {
                  const targetTotal = c.total_price || c.package_price;
                  const rem = Math.max(0, targetTotal - c.paid_amount);
                  if (rem > 0) setAmount(rem);
                }
              }}
              className="w-full px-3 py-2 bg-[#111318] border border-[#292D35] rounded-xl text-[#F2F1ED] focus:outline-none focus:border-[#C5A572]"
            >
              {clients.map(c => (
                <option key={c.id} value={c.id}>
                  {c.order_id} — {c.client_name} ({c.package_name} · {c.payment_status})
                </option>
              ))}
            </select>
          </div>

          {/* Type */}
          <div className="space-y-1.5">
            <label className="text-[#666B76] font-semibold uppercase tracking-wider block">
              Tipe Transaksi
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['DP', 'Pelunasan', 'Add-on'] as const).map(t => (
                <button
                  type="button"
                  key={t}
                  onClick={() => setType(t)}
                  className={`py-2 px-3 rounded-xl font-bold transition-colors border ${
                    type === t
                      ? 'bg-emerald-950 text-emerald-300 border-emerald-700'
                      : 'bg-[#111318] text-[#9296A0] border-[#292D35]'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Amount */}
          <div className="space-y-1.5">
            <label className="text-[#666B76] font-semibold uppercase tracking-wider block">
              Jumlah Uang (Rupiah)
            </label>
            <input
              type="number"
              step="5000"
              value={amount}
              onChange={e => setAmount(Number(e.target.value))}
              required
              className="w-full px-3 py-2 bg-[#111318] border border-[#292D35] rounded-xl text-[#F2F1ED] font-mono text-sm focus:outline-none focus:border-[#C5A572]"
            />
          </div>

          {/* Payment Method */}
          <div className="space-y-1.5">
            <label className="text-[#666B76] font-semibold uppercase tracking-wider block">
              Metode Pembayaran
            </label>
            <select
              value={paymentMethod}
              onChange={e => setPaymentMethod(e.target.value)}
              className="w-full px-3 py-2 bg-[#111318] border border-[#292D35] rounded-xl text-[#F2F1ED] focus:outline-none focus:border-[#C5A572]"
            >
              <option value="Transfer SeaBank">Transfer SeaBank (901507540052)</option>
              <option value="Transfer BCA">Transfer Bank BCA</option>
              <option value="Transfer Mandiri">Transfer Bank Mandiri</option>
              <option value="Transfer BRI">Transfer Bank BRI</option>
              <option value="QRIS / Lainnya">QRIS / Pembayaran Lain</option>
            </select>
          </div>

          {/* Admin Notes */}
          <div className="space-y-1.5">
            <label className="text-[#666B76] font-semibold uppercase tracking-wider block">
              Catatan Bukti Mutasi
            </label>
            <input
              type="text"
              placeholder="Contoh: Terverifikasi rekening BCA a/n Bestari 14:30 WIB"
              value={adminNotes}
              onChange={e => setAdminNotes(e.target.value)}
              className="w-full px-3 py-2 bg-[#111318] border border-[#292D35] rounded-xl text-[#F2F1ED] focus:outline-none focus:border-[#C5A572]"
            />
          </div>

          <div className="pt-3 flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 px-4 text-xs font-semibold text-[#9296A0] hover:text-[#F2F1ED] bg-[#111318] hover:bg-[#1D2027] border border-[#292D35] rounded-xl transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              className="flex-1 py-2.5 px-4 text-xs font-bold text-[#0B0C0F] bg-emerald-400 hover:bg-emerald-300 rounded-xl transition-all shadow-md"
            >
              Verifikasi &amp; Simpan
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
