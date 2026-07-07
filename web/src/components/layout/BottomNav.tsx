import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import {
  LayoutDashboard, Radar, LineChart, BarChart3, Settings,
  ClipboardList, FlaskConical, TrendingUp, Grid3x3, X,
  Sliders, Cpu, Flame, Bell, Wifi, CandlestickChart, BarChart2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useMarketStore } from '@/stores/marketStore'

const primaryItems = [
  { to: '/',        icon: LayoutDashboard, label: 'Anasayfa' },
  { to: '/monitor', icon: Radar,           label: 'Takip'    },
  { to: '/signals', icon: LineChart,       label: 'Sinyal'   },
  { to: '/coins',   icon: BarChart3,       label: 'Coinler'  },
]

const bistPrimaryItems = [
  { to: '/bist',           icon: LayoutDashboard, label: 'Pano'         },
  { to: '/bist/monitor',   icon: Radar,           label: 'Takip'        },
  { to: '/bist/signals',   icon: LineChart,       label: 'Sinyaller'    },
  { to: '/bist/chart',     icon: CandlestickChart,label: 'Grafik'       },
]

const moreItems = [
  { to: '/positions',    icon: TrendingUp,       label: 'Pozisyonlar'  },
  { to: '/trades',       icon: ClipboardList,    label: 'Emirler'      },
  { to: '/strategies',   icon: Sliders,          label: 'Stratejiler'  },
  { to: '/indicators',   icon: Cpu,              label: 'İndikatörler' },
  { to: '/volatile',     icon: Flame,            label: 'Volatil Mod'  },
  { to: '/backtest',     icon: FlaskConical,     label: 'Backtest'     },
  { to: '/chart',        icon: CandlestickChart, label: 'Grafik'       },
  { to: '/notifications',icon: Bell,             label: 'Bildirimler'  },
  { to: '/binance',      icon: Wifi,             label: 'Binance'      },
  { to: '/settings',     icon: Settings,         label: 'Ayarlar'      },
]

const bistMoreItems = [
  { to: '/bist/stocks',      icon: BarChart2,   label: 'Hisseler'     },
  { to: '/bist/indicators',  icon: Cpu,         label: 'İndikatörler' },
  { to: '/bist/strategies',  icon: Sliders,     label: 'Stratejiler'  },
  { to: '/settings',         icon: Settings,    label: 'Ayarlar'      },
]

export default function BottomNav() {
  const [open, setOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const { market, setMarket } = useMarketStore()
  const isBist = market === 'bist'

  const activePrimaryItems = isBist ? bistPrimaryItems : primaryItems
  const activeMoreItems    = isBist ? bistMoreItems    : moreItems

  useEffect(() => { setOpen(false) }, [location.pathname])

  const close = () => setOpen(false)

  const switchMarket = (m: 'crypto' | 'bist') => {
    setMarket(m)
    navigate(m === 'bist' ? '/bist' : '/')
    close()
  }

  return (
    <>
      {/* More drawer */}
      {open && (
        <div
          className="md:hidden fixed inset-0 z-50"
          onClick={close}
        >
          <div className="absolute inset-0 bg-black/50" />

          <div
            className="absolute bottom-14 left-0 right-0 bg-[#0f1117] border-t border-white/8"
            onClick={e => e.stopPropagation()}
          >
            {/* KRIPTO / BIST market switcher */}
            <div className="flex gap-2 p-3 border-b border-white/8">
              <button
                onClick={() => switchMarket('crypto')}
                className={cn(
                  'flex-1 py-2 rounded-lg text-xs font-semibold border transition-colors',
                  !isBist
                    ? 'bg-yellow-400/15 border-yellow-400/30 text-yellow-400'
                    : 'bg-white/5 border-white/10 text-slate-400 hover:border-white/20'
                )}
              >
                KRIPTO
              </button>
              <button
                onClick={() => switchMarket('bist')}
                className={cn(
                  'flex-1 py-2 rounded-lg text-xs font-semibold border transition-colors',
                  isBist
                    ? 'bg-yellow-400/15 border-yellow-400/30 text-yellow-400'
                    : 'bg-white/5 border-white/10 text-slate-400 hover:border-white/20'
                )}
              >
                BIST
              </button>
            </div>

            <div className="grid grid-cols-4 gap-0">
              {activeMoreItems.map(({ to, icon: Icon, label }) => (
                <NavLink
                  key={to}
                  to={to}
                  className={({ isActive }) =>
                    cn('flex flex-col items-center justify-center gap-1 py-4 text-[10px] font-medium transition-colors',
                      isActive ? 'text-yellow-400' : 'text-slate-400')}
                >
                  <Icon size={20} strokeWidth={1.5} />
                  <span>{label}</span>
                </NavLink>
              ))}
            </div>
          </div>
        </div>
      )}

      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#0f1117]/95 backdrop-blur border-t border-white/8 flex items-stretch h-14">
        {activePrimaryItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/' || to === '/bist'}
            className={({ isActive }) =>
              cn('flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors',
                isActive ? 'text-yellow-400' : 'text-slate-500')}
          >
            {({ isActive }) => (
              <>
                <Icon size={20} strokeWidth={isActive ? 2.5 : 1.5} />
                <span>{label}</span>
              </>
            )}
          </NavLink>
        ))}
        {/* More button */}
        <button
          onClick={() => setOpen(v => !v)}
          className={cn('flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors',
            open ? 'text-yellow-400' : 'text-slate-500')}
        >
          {open ? <X size={20} strokeWidth={2} /> : <Grid3x3 size={20} strokeWidth={1.5} />}
          <span>{open ? 'Kapat' : 'Daha Fazla'}</span>
        </button>
      </nav>
    </>
  )
}
