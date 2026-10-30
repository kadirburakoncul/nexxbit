import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import Header from '@/components/layout/Header'
import { client } from '@/api/client'
import {
  marketDataApi,
  type MarketSymbol,
  type MarketDataExport,
  type IndicatorOptimization,
  type OptimizationCandidate,
} from '@/api/marketData'
import { cn } from '@/lib/utils'
import {
  Download, Database, Search, Check, X, Trash2, Loader2,
  FlaskConical, AlertTriangle, Info, TrendingUp, Clock, CheckCircle2,
} from 'lucide-react'

// ─── yardımcılar ──────────────────────────────────────────────────────────────
const fmtVol = (v: number) =>
  v >= 1e9 ? `${(v / 1e9).toFixed(1)}B` :
  v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` :
  v >= 1e3 ? `${(v / 1e3).toFixed(0)}K` : v.toFixed(0)

const fmtBytes = (b: number) =>
  b >= 1e9 ? `${(b / 1e9).toFixed(2)} GB` :
  b >= 1e6 ? `${(b / 1e6).toFixed(1)} MB` :
  b >= 1e3 ? `${(b / 1e3).toFixed(0)} KB` : `${b} B`

const fmtDuration = (s: number) =>
  s >= 3600 ? `${Math.round(s / 3600)} saat` :
  s >= 60 ? `${Math.round(s / 60)} dakika` : `${s} saniye`

const pct = (n: number | null | undefined) =>
  typeof n === 'number' && Number.isFinite(n)
    ? `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`
    : '—'

/** Eksik/bozuk alan tüm sayfayı çökertmesin diye sayısal okumalar korunur. */
const num = (n: number | null | undefined, digits = 0) =>
  typeof n === 'number' && Number.isFinite(n) ? n.toFixed(digits) : '—'

const isoDate = (d: Date) => d.toISOString().slice(0, 10)

const inputCls =
  'w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-100 ' +
  'focus:outline-none focus:border-yellow-400/50'

type Tab = 'data' | 'optimizer'

export default function MarketDataPage() {
  const [tab, setTab] = useState<Tab>('data')

  return (
    <>
      <Header title="Veri & İndikatör Laboratuvarı" />
      <div className="p-3 md:p-6 max-w-6xl space-y-4">

        <div className="flex gap-1 bg-white/5 rounded-xl p-1 w-fit">
          {([['data', 'Veri İndir', Database], ['optimizer', 'İndikatör Ara', FlaskConical]] as const)
            .map(([key, label, Icon]) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                  tab === key ? 'bg-yellow-400 text-black' : 'text-slate-400 hover:text-slate-200'
                )}
              >
                <Icon size={14} />
                {label}
              </button>
            ))}
        </div>

        {tab === 'data' ? <DataTab /> : <OptimizerTab />}
      </div>
    </>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// Coin seçici — hacme göre sıralı, arama + toplu seçim
// ═══════════════════════════════════════════════════════════════════════════

function SymbolPicker({
  symbols, selected, onChange, max,
}: {
  symbols: MarketSymbol[]
  selected: Set<string>
  onChange: (next: Set<string>) => void
  max: number
}) {
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    const q = search.trim().toUpperCase()
    return q ? symbols.filter(s => s.symbol.includes(q)) : symbols
  }, [symbols, search])

  const toggle = (sym: string) => {
    const next = new Set(selected)
    if (next.has(sym)) next.delete(sym)
    else {
      if (next.size >= max) { toast.error(`En fazla ${max} coin seçebilirsiniz.`); return }
      next.add(sym)
    }
    onChange(next)
  }

  const selectTop = (n: number) => onChange(new Set(filtered.slice(0, n).map(s => s.symbol)))

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Coin ara (BTC, ETH…)"
            className={cn(inputCls, 'pl-8')}
          />
        </div>
        {[10, 25, 50].filter(n => n <= max).map(n => (
          <button key={n} onClick={() => selectTop(n)}
            className="px-2.5 py-2 rounded-lg text-xs bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10 whitespace-nowrap">
            İlk {n}
          </button>
        ))}
        <button onClick={() => onChange(new Set())}
          className="px-2.5 py-2 rounded-lg text-xs bg-white/5 border border-white/10 text-slate-400 hover:text-red-300">
          Temizle
        </button>
      </div>

      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-500">
          {symbols.length} parite · hacme göre sıralı
        </span>
        <span className={cn('font-medium', selected.size > 0 ? 'text-yellow-400' : 'text-slate-600')}>
          {selected.size} / {max} seçili
        </span>
      </div>

      <div className="border border-white/8 rounded-xl overflow-hidden">
        <div className="max-h-72 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-[#13151c]">
              <tr className="text-[11px] uppercase tracking-wider text-slate-500 border-b border-white/8">
                <th className="w-8 px-2 py-2" />
                <th className="text-left  font-medium px-2 py-2">Coin</th>
                <th className="text-right font-medium px-2 py-2">Fiyat</th>
                <th className="text-right font-medium px-2 py-2">24s %</th>
                <th className="text-right font-medium px-2 py-2">24s Hacim</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 300).map(s => {
                const on = selected.has(s.symbol)
                return (
                  <tr key={s.symbol}
                    onClick={() => toggle(s.symbol)}
                    className={cn('cursor-pointer border-b border-white/5 last:border-0',
                      on ? 'bg-yellow-400/10' : 'hover:bg-white/[0.03]')}>
                    <td className="px-2 py-1.5">
                      <div className={cn('w-4 h-4 rounded border flex items-center justify-center',
                        on ? 'bg-yellow-400 border-yellow-400' : 'border-white/20')}>
                        {on && <Check size={11} className="text-black" />}
                      </div>
                    </td>
                    <td className="px-2 py-1.5 font-medium text-slate-200">{s.baseAsset}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums text-slate-400">
                      {s.lastPrice < 1 ? s.lastPrice.toFixed(6) : s.lastPrice.toFixed(2)}
                    </td>
                    <td className={cn('px-2 py-1.5 text-right tabular-nums',
                      s.priceChangePercent >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                      {pct(s.priceChangePercent)}
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums text-slate-400">
                      {fmtVol(s.quoteVolume24h)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
      {filtered.length > 300 && (
        <p className="text-[11px] text-slate-600">
          İlk 300 sonuç gösteriliyor — aramayı daraltın.
        </p>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// Sekme 1 — Veri indirme
// ═══════════════════════════════════════════════════════════════════════════

function DataTab() {
  const qc = useQueryClient()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [timeframe, setTimeframe] = useState('1h')
  const [name, setName] = useState('')
  const [format, setFormat] = useState('csv')
  const [withIndicators, setWithIndicators] = useState(true)
  const [start, setStart] = useState(isoDate(new Date(Date.now() - 90 * 864e5)))
  const [end, setEnd] = useState(isoDate(new Date()))

  const { data: symbols = [], isLoading: loadingSymbols } = useQuery({
    queryKey: ['market-symbols'], queryFn: marketDataApi.symbols, staleTime: 10 * 60_000,
  })
  const { data: timeframes = [] } = useQuery({
    queryKey: ['market-timeframes'], queryFn: marketDataApi.timeframes, staleTime: Infinity,
  })
  const { data: exports = [] } = useQuery({
    queryKey: ['market-exports'],
    queryFn: marketDataApi.exports,
    refetchInterval: q => {
      const rows = q.state.data as MarketDataExport[] | undefined
      return rows?.some(e => e.status === 'Running' || e.status === 'Pending') ? 3000 : 30000
    },
  })

  const { data: estimate } = useQuery({
    queryKey: ['market-estimate', selected.size, timeframe, start, end],
    queryFn: () => marketDataApi.estimate(selected.size, timeframe, start, end),
    enabled: selected.size > 0,
  })

  const create = useMutation({
    mutationFn: () => marketDataApi.createExport({
      name: name || undefined, symbols: [...selected], timeframe,
      startDate: start, endDate: end, format, includeIndicators: withIndicators,
    }),
    onSuccess: () => {
      toast.success('Veri çekme başladı — arka planda devam ediyor.')
      qc.invalidateQueries({ queryKey: ['market-exports'] })
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.errors?.[0] ?? 'İşlem başlatılamadı.'),
  })

  const remove = useMutation({
    mutationFn: (id: string) => marketDataApi.deleteExport(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['market-exports'] }),
  })

  const download = async (e: MarketDataExport) => {
    try {
      const res = await client.get(marketDataApi.downloadUrl(e.id), { responseType: 'blob' })
      const url = URL.createObjectURL(res.data)
      const a = document.createElement('a')
      a.href = url
      a.download = `${e.name}_${e.timeframe}.${e.format}`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      toast.error('Dosya indirilemedi.')
    }
  }

  return (
    <div className="space-y-4">
      <div className="bg-white/[0.02] border border-white/8 rounded-xl p-4 space-y-4">
        <p className="text-sm font-semibold text-slate-200">1 · Coin seçin</p>
        {loadingSymbols
          ? <p className="text-sm text-slate-500 py-6 text-center">Binance paritesi yükleniyor…</p>
          : <SymbolPicker symbols={symbols} selected={selected} onChange={setSelected} max={150} />}
      </div>

      <div className="bg-white/[0.02] border border-white/8 rounded-xl p-4 space-y-4">
        <p className="text-sm font-semibold text-slate-200">2 · Periyot ve tarih aralığı</p>

        <div className="flex flex-wrap gap-2">
          {timeframes.map(tf => (
            <button key={tf.key} onClick={() => setTimeframe(tf.key)} title={tf.sourceNote}
              className={cn('px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors',
                timeframe === tf.key
                  ? 'bg-yellow-400 text-black border-yellow-400'
                  : 'bg-white/5 text-slate-300 border-white/10 hover:border-white/25')}>
              {tf.displayName}
              {tf.isDerived && <span className="ml-1 opacity-60">*</span>}
            </button>
          ))}
        </div>
        {timeframes.find(t => t.key === timeframe)?.isDerived && (
          <p className="text-[11px] text-amber-400/80 flex items-start gap-1.5">
            <Info size={12} className="mt-0.5 shrink-0" />
            Binance bu periyodu doğrudan vermiyor —
            {' '}{timeframes.find(t => t.key === timeframe)?.sourceNote}. Barlar gün başına hizalanır.
          </p>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="text-xs text-slate-400 block mb-1">Başlangıç</label>
            <input type="date" value={start} max={end} onChange={e => setStart(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="text-xs text-slate-400 block mb-1">Bitiş</label>
            <input type="date" value={end} min={start} max={isoDate(new Date())}
              onChange={e => setEnd(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="text-xs text-slate-400 block mb-1">Dosya adı</label>
            <input value={name} onChange={e => setName(e.target.value)}
              placeholder="otomatik" className={inputCls} />
          </div>
        </div>

        <div className="flex flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">Biçim:</span>
            {['csv', 'json'].map(f => (
              <button key={f} onClick={() => setFormat(f)}
                className={cn('px-2.5 py-1 rounded-md text-xs border',
                  format === f ? 'bg-white/10 border-white/25 text-slate-100'
                               : 'bg-white/5 border-white/10 text-slate-400')}>
                {f.toUpperCase()}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={withIndicators}
              onChange={e => setWithIndicators(e.target.checked)}
              className="accent-yellow-400" />
            <span className="text-xs text-slate-300">Hesaplanmış kolonları ekle</span>
          </label>
        </div>
        {withIndicators && (
          <p className="text-[11px] text-slate-600 leading-relaxed">
            OHLCV'ye ek olarak: getiri, mum gövdesi, EMA20/50/200, RSI14, ATR, MACD, ADX/+DI/−DI,
            T3, hacim oranı ve <span className="text-slate-400">ileriye dönük getiriler</span>{' '}
            (1/5/10 bar sonrası). Sonuncular, bir kuralın işe yarayıp yaramadığını ölçerken
            hedef değişken olarak kullanılır.
          </p>
        )}
      </div>

      {estimate && (
        <div className={cn('border rounded-xl p-4',
          estimate.exceedsLimits ? 'bg-red-500/5 border-red-500/25' : 'bg-sky-500/5 border-sky-500/20')}>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            {[
              ['Satır', estimate.estimatedTotalBars.toLocaleString('tr-TR')],
              ['Dosya', fmtBytes(estimate.estimatedFileSizeBytes)],
              ['API isteği', estimate.estimatedApiRequests.toLocaleString('tr-TR')],
              ['Süre', fmtDuration(estimate.estimatedSeconds)],
            ].map(([label, value]) => (
              <div key={label}>
                <p className="text-[11px] text-slate-500 uppercase tracking-wider">{label}</p>
                <p className="text-sm font-semibold text-slate-200 tabular-nums">{value}</p>
              </div>
            ))}
          </div>
          {estimate.warning && (
            <p className={cn('text-xs mt-3 flex items-start gap-1.5',
              estimate.exceedsLimits ? 'text-red-300' : 'text-amber-300')}>
              <AlertTriangle size={12} className="mt-0.5 shrink-0" />
              {estimate.warning}
            </p>
          )}
        </div>
      )}

      <button
        onClick={() => create.mutate()}
        disabled={selected.size === 0 || create.isPending || estimate?.exceedsLimits}
        className="w-full sm:w-auto flex items-center justify-center gap-2 bg-yellow-400 hover:bg-yellow-300
                   disabled:opacity-40 disabled:cursor-not-allowed text-black font-semibold
                   px-6 py-2.5 rounded-xl text-sm transition-colors">
        {create.isPending ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
        Veriyi Çek
      </button>

      <div className="space-y-2">
        <p className="text-sm font-semibold text-slate-200">Dosyalarım</p>
        {exports.length === 0
          ? <p className="text-sm text-slate-600 py-4">Henüz veri çekilmedi.</p>
          : exports.map(e => <ExportRow key={e.id} e={e} onDownload={download} onDelete={id => remove.mutate(id)} />)}
      </div>
    </div>
  )
}

function StatusBadge({ status, progress }: { status: string; progress: number }) {
  const map: Record<string, { cls: string; label: string }> = {
    Pending:   { cls: 'bg-slate-500/15 text-slate-300',   label: 'Sırada' },
    Running:   { cls: 'bg-sky-500/15 text-sky-300',       label: `Çalışıyor %${progress}` },
    Completed: { cls: 'bg-emerald-500/15 text-emerald-300', label: 'Hazır' },
    Failed:    { cls: 'bg-red-500/15 text-red-300',       label: 'Hata' },
    Cancelled: { cls: 'bg-amber-500/15 text-amber-300',   label: 'İptal' },
  }
  const s = map[status] ?? map.Pending
  return <span className={cn('text-[11px] px-2 py-0.5 rounded-full font-medium', s.cls)}>{s.label}</span>
}

function ExportRow({ e, onDownload, onDelete }: {
  e: MarketDataExport
  onDownload: (e: MarketDataExport) => void
  onDelete: (id: string) => void
}) {
  const running = e.status === 'Running' || e.status === 'Pending'
  return (
    <div className="bg-white/[0.02] border border-white/8 rounded-xl p-3">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-slate-200">{e.name}</span>
            <StatusBadge status={e.status} progress={e.progressPct} />
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">
            {e.symbolCount} coin · {e.timeframe} · {e.startDate.slice(0, 10)} → {e.endDate.slice(0, 10)}
            {e.totalRows > 0 && ` · ${e.totalRows.toLocaleString('tr-TR')} satır`}
            {e.fileSizeBytes ? ` · ${fmtBytes(e.fileSizeBytes)}` : ''}
          </p>
          {running && (
            <div className="mt-2 h-1 bg-white/10 rounded-full overflow-hidden">
              <div className="h-full bg-sky-400 transition-all"
                style={{ width: `${e.progressPct}%` }} />
            </div>
          )}
          {e.errorMessage && <p className="text-[11px] text-red-400 mt-1">{e.errorMessage}</p>}
          {e.dataQualityNote && e.status === 'Completed' && (
            <p className="text-[11px] text-slate-600 mt-1 line-clamp-2" title={e.dataQualityNote}>
              {e.dataQualityNote}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {e.status === 'Completed' && (
            <button onClick={() => onDownload(e)} title="İndir"
              className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-emerald-400">
              <Download size={14} />
            </button>
          )}
          <button onClick={() => onDelete(e.id)} title="Sil"
            className="p-2 rounded-lg bg-white/5 hover:bg-red-500/15 text-slate-500 hover:text-red-400">
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// Sekme 2 — İndikatör arama
// ═══════════════════════════════════════════════════════════════════════════

type FamilyInfo = { rule: string; scans: string; combos: string }

const FAMILY_INFO: Record<string, FamilyInfo> = {
  AUTO: {
    rule: 'Hiçbir hazır indikatör KULLANILMAZ. Elde yalnızca ham mum alanları (açılış/yüksek/düşük/kapanış/hacim) ve genel işlemler (ortalama, en yüksek, en düşük, sapma, gecikme, değişim, dört işlem) vardır. Sistem bunları birleştirerek kendi formülünü kurar.',
    scans: 'formül ağaçları evrimleşir — 180 birey × 18 nesil, çaprazlama ve mutasyonla. Eşik, formülün kendi dağılımındaki yüzdelik.',
    combos: 'veri ÜÇE bölünür: eğitim (evrim) · doğrulama (seçim) · test (evrime hiç girmez)',
  },
  KURAL: {
    rule: 'Hazır indikatörleri YAPI TAŞI olarak kullanır: RSI, ADX, yön, MACD, EMA uzaklıkları, hacim, oynaklık… Bunlardan "şu koşulların TAMAMI sağlanırsa pozisyonda kal" biçiminde kural kurar.',
    scans: 'binlerce aday kural — 1 ila 3 koşullu kombinasyonlar, eşikler verinin kendi dağılımından',
    combos: 'veri ÜÇE bölünür: eğitim (arama) · doğrulama (seçim) · test (seçime hiç karışmaz)',
  },
  T3: {
    rule: 'T3 (yumuşatılmış ortalama) üst üste N bar YUKARI dönünce AL, N bar AŞAĞI dönünce SAT.',
    scans: 'period (3–18), faktör (0.3–0.9), kaç bar onay isteneceği (1–3)',
    combos: '72 kombinasyon',
  },
  EMA: {
    rule: 'Hızlı EMA, yavaş EMA çizgisini YUKARI keserse AL; aşağı keserse SAT. Klasik trend takibi.',
    scans: 'hızlı periyot (5–26), yavaş periyot (21–200)',
    combos: '19 kombinasyon',
  },
  RSI: {
    rule: 'RSI al seviyesini YUKARI geçerse AL; sat seviyesini AŞAĞI geçerse SAT.',
    scans: 'periyot (7/14/21), al seviyesi (30–55), sat seviyesi (60–80)',
    combos: '48 kombinasyon',
  },
  MACD: {
    rule: 'MACD histogramı sıfırın ÜSTÜNE çıkınca AL, ALTINA inince SAT.',
    scans: 'hızlı (8–16), yavaş (21–34), sinyal (7–12)',
    combos: '21 kombinasyon',
  },
  ADX: {
    rule: 'ADX eşiğin üstünde VE +DI > −DI ise AL (güçlü yukarı trend); değilse SAT.',
    scans: 'periyot (10/14/20), trend gücü eşiği (15–30)',
    combos: '12 kombinasyon',
  },
}

function OptimizerTab() {
  const qc = useQueryClient()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [timeframe, setTimeframe] = useState('4h')
  const [family, setFamily] = useState('T3')
  const [commission, setCommission] = useState(0.2)
  const [start, setStart] = useState(isoDate(new Date(Date.now() - 365 * 864e5)))
  const [end, setEnd] = useState(isoDate(new Date()))
  const [openId, setOpenId] = useState<string | null>(null)

  const { data: symbols = [] } = useQuery({
    queryKey: ['market-symbols'], queryFn: marketDataApi.symbols, staleTime: 10 * 60_000,
  })
  const { data: timeframes = [] } = useQuery({
    queryKey: ['market-timeframes'], queryFn: marketDataApi.timeframes, staleTime: Infinity,
  })
  const { data: families = [] } = useQuery({
    queryKey: ['optimizer-families'], queryFn: marketDataApi.families, staleTime: Infinity,
  })
  const { data: runs = [] } = useQuery({
    queryKey: ['optimizations'],
    queryFn: marketDataApi.optimizations,
    refetchInterval: q => {
      const rows = q.state.data as IndicatorOptimization[] | undefined
      return rows?.some(r => r.status === 'Running' || r.status === 'Pending') ? 3000 : 30000
    },
  })

  const create = useMutation({
    mutationFn: () => marketDataApi.createOptimization({
      symbols: [...selected], timeframe, startDate: start, endDate: end,
      family, commissionPct: commission,
    }),
    onSuccess: () => {
      toast.success('Tarama başladı.')
      qc.invalidateQueries({ queryKey: ['optimizations'] })
    },
    onError: (e: any) => toast.error(e?.response?.data?.errors?.[0] ?? 'Tarama başlatılamadı.'),
  })

  const remove = useMutation({
    mutationFn: (id: string) => marketDataApi.deleteOptimization(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['optimizations'] }),
  })

  return (
    <div className="space-y-4">
      <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4">
        <div className="flex items-start gap-2.5">
          <AlertTriangle size={15} className="text-amber-400 shrink-0 mt-0.5" />
          <div className="text-xs text-slate-400 leading-relaxed space-y-1.5">
            <p className="text-amber-300 font-medium">Bu araç "kazandıran ayarı" garanti etmez.</p>
            <p>
              Yeterince kombinasyon denenirse, tamamen rastgele bir kural bile geçmişte iyi
              görünen bir ayar üretir. Bu yüzden her sonuç{' '}
              <span className="text-slate-300">zaman olarak ikiye bölünüp ayrı ölçülür</span> ve{' '}
              <span className="text-slate-300">coini alıp tutmakla karşılaştırılır</span>.
              Sıralama ham getiriye göre değil, al-tut'a üstünlüğe göre yapılır.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white/[0.02] border border-white/8 rounded-xl p-4 space-y-4">
        <p className="text-sm font-semibold text-slate-200">1 · Test edilecek coinler</p>
        <SymbolPicker symbols={symbols} selected={selected} onChange={setSelected} max={30} />
        <p className="text-[11px] text-slate-600">
          Her coin, her kombinasyonda yeniden test edilir — bu yüzden üst sınır 30.
          Az sayıda coinle çıkan sonuç o coinlere özel olabilir; 10–20 arası makul bir denge.
        </p>
      </div>

      <div className="bg-white/[0.02] border border-white/8 rounded-xl p-4 space-y-4">
        <p className="text-sm font-semibold text-slate-200">2 · Arama ayarları</p>

        <div>
          <label className="text-xs text-slate-400 block mb-1">İndikatör ailesi</label>
          <p className="text-[11px] text-slate-600 mb-2 leading-relaxed">
            Hangi <span className="text-slate-400">al-sat kuralının</span> taranacağını seçer.
            Her aile farklı bir mantıkla alım/satım kararı verir; bu araç o kuralın
            <span className="text-slate-400"> en iyi ayarlarını</span> arar — kuralın kendisini değiştirmez.
          </p>
          <div className="flex flex-wrap gap-2">
            {families.map(f => (
              <button key={f} onClick={() => setFamily(f)}
                className={cn('px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors',
                  family === f ? 'bg-yellow-400 text-black border-yellow-400'
                               : 'bg-white/5 text-slate-300 border-white/10 hover:border-white/25',
                  f === 'AUTO' && family !== f && 'border-violet-500/40 text-violet-300',
                  f === 'KURAL' && family !== f && 'border-sky-500/40 text-sky-300')}>
                {f === 'AUTO' ? '✨ Sıfırdan Formül Üret'
                  : f === 'KURAL' ? '🧩 İndikatörlerden Kural Kur'
                  : f}
              </button>
            ))}
          </div>

          {FAMILY_INFO[family] && (
            <div className="mt-2.5 bg-white/[0.03] border border-white/8 rounded-lg p-3 space-y-1.5">
              <div className="flex gap-2">
                <span className="text-[11px] text-slate-500 w-20 shrink-0">Kural</span>
                <span className="text-[11px] text-slate-300 flex-1">{FAMILY_INFO[family].rule}</span>
              </div>
              <div className="flex gap-2">
                <span className="text-[11px] text-slate-500 w-20 shrink-0">Taranan</span>
                <span className="text-[11px] text-slate-400 flex-1">{FAMILY_INFO[family].scans}</span>
              </div>
              <div className="flex gap-2">
                <span className="text-[11px] text-slate-500 w-20 shrink-0">Deneme</span>
                <span className="text-[11px] text-slate-400 flex-1">
                  {FAMILY_INFO[family].combos}
                  <span className="text-slate-600"> — her biri seçtiğiniz tüm coinlerde ayrı test edilir</span>
                </span>
              </div>
            </div>
          )}
        </div>

        <div>
          <label className="text-xs text-slate-400 block mb-2">Periyot</label>
          <div className="flex flex-wrap gap-2">
            {timeframes.map(tf => (
              <button key={tf.key} onClick={() => setTimeframe(tf.key)}
                className={cn('px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors',
                  timeframe === tf.key ? 'bg-yellow-400 text-black border-yellow-400'
                                       : 'bg-white/5 text-slate-300 border-white/10 hover:border-white/25')}>
                {tf.displayName}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="text-xs text-slate-400 block mb-1">Başlangıç</label>
            <input type="date" value={start} max={end} onChange={e => setStart(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="text-xs text-slate-400 block mb-1">Bitiş</label>
            <input type="date" value={end} min={start} max={isoDate(new Date())}
              onChange={e => setEnd(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="text-xs text-slate-400 block mb-1">Komisyon (gidiş-dönüş %)</label>
            <input type="number" step="0.05" min="0" max="5" value={commission}
              onChange={e => setCommission(Number(e.target.value))} className={inputCls} />
          </div>
        </div>
        <p className="text-[11px] text-slate-600">
          Binance spot %0.1 alış + %0.1 satış = %0.2. Komisyonu sıfırlamak sonuçları
          gerçekte oluşmayacak kadar iyi gösterir.
        </p>
      </div>

      <button
        onClick={() => create.mutate()}
        disabled={selected.size === 0 || create.isPending}
        className="w-full sm:w-auto flex items-center justify-center gap-2 bg-yellow-400 hover:bg-yellow-300
                   disabled:opacity-40 text-black font-semibold px-6 py-2.5 rounded-xl text-sm transition-colors">
        {create.isPending ? <Loader2 size={15} className="animate-spin" /> : <FlaskConical size={15} />}
        Taramayı Başlat
      </button>

      <div className="space-y-2">
        <p className="text-sm font-semibold text-slate-200">Taramalarım</p>
        {runs.length === 0
          ? <p className="text-sm text-slate-600 py-4">Henüz tarama yapılmadı.</p>
          : runs.map(r => (
              <OptimizationRow key={r.id} run={r}
                open={openId === r.id}
                onToggle={() => setOpenId(openId === r.id ? null : r.id)}
                onDelete={() => remove.mutate(r.id)} />
            ))}
      </div>
    </div>
  )
}

function OptimizationRow({ run, open, onToggle, onDelete }: {
  run: IndicatorOptimization; open: boolean; onToggle: () => void; onDelete: () => void
}) {
  const qc = useQueryClient()
  const running = run.status === 'Running' || run.status === 'Pending'

  const { data } = useQuery({
    queryKey: ['optimization', run.id],
    queryFn: () => marketDataApi.optimization(run.id),
    enabled: open && run.status === 'Completed',
  })

  const apply = useMutation({
    mutationFn: (v: { params?: Record<string, number>; ruleJson?: string | null }) =>
      marketDataApi.applyIndicator(run.id, v.params, v.ruleJson),
    onSuccess: r => {
      toast.success(r.message)
      qc.invalidateQueries({ queryKey: ['indicators'] })
    },
    onError: (e: any) => toast.error(e?.response?.data?.errors?.[0] ?? 'Uygulanamadı.'),
  })

  const isDiscovery = run.family === 'AUTO' || run.family === 'KURAL'
  const edge = run.bestReturnPct != null && run.buyHoldReturnPct != null
    ? run.bestReturnPct - run.buyHoldReturnPct : null

  return (
    <div className="bg-white/[0.02] border border-white/8 rounded-xl overflow-hidden">
      <div className="p-3 flex items-start gap-3">
        <button onClick={onToggle} className="flex-1 min-w-0 text-left">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-slate-200">{run.name}</span>
            <StatusBadge status={run.status} progress={run.progressPct} />
            {run.status === 'Completed' && edge != null && (
              <span className={cn('text-[11px] px-2 py-0.5 rounded-full font-medium',
                edge > 0 ? 'bg-emerald-500/15 text-emerald-300' : 'bg-red-500/15 text-red-300')}>
                al-tut'a göre {pct(edge)}
              </span>
            )}
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">
            {run.family} · {run.symbols.length} coin · {run.timeframe} ·{' '}
            {run.startDate.slice(0, 10)} → {run.endDate.slice(0, 10)}
            {run.testedCombinations > 0 && ` · ${run.testedCombinations} kombinasyon`}
          </p>
          {running && (
            <div className="mt-2 h-1 bg-white/10 rounded-full overflow-hidden">
              <div className="h-full bg-sky-400 transition-all" style={{ width: `${run.progressPct}%` }} />
            </div>
          )}
          {run.errorMessage && <p className="text-[11px] text-red-400 mt-1">{run.errorMessage}</p>}
        </button>
        <button onClick={onDelete} title="Sil"
          className="p-2 rounded-lg bg-white/5 hover:bg-red-500/15 text-slate-500 hover:text-red-400 shrink-0">
          <Trash2 size={14} />
        </button>
      </div>

      {open && run.status === 'Completed' && (
        <div className="border-t border-white/8 p-3 space-y-3">
          {run.verdict && (
            <div className={cn('rounded-lg p-3 text-xs leading-relaxed',
              run.verdict.startsWith('UMUT') ? 'bg-emerald-500/8 text-emerald-200'
                : run.verdict.startsWith('KULLANMAYIN') ? 'bg-red-500/8 text-red-200'
                : 'bg-amber-500/8 text-amber-200')}>
              {run.verdict}
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {[
              ['Strateji', pct(run.bestReturnPct), 'text-slate-200'],
              ['Al-tut', pct(run.buyHoldReturnPct), 'text-slate-400'],
              [isDiscovery ? 'Doğrulama' : 'İlk dönem', pct(run.inSampleReturnPct), 'text-slate-300'],
              [isDiscovery ? 'Test seti' : 'İkinci dönem', pct(run.outOfSampleReturnPct),
                (run.outOfSampleReturnPct ?? 0) > 0 ? 'text-emerald-400' : 'text-red-400'],
              ['İşlem', run.bestTradeCount?.toString() ?? '—', 'text-slate-400'],
            ].map(([l, v, c]) => (
              <div key={l} className="bg-white/[0.03] rounded-lg p-2 text-center">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider">{l}</p>
                <p className={cn('text-sm font-semibold tabular-nums', c)}>{v}</p>
              </div>
            ))}
          </div>

          {data?.results && data.results.length > 0 && (
            <ResultsTable
              results={data.results}
              onApply={(p, rule) => apply.mutate({ params: p, ruleJson: rule })}
              applying={apply.isPending}
              isAuto={run.family === 'AUTO'}
              isRule={run.family === 'KURAL'}
            />
          )}
        </div>
      )}
    </div>
  )
}

function ResultsTable({ results, onApply, applying, isAuto, isRule }: {
  results: OptimizationCandidate[]
  onApply: (params: Record<string, number>, ruleJson?: string | null) => void
  applying: boolean
  isAuto: boolean
  isRule: boolean
}) {
  return (
    <div>
      <p className="text-xs text-slate-400 mb-2">
        {isAuto || isRule
          ? 'Keşfedilen en iyi 10 formül (doğrulama setindeki üstünlüğe göre sıralı)'
          : "En iyi 10 kombinasyon (al-tut'a üstünlüğe göre)"}
      </p>
      <div className="overflow-x-auto border border-white/8 rounded-lg">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-[10px] uppercase tracking-wider text-slate-500 border-b border-white/8">
              <th className="text-left  font-medium px-2 py-2">
                {isAuto ? 'Keşfedilen formül' : isRule ? 'Keşfedilen kural' : 'Parametre'}
              </th>
              <th className="text-right font-medium px-2 py-2">Üstünlük</th>
              <th className="text-right font-medium px-2 py-2">Getiri</th>
              <th className="text-right font-medium px-2 py-2">{isAuto || isRule ? 'Test seti' : '2. dönem'}</th>
              <th className="text-right font-medium px-2 py-2">Kazanma</th>
              <th className="text-right font-medium px-2 py-2">İşlem</th>
              <th className="text-right font-medium px-2 py-2">Coin</th>
              <th className="px-2 py-2" />
            </tr>
          </thead>
          <tbody>
            {results.slice(0, 10).map((r, i) => (
              <tr key={i} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02]">
                <td className={cn('px-2 py-1.5 text-slate-300',
                  isAuto || isRule ? 'min-w-[280px] leading-relaxed' : 'whitespace-nowrap')}>
                  {r.paramsLabel ?? '—'}
                </td>
                <td className={cn('px-2 py-1.5 text-right tabular-nums font-semibold',
                  (r.edgePct ?? 0) > 0 ? 'text-emerald-400' : 'text-red-400')}>{pct(r.edgePct)}</td>
                <td className="px-2 py-1.5 text-right tabular-nums text-slate-400">{pct(r.returnPct)}</td>
                <td className={cn('px-2 py-1.5 text-right tabular-nums',
                  (r.outOfSamplePct ?? 0) > 0 ? 'text-emerald-400/80' : 'text-red-400/80')}>
                  {pct(r.outOfSamplePct)}
                </td>
                <td className="px-2 py-1.5 text-right tabular-nums text-slate-400">{num(r.winRate)}%</td>
                <td className="px-2 py-1.5 text-right tabular-nums text-slate-500">{r.tradeCount ?? '—'}</td>
                <td className="px-2 py-1.5 text-right tabular-nums text-slate-500">
                  {r.symbolsBeatingBuyHold ?? '—'}/{r.symbolCount ?? '—'}
                </td>
                <td className="px-2 py-1.5 text-right">
                  <button onClick={() => onApply(r.parameters ?? {}, r.ruleJson)}
                    disabled={applying || (!r.ruleJson && !r.parameters)}
                    title="Bu parametreleri indikatör ayarı olarak kaydet"
                    className="px-2 py-1 rounded-md bg-white/5 border border-white/10 text-slate-300
                               hover:bg-yellow-400 hover:text-black hover:border-yellow-400
                               disabled:opacity-40 transition-colors whitespace-nowrap">
                    Uygula
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-slate-600 mt-2">
        <span className="text-slate-500">Üstünlük</span> = stratejinin al-tut'u kaç puan geçtiği.
        Negatifse coini alıp tutmak daha iyiydi. <span className="text-slate-500">2. dönem</span>{' '}
        sütunu negatifse parametreler geçmişe aşırı uydurulmuş olabilir.
      </p>
    </div>
  )
}
