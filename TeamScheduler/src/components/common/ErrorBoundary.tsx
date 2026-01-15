// 에러 바운더리 컴포넌트

import { Component, ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-card border border-border rounded-lg shadow-xl p-6 text-center">
            <AlertTriangle className="w-12 h-12 text-destructive mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-foreground mb-2">
              문제가 발생했습니다
            </h2>
            <p className="text-muted-foreground mb-4">
              예상치 못한 오류가 발생했습니다. 페이지를 새로고침해주세요.
            </p>
            {this.state.error && (
              <details className="text-left bg-muted p-3 rounded-md mb-4">
                <summary className="cursor-pointer text-sm font-medium text-foreground mb-2">
                  오류 상세정보
                </summary>
                <pre className="text-xs text-muted-foreground overflow-auto">
                  {this.state.error.message}
                </pre>
              </details>
            )}
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors font-medium"
            >
              페이지 새로고침
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
