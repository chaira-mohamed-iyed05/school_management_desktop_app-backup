import { useEffect, useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Printer, Download, Eye } from 'lucide-react'
import QRCode from 'qrcode'
import schoolLogo from '../assets/school-logo-cropped.png'
import type { Student, Enrollment } from '@shared/types/index'

interface SchoolInfo {
  schoolNameAr: string
  schoolNameFr: string
  academicYear: string
  phone?: string | null
  address?: string | null
}

export default function StudentCard() {
  const { t } = useTranslation()
  const { id } = useParams()
  const navigate = useNavigate()
  const [student, setStudent] = useState<Student | null>(null)
  const [school, setSchool] = useState<SchoolInfo>({ schoolNameAr: 'مدرسة المعيار الثابت للغات', schoolNameFr: 'EL MIYAR EL THABIT', academicYear: '2025-2026' })
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [enrollments, setEnrollments] = useState<Enrollment[]>([])
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [printing, setPrinting] = useState(false)
  const [showPreview, setShowPreview] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const studentId = Number(id)
        const [studentRes, settingsRes, enrollRes] = await Promise.all([
          window.schoolApp.students.getById(studentId),
          window.schoolApp.settings.get(),
          window.schoolApp.enrollments.byStudent(studentId),
        ])

        if (studentRes.success && studentRes.data) {
          const s = studentRes.data
          setStudent(s)

          // Load photo
          if (s.photoPath) {
            try {
              const photoRes = await window.schoolApp.media.getImageUrl(s.photoPath)
              if (photoRes.success && photoRes.data?.url) setPhotoUrl(photoRes.data.url)
            } catch {}
          }
        }

        if (settingsRes.success && settingsRes.data) {
          const rawFr = settingsRes.data.schoolNameFr ?? ''
          const cleanFr = /edupilot/i.test(rawFr) ? '' : rawFr
          setSchool({
            schoolNameAr: settingsRes.data.schoolNameAr ?? '',
            schoolNameFr: cleanFr,
            academicYear: settingsRes.data.academicYear ?? '2025-2026',
            phone: settingsRes.data.phone,
            address: settingsRes.data.address,
          })
        }

        if (enrollRes.success && enrollRes.data) {
          setEnrollments(enrollRes.data)
        }
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id])

  const fullNameAr = student ? `${student.lastNameAr} ${student.firstNameAr}` : ''
  const fullNameFr = student ? `${student.lastNameFr} ${student.firstNameFr}` : ''
  const initials = student ? (student.firstNameAr.charAt(0) + student.lastNameAr.charAt(0)) : ''

  const activeEnrollments = useMemo(() => {
    const active = enrollments.filter(e => e.status === 'active')
    return active.length > 0 ? active : enrollments
  }, [enrollments])

  // Generate QR Code with clean, structured payload
  useEffect(() => {
    if (student?.qrToken) {
      const classesSummary = activeEnrollments
        .map(e => `${e.courseName || 'Cours'}${e.groupName ? ` (${e.groupName})` : ''}${e.teacherName ? ` - ${e.teacherName}` : ''}`)

      // Clean structured plain text card — instantly readable by smartphones and QR scanners
      const schoolLabel = school.schoolNameFr || school.schoolNameAr || 'ECOLE'
      const lines = [
        schoolLabel,
        `Matricule: ${student.studentNumber}`,
        `Nom: ${fullNameAr}`,
        fullNameFr ? `Nom FR: ${fullNameFr}` : null,
        student.phone ? `Tél: ${student.phone}` : null,
        classesSummary.length > 0 ? `Classes: ${classesSummary.join(', ')}` : null,
        `ID: ${student.qrToken}`,
      ].filter(Boolean)

      const qrPayload = lines.join('\n')

      QRCode.toDataURL(qrPayload, {
        width: 240,
        margin: 1,
        color: { dark: '#000000', light: '#FFFFFF' },
        errorCorrectionLevel: 'M',
      })
        .then((url) => setQrDataUrl(url))
        .catch((err) => console.error('QR generation error:', err))
    }
  }, [student, activeEnrollments, school, fullNameAr, fullNameFr])


  const handlePrint = async () => {
    setPrinting(true)
    try {
      await window.schoolApp.app.print()
    } finally {
      setPrinting(false)
    }
  }

  const handleSavePDF = async () => {
    setPrinting(true)
    try {
      await window.schoolApp.app.printToPdf({
        pageSize: 'A4' as any,
        marginsType: 0,
        filename: `Ticket-${student?.studentNumber || 'etudiant'}.pdf`,
      })
    } finally {
      setPrinting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-6 h-6 border-2 border-[#2563EB] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!student) {
    return <div className="text-center py-20 text-slate-400">{t('errors.STUDENT_NOT_FOUND')}</div>
  }

  /* ── 80mm Thermal Ticket Component (Compact, Ink & Paper Saver) ── */
  const TicketContent = () => (
    <div
      className="student-ticket-content"
      style={{
        width: '72mm',
        fontFamily: "'Courier New', Courier, monospace",
        backgroundColor: '#ffffff',
        color: '#000000',
        padding: '2mm 1mm',
        boxSizing: 'border-box',
        margin: '0 auto',
        WebkitFontSmoothing: 'antialiased',
      }}
    >
      {/* Header: School Logo & name */}
      <div style={{ textAlign: 'center', marginBottom: '1.5mm' }}>
        <img
          src={schoolLogo}
          alt="Logo"
          style={{ width: '28mm', height: 'auto', display: 'block', margin: '0 auto 1mm', imageRendering: 'crisp-edges' }}
        />
        <div style={{ fontSize: '9.5pt', fontWeight: 'bold', direction: 'rtl', color: '#000000', lineHeight: '1.2' }}>
          {school.schoolNameAr || 'مدرسة المعيار الثابت للغات'}
        </div>
        {school.schoolNameFr && (
          <div style={{ fontSize: '7.5pt', fontWeight: 'bold', color: '#000000', letterSpacing: '0.5px', marginTop: '0.5mm' }}>
            {school.schoolNameFr}
          </div>
        )}
        <div style={{ fontSize: '6.5pt', color: '#000000', fontWeight: '600', marginTop: '0.5mm', direction: 'rtl' }}>
          دروس دعم — تمهيدي — ابتدائي — متوسط — ثانوي
        </div>
        <div style={{ borderBottom: '1px dashed #000000', margin: '1.2mm 0' }} />
        <div style={{ fontSize: '8.5pt', fontWeight: 'bold', letterSpacing: '1.5px', textTransform: 'uppercase', color: '#000000' }}>
          ✦ TICKET ÉTUDIANT ✦
        </div>
        <div style={{ fontSize: '7pt', fontWeight: 'bold', color: '#000000' }}>
          Année: {school.academicYear}
        </div>
        <div style={{ borderBottom: '1px dashed #000000', margin: '1.2mm 0' }} />
      </div>

      {/* Photo / Initials Circle (Compact 15mm) */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5mm' }}>
        {photoUrl ? (
          <img
            src={photoUrl}
            alt="Photo"
            style={{
              width: '15mm',
              height: '15mm',
              borderRadius: '50%',
              objectFit: 'cover',
              border: '1.5px solid #000000',
            }}
          />
        ) : (
          <div style={{
            width: '15mm',
            height: '15mm',
            borderRadius: '50%',
            border: '1.5px solid #000000',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '9pt',
            fontWeight: 'bold',
            color: '#000000',
          }}>
            {initials}
          </div>
        )}
      </div>

      {/* Student Names */}
      <div style={{ textAlign: 'center', marginBottom: '1.5mm' }}>
        <div style={{ fontSize: '10.5pt', fontWeight: 'bold', direction: 'rtl', color: '#000000', lineHeight: '1.2' }}>
          {fullNameAr}
        </div>
        {fullNameFr && (
          <div style={{ fontSize: '8pt', fontWeight: 'bold', color: '#000000', marginTop: '0.5mm' }}>
            {fullNameFr}
          </div>
        )}
      </div>

      <div style={{ borderBottom: '1px dashed #000000', margin: '1.2mm 0' }} />

      {/* Student Identity Details */}
      <div style={{ fontSize: '7.5pt', lineHeight: '1.35', color: '#000000' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontWeight: 'bold' }}>N° Matricule:</span>
          <span style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>{student.studentNumber}</span>
        </div>
        {student.phone && (
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 'bold' }}>Téléphone:</span>
            <span style={{ fontWeight: 'bold' }}>{student.phone}</span>
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontWeight: 'bold' }}>Statut:</span>
          <span style={{ fontWeight: 'bold' }}>{student.status === 'active' ? 'ACTIF' : 'INACTIF'}</span>
        </div>
      </div>

      <div style={{ borderBottom: '1px dashed #000000', margin: '1.2mm 0' }} />

      {/* Course & Group Enrollment Details with Teacher */}
      <div style={{ fontSize: '7.5pt', lineHeight: '1.35', color: '#000000' }}>
        <div style={{ fontWeight: 'bold', textDecoration: 'underline', marginBottom: '1mm' }}>
          CLASSES & ENSEIGNANTS:
        </div>
        {activeEnrollments.length > 0 ? (
          activeEnrollments.map((en, idx) => (
            <div key={en.id || idx} style={{ marginBottom: '1mm', paddingBottom: '1mm', borderBottom: idx < activeEnrollments.length - 1 ? '1px dashed #000000' : 'none' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
                <span>• Matière:</span>
                <span style={{ direction: 'rtl' }}>{en.courseName || en.groupName || '—'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 'bold' }}>  Groupe:</span>
                <span style={{ fontWeight: 'bold' }}>{en.groupName || `Groupe #${en.groupId}`}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 'bold' }}>  Enseignant:</span>
                <span style={{ fontWeight: 'bold' }}>{en.teacherName || 'Non assigné'}</span>
              </div>
            </div>
          ))
        ) : (
          <div style={{ color: '#000000', fontWeight: 'bold', fontStyle: 'italic' }}>Aucune inscription active</div>
        )}
      </div>

      <div style={{ borderBottom: '1px dashed #000000', margin: '1.2mm 0' }} />

      {/* Rich QR Code Section (Compact 25mm to conserve paper) */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1mm', margin: '1.5mm 0' }}>
        {qrDataUrl ? (
          <img
            src={qrDataUrl}
            alt="QR Code"
            style={{ width: '25mm', height: '25mm', display: 'block', imageRendering: 'pixelated' }}
          />
        ) : (
          <div style={{ width: '25mm', height: '25mm', border: '1px dashed #000000', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '7pt', fontWeight: 'bold', color: '#000000' }}>
            QR Code
          </div>
        )}
        <div style={{ fontSize: '6pt', fontWeight: 'bold', color: '#000000', fontFamily: 'monospace', textAlign: 'center', wordBreak: 'break-all', maxWidth: '70mm' }}>
          ID: {student.qrToken}
        </div>
      </div>

      <div style={{ borderBottom: '1px dashed #000000', margin: '1.2mm 0' }} />

      {/* Footer */}
      <div style={{ textAlign: 'center', fontSize: '6pt', fontWeight: 'bold', color: '#000000', lineHeight: '1.2' }}>
        <div>Inscrit le: {student.registrationDate}</div>
        <div>Scannez ce QR Code pour voir le profil & pointer la présence</div>
      </div>
    </div>
  )

  return (
    <>
      {/* Print-only ticket — full-roll 80mm compatibility (72mm printable width, zero margin) */}
      <style>{`
        @media print {
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
          }
          body * {
            visibility: hidden !important;
          }
          .student-ticket-print,
          .student-ticket-print * {
            visibility: visible !important;
          }
          .student-ticket-print {
            position: absolute !important;
            left: 0 !important;
            right: 0 !important;
            top: 0 !important;
            margin: 0 auto !important;
            padding: 0 !important;
            width: 72mm !important;
            display: block !important;
          }
          @page {
            size: 80mm auto;
            margin: 0mm;
          }
        }
      `}</style>

      {/* Hidden print area */}
      <div className="student-ticket-print" style={{ position: 'absolute', left: '-9999px', top: 0 }}>
        <TicketContent />
      </div>

      {/* Toolbar — hidden on print */}
      <div className="no-print flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-slate-500 hover:text-slate-800 text-sm transition-colors"
        >
          <ArrowLeft size={15} /> {t('common.back')}
        </button>

        <div className="ms-auto flex items-center gap-2">
          <button
            onClick={() => setShowPreview(true)}
            className="flex items-center gap-2 border border-border bg-white text-slate-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors"
          >
            <Eye size={15} /> {t('common.preview') ?? 'Aperçu'}
          </button>
          <button
            onClick={handleSavePDF}
            disabled={printing}
            className="flex items-center gap-2 border border-[#2563EB] text-[#2563EB] px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#EFF6FF] transition-colors disabled:opacity-50"
          >
            <Download size={15} /> PDF
          </button>
          <button
            onClick={handlePrint}
            disabled={printing}
            className="flex items-center gap-2 bg-[#2563EB] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#1D4ED8] transition-colors disabled:opacity-50"
          >
            <Printer size={15} /> {t('common.print')}
          </button>
        </div>
      </div>

      {/* On-screen ticket preview card */}
      <div className="no-print flex justify-center">
        <div className="bg-white rounded-2xl shadow-xl border border-border overflow-hidden" style={{ width: '360px' }}>
          <div className="h-2 bg-linear-to-r from-[#2563EB] to-[#06B6D4]" />

          <div className="p-6">
            {/* School logo & name */}
            <div className="text-center mb-4">
              <img
                src={schoolLogo}
                alt="Logo"
                className="w-24 mx-auto mb-2 rounded-lg"
              />
              <p className="text-base font-extrabold text-[#0F172A]" dir="rtl">
                {school.schoolNameAr || 'مدرسة المعيار الثابت للغات'}
              </p>
              {school.schoolNameFr && (
                <p className="text-[10px] font-bold tracking-[1.5px] text-slate-400 uppercase mt-0.5">
                  {school.schoolNameFr}
                </p>
              )}
              <p className="text-[9px] text-slate-500 mt-1" dir="rtl">
                دروس دعم — تمهيدي — ابتدائي — متوسط — ثانوي
              </p>
              <div className="border-b border-dashed border-slate-300 my-2.5" />
              <p className="text-xs font-bold tracking-[2px] text-[#0F172A] uppercase">TICKET ÉTUDIANT</p>
              <p className="text-[10px] text-slate-400 mt-0.5">Année scolaire: {school.academicYear}</p>
            </div>

            {/* Photo */}
            <div className="flex justify-center mb-3">
              {photoUrl ? (
                <img
                  src={photoUrl}
                  alt={fullNameFr}
                  className="w-20 h-20 rounded-full object-cover border-2 border-[#2563EB]"
                />
              ) : (
                <div className="w-20 h-20 rounded-full bg-[#EFF6FF] border-2 border-[#2563EB] flex items-center justify-center text-[#2563EB] font-bold text-2xl">
                  {initials}
                </div>
              )}
            </div>

            {/* Names */}
            <div className="text-center mb-3">
              <p className="font-bold text-[#0F172A] text-base" dir="rtl">{fullNameAr}</p>
              <p className="text-slate-500 text-sm">{fullNameFr}</p>
            </div>

            <div className="border-b border-dashed border-slate-300 my-2.5" />

            {/* Student details */}
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">MATRICULE</span>
                <span className="font-mono font-bold text-[#0F172A]">{student.studentNumber}</span>
              </div>
              {student.phone && (
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">TÉLÉPHONE</span>
                  <span className="font-medium text-[#0F172A] dir-ltr">{student.phone}</span>
                </div>
              )}
            </div>

            <div className="border-b border-dashed border-slate-300 my-2.5" />

            {/* Classes, Subject & Teacher details */}
            <div>
              <p className="text-[10px] font-bold tracking-wider text-slate-400 uppercase mb-2">
                CLASSES & ENSEIGNANTS
              </p>
              <div className="space-y-2">
                {activeEnrollments.length > 0 ? (
                  activeEnrollments.map((en, idx) => (
                    <div key={en.id || idx} className="bg-slate-50 border border-slate-200/80 rounded-lg p-2.5 text-xs space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500 font-medium">المادة / Cours:</span>
                        <span className="font-bold text-[#0F172A]">{en.courseName || en.groupName || '—'}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500 font-medium">الفوج / Groupe:</span>
                        <span className="font-semibold text-[#2563EB]">{en.groupName || `Groupe #${en.groupId}`}</span>
                      </div>
                      <div className="flex justify-between items-center pt-0.5 border-t border-slate-200/60">
                        <span className="text-slate-500 font-medium">الأستاذ / Prof:</span>
                        <span className="font-medium text-slate-800">{en.teacherName || 'Non assigné'}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-400 italic">Aucune inscription active</p>
                )}
              </div>
            </div>

            <div className="border-b border-dashed border-slate-300 my-2.5" />

            {/* QR Code */}
            <div className="flex flex-col items-center gap-2">
              {qrDataUrl ? (
                <img src={qrDataUrl} alt="QR Code" className="w-32 h-32 rounded-lg" />
              ) : (
                <div className="w-32 h-32 bg-slate-100 rounded-lg flex items-center justify-center text-xs text-slate-400">
                  Chargement...
                </div>
              )}
              <p className="text-[9px] font-mono text-slate-400 text-center break-all max-w-65">{student.qrToken}</p>
            </div>

            <div className="border-b border-dashed border-slate-300 my-2.5" />

            <p className="text-center text-[9px] text-slate-400">
              Scannez ce QR Code pour afficher le profil & pointer
            </p>
          </div>

          <div className="h-1 bg-linear-to-r from-[#2563EB] to-[#06B6D4]" />
        </div>
      </div>

      <p className="text-center text-xs text-slate-400 mt-4 no-print">
        Format ticket thermique 80mm · {student.studentNumber}
      </p>

      {/* Preview Modal */}
      {showPreview && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-3 sm:p-6" onClick={() => setShowPreview(false)}>
          <div className="bg-white rounded-2xl shadow-2xl max-h-[90vh] max-w-lg w-full flex flex-col overflow-hidden animate-fade-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-border bg-slate-50 shrink-0">
              <h3 className="font-bold text-[#0F172A] text-sm">Aperçu du ticket 80mm</h3>
              <div className="flex gap-2">
                <button
                  onClick={handleSavePDF}
                  disabled={printing}
                  className="flex items-center gap-1.5 text-xs border border-[#2563EB] text-[#2563EB] px-3 py-1.5 rounded-lg hover:bg-[#EFF6FF] transition-colors disabled:opacity-50 font-semibold"
                >
                  <Download size={13} /> {t('common.export')} PDF
                </button>
                <button
                  onClick={handlePrint}
                  disabled={printing}
                  className="flex items-center gap-1.5 text-xs bg-[#2563EB] text-white px-3 py-1.5 rounded-lg hover:bg-[#1D4ED8] transition-colors disabled:opacity-50 font-semibold"
                >
                  <Printer size={13} /> {t('common.print')}
                </button>
                <button
                  onClick={() => setShowPreview(false)}
                  className="text-slate-400 hover:text-slate-600 transition-colors w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-200"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="p-4 sm:p-6 flex justify-center bg-slate-100 overflow-y-auto flex-1">
              <div className="shadow-lg bg-white rounded-xs">
                <TicketContent />
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
