import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { notificationsApi } from '@/api/notifications'
import { Bell, CheckCheck, Trash2 } from 'lucide-react'
import { format } from 'date-fns'
import { tr } from 'date-fns/locale'
import Header from '@/components/layout/Header'
import { cn } from '@/lib/utils'

const TYPE_LABEL: Record<number, string> = {
  0: 'Alım Sinyali', 1: 'Satış Sinyali', 2: 'Stop Loss', 3: 'Take Profit',
  4: 'Emir', 5: 'Binance Hatası', 6: 'Günlük Rapor', 7: 'Risk Uyarısı',
  8: 'Flash Crash', 9: 'Sistem',
}
const TYPE_COLOR: Record<number, string> = {
  0: 'text-emerald-400', 1: 'text-red-400', 2: 'text-orange-400', 3: 'text-blue-400',
  4: 'text-slate-300', 5: 'text-red-400', 6: 'text-yellow-400', 7: 'text-orange-400',
  8: 'text-red-500', 9: 'text-slate-400',
}

export default function NotificationsPage() {
  const qc = useQueryClient()
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
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  })

  const deleteAll = useMutation({
    mutationFn: () => notificationsApi.deleteAll(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  })

  return (
    <>
      <Header title="Bildirimler" />
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-400">
            {data?.unreadCount ?? 0} okunmamış bildirim
          </span>
          <div className="flex items-center gap-3">
            {(data?.unreadCount ?? 0) > 0 && (
              <button
                onClick={() => markAll.mutate()}
                disabled={markAll.isPending}
                className="flex items-center gap-1 text-xs text-yellow-400 hover:text-yellow-300 disabled:opacity-50 transition-colors"
              >
                <CheckCheck size={14} /> Tümünü okundu
              </button>
            )}
            {(data?.items.length ?? 0) > 0 && (
              <button
                onClick={() => { if (confirm('Tüm bildirimler silinsin mi?')) deleteAll.mutate() }}
                disabled={deleteAll.isPending}
                className="flex items-center gap-1 text-xs text-slate-500 hover:text-red-400 disabled:opacity-50 transition-colors"
              >
                <Trash2 size={13} /> Tümünü sil
              </button>
            )}
          </div>
        </div>

        <div className="space-y-2">
          {isLoading && <p className="text-slate-500 text-sm">Yükleniyor…</p>}
          {data?.items.map(n => (
            <div
              key={n.id}
              className={cn(
                'bg-white/5 border rounded-xl px-5 py-4 flex items-start gap-4 transition-colors',
                n.isRead ? 'border-white/5' : 'border-yellow-400/20 bg-yellow-400/5'
              )}
            >
              <Bell size={16} className={cn('mt-0.5 shrink-0', TYPE_COLOR[n.type] ?? 'text-slate-400')} />
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className={`text-xs font-medium ${TYPE_COLOR[n.type] ?? 'text-slate-400'}`}>
                      {TYPE_LABEL[n.type] ?? 'Bildirim'}
                    </span>
                    <p className="text-sm font-semibold text-slate-200 mt-0.5">{n.title}</p>
                    <p className="text-sm text-slate-400 mt-0.5">{n.body}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {!n.isRead && (
                      <button
                        onClick={() => markOne.mutate(n.id)}
                        disabled={markOne.isPending}
                        className="text-xs text-slate-500 hover:text-yellow-400 disabled:opacity-50 transition-colors"
                      >
                        Okundu
                      </button>
                    )}
                    <button
                      onClick={() => deleteOne.mutate(n.id)}
                      disabled={deleteOne.isPending}
                      className="text-slate-700 hover:text-red-400 disabled:opacity-50 transition-colors p-0.5"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
                <p className="text-xs text-slate-600 mt-2">
                  {format(new Date(n.createdAt), 'dd MMM yyyy HH:mm', { locale: tr })}
                </p>
              </div>
            </div>
          ))}
          {data?.items.length === 0 && !isLoading && (
            <p className="text-slate-500 text-sm text-center py-8">Bildirim bulunamadı</p>
          )}
        </div>
      </div>
    </>
  )
}
