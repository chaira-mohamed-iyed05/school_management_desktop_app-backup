import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Printer, X, CheckCircle2, AlertTriangle, UserCheck, Calendar } from 'lucide-react'
import schoolLogo from '../assets/school-logo-cropped.png'
import type { TeacherPayoutReceiptTicket } from '@shared/types/index'

interface TeacherPayoutTicketModalProps {
  ticket: TeacherPayoutReceiptTicket
  onClose: () => void
}

export default function TeacherPayoutTicketModal({ ticket, onClose }: TeacherPayoutTicketModalProps) {
  const { t, i18n } = useTranslation()
  const lang = i18n.language
  const isRTL = lang === 'ar'
  const [format, setFormat] = useState<'thermal' | 'a4'>('thermal')

  const { payout, group, teacher, schoolSettings, paidItems, debtItems } = ticket

  const handlePrint = async () => {
    try {
      if (window.schoolApp?.app?.print) {
        await window.schoolApp.app.print()
      } else {
        window.print()
      }
    } catch {
      window.print()
    }
  }

  // Group paid items by session
  const itemsBySession = new Map<number, typeof paidItems>()
  for (const item of paidItems) {
    if (!itemsBySession.has(item.sessionId)) {
      itemsBySession.set(item.sessionId, [])
    }
    itemsBySession.get(item.sessionId)!.push(item)
  }

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl animate-fade-in overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Top Action Bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-slate-50 shrink-0">
          <div className="flex items-center gap-2">
            <span className="p-2 bg-purple-100 text-purple-700 rounded-lg">
              <Printer size={18} />
            </span>
            <div>
              <h3 className="font-bold text-sm text-[#0F172A]">
                {t('teacherPayouts.receiptTitle')} — {payout.payoutNumber}
              </h3>
              <p className="text-xs text-slate-500">
                {teacher.name} | {group.name}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex bg-slate-200 p-0.5 rounded-lg text-xs font-medium">
              <button
                type="button"
                onClick={() => setFormat('thermal')}
                className={`px-3 py-1 rounded-md transition-all ${
                  format === 'thermal' ? 'bg-white text-purple-700 font-bold shadow-xs' : 'text-slate-600'
                }`}
              >
                80mm حراري
              </button>
              <button
                type="button"
                onClick={() => setFormat('a4')}
                className={`px-3 py-1 rounded-md transition-all ${
                  format === 'a4' ? 'bg-white text-purple-700 font-bold shadow-xs' : 'text-slate-600'
                }`}
              >
                A4 قياسي
              </button>
            </div>

            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 bg-purple-600 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-purple-700 transition-colors shadow-xs cursor-pointer"
            >
              <Printer size={14} /> {t('teacherPayouts.print')}
            </button>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200 transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Scrollable Printable Document Preview */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-100 flex justify-center">
          {/* Printable Ticket Container */}
          <div
            id="teacher-payout-ticket"
            className={`bg-white shadow-md border border-slate-300 text-black leading-tight select-text ${
              format === 'thermal'
                ? 'w-[72mm] p-2 text-[11px] font-mono'
                : 'w-[180mm] p-8 text-xs font-sans rounded-xl'
            }`}
            style={{ WebkitFontSmoothing: 'antialiased' }}
          >
            {/* Header: School details & Logo */}
            <div className="text-center pb-2 border-b border-dashed border-black mb-3">
              <img
                src={schoolLogo}
                alt="Logo"
                className="w-20 mx-auto mb-1 block"
                style={{ imageRendering: 'crisp-edges' }}
              />
              <h2 className="font-extrabold text-sm text-black">
                {schoolSettings?.schoolNameAr || 'مدرسة المعيار الثابت للغات'}
              </h2>
              {schoolSettings?.schoolNameFr && (
                <p className="text-[10px] font-semibold text-slate-800 tracking-wider">
                  {schoolSettings.schoolNameFr}
                </p>
              )}
              <p className="text-[9px] text-slate-700 mt-0.5">
                دروس دعم — تمهيدي — ابتدائي — متوسط — ثانوي
              </p>
              {schoolSettings?.phone && (
                <p className="text-[9px] text-slate-700">هاتف: {schoolSettings.phone}</p>
              )}
              <div className="border-b border-dashed border-black my-2" />
              <div className="font-bold text-xs tracking-wider uppercase">
                ✦ {t('teacherPayouts.receiptTitle')} ✦
              </div>
              <div className="font-mono text-xs font-bold mt-0.5">
                N°: {payout.payoutNumber}
              </div>
            </div>

            {/* Teacher & Group Meta Block */}
            <div className="bg-slate-50 border border-slate-200 p-2.5 rounded-lg mb-3 text-[11px] space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-600 font-bold">{t('teachers.title')}:</span>
                <span className="font-extrabold text-black">{teacher.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600 font-bold">{t('courses.groups')}:</span>
                <span className="font-bold">{group.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600 font-bold">{t('teacherPayouts.payoutDate')}:</span>
                <span className="font-mono">{payout.payoutDate}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600 font-bold">{t('teacherPayouts.sessionsCount')}:</span>
                <span className="font-bold">{payout.sessionsCount} حصص</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600 font-bold">{t('teacherPayouts.teacherPercentage')}:</span>
                <span className="font-bold text-purple-700">{payout.percentage}%</span>
              </div>
            </div>

            {/* Paid Sessions Breakdown */}
            <div className="mb-3">
              <div className="font-bold text-[11px] border-b border-black pb-1 mb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <CheckCircle2 size={12} className="text-emerald-600" />
                  <span>الحصص والاشتراكات المسددة اليوم (خضراء 🟢):</span>
                </span>
                <span className="text-[10px] text-slate-600">{paidItems.length} طالب</span>
              </div>

              {Array.from(itemsBySession.entries()).map(([sid, items]) => {
                const sessionDate = items[0]?.sessionDate || ''
                const sessionNum = items[0]?.sessionNumber || ''
                const sessionGross = items.reduce((sum, it) => sum + it.price, 0)
                const sessionTeacherShare = items.reduce((sum, it) => sum + it.teacherShare, 0)

                return (
                  <div key={sid} className="mb-2 bg-slate-50/70 p-2 rounded border border-slate-200">
                    <div className="flex justify-between items-center text-[10px] font-bold border-b border-slate-200 pb-1 mb-1">
                      <span>حصـة رقم #{sessionNum} ({sessionDate})</span>
                      <span className="text-purple-700">حصة الأستاذ: {sessionTeacherShare.toLocaleString()} DA</span>
                    </div>
                    <div className="space-y-0.5">
                      {items.map((it, idx) => (
                        <div key={idx} className="flex justify-between items-center text-[9.5px]">
                          <span className="truncate max-w-[50mm]">
                            • {it.studentName}
                            {it.isDeparted && (
                              <span className="ms-1 text-[8px] bg-red-100 text-red-700 px-1 rounded">
                                [غادر المركز]
                              </span>
                            )}
                          </span>
                          <span className="font-mono text-slate-600 shrink-0">
                            {it.price.toLocaleString()} DA
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Net Payout Summary Highlight Box */}
            <div className="bg-purple-50 border-2 border-purple-300 p-2.5 rounded-xl mb-3 space-y-1">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-slate-700">{t('teacherPayouts.grossAmount')}:</span>
                <span className="font-mono font-bold">{payout.grossAmount.toLocaleString()} DA</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-slate-700">{t('teacherPayouts.teacherPercentage')}:</span>
                <span className="font-mono font-bold">{payout.percentage}%</span>
              </div>
              <div className="border-t border-purple-200 pt-1 mt-1 flex justify-between items-center">
                <span className="font-black text-sm text-purple-900">{t('teacherPayouts.netPaid')}:</span>
                <span className="font-black text-base text-purple-900 font-mono">
                  {payout.netPaidAmount.toLocaleString()} DA
                </span>
              </div>
              <div className="text-[9px] text-slate-500 pt-0.5 text-center">
                طريقة الدفع: {payout.paymentMethod === 'cash' ? 'نقداً (خزينة المركز)' : payout.paymentMethod}
              </div>
            </div>

            {/* Transparency Section: Indebted Students (Red Cells) */}
            <div className="mb-4">
              <div className="font-bold text-[10.5px] border-b border-red-300 pb-1 mb-1.5 flex items-center justify-between text-red-800">
                <span className="flex items-center gap-1">
                  <AlertTriangle size={12} className="text-red-600" />
                  <span>{t('teacherPayouts.indebtedStudents')}</span>
                </span>
                <span className="text-[9.5px] font-mono">
                  {debtItems.length > 0 ? `${debtItems.length} ديون معلقة` : '0'}
                </span>
              </div>

              {debtItems.length > 0 ? (
                <div className="space-y-1 bg-red-50/60 p-2 rounded-lg border border-red-200">
                  {debtItems.map((deb, idx) => (
                    <div key={idx} className="flex justify-between items-center text-[9px] text-red-900">
                      <span className="truncate max-w-[48mm]">
                        • {deb.studentName} (ح#{deb.sessionNumber} - {deb.sessionDate})
                        {deb.isDeparted && (
                          <span className="ms-1 text-[8px] bg-red-200 px-1 rounded">[غادر]</span>
                        )}
                      </span>
                      <span className="font-mono font-bold text-red-700 shrink-0">
                        {deb.price.toLocaleString()} DA
                      </span>
                    </div>
                  ))}
                  <div className="border-t border-red-200 pt-1 mt-1 flex justify-between font-bold text-[9.5px] text-red-800">
                    <span>مجموع الديون المعلقة المحجوبة:</span>
                    <span className="font-mono">{payout.pendingDebtAmount.toLocaleString()} DA</span>
                  </div>
                  <p className="text-[8px] text-slate-500 italic mt-0.5">
                    * ملاحظة: ستُصرف هذه الحصص للأستاذ تلقائياً فور قيام الطالب بتسديد دينه.
                  </p>
                </div>
              ) : (
                <div className="text-[9.5px] text-emerald-700 bg-emerald-50 p-2 rounded border border-emerald-200 text-center font-medium">
                  ✓ لا توجد ديون معلقة في هذه الحصص، كافة الطلاب خالصين ومسددين 100%.
                </div>
              )}
            </div>

            {/* Signatures Block */}
            <div className="border-t border-dashed border-black pt-2 mt-4 text-[10px]">
              <div className="grid grid-cols-2 gap-4 text-center">
                <div>
                  <p className="font-bold text-slate-800">{t('teacherPayouts.teacherSignature')}</p>
                  <div className="h-10 mt-1 border-b border-dotted border-slate-400" />
                </div>
                <div>
                  <p className="font-bold text-slate-800">{t('teacherPayouts.adminSignature')}</p>
                  <div className="h-10 mt-1 border-b border-dotted border-slate-400" />
                </div>
              </div>
              <p className="text-[8px] text-slate-400 text-center mt-3">
                نظام إيدوبيلوت دي زي — تاريخ الطباعة: {new Date().toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Global CSS for direct ticket printing */}
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #teacher-payout-ticket,
          #teacher-payout-ticket * {
            visibility: visible !important;
          }
          #teacher-payout-ticket {
            position: absolute !important;
            left: 0 !important;
            right: 0 !important;
            top: 0 !important;
            margin: 0 auto !important;
            padding: 2mm !important;
            display: block !important;
            width: 72mm !important;
            border: none !important;
            box-shadow: none !important;
          }
          @page {
            size: 80mm auto;
            margin: 0mm;
          }
        }
      `}</style>
    </div>
  )
}
