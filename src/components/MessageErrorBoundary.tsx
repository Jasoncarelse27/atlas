import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class MessageErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center p-8 bg-[#CF9A96]/10 border border-[#CF9A96]/30 rounded-lg m-4">
          <div className="text-center">
            <div className="text-[#A67571] text-2xl mb-2">⚠️</div>
            <h3 className="text-[#A67571] font-semibold mb-2">Chat Display Error</h3>
            <p className="text-[#8B7E74] text-sm mb-4">
              There was an issue displaying the chat messages.
            </p>
            <button
              onClick={() => this.setState({ hasError: false, error: undefined })}
              className="px-4 py-2 bg-[#CF9A96] text-white rounded-md hover:bg-[#BF8A86] transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default MessageErrorBoundary;
