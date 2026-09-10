import React from "react";

export default class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error("Vardin application render error:", error, info);
  }

  handleRetry = () => {
    // A full reload clears any corrupted transient React state while preserving
    // the persisted Vardin session token.
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="fixed inset-0 z-[99999] flex min-h-screen items-center justify-center bg-[#f7fbfa] px-5 text-center">
        <div className="w-full max-w-md rounded-3xl border border-[#dcebe8] bg-white p-7 shadow-xl sm:p-9">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-500 to-teal-600 shadow-lg shadow-teal-600/20">
            <img src="/favicon.svg" alt="Vardin" width="34" height="34" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Vardin needs a quick refresh</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Something interrupted this screen while it was loading. Your account session is preserved.
          </p>
          <button
            type="button"
            onClick={this.handleRetry}
            className="mt-6 inline-flex h-11 items-center justify-center rounded-xl bg-teal-600 px-6 text-sm font-semibold text-white shadow-md transition hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2"
          >
            Try again
          </button>
          {import.meta.env.DEV && this.state.error?.message && (
            <p className="mt-5 break-words text-xs text-slate-400">{this.state.error.message}</p>
          )}
        </div>
      </div>
    );
  }
}
