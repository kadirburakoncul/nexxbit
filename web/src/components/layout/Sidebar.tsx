import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, TrendingUp, LineChart, Bell, Settings,
  Wifi, FlaskConical, Shield, Users, CandlestickChart, Terminal,
  BarChart3, Cpu, Sliders, ClipboardList, Radar, Flame, BarChart2, PieChart, Trophy
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/authStore'
import { useMarketStore } from '@/stores/marketStore'

const bistNavItems = [
  { to: '/bist',             icon: LayoutDashboard, label: 'BIST Pano'    },
  { to: '/bist/indicators',  icon: Cpu,             label: 'İndikatörler' },
  { to: '/bist/strategies',  icon: Sliders,         label: 'Stratejiler'  },
  { to: '/bist/signals',     icon: LineChart,        label: 'Sinyaller'    },
  { to: '/bist/monitor',     icon: Radar,           label: 'Takip'        },
  { to: '/bist/chart',       icon: CandlestickChart,label: 'Grafik'       },
  { to: '/bist/stocks',      icon: BarChart2,       label: 'Hisseler'     },
  { to: '/bist/momentum',    icon: Trophy,          label: 'Momentum'     },
]

const navItems = [
  { to: '/',           icon: LayoutDashboard, label: 'Dashboard'   },
  { to: '/positions',  icon: TrendingUp,      label: 'Pozisyonlar' },
  { to: '/signals',    icon: LineChart,        label: 'Sinyaller'   },
  { to: '/monitor',    icon: Radar,           label: 'Takip'       },
  { to: '/trades',     icon: ClipboardList,   label: 'Emirler'     },
  { to: '/coins',      icon: BarChart3,       label: 'Coinler'     },
  { to: '/chart',      icon: CandlestickChart,label: 'Grafik'      },
  { to: '/backtest',   icon: FlaskConical,    label: 'Backtest'    },
  { to: '/indicators', icon: Cpu,             label: 'İndikatörler'},
  { to: '/strategies', icon: Sliders,         label: 'Stratejiler' },
  { to: '/volatile',   icon: Flame,           label: 'Volatil Mod' },
  { to: '/analysis',   icon: BarChart2,       label: 'Analiz'      },
  { to: '/analytics',  icon: PieChart,        label: 'Performans'  },
  { to: '/notifications', icon: Bell,         label: 'Bildirimler' },
  { to: '/settings',   icon: Settings,        label: 'Ayarlar'     },
  { to: '/binance',    icon: Wifi,            label: 'Binance'     },
]

const adminItems = [
  { to: '/admin',       icon: Shield,   label: 'Admin Panel'  },
  { to: '/admin/users', icon: Users,    label: 'Kullanıcılar' },
  { to: '/admin/logs',  icon: Terminal, label: 'Canlı Loglar' },
]

export default function Sidebar() {
  const isAdmin = useAuthStore(s => s.isAdmin)()
  const { market, setMarket } = useMarketStore()
  const navigate = useNavigate()
  const isBist = market === 'bist'

  const switchMarket = (m: 'crypto' | 'bist') => {
    setMarket(m)
    navigate(m === 'bist' ? '/bist' : '/')
  }

  const activeNavItems = isBist ? bistNavItems : navItems

  return (
    <aside className="hidden md:flex md:flex-col w-56 shrink-0 bg-[#0f1117] border-r border-white/5 h-screen sticky top-0">
      {/* Logo */}
      <div className="px-5 py-4 border-b border-white/5">
        <span className="text-lg tracking-tight font-light">
          <span className="font-bold text-yellow-400">NEXX</span><span className="text-slate-100">BIT</span>
        </span>
      </div>

      {/* Market switcher */}
      <div className="px-3 pt-3">
        <div className="flex bg-white/5 rounded-xl p-1">
          <button
            onClick={() => switchMarket('crypto')}
            className={cn('flex-1 text-center py-1.5 rounded-lg text-xs font-medium transition-colors',
              !isBist ? 'bg-yellow-400 text-black' : 'text-slate-500 hover:text-slate-300')}
          >
            Kripto
          </button>
          <button
            onClick={() => switchMarket('bist')}
            className={cn('flex-1 text-center py-1.5 rounded-lg text-xs font-medium transition-colors',
              isBist ? 'bg-yellow-400 text-black' : 'text-slate-500 hover:text-slate-300')}
          >
            BIST
          </button>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {activeNavItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/' || to === '/bist'}
            className={({ isActive }) =>
              cn('flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
                isActive
                  ? 'bg-yellow-400/10 text-yellow-400 font-medium'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5')
            }
          >
            <Icon size={16} />
            {label}
          </NavLink>
        ))}

        {!isBist && isAdmin && (
          <>
            <div className="px-3 pt-4 pb-1 text-xs text-slate-600 uppercase tracking-wider">Admin</div>
            {adminItems.map(({ to, icon: Icon, label }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/admin'}
                className={({ isActive }) =>
                  cn('flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
                    isActive
                      ? 'bg-red-500/10 text-red-400 font-medium'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-white/5')
                }
              >
                <Icon size={16} />
                {label}
              </NavLink>
            ))}
          </>
        )}
      </nav>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-white/5 text-xs text-slate-600">
        {isBist ? 'BIST: sadece sinyal, al-sat yok' : 'Withdrawal yetkisi kullanılmaz'}
      </div>
    </aside>
  )
}
