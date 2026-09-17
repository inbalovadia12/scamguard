import React from "react";

/**
 * Catches render errors from the routed content so a single broken page
 * doesn't blank the entire app. Shows a calm recovery UI with a reload action.
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error("Vardin render error:", error, info);
  }

  handleReload = () => {
    this.setState({ hasError: false });
    // Hard reload to re-mount the route cleanly; avoids carrying stale state.
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[60vh] flex items-center justify-center px-4 py-16">
          <div className="max-w-md w-full text-center space-y-4">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center">
              <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6 text-primary" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 9v4M12 17h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold tracking-tight font-heading">Something went wrong</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Vardin hit an unexpected error loading this page. Your data is safe. Try reloading — if it keeps happening, please send feedback.
            </p>
            <div className="flex items-center justify-center gap-2 pt-1">
              <button
                onClick={this.handleReload}
                className="inline-flex items-center justify-center rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90 transition-colors"
              >
                Reload page
              </button>
              <a
                href="/dashboard"
                className="inline-flex items-center justify-center rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors"
              >
                Go to Dashboard
              </a>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}