import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'
import { Link } from 'react-router-dom'

interface Props {
  icon: LucideIcon
  title: string
  description?: string
  action?: { label: string; to?: string; onClick?: () => void }
  className?: string
}

export default function EmptyState({ icon: Icon, title, description, action, className }: Props) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-16 px-6 text-center', className)}>
      <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/8 flex items-center justify-center mb-4">
        <Icon size={22} className="text-slate-500" />
      </div>
      <p className="text-sm font-medium text-slate-300 mb-1">{title}</p>
      {description && <p className="text-xs text-slate-600 max-w-xs">{description}</p>}
      {action && (
        <div className="mt-4">
          {action.to ? (
            <Link
              to={action.to}
              className="inline-flex items-center gap-2 bg-yellow-400 hover:bg-yellow-300 text-black font-semibold px-4 py-2 rounded-lg text-sm transition-colors"
            >
              {action.label}
            </Link>
          ) : (
            <button
              onClick={action.onClick}
              className="inline-flex items-center gap-2 bg-yellow-400 hover:bg-yellow-300 text-black font-semibold px-4 py-2 rounded-lg text-sm transition-colors"
            >
              {action.label}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
