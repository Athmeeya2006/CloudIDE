import { Component, ErrorInfo, ReactNode } from 'react';

interface Props { children: ReactNode; fallback?: ReactNode }
interface State { hasError: boolean; error: Error | null }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div className="h-full flex flex-col items-center justify-center bg-ide-bg text-ide-text-muted p-8">
          <div className="text-4xl mb-4">⚠️</div>
          <div className="text-[14px] font-medium text-ide-text mb-2">Something went wrong</div>
          <div className="text-[12px] text-ide-text-dim mb-4 font-mono max-w-md text-center break-all">
            {this.state.error?.message}
          </div>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="px-4 py-2 bg-ide-accent text-white text-[13px] hover:bg-[#1a8ad4] transition-colors"
          >
            Try Again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
