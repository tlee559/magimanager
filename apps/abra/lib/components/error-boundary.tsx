"use client";

import { Component, type ReactNode } from "react";

// ============================================================================
// ERROR BOUNDARY COMPONENT
// ============================================================================

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex flex-col items-center justify-center min-h-[200px] p-8 bg-slate-900/50 rounded-xl border border-slate-800">
          <div className="text-4xl mb-4">⚠️</div>
          <h2 className="text-lg font-semibold text-slate-200 mb-2">Something went wrong</h2>
          <p className="text-sm text-slate-400 text-center max-w-md mb-4">
            {this.state.error?.message || "An unexpected error occurred"}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-500 transition text-sm"
          >
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

// ============================================================================
// ERROR FALLBACK COMPONENT
// ============================================================================

interface ErrorFallbackProps {
  error?: Error;
  resetError?: () => void;
  title?: string;
  message?: string;
}

export function ErrorFallback({
  error,
  resetError,
  title = "Something went wrong",
  message,
}: ErrorFallbackProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[200px] p-8 bg-slate-900/50 rounded-xl border border-slate-800">
      <div className="text-4xl mb-4">⚠️</div>
      <h2 className="text-lg font-semibold text-slate-200 mb-2">{title}</h2>
      <p className="text-sm text-slate-400 text-center max-w-md mb-4">
        {message || error?.message || "An unexpected error occurred"}
      </p>
      {resetError && (
        <button
          onClick={resetError}
          className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-500 transition text-sm"
        >
          Try Again
        </button>
      )}
    </div>
  );
}

// ============================================================================
// QUERY ERROR FALLBACK
// ============================================================================

interface QueryErrorFallbackProps {
  error: Error;
  refetch?: () => void;
}

export function QueryErrorFallback({ error, refetch }: QueryErrorFallbackProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[200px] p-8 bg-slate-900/50 rounded-xl border border-red-900/50">
      <div className="text-4xl mb-4">❌</div>
      <h2 className="text-lg font-semibold text-red-400 mb-2">Failed to load data</h2>
      <p className="text-sm text-slate-400 text-center max-w-md mb-4">{error.message}</p>
      {refetch && (
        <button
          onClick={() => refetch()}
          className="px-4 py-2 bg-slate-800 text-slate-200 rounded-lg hover:bg-slate-700 transition text-sm border border-slate-700"
        >
          Retry
        </button>
      )}
    </div>
  );
}

// ============================================================================
// EMPTY STATE COMPONENT
// ============================================================================

interface EmptyStateProps {
  icon?: string;
  title: string;
  message?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function EmptyState({ icon = "📭", title, message, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[200px] p-8">
      <div className="text-4xl mb-4">{icon}</div>
      <h2 className="text-lg font-semibold text-slate-200 mb-2">{title}</h2>
      {message && <p className="text-sm text-slate-400 text-center max-w-md mb-4">{message}</p>}
      {action && (
        <button
          onClick={action.onClick}
          className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-500 transition text-sm"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
