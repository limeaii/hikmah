import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

interface ErrorBoundaryProps {
  children?: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

// Error Boundary to catch runtime errors (like missing API keys or undefined variables)
class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-red-50 p-8 font-sans">
          <div className="bg-white p-8 rounded-2xl shadow-xl max-w-lg w-full border border-red-100">
            <h1 className="text-2xl font-bold text-red-600 mb-4">Something went wrong</h1>
            <p className="text-slate-600 mb-4">The application encountered a critical error.</p>
            <div className="bg-slate-900 text-slate-50 p-4 rounded-lg overflow-auto text-xs mb-4">
              <p className="font-mono">{this.state.error?.message}</p>
            </div>
            <p className="text-sm text-slate-500">Try reloading the page. If this persists, check the API key configuration in index.html.</p>
            <button 
              onClick={() => window.location.reload()}
              className="mt-6 w-full bg-red-600 text-white py-3 rounded-xl font-bold hover:bg-red-700 transition"
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);