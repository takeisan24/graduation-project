"use client"

import React, { Component, ReactNode } from 'react';
import ErrorState from './ErrorState';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export default class CreateSectionErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[CreateSectionErrorBoundary]', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined });
  };

  override render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      const isNetworkError = typeof navigator !== 'undefined' && !navigator.onLine
        ? true
        : this.state.error?.message.toLowerCase().includes('network');

      return (
        <div className="flex flex-1 h-full w-full items-center justify-center p-4 bg-background">
          <ErrorState
            variant="full"
            isNetworkError={isNetworkError}
            error={this.state.error}
            onRetry={this.handleRetry}
          />
        </div>
      );
    }

    return this.props.children;
  }
}
