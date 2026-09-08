import type { LucideIcon } from 'lucide-react'

interface StatCardProps {
  title: string
  value: string | number
  change?: string
  changePositive?: boolean
  icon: LucideIcon
  iconColor?: string
  iconBg?: string
}

export default function StatCard({ title, value, change, changePositive, icon: Icon, iconColor = 'text-blue-600', iconBg = 'bg-blue-50' }: StatCardProps) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{title}</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{value}</p>
          {change && (
            <p className={`text-xs mt-1 font-medium ${changePositive ? 'text-green-600' : 'text-red-600'}`}>
              {changePositive ? '▲' : '▼'} {change}
            </p>
          )}
        </div>
        <div className={`w-10 h-10 rounded-lg ${iconBg} flex items-center justify-center`}>
          <Icon size={20} className={iconColor} />
        </div>
      </div>
    </div>
  )
}
