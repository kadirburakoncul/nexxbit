import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { bistApi, type BistMomentumRow } from '@/api/bist'
import Header from '@/components/layout/Header'
import { TrendingUp, TrendingDown, Info, RefreshCw, Trophy } from 'lucide-react'
import { cn } from '@/lib/utils'

const LOOKBACKS = [
  { days: 63,  label: '3 Ay',  note: 'Ölçümde out-of-sample zayıf kaldı' },
  { days: 126, label: '6 Ay',  note: 'Ölçümde en istikrarlı pencere' },
  { days: 252, label: '12 Ay', note: 'Yavaş tepki verir, geç döner' },
]

const pct = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`

export default function BistMomentumPage() {
  const [lookback, setLookback] = useState(126)
  const [topN, setTopN] = useState(3)

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['bist-momentum', lookback, topN],
    queryFn: () => bistApi.momentum(lookback, topN),
    staleTime: 10 * 60_000,
  })

  const rows = data?.rows ?? []
  const selected = rows.filter(r => r.isSelected)

  return (
    <>
      <Header title="BIST Momentum" />
      <div className="p-3 md:p-6 max-w-4xl space-y-4">

        {/* Ne işe yarar */}
        <div className="bg-white/[0.02] border border-white/8 rounded-xl p-4">
          <div className="flex items-start gap-2.5">
            <Info size={15} className="text-sky-400 shrink-0 mt-0.5" />
            <div className="text-xs text-slate-400 leading-relaxed">
              <p className="text-slate-200 font-medium mb-1">"Hangi hisseyi tutmalı?" sorusuna cevap verir.</p>
              Sinyal stratejileri <span className="text-slate-300">giriş anını</span> ararken momentum
              <span className="text-slate-300"> seçim</span> yapar: son dönemde en çok yükselenleri tutar,
              listeden düşenleri bırakır. Dönüş noktası aramaz.
            </div>
          </div>
        </div>

        {/* Parametreler */}
        <div className="bg-white/[0.02] border border-white/8 rounded-xl p-4 space-y-4">
          <div>
            <label className="text-xs text-slate-400 block mb-2">Bakılan dönem</label>
            <div className="flex flex-wrap gap-2">
              {LOOKBACKS.map(lb => (
                <button
                  key={lb.days}
                  onClick={() => setLookback(lb.days)}
                  title={lb.note}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors',
                    lookback === lb.days
                      ? 'bg-yellow-400 text-black border-yellow-400'
                      : 'bg-white/5 text-slate-300 border-white/10 hover:border-white/25'
                  )}
                >
                  {lb.label}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-slate-600 mt-1.5">
              {LOOKBACKS.find(l => l.days === lookback)?.note}
            </p>
          </div>

          <div>
            <label className="text-xs text-slate-400 block mb-2">Kaç hisse tutulsun</label>
            <div className="flex gap-2">
              {[3, 5, 8].map(n => (
                <button
                  key={n}
                  onClick={() => setTopN(n)}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors',
                    topN === n
                      ? 'bg-yellow-400 text-black border-yellow-400'
                      : 'bg-white/5 text-slate-300 border-white/10 hover:border-white/25'
                  )}
                >
                  İlk {n}
                </button>
              ))}
              <button
                onClick={() => refetch()}
                disabled={isFetching}
                className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10 disabled:opacity-40"
              >
                <RefreshCw size={12} className={isFetching ? 'animate-spin' : ''} />
                Yenile
              </button>
            </div>
            <p className="text-[11px] text-slate-600 mt-1.5">
              Az hisse = yüksek getiri potansiyeli ama düşük çeşitlendirme.
            </p>
          </div>
        </div>

        {/* Seçilenler özeti */}
        {selected.length > 0 && (
          <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Trophy size={14} className="text-emerald-400" />
              <p className="text-sm font-semibold text-emerald-300">
                Şu an en güçlü {selected.length} hisse
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {selected.map(r => (
                <span key={r.stockId} className="px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/25 text-xs">
                  <span className="font-semibold text-emerald-200">{r.symbol}</span>
                  <span className="text-emerald-400/80 ml-1.5 tabular-nums">{pct(r.lookbackChangePct)}</span>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Sıralama */}
        <div className="bg-white/[0.02] border border-white/8 rounded-xl overflow-hidden">
          {isLoading ? (
            <div className="p-8 text-center text-sm text-slate-500">Hesaplanıyor…</div>
          ) : rows.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">Veri alınamadı.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[11px] uppercase tracking-wider text-slate-500 border-b border-white/8">
                    <th className="text-left  font-medium px-3 py-2.5">#</th>
                    <th className="text-left  font-medium px-3 py-2.5">Hisse</th>
                    <th className="text-right font-medium px-3 py-2.5">Fiyat</th>
                    <th className="text-right font-medium px-3 py-2.5">Dönem</th>
                    <th className="text-right font-medium px-3 py-2.5">Son 1 Ay</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(r => <Row key={r.stockId} r={r} />)}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Uyarı */}
        <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4 text-xs text-slate-400 leading-relaxed space-y-2">
          <p className="text-amber-300 font-medium">Bilinmesi gerekenler</p>
          <ul className="space-y-1.5 list-disc list-inside">
            <li><span className="text-slate-300">Dönüş noktalarında sert kayıp:</span> piyasa tepeden dönerken en çok yükselenler en sert düşer — momentum tam o an onları tutuyor olur.</li>
            <li><span className="text-slate-300">Geç girer:</span> tanımı gereği hareket başladıktan sonra girer.</li>
            <li><span className="text-slate-300">Yoğunlaşma riski:</span> 3 hisse tutmak düşük çeşitlendirme demektir.</li>
            <li><span className="text-slate-300">Ölçüm kısıtı:</span> 19 hisse × 2 yıllık testte sonuç büyük ölçüde tek bir hissenin (ASELS) uzun süre listede kalmasından geldi. Az sayıda hisseyle yapılan ölçüm kesin sonuç değildir.</li>
          </ul>
          <p className="text-slate-500 pt-1">
            Bu sayfa bilgi amaçlıdır, yatırım tavsiyesi değildir. BIST modülü emir göndermez.
          </p>
        </div>
      </div>
    </>
  )
}

function Row({ r }: { r: BistMomentumRow }) {
  const up = r.lookbackChangePct >= 0
  const recentUp = r.recentChangePct >= 0
  return (
    <tr className={cn(
      'border-b border-white/5 last:border-0',
      r.isSelected ? 'bg-emerald-500/[0.06]' : 'hover:bg-white/[0.02]'
    )}>
      <td className="px-3 py-2.5">
        <span className={cn(
          'inline-flex items-center justify-center w-6 h-6 rounded-md text-[11px] font-semibold',
          r.isSelected ? 'bg-emerald-500/20 text-emerald-300' : 'text-slate-600'
        )}>
          {r.rank}
        </span>
      </td>
      <td className="px-3 py-2.5">
        <div className="font-medium text-slate-200">{r.symbol}</div>
        <div className="text-[11px] text-slate-600 truncate max-w-[160px]">{r.displayName}</div>
      </td>
      <td className="px-3 py-2.5 text-right tabular-nums text-slate-300">{r.lastPrice.toFixed(2)}</td>
      <td className={cn('px-3 py-2.5 text-right tabular-nums font-semibold',
        up ? 'text-emerald-400' : 'text-red-400')}>
        <span className="inline-flex items-center gap-1 justify-end">
          {up ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
          {pct(r.lookbackChangePct)}
        </span>
      </td>
      <td className={cn('px-3 py-2.5 text-right tabular-nums text-xs',
        recentUp ? 'text-emerald-400/70' : 'text-red-400/70')}>
        {pct(r.recentChangePct)}
      </td>
    </tr>
  )
}
