import { useState, useCallback, useRef, useEffect } from 'react'
import { useSignalR } from '@/hooks/useSignalR'
import { hubUrl } from '@/lib/config'
import Header from '@/components/layout/Header'
import { cn } from '@/lib/utils'
import { Trash2, Pause, Play } from 'lucide-react'

interface LogEntry {
  timestamp: string
  level: string
  message: string
  source?: string
  exception?: string
}

const LEVEL_COLOR: Record<string, string> = {
  Verbose: 'text-slate-600',
  Debug: 'text-slate-400',
  Information: 'text-sky-400',
  Warning: 'text-yellow-400',
  Error: 'text-red-400',
  Fatal: 'text-red-600',
}

const MAX_LOGS = 500

export default function AdminLogsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [paused, setPaused] = useState(false)
  const [filter, setFilter] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const pausedRef = useRef(false)

  pausedRef.current = paused

  const handleLog = useCallback((entry: unknown) => {
    if (pausedRef.current) return
    setLogs(prev => {
      const next = [...prev, entry as LogEntry]
      return next.length > MAX_LOGS ? next.slice(-MAX_LOGS) : next
    })
  }, [])

  useSignalR({
    hubUrl: hubUrl('/hubs/logs'),
    events: { log: handleLog },
  })

  useEffect(() => {
    if (!paused) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs, paused])

  const filtered = filter
    ? logs.filter(l =>
        l.message.toLowerCase().includes(filter.toLowerCase()) ||
        l.source?.toLowerCase().includes(filter.toLowerCase())
      )
    : logs

  return (
    <>
      <Header title="Admin — Canlı Loglar" />
      <div className="p-6 space-y-3 flex flex-col h-[calc(100vh-3.5rem)]">
        {/* Toolbar */}
        <div className="flex items-center gap-3 shrink-0">
          <input
            value={filter}
            onChange={e => setFilter(e.target.value)}
            placeholder="Log ara…"
            className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-yellow-400/50 w-56"
          />
          <span className="text-xs text-slate-500">{logs.length} log</span>
          <div className="ml-auto flex gap-2">
            <button
              onClick={() => setPaused(p => !p)}
              className={cn('flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                paused ? 'bg-yellow-400/20 text-yellow-400' : 'bg-white/5 text-slate-400 hover:bg-white/10')}
            >
              {paused ? <><Play size={12} /> Devam</> : <><Pause size={12} /> Duraklat</>}
            </button>
            <button
              onClick={() => setLogs([])}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
            >
              <Trash2 size={12} /> Temizle
            </button>
          </div>
        </div>

        {/* Log list */}
        <div className="flex-1 overflow-y-auto bg-[#0b0b0f] border border-white/5 rounded-xl p-3 font-mono text-xs space-y-0.5">
          {filtered.length === 0 && (
            <p className="text-slate-600 text-center py-8">Bekleniyor…</p>
          )}
          {filtered.map((log, i) => (
            <div key={i} className="flex gap-3 py-0.5 hover:bg-white/5 px-1 rounded group">
              <span className="text-slate-600 shrink-0 w-20">
                {new Date(log.timestamp).toLocaleTimeString('tr-TR')}
              </span>
              <span className={cn('shrink-0 w-20 font-semibold', LEVEL_COLOR[log.level] ?? 'text-slate-400')}>
                {log.level}
              </span>
              {log.source && (
                <span className="text-slate-600 shrink-0 max-w-40 truncate">{log.source}</span>
              )}
              <span className="text-slate-300 break-all">{log.message}</span>
              {log.exception && (
                <span className="text-red-500 break-all hidden group-hover:block">{log.exception}</span>
              )}
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      </div>
    </>
  )
}
