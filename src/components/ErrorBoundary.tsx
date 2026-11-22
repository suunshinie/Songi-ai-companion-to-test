import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    const raw = error instanceof Error ? error.message : String(error);
    let friendly = 'Something unexpected happened in your sanctuary view.';
    try {
      const parsed = JSON.parse(raw) as { error?: string; operationType?: string; path?: string };
      if (parsed?.error) {
        friendly = parsed.error.includes('permissions')
          ? 'Please verify your account or sign in again to sync cloud sanctuary data.'
          : parsed.error;
      }
    } catch {
      if (raw) friendly = raw;
    }
    return { hasError: true, message: friendly };
  }

  componentDidCatch(error: unknown) {
    console.error('Sanctuary ErrorBoundary caught:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#FAF7F2] text-[#2A2A28] flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white rounded-2xl border border-[#E3D9CD] p-7 shadow-lg space-y-4">
            <div className="w-11 h-11 rounded-xl bg-[#F1EAE1] text-[#C97B5A] flex items-center justify-center font-bold text-lg">
              !
            </div>
            <h1 className="text-xl font-bold text-[#2A2A28]">
              Let&apos;s pause and reset safely
            </h1>
            <p className="text-sm text-[#6B6B66] leading-relaxed">{this.state.message}</p>
            <button
              type="button"
              onClick={() => this.setState({ hasError: false, message: '' })}
              className="w-full py-2.5 px-4 rounded-xl bg-[#2F6F63] text-white text-sm font-semibold hover:bg-[#24594f] transition-colors"
            >
              Return to SHONGI
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
