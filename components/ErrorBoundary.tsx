import React from 'react';

type ErrorBoundaryProps = {
  children: React.ReactNode;
};

type ErrorBoundaryState = {
  hasError: boolean;
};

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Unhandled UI error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-black text-zinc-200 flex items-center justify-center p-6">
          <div className="max-w-md text-center border border-zinc-800 bg-zinc-900 rounded-xl p-8">
            <h1 className="text-2xl font-serif text-white mb-3">Произошла ошибка интерфейса</h1>
            <p className="text-zinc-400 mb-6">
              Приложение перехватило непредвиденную ошибку. Обновите страницу и повторите действие.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-gold-500 text-black font-semibold rounded-lg hover:bg-gold-400 transition-colors"
            >
              Перезагрузить страницу
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
