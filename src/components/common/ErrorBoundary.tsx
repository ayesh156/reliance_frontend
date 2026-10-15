import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '../ui/button';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  resetKey?: any;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Enterprise Application & Component Error Boundary
 * Prevents uncaught React render/hook errors from triggering a black screen.
 * Safely renders a localized fallback UI and provides a one-click recovery reset.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary caught error]:', error, errorInfo);
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  public componentDidUpdate(prevProps: ErrorBoundaryProps) {
    if (this.props.resetKey !== prevProps.resetKey && this.state.hasError) {
      this.setState({ hasError: false, error: null });
    }
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="p-4 sm:p-6 rounded-2xl border border-rose-200 dark:border-rose-900/50 bg-rose-50/70 dark:bg-rose-950/20 text-rose-900 dark:text-rose-200 space-y-3 my-2 shadow-xs">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="size-5 text-rose-600 dark:text-rose-400 shrink-0" />
            <h4 className="text-sm font-bold">Something went wrong while displaying this component</h4>
          </div>
          <p className="text-xs text-rose-800/80 dark:text-rose-300 font-mono break-all">
            {this.state.error?.message || 'An unexpected rendering error occurred.'}
          </p>
          <div className="flex items-center gap-2 pt-1">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={this.handleReset}
              className="h-8 text-xs font-semibold gap-1.5 border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/40"
            >
              <RefreshCw className="size-3.5" /> Try Again
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => window.location.reload()}
              className="h-8 text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white"
            >
              Reload Page
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
