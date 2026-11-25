import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error?.message || 'Terjadi kesalahan aplikasi yang tidak terduga.'
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Bestari ErrorBoundary caught error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bestari-canvas-bg text-[#F2F1ED] flex items-center justify-center p-6 font-['DM_Sans']">
          <div className="max-w-md w-full p-6 bg-[#12151D] border border-rose-800/50 rounded-2xl shadow-2xl space-y-4 text-center">
            <div className="w-12 h-12 mx-auto rounded-xl bg-rose-950/60 border border-rose-800/60 flex items-center justify-center text-rose-400">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div className="space-y-1.5">
              <h2 className="text-lg font-bold text-[#F2F1ED]">Terjadi Kendala Tampilan</h2>
              <p className="text-xs text-[#9CA1AD] leading-relaxed">
                Aplikasi mengalami kesalahan pemrosesan data. Silakan muat ulang halaman untuk memulihkan sesi Anda.
              </p>
            </div>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="w-full py-2.5 px-4 bg-[#C5A572] hover:bg-[#D8C49D] text-[#0B0C0F] text-xs font-bold rounded-xl inline-flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Muat Ulang Halaman</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
