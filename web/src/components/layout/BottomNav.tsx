import { NavLink } from 'react-router-dom'
import { useState } from 'react'
import {
  LayoutDashboard, Radar, LineChart, BarChart3, Settings,
  ClipboardList, FlaskConical, TrendingUp, Grid3x3, X,
  Sliders, Cpu, Flame, Bell, Wifi, CandlestickChart
} from 'lucide-react'
import { cn } from '@/lib/utils'

const primaryItems = [
  { to: '/',        icon: LayoutDashboard, label: 'Anasayfa' },
  { to: '/monitor', icon: Radar,           label: 'Takip'    },
  { to: '/signals', icon: LineChart,       label: 'Sinyal'   },
  { to: '/coins',   icon: BarChart3,       label: 'Coinler'  },
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

export default function BottomNav() {
  const [open, setOpen] = useState(false)

  return (
    <>
      {/* More drawer — slide-up animasyonu */}
      <div
        className={cn(
          'md:hidden fixed inset-0 z-50 transition-all duration-200',
          open ? 'pointer-events-auto' : 'pointer-events-none'
        )}
        onClick={() => setOpen(false)}
      >
        {/* Backdrop */}
        <div className={cn(
          'absolute inset-0 bg-black/40 transition-opacity duration-200',
          open ? 'opacity-100' : 'opacity-0'
        )} />
        {/* Drawer */}
        <div className={cn(
          'absolute bottom-14 left-0 right-0 bg-[#0f1117] border-t border-white/8 grid grid-cols-4 gap-0 transition-transform duration-200',
          open ? 'translate-y-0' : 'translate-y-full'
        )}>
          {moreItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              onClick={() => setOpen(false)}
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

      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#0f1117]/95 backdrop-blur border-t border-white/8 flex items-stretch h-14">
        {primaryItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
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
