/**
 * StudentCard.tsx -- rewritten as thermal ticket page in Arabic
 */
import { useState, useEffect, useRef } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { ArrowRight, Printer, Download, RefreshCw } from "lucide-react"
import StudentTicket from "../components/StudentTicket"

interface StudentData {
  id: number
  studentNumber: string
  firstNameFr: string
  lastNameFr: string
  firstNameAr?: string
  lastNameAr?: string
  qrToken: string
  status: "active" | "inactive" | "archived"
  photoPath?: string | null
}

interface EnrollmentData {
  id: number
  groupId: number
  status: string
  groupName?: string
  courseName?: string
}

export default function StudentCard() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [student, setStudent] = useState<StudentData | null>(null)
  const [enrollment, setEnrollment] = useState<EnrollmentData | null>(null)
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [schoolName, setSchoolName] = useState("إيدوبيلوت الجزائر")
  const [academicYear, setAcademicYear] = useState("2025-2026")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const ticketRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const load = async () => {
      if (!id) return
      setLoading(true)
      try {
        const api = (window as any).schoolApp

        // Load student
        const studentRes = await api.students.getById(Number(id))
        if (!studentRes.success || !studentRes.data) {
          setError("لم يتم العثور على الطالب")
          return
        }
        const s = studentRes.data
        setStudent({
          id: s.id,
          studentNumber: s.studentNumber,
          firstNameFr: s.firstNameFr,
          lastNameFr: s.lastNameFr,
          firstNameAr: s.firstNameAr,
          lastNameAr: s.lastNameAr,
          qrToken: s.qrToken,
          status: s.status,
          photoPath: s.photoPath,
        })

        // Load enrollments to get course/group info
        const enrollRes = await api.enrollments.byStudent(Number(id))
        if (enrollRes.success && enrollRes.data && enrollRes.data.length > 0) {
          const active = enrollRes.data.find((e: any) => e.status === "active") ?? enrollRes.data[0]
          setEnrollment(active)
        }

        // Load photo
        if (s.photoPath) {
          const photoRes = await api.media.getImageUrl(s.photoPath)
          if (photoRes.success && photoRes.data?.url) {
            setPhotoUrl(photoRes.data.url)
          }
        }

        // Load school settings
        const settingsRes = await api.settings.get()
        if (settingsRes.success && settingsRes.data) {
          setSchoolName(settingsRes.data.schoolNameAr || settingsRes.data.schoolNameFr || "إيدوبيلوت الجزائر")
          setAcademicYear(settingsRes.data.academicYear || "2025-2026")
        }
      } catch (err) {
        setError("حدث خطأ أثناء تحميل البيانات.")
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id])

  const handlePrint = async () => {
    const api = (window as any).schoolApp
    await api.app.print()
  }

  const handlePdf = async () => {
    const api = (window as any).schoolApp
    await api.app.printToPdf({
      pageSize: "A4",
      marginsType: 0,
      filename: `ticket-${student?.studentNumber ?? id}.pdf`,
    })
  }

  const handleRegenQR = async () => {
    if (!id) return
    const api = (window as any).schoolApp
    const res = await api.students.regenQR(Number(id))
    if (res.success && res.data) {
      setStudent((prev) => (prev ? { ...prev, qrToken: res.data.token } : prev))
      alert('تم إعادة توليد رمز QR بنجاح!')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full" dir="rtl">
        <div className="text-slate-400 text-sm font-medium">جاري تحميل بطاقة الطالب...</div>
      </div>
    )
  }

  if (error || !student) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3" dir="rtl">
        <div className="text-rose-500 text-sm font-bold">{error ?? "لم يتم العثور على الطالب"}</div>
        <button onClick={() => navigate(-1)} className="text-blue-600 text-sm font-semibold hover:underline cursor-pointer">
          العودة للملف
        </button>
      </div>
    )
  }

  return (
    <div dir="rtl">
      {/* Screen-only header + controls */}
      <div className="print:hidden flex flex-col gap-5">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
          >
            <ArrowRight size={16} />
            <span>العودة إلى ملف الطالب</span>
          </button>
        </div>

        <div className="flex gap-8 items-start">
          {/* Ticket preview */}
          <div className="flex flex-col items-center gap-3">
            <p className="text-xs text-slate-500 font-bold uppercase tracking-wide">معاينة بطاقة الحضور (تذكرة حرارية)</p>
            <div ref={ticketRef} className="shadow-lg rounded-md overflow-hidden">
              <StudentTicket
                student={student}
                courseName={enrollment?.courseName}
                groupName={enrollment?.groupName}
                schoolName={schoolName}
                academicYear={academicYear}
                photoUrl={photoUrl}
                forPrint={false}
              />
            </div>
          </div>

          {/* Actions panel */}
          <div className="flex-1 max-w-sm space-y-4">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
              <h3 className="text-sm font-bold text-slate-900 mb-4 pb-2 border-b border-slate-100">خيارات الطباعة والتصدير</h3>
              <div className="space-y-3">
                <button
                  onClick={handlePrint}
                  className="flex items-center justify-center gap-2 w-full px-4 py-2.5 text-sm font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer shadow-sm"
                >
                  <Printer size={16} />
                  <span>طباعة التذكرة</span>
                </button>
                <button
                  onClick={handlePdf}
                  className="flex items-center justify-center gap-2 w-full px-4 py-2.5 text-sm font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                >
                  <Download size={16} />
                  <span>تصدير كملف PDF</span>
                </button>
                <button
                  onClick={handleRegenQR}
                  className="flex items-center justify-center gap-2 w-full px-4 py-2.5 text-sm font-bold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg transition-colors cursor-pointer"
                >
                  <RefreshCw size={16} />
                  <span>إعادة توليد رمز QR</span>
                </button>
              </div>
            </div>

            <div className="bg-slate-50 rounded-xl border border-slate-200 p-4">
              <h4 className="text-xs font-bold text-slate-600 mb-3 pb-2 border-b border-slate-200">معلومات التذكرة</h4>
              <div className="space-y-2 text-xs text-slate-600">
                <div className="flex justify-between"><span>رقم الطالب:</span> <span className="font-mono text-slate-800 font-bold" dir="ltr">{student.studentNumber}</span></div>
                <div className="flex justify-between"><span>المادة:</span> <span className="font-bold text-slate-800">{enrollment?.courseName ?? "—"}</span></div>
                <div className="flex justify-between"><span>الفوج:</span> <span className="font-bold text-slate-800">{enrollment?.groupName ?? "—"}</span></div>
                <div className="flex justify-between"><span>الحالة:</span>
                  <span className={`font-bold ${student.status === "active" ? "text-emerald-700" : "text-rose-600"}`}>
                    {student.status === "active" ? "نشط" : student.status === "inactive" ? "غير نشط" : "مؤرشف"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Print-only content */}
      <div className="hidden print:flex print:items-center print:justify-center print:min-h-screen">
        <StudentTicket
          student={student}
          courseName={enrollment?.courseName}
          groupName={enrollment?.groupName}
          schoolName={schoolName}
          academicYear={academicYear}
          photoUrl={photoUrl}
          forPrint={true}
        />
      </div>
    </div>
  )
}
