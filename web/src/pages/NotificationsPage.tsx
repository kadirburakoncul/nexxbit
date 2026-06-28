import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { notificationsApi } from '@/api/notifications'
import type { Notification } from '@/api/notifications'
import {
  Bell, CheckCheck, Trash2, X, TrendingUp, TrendingDown,
  AlertTriangle, FileText, ShieldAlert, Zap, Settings, UserPlus,
} from 'lucide-react'
import { format, formatDistanceToNow } from 'date-fns'
import { tr } from 'date-fns/locale'
import Header from '@/components/layout/Header'
import { cn } from '@/lib/utils'

// ─── Tip meta ─────────────────────────────────────────────────────────────────
const TYPE_META: Record<number, { label: string; icon: React.ReactNode; color: string; bg: string }> = {
  0:  { label: 'Alım Sinyali',  icon: <TrendingUp size={14} />,    color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  1:  { label: 'Satış Sinyali', icon: <TrendingDown size={14} />,  color: 'text-red-400',     bg: 'bg-red-500/10' },
  2:  { label: 'Stop Loss',     icon: <AlertTriangle size={14} />, color: 'text-orange-400',  bg: 'bg-orange-500/10' },
  3:  { label: 'Take Profit',   icon: <TrendingUp size={14} />,    color: 'text-blue-400',    bg: 'bg-blue-500/10' },
  4:  { label: 'Emir',          icon: <Zap size={14} />,           color: 'text-slate-300',   bg: 'bg-white/10' },
  5:  { label: 'Binance Hatası',icon: <AlertTriangle size={14} />, color: 'text-red-400',     bg: 'bg-red-500/10' },
  6:  { label: 'Günlük Rapor',  icon: <FileText size={14} />,      color: 'text-yellow-400',  bg: 'bg-yellow-500/10' },
  7:  { label: 'Risk Uyarısı',  icon: <ShieldAlert size={14} />,   color: 'text-orange-400',  bg: 'bg-orange-500/10' },
  8:  { label: 'Flash Crash',   icon: <AlertTriangle size={14} />, color: 'text-red-500',     bg: 'bg-red-500/15' },
  9:  { label: 'Sistem',        icon: <Settings size={14} />,      color: 'text-slate-400',   bg: 'bg-white/8' },
  10: { label: 'Yeni Üye',      icon: <UserPlus size={14} />,      color: 'text-purple-400',  bg: 'bg-purple-500/10' },
}

const DEFAULT_META = { label: 'Bildirim', icon: <Bell size={14} />, color: 'text-slate-400', bg: 'bg-white/8' }

// ─── Detail Modal ─────────────────────────────────────────────────────────────
function NotificationModal({ n, onClose, onDelete }: {
  n: Notification
  onClose: () => void
  onDelete: () => void
}) {
  const meta = TYPE_META[n.type] ?? DEFAULT_META
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-md bg-[#0f1117] border border-white/12 rounded-2xl overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/8 flex items-center gap-3">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${meta.bg}`}>
            <span className={meta.color}>{meta.icon}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className={`text-xs font-semibold uppercase tracking-wider ${meta.color}`}>{meta.label}</p>
            <p className="text-sm font-bold text-slate-100 truncate mt-0.5">{n.title}</p>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-600 hover:text-slate-300 hover:bg-white/8 transition-colors shrink-0"
          >
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          {/* Mesaj */}
          <div className="bg-white/[0.03] border border-white/8 rounded-xl p-4">
            <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">{n.body}</p>
          </div>

          {/* Meta bilgiler */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white/[0.03] border border-white/8 rounded-xl p-3">
              <p className="text-[10px] text-slate-600 uppercase tracking-wider mb-1">Tarih</p>
              <p className="text-xs font-semibold text-slate-200">
                {format(new Date(n.createdAt), 'dd MMM yyyy', { locale: tr })}
              </p>
              <p className="text-[10px] text-slate-600 mt-0.5">
                {format(new Date(n.createdAt), 'HH:mm', { locale: tr })}
              </p>
            </div>
            <div className="bg-white/[0.03] border border-white/8 rounded-xl p-3">
              <p className="text-[10px] text-slate-600 uppercase tracking-wider mb-1">Durum</p>
              <p className={`text-xs font-semibold ${n.isRead ? 'text-slate-500' : 'text-yellow-400'}`}>
                {n.isRead ? 'Okundu' : 'Okunmadı'}
              </p>
              <p className="text-[10px] text-slate-600 mt-0.5">
                {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true, locale: tr })}
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/8 flex items-center justify-between">
          <button
            onClick={() => { onDelete(); onClose() }}
            className="flex items-center gap-1.5 text-xs text-slate-600 hover:text-red-400 transition-colors"
          >
            <Trash2 size={12} /> Bildirimi sil
          </button>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-white/8 hover:bg-white/12 text-slate-300 rounded-lg text-xs font-medium transition-colors"
          >
            Kapat
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function NotificationsPage() {
  const qc = useQueryClient()
  const [selected, setSelected] = useState<Notification | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => notificationsApi.list({ pageSize: 50 }),
  })

  const markAll = useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  })

  const markOne = useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  })

  const deleteOne = useMutation({
    mutationFn: (id: string) => notificationsApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] })
      setSelected(null)
    },
  })

  const deleteAll = useMutation({
    mutationFn: () => notificationsApi.deleteAll(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  })

  const handleClick = (n: Notification) => {
    setSelected(n)
    if (!n.isRead) markOne.mutate(n.id)
  }

  return (
    <>
      <Header title="Bildirimler" />
      <div className="p-3 md:p-6 space-y-4 max-w-2xl">

        {/* Topbar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-300 font-medium">
              {data?.items.length ?? 0} bildirim
            </span>
            {(data?.unreadCount ?? 0) > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-400/15 text-yellow-400 border border-yellow-400/20 font-semibold">
                {data?.unreadCount} okunmamış
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            {(data?.unreadCount ?? 0) > 0 && (
              <button
                onClick={() => markAll.mutate()}
                disabled={markAll.isPending}
                className="flex items-center gap-1.5 text-xs text-yellow-400 hover:text-yellow-300 disabled:opacity-50 transition-colors"
              >
                <CheckCheck size={13} /> Tümünü okundu işaretle
              </button>
            )}
            {(data?.items.length ?? 0) > 0 && (
              <button
                onClick={() => { if (confirm('Tüm bildirimler silinsin mi?')) deleteAll.mutate() }}
                disabled={deleteAll.isPending}
                className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-red-400 disabled:opacity-50 transition-colors"
              >
                <Trash2 size={12} /> Tümünü sil
              </button>
            )}
          </div>
        </div>

        {/* Liste */}
        <div className="space-y-2">
          {isLoading && (
            <div className="flex items-center justify-center gap-2 py-12 text-slate-500 text-sm">
              <Bell size={16} className="animate-pulse" /> Yükleniyor…
            </div>
          )}

          {!isLoading && data?.items.length === 0 && (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <div className="w-14 h-14 rounded-2xl bg-white/[0.03] border border-white/8 flex items-center justify-center">
                <Bell size={22} className="text-slate-700" />
              </div>
              <p className="text-slate-500 font-medium">Bildirim yok</p>
              <p className="text-slate-600 text-sm">Yeni bildirimler burada görünecek</p>
            </div>
          )}

          {data?.items.map(n => {
            const meta = TYPE_META[n.type] ?? DEFAULT_META
            return (
              <div
                key={n.id}
                onClick={() => handleClick(n)}
                className={cn(
                  'group flex items-start gap-4 px-5 py-4 rounded-xl border cursor-pointer transition-colors',
                  n.isRead
                    ? 'bg-white/[0.02] border-white/5 hover:bg-white/5 hover:border-white/10'
                    : 'bg-yellow-400/5 border-yellow-400/20 hover:bg-yellow-400/8'
                )}
              >
                {/* İkon */}
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${meta.bg}`}>
                  <span className={meta.color}>{meta.icon}</span>
                </div>

                {/* İçerik */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start gap-2 mb-1">
                    <span className={`text-[10px] font-semibold uppercase tracking-wider ${meta.color}`}>
                      {meta.label}
                    </span>
                    {!n.isRead && (
                      <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 mt-1 shrink-0" />
                    )}
                  </div>
                  <p className="text-sm font-semibold text-slate-200">{n.title}</p>
                  <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{n.body}</p>
                  <p className="text-[10px] text-slate-600 mt-1.5 flex items-center gap-1">
                    {format(new Date(n.createdAt), 'dd MMM yyyy HH:mm', { locale: tr })}
                    <span className="opacity-50">·</span>
                    {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true, locale: tr })}
                  </p>
                </div>

                {/* Aksiyonlar */}
                <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                  <button
                    onClick={() => deleteOne.mutate(n.id)}
                    disabled={deleteOne.isPending}
                    className="p-1.5 rounded-lg text-slate-700 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Detail Modal */}
      {selected && (
        <NotificationModal
          n={selected}
          onClose={() => setSelected(null)}
          onDelete={() => deleteOne.mutate(selected.id)}
        />
      )}
    </>
  )
}
