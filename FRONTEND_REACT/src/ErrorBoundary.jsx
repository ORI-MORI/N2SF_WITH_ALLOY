import React from 'react';

export default class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        this.setState({ errorInfo });
        console.error('ErrorBoundary caught:', error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div style={{ padding: 40, background: '#1e293b', color: '#f1f5f9', minHeight: '100vh', fontFamily: 'monospace' }}>
                    <h1 style={{ color: '#ef4444', fontSize: 24 }}>Runtime Error</h1>
                    <pre style={{ color: '#fbbf24', whiteSpace: 'pre-wrap', marginTop: 16, fontSize: 14 }}>
                        {this.state.error?.toString()}
                    </pre>
                    <pre style={{ color: '#94a3b8', whiteSpace: 'pre-wrap', marginTop: 16, fontSize: 12, maxHeight: 400, overflow: 'auto' }}>
                        {this.state.errorInfo?.componentStack}
                    </pre>
                    <button
                        onClick={() => this.setState({ hasError: false, error: null, errorInfo: null })}
                        style={{ marginTop: 20, padding: '8px 16px', background: '#3b82f6', color: 'white', border: 'none', cursor: 'pointer' }}
                    >
                        Retry
                    </button>
                </div>
            );
        }
        return this.props.children;
    }
}
