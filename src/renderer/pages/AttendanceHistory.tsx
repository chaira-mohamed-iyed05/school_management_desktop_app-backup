import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { History } from 'lucide-react'
import type { AttendanceSession } from '@shared/types/index'

export default function AttendanceHistory() {
  const { t } = useTranslation()
  const [sessions, setSessions] = useState<AttendanceSession[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    window.schoolApp.attendance.listSessions({ limit: 50 }).then((res) => {
      if (res.success && res.data) setSessions(res.data)
      setLoading(false)
    })
  }, [])

  if (loading) return <div className="flex justify-center py-20"><div className="w-6 h-6 border-2 border-[#2563EB] border-t-transparent rounded-full animate-spin" /></div>

  return (
    <div className="animate-fade-in">
      {sessions.length === 0 ? (
        <div className="text-center py-20 text-slate-400 bg-white rounded-xl border border-border">
          <History size={36} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">{t('attendance.noSessions')}</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-border text-slate-500 text-xs uppercase tracking-wide">
                <th className="text-start px-4 py-3 font-medium">{t('attendance.date')}</th>
                <th className="text-start px-4 py-3 font-medium">{t('attendance.group')}</th>
                <th className="text-start px-4 py-3 font-medium">{t('common.status')}</th>
                <th className="text-start px-4 py-3 font-medium hidden md:table-cell">{t('courses.startTime')}</th>
                <th className="text-start px-4 py-3 font-medium hidden md:table-cell">{t('courses.endTime')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F1F5F9]">
              {sessions.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-[#0F172A]">{s.sessionDate}</td>
                  <td className="px-4 py-3 text-slate-500">#{s.groupId}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.status === 'open' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                      {s.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-400 hidden md:table-cell font-mono text-xs">{s.actualStartTime ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-400 hidden md:table-cell font-mono text-xs">{s.endTime ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
