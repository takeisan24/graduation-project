/**
 * JobErrorBoundary
 * 
 * Simple React error boundary để tránh crash toàn bộ UI khi
 * VideoFactoryModal hoặc JobDetailPage gặp lỗi runtime bất ngờ.
 * Thay vì blank screen, hiển thị message gọn để user có thể đóng / reload.
 */

'use client';

import React from 'react';

interface JobErrorBoundaryProps {
  children: React.ReactNode;
}

interface JobErrorBoundaryState {
  hasError: boolean;
  message?: string;
}

export class JobErrorBoundary extends React.Component<
  JobErrorBoundaryProps,
  JobErrorBoundaryState
> {
  constructor(props: JobErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, message: undefined };
  }

  /**
   * React lifecycle: được gọi khi có error trong subtree.
   * Lưu lại state để render fallback UI an toàn.
   */
  static getDerivedStateFromError(error: unknown): JobErrorBoundaryState {
    const msg =
      error instanceof Error ? error.message : typeof error === 'string' ? error : 'Unknown error';
    return { hasError: true, message: msg };
  }

  /**
   * Optional hook để log error cho analytics / monitoring nếu cần.
   */
  componentDidCatch(error: unknown, info: React.ErrorInfo) {
    // NOTE: Ở đây chỉ log console; production có thể gửi lên monitoring (Sentry,...)
    // nhưng tránh thêm dependency nặng trong demo này.
    // eslint-disable-next-line no-console
    // SILENCED: console.error('JobErrorBoundary caught error', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-4 text-sm text-red-200 bg-red-900/40 border border-red-600 rounded-md">
          <p className="font-semibold mb-1">Đã xảy ra lỗi khi hiển thị Video Factory.</p>
          <p className="text-red-100/80 mb-2">
            {this.state.message || 'Vui lòng đóng cửa sổ này và thử lại sau.'}
          </p>
          <button
            type="button"
            className="inline-flex items-center px-3 py-1.5 rounded-md bg-red-600 text-white text-xs hover:bg-red-500 transition-colors"
            onClick={() => this.setState({ hasError: false, message: undefined })}
          >
            Thử tải lại component
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}


