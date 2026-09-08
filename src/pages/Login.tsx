import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Wifi } from 'lucide-react'
import Logo from '../components/Logo'

export default function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [remember, setRemember] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!username || !password) { setError('يرجى ملء جميع الحقول.'); return }
    setLoading(true)
    setTimeout(() => {
      setLoading(false)
      navigate('/dashboard')
    }, 600)
  }

  return (
    <div className="min-h-screen flex bg-background" dir="rtl">
      {/* Right panel (in RTL: on the right side) */}
      <div className="hidden lg:flex flex-col justify-between w-110 bg-[#0F172A] p-10 shrink-0 text-right">
        <Logo size={36} />
        <div>
          <h2 className="text-3xl font-bold text-white leading-snug mb-4">
            إدارة مؤسستك التعليمية.<br />
            <span className="text-accent">بكل سهولة واحترافية.</span>
          </h2>
          <p className="text-slate-400 text-sm leading-relaxed">
            يقوم نظام إيدوبيلوت بمركزة إدارة الطلاب، بطاقات الحضور، سجل الغيابات، المدفوعات والتقارير في تطبيق محلي سريع وموثوق دون الحاجة إلى اتصال بالإنترنت.
          </p>
          <div className="mt-8 grid grid-cols-2 gap-4">
            {[
              { label: 'الطلاب المسجلين', value: '+100' },
              { label: 'الأفواج النشطة', value: '12' },
              { label: 'تسجيلات الحضور', value: '+500' },
              { label: 'العملة المعتمدة', value: 'دج (DZD)' },
            ].map(s => (
              <div key={s.label} className="bg-white/5 rounded-xl p-4 border border-white/10">
                <p className="text-xl font-bold text-white font-mono">{s.value}</p>
                <p className="text-xs text-slate-400 mt-1">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <Wifi size={14} className="text-teal-400" />
          <span>تطبيق محلي 100% – يعمل مباشرة دون إنترنت</span>
        </div>
      </div>

      {/* Main form */}
      <div className="flex-1 flex flex-col items-center justify-center px-8">
        <div className="w-full max-w-sm">
          <div className="lg:hidden mb-8 flex justify-center">
            <Logo size={36} />
          </div>
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-slate-900">تسجيل الدخول</h1>
            <p className="text-sm text-slate-500 mt-1">لوحة التحكم وإدارة المدرسة</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">اسم المستخدم</label>
              <input
                type="text"
                value={username}
                onChange={e => { setUsername(e.target.value); setError('') }}
                placeholder="admin"
                className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all bg-white outline-none font-mono text-left"
                dir="ltr"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">كلمة المرور</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError('') }}
                  placeholder="••••••••"
                  className="w-full px-3.5 py-2.5 pl-10 text-sm border border-slate-200 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all bg-white outline-none font-mono"
                  dir="ltr"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error && <p className="text-xs text-rose-600 bg-rose-50 px-3 py-2 rounded-lg border border-rose-200 font-semibold">{error}</p>}

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="remember"
                checked={remember}
                onChange={e => setRemember(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-blue-600 accent-blue-600 cursor-pointer"
              />
              <label htmlFor="remember" className="text-sm text-slate-600 cursor-pointer select-none">تذكر جلسة الدخول</label>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-lg transition-colors disabled:opacity-60 text-sm shadow-sm cursor-pointer"
            >
              {loading ? 'جاري التحقق...' : 'دخول إلى النظام'}
            </button>
          </form>

          <div className="mt-6 flex items-center gap-2 text-xs text-slate-500 bg-slate-50 rounded-lg px-3.5 py-2.5 border border-slate-200">
            <Wifi size={14} className="text-slate-400" />
            <span>يعمل النظام محلياً بالكامل لحماية وسرية بياناتكم</span>
          </div>
        </div>

        <p className="absolute bottom-6 text-xs text-slate-400 font-mono">Edupilot DZ v1.0.0 – 2026</p>
      </div>
    </div>
  )
}
