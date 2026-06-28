import { cn } from '@/lib/utils'

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded bg-white/8', className)} />
}

export function SkeletonCard({ rows = 3 }: { rows?: number }) {
  return (
    <div className="bg-white/5 border border-white/8 rounded-2xl p-5 space-y-3">
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="h-7 w-1/2" />
      {Array.from({ length: rows - 2 }).map((_, i) => (
        <Skeleton key={i} className="h-3 w-full" />
      ))}
    </div>
  )
}

export function SkeletonTable({ rows = 5, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="bg-white/5 border border-white/5 rounded-xl overflow-hidden">
      <div className="border-b border-white/5 px-5 py-3 flex gap-4">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-3 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="border-b border-white/5 last:border-0 px-5 py-3.5 flex gap-4">
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} className={cn('h-4', c === 0 ? 'w-20' : 'flex-1')} />
          ))}
        </div>
      ))}
    </div>
  )
}

export function SkeletonRow() {
  return (
    <div className="border-b border-white/5 px-5 py-3.5 flex items-center gap-4">
      <Skeleton className="h-4 w-20" />
      <Skeleton className="h-4 flex-1" />
      <Skeleton className="h-4 w-16" />
      <Skeleton className="h-4 w-16" />
      <Skeleton className="h-4 w-20" />
    </div>
  )
}
