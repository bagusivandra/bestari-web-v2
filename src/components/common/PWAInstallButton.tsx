import React, { useState } from 'react';
import { Download, Smartphone, X } from 'lucide-react';
import { usePWAInstall } from '../../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  compact?: boolean;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ compact = false }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={() => {
          void install();
        }}
        title="Pasang Bestari Graduation sebagai aplikasi desktop/HP"
        className={`flex items-center gap-1.5 rounded-xl bg-[#12151D] hover:bg-[#1A1E29] border border-[#C5A572]/45 text-[#D8C49D] font-semibold transition-all whitespace-nowrap shrink-0 ${
          compact ? 'px-2.5 py-1.5 text-[11px]' : 'px-3.5 py-2 text-xs'
        }`}
      >
        <Download className="w-3.5 h-3.5 text-[#C5A572]" />
        <span>Install App</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          className={`flex items-center gap-1.5 rounded-xl bg-[#12151D] hover:bg-[#1A1E29] border border-[#C5A572]/45 text-[#D8C49D] font-semibold transition-all whitespace-nowrap shrink-0 ${
            compact ? 'px-2.5 py-1.5 text-[11px]' : 'px-3.5 py-2 text-xs'
          }`}
        >
          <Smartphone className="w-3.5 h-3.5 text-[#C5A572]" />
          <span>Install di iOS</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
            <div className="w-full max-w-sm rounded-2xl bg-[#12151D] border border-[#252A36] p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-[#F2F1ED]">
                  Pasang di Layar Utama iPhone / iPad
                </h3>
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  className="p-1 text-[#9CA1AD] hover:text-[#F2F1ED] rounded-lg"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <ol className="text-xs text-[#9CA1AD] space-y-2 list-decimal list-inside leading-relaxed">
                <li>
                  Ketuk tombol <strong className="text-[#F2F1ED]">Share</strong> (ikon kotak panah atas) di toolbar Safari.
                </li>
                <li>
                  Gulir ke bawah dan pilih <strong className="text-[#D8C49D]">Add to Home Screen</strong>.
                </li>
                <li>
                  Ketuk <strong className="text-[#F2F1ED]">Add</strong> untuk membuka Bestari Graduation seperti aplikasi native.
                </li>
              </ol>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="w-full py-2.5 rounded-xl bg-[#C5A572] hover:bg-[#D8C49D] text-[#0B0C0F] text-xs font-bold"
              >
                Mengerti
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
