interface BadgeProps {
  variant: 'success' | 'error' | 'warning' | 'info' | 'neutral' | 'paid' | 'unpaid' | 'partial' | 'overdue' | 'active' | 'inactive' | 'archived'
  children?: React.ReactNode
  size?: 'sm' | 'md'
}

const variants: Record<BadgeProps['variant'], string> = {
  archived: 'bg-slate-100 text-slate-500 border border-slate-200',
  success: 'bg-green-50 text-green-700 border border-green-200',
  error: 'bg-red-50 text-red-700 border border-red-200',
  warning: 'bg-amber-50 text-amber-700 border border-amber-200',
  info: 'bg-blue-50 text-blue-700 border border-blue-200',
  neutral: 'bg-slate-100 text-slate-600 border border-slate-200',
  paid: 'bg-green-50 text-green-700 border border-green-200',
  unpaid: 'bg-red-50 text-red-700 border border-red-200',
  partial: 'bg-amber-50 text-amber-700 border border-amber-200',
  overdue: 'bg-orange-50 text-orange-700 border border-orange-200',
  active: 'bg-blue-50 text-blue-700 border border-blue-200',
  inactive: 'bg-slate-100 text-slate-500 border border-slate-200',
}

const labels: Partial<Record<BadgeProps['variant'], string>> = {
  paid: 'مدفوع',
  unpaid: 'غير مدفوع',
  partial: 'جزئي',
  overdue: 'متأخر',
  active: 'نشط',
  inactive: 'غير نشط',
  archived: 'مؤرشف',
}

export default function Badge({ variant, children, size = 'sm' }: BadgeProps) {
  return (
    <span className={`inline-flex items-center rounded-full font-medium ${size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs'} ${variants[variant]}`}>
      {children ?? labels[variant]}
    </span>
  )
}
