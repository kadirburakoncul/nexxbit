import { Component } from 'react'
import type { ReactNode } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

interface Props { children: ReactNode }
interface State { error: Error | null }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="min-h-screen bg-[#0a0d14] flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center space-y-5">
          <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto">
            <AlertTriangle size={28} className="text-red-400" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-slate-100 mb-1">Beklenmeyen Hata</h1>
            <p className="text-sm text-slate-500">Sayfa yüklenirken bir hata oluştu.</p>
          </div>
          <pre className="text-left text-xs text-red-400/70 bg-red-500/5 border border-red-500/10 rounded-lg p-3 overflow-auto max-h-32">
            {this.state.error.message}
          </pre>
          <button
            onClick={() => window.location.reload()}
            className="inline-flex items-center gap-2 bg-yellow-400 hover:bg-yellow-300 text-black font-semibold px-5 py-2.5 rounded-lg text-sm transition-colors"
          >
            <RefreshCw size={14} /> Sayfayı Yenile
          </button>
        </div>
      </div>
    )
  }
}
