import React from 'react';
import { AlertOctagon, RefreshCw } from 'lucide-react';

interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    let readable = error.message;
    try {
      const parsed = JSON.parse(error.message);
      if (parsed && parsed.error) {
        readable = `Access or database error (${parsed.operationType} on ${parsed.path || 'record'}): ${parsed.error}`;
      }
    } catch {
      // use raw message
    }
    return { hasError: true, message: readable };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#DDE3EC] text-slate-900 flex items-center justify-center p-6">
          <div className="max-w-lg w-full bg-[#EEF2F7] border border-rose-300 rounded-2xl p-8 space-y-5 shadow-lg">
            <div className="w-11 h-11 rounded-lg bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-700">
              <AlertOctagon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 font-display">
                Application Encountered an Error
              </h2>
              <p className="text-sm text-slate-600 mt-2 leading-relaxed break-words">
                {this.state.message}
              </p>
            </div>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#FACC15] hover:bg-amber-400 text-slate-950 text-sm font-semibold transition-colors cursor-pointer shadow-xs"
            >
              <RefreshCw className="w-4 h-4" />
              Reload Application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
