import { jsPDF } from 'jspdf';
import { AddOnItem, ClientBooking, Transaction } from '../types';
import { formatDateIndoLong, formatRupiah } from './formatters';

export function buildInvoiceNumber(client: ClientBooking): string {
  if (client.invoice_number) return client.invoice_number;
  const cleanOrder = client.order_id.replace(/[^A-Z0-9-]/gi, '').toUpperCase();
  return `INV-PLN/${cleanOrder}`;
}

export function buildInvoiceFileName(client: ClientBooking): string {
  const safeName = client.client_name.replace(/[^a-zA-Z0-9\s-]/g, '').trim().replace(/\s+/g, '_');
  const prefix = client.payment_status === 'LUNAS' ? 'INVOICE_LUNAS' : 'INVOICE_DP';
  return `${prefix}_${client.order_id}_${safeName}.pdf`;
}

export function generateInvoicePdfBlob(
  client: ClientBooking,
  transactions: Transaction[],
  addons: AddOnItem[] = []
): Blob {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 16;
  const contentWidth = pageWidth - margin * 2;

  const invoiceNo = buildInvoiceNumber(client);
  const issuedDate = formatDateIndoLong(
    client.invoice_issued_at || new Date().toISOString().split('T')[0]
  );
  const totalBill = client.total_price || client.package_price || 0;
  const isPaidFull = client.payment_status === 'LUNAS' || client.paid_amount >= totalBill;
  const verifiedPaid = isPaidFull ? totalBill : Math.max(0, client.paid_amount || 0);
  const remainingBill = Math.max(0, totalBill - verifiedPaid);

  // Dark editorial header block
  doc.setFillColor(12, 14, 19);
  doc.rect(0, 0, pageWidth, 44, 'F');

  // Gold accent bar
  doc.setFillColor(197, 165, 114);
  doc.rect(0, 44, pageWidth, 1.5, 'F');

  // Brand title
  doc.setTextColor(197, 165, 114);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text('BESTARI GRADUATION', margin, 19);

  doc.setTextColor(216, 196, 157);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('#WhereDreamsMeetReality  |  bestarigraduation@gmail.com', margin, 26);

  doc.setTextColor(160, 165, 175);
  doc.setFontSize(8.5);
  doc.text('Bukti Pembayaran & Invoice Resmi Layanan Fotografi Wisuda', margin, 33);

  // Right header: INVOICE & Status stamp
  doc.setTextColor(242, 241, 237);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('INVOICE', pageWidth - margin, 18, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(216, 196, 157);
  doc.text(invoiceNo, pageWidth - margin, 24, { align: 'right' });

  if (isPaidFull) {
    doc.setFillColor(16, 185, 129);
    doc.roundedRect(pageWidth - margin - 26, 28.5, 26, 8, 2, 2, 'F');
    doc.setTextColor(11, 12, 15);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('LUNAS', pageWidth - margin - 13, 33.8, { align: 'center' });
  } else {
    doc.setFillColor(245, 158, 11);
    doc.roundedRect(pageWidth - margin - 34, 28.5, 34, 8, 2, 2, 'F');
    doc.setTextColor(11, 12, 15);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('DP TERVERIFIKASI', pageWidth - margin - 17, 33.8, { align: 'center' });
  }

  // Section 1: Client & Invoice Metadata
  let y = 55;
  doc.setFillColor(248, 247, 244);
  doc.roundedRect(margin, y, contentWidth, 38, 2.5, 2.5, 'F');
  doc.setDrawColor(225, 220, 210);
  doc.roundedRect(margin, y, contentWidth, 38, 2.5, 2.5, 'S');

  doc.setTextColor(120, 115, 105);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('DITAGIHKAN KEPADA', margin + 5, y + 7);
  doc.text('DETAIL ORDER & JADWAL', margin + contentWidth / 2 + 4, y + 7);

  doc.setTextColor(25, 28, 34);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(client.client_name, margin + 5, y + 14);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(70, 74, 84);
  doc.text(`Kampus: ${client.campus}`, margin + 5, y + 20);
  doc.text(`WhatsApp: ${client.phone}`, margin + 5, y + 25.5);
  doc.text(
    `Wilayah: ${client.region_id.toUpperCase()}  |  ID Portal: ${client.client_id_display}`,
    margin + 5,
    y + 31
  );

  // Right column metadata
  const rightColX = margin + contentWidth / 2 + 4;
  doc.text(`No. Order: ${client.order_id}`, rightColX, y + 14);
  doc.text(`Tanggal Terbit: ${issuedDate}`, rightColX, y + 20);
  doc.text(
    `Jadwal Sesi: ${formatDateIndoLong(client.photo_date)} (${client.session_time} WIB)`,
    rightColX,
    y + 25.5
  );
  doc.text(
    `Fotografer: ${
      client.photographer && client.photographer !== 'Belum Ditugaskan'
        ? client.photographer
        : 'Tim Bestari'
    }`,
    rightColX,
    y + 31
  );

  // Section 2: Line items table
  y += 47;
  doc.setFillColor(23, 26, 32);
  doc.rect(margin, y, contentWidth, 9, 'F');
  doc.setTextColor(216, 196, 157);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('DESKRIPSI LAYANAN', margin + 4, y + 6);
  doc.text('KETERANGAN', margin + 96, y + 6);
  doc.text('NOMINAL', pageWidth - margin - 4, y + 6, { align: 'right' });

  y += 9;
  const rows: Array<{ title: string; detail: string; amount: number }> = [
    {
      title: `Paket Foto Wisuda — ${client.package_name}`,
      detail: `Kuota ${client.edit_quota} Foto Edit (${client.region_id.toUpperCase()})`,
      amount: client.package_price || totalBill
    }
  ];

  let addonRecordedTotal = 0;
  (client.selected_addons || []).forEach(addonName => {
    const matched = addons.find(a => a.name === addonName);
    const price = matched?.price ?? 0;
    addonRecordedTotal += price;
    rows.push({
      title: `Add-on: ${addonName}`,
      detail: matched?.description
        ? matched.description.slice(0, 42) + (matched.description.length > 42 ? '...' : '')
        : 'Layanan tambahan sesi wisuda',
      amount: price
    });
  });

  const remainingAddonDiff = totalBill - (client.package_price || 0) - addonRecordedTotal;
  if (remainingAddonDiff > 0) {
    rows.push({
      title: 'Penyesuaian / Add-on Tambahan',
      detail: 'Tambahan layanan paket yang disepakati',
      amount: remainingAddonDiff
    });
  }

  rows.forEach((row, index) => {
    const rowHeight = 12;
    if (index % 2 === 1) {
      doc.setFillColor(249, 249, 250);
      doc.rect(margin, y, contentWidth, rowHeight, 'F');
    }
    doc.setDrawColor(230, 232, 236);
    doc.line(margin, y + rowHeight, pageWidth - margin, y + rowHeight);

    doc.setTextColor(25, 28, 34);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(row.title, margin + 4, y + 7.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(95, 100, 110);
    doc.text(row.detail, margin + 96, y + 7.5);

    doc.setTextColor(25, 28, 34);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(row.amount > 0 ? formatRupiah(row.amount) : 'Termasuk', pageWidth - margin - 4, y + 7.5, {
      align: 'right'
    });
    y += rowHeight;
  });

  // Totals box
  y += 6;
  const summaryX = margin + contentWidth - 82;
  doc.setFillColor(248, 247, 244);
  doc.roundedRect(summaryX, y, 82, 28, 2, 2, 'F');
  doc.setDrawColor(197, 165, 114);
  doc.roundedRect(summaryX, y, 82, 28, 2, 2, 'S');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(80, 85, 95);
  doc.text('Total Tagihan', summaryX + 4, y + 7);
  doc.text(formatRupiah(totalBill), pageWidth - margin - 4, y + 7, { align: 'right' });

  doc.text('Total Terverifikasi', summaryX + 4, y + 13.5);
  doc.setTextColor(isPaidFull ? 16 : 180, isPaidFull ? 145 : 115, isPaidFull ? 100 : 15);
  doc.setFont('helvetica', 'bold');
  doc.text(formatRupiah(verifiedPaid), pageWidth - margin - 4, y + 13.5, { align: 'right' });

  doc.setDrawColor(215, 205, 185);
  doc.line(summaryX + 4, y + 17, pageWidth - margin - 4, y + 17);

  doc.setTextColor(20, 24, 30);
  doc.setFontSize(9.5);
  doc.text('Sisa Tagihan', summaryX + 4, y + 23.5);
  if (isPaidFull) {
    doc.setTextColor(16, 145, 100);
    doc.text('Rp 0 (LUNAS)', pageWidth - margin - 4, y + 23.5, { align: 'right' });
  } else {
    doc.setTextColor(180, 110, 10);
    doc.text(formatRupiah(remainingBill), pageWidth - margin - 4, y + 23.5, { align: 'right' });
  }

  // Payment history section
  const clientTxs = transactions.filter(
    t => (t.client_id === client.id || t.order_id === client.order_id) && t.status === 'verified'
  );

  y += 38;
  doc.setTextColor(25, 28, 34);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.text('Riwayat Pembayaran Terverifikasi', margin, y);
  y += 4;

  if (clientTxs.length === 0) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(95, 100, 110);
    doc.text(
      `• Pembayaran terverifikasi oleh Bestari Admin (${formatRupiah(verifiedPaid)})`,
      margin + 2,
      y + 5
    );
    y += 10;
  } else {
    clientTxs.slice(0, 5).forEach(tx => {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(70, 74, 84);
      doc.text(
        `• ${formatDateIndoLong(tx.date)} — ${tx.type} (${tx.payment_method})`,
        margin + 2,
        y + 5
      );
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(25, 28, 34);
      doc.text(formatRupiah(tx.amount), pageWidth - margin - 2, y + 5, { align: 'right' });
      y += 6.5;
    });
  }

  // Footer
  const footerY = 266;
  doc.setDrawColor(225, 220, 210);
  doc.line(margin, footerY - 6, pageWidth - margin, footerY - 6);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(25, 28, 34);
  doc.text('Rekening Resmi Bestari Graduation:', margin, footerY);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(85, 90, 100);
  doc.text('SeaBank 901507540052 a/n Ivandra Bagus Pranata', margin, footerY + 5);
  doc.text(
    'Dokumen ini diterbitkan secara otomatis oleh Bestari Operational System & sah sebagai bukti pelunasan.',
    margin,
    footerY + 11
  );

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(150, 120, 70);
  doc.text('Bestari Admin', pageWidth - margin, footerY + 4, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(120, 125, 135);
  doc.text('Terverifikasi Elektronik', pageWidth - margin, footerY + 9, { align: 'right' });

  return doc.output('blob');
}

export function downloadInvoicePdf(
  client: ClientBooking,
  transactions: Transaction[],
  addons: AddOnItem[] = []
) {
  const blob = generateInvoicePdfBlob(client, transactions, addons);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = buildInvoiceFileName(client);
  link.click();
  URL.revokeObjectURL(url);
}
