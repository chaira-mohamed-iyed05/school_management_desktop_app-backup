import { useState, useRef, useEffect } from 'react'
import { Search, ChevronDown, Check, User, X } from 'lucide-react'

interface StudentComboboxProps {
  students: any[]
  value: string
  onChange: (studentId: string) => void
  placeholder?: string
  debtMap?: Record<number, { debt: number; monthsOverdue: number; status: string }>
}

export default function StudentCombobox({
  students,
  value,
  onChange,
  placeholder = 'ابحث عن طالب (الاسم، اللقب، رقم القيد)...',
  debtMap = {}
}: StudentComboboxProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const selectedStudent = students.find(s => String(s.id) === String(value))

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const filteredStudents = students.filter(s => {
    if (!searchTerm.trim()) return true
    const term = searchTerm.toLowerCase().trim()
    const nameFr = `${s.firstNameFr || ''} ${s.lastNameFr || ''}`.toLowerCase()
    const nameAr = `${s.firstNameAr || ''} ${s.lastNameAr || ''}`.toLowerCase()
    const studentNumber = (s.studentNumber || '').toLowerCase()
    const qrToken = (s.qrToken || '').toLowerCase()
    const phone = (s.phone || '').toLowerCase()

    return (
      nameFr.includes(term) ||
      nameAr.includes(term) ||
      studentNumber.includes(term) ||
      qrToken.includes(term) ||
      phone.includes(term)
    )
  })

  const handleSelect = (id: number) => {
    onChange(String(id))
    setIsOpen(false)
    setSearchTerm('')
  }

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    onChange('')
    setSearchTerm('')
  }

  return (
    <div className="relative w-full" ref={containerRef} dir="rtl">
      {/* Input / trigger button */}
      <div
        onClick={() => {
          setIsOpen(true)
          setTimeout(() => inputRef.current?.focus(), 50)
        }}
        className={`w-full min-h-10 px-3 py-2 text-sm border rounded-lg bg-white flex items-center justify-between cursor-pointer transition-all ${
          isOpen ? 'border-blue-500 ring-2 ring-blue-100' : 'border-slate-200 hover:border-slate-300'
        }`}
      >
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          <User size={16} className="text-slate-400 shrink-0" />
          {selectedStudent ? (
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <span className="font-bold text-slate-900 truncate">
                {selectedStudent.firstNameAr ? `${selectedStudent.lastNameAr} ${selectedStudent.firstNameAr}` : `${selectedStudent.firstNameFr} ${selectedStudent.lastNameFr}`}
              </span>
              <span className="font-mono text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded shrink-0">
                {selectedStudent.studentNumber}
              </span>
              {debtMap[selectedStudent.id] && debtMap[selectedStudent.id].debt > 0 && (
                <span className="text-[11px] font-bold text-rose-600 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded shrink-0">
                  دين: {debtMap[selectedStudent.id].debt.toLocaleString('ar-DZ')} دج ({debtMap[selectedStudent.id].monthsOverdue} شهر)
                </span>
              )}
            </div>
          ) : (
            <span className="text-slate-400 text-sm truncate">{placeholder}</span>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0 mr-2">
          {selectedStudent && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors"
              title="إلغاء التحديد"
            >
              <X size={14} />
            </button>
          )}
          <ChevronDown size={16} className={`text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </div>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute z-50 left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden flex flex-col max-h-72">
          {/* Search box inside dropdown */}
          <div className="p-2.5 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
            <Search size={15} className="text-slate-400 shrink-0 mr-1" />
            <input
              ref={inputRef}
              type="text"
              placeholder="اكتب اسم الطالب، اللقب، أو رقم القيد..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full bg-transparent text-sm outline-none placeholder-slate-400 text-slate-800 font-sans"
              autoFocus
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Results list */}
          <div className="overflow-y-auto divide-y divide-slate-50 flex-1">
            {filteredStudents.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400">
                لم يتم العثور على أي طالب يطابق "{searchTerm}"
              </div>
            ) : (
              filteredStudents.map(s => {
                const isSelected = String(s.id) === String(value)
                const studentDebt = debtMap[s.id]
                return (
                  <div
                    key={s.id}
                    onClick={() => handleSelect(s.id)}
                    className={`px-3.5 py-2.5 flex items-center justify-between cursor-pointer transition-colors ${
                      isSelected ? 'bg-blue-50/80 text-blue-950' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-bold truncate ${isSelected ? 'text-blue-700' : 'text-slate-800'}`}>
                          {s.firstNameAr ? `${s.lastNameAr} ${s.firstNameAr}` : `${s.firstNameFr} ${s.lastNameFr}`}
                        </span>
                        {s.firstNameFr && s.firstNameAr && (
                          <span className="text-xs text-slate-400 font-normal font-sans" dir="ltr">
                            ({s.firstNameFr} {s.lastNameFr})
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="font-mono text-[11px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                          {s.studentNumber}
                        </span>
                        {s.phone && (
                          <span className="text-[11px] text-slate-400 font-mono text-left" dir="ltr">
                            {s.phone}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 mr-3">
                      {studentDebt && studentDebt.debt > 0 ? (
                        <span className="text-[11px] font-bold text-rose-600 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded">
                          دين: {studentDebt.debt.toLocaleString('ar-DZ')} دج
                        </span>
                      ) : (
                        <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                          مستوفٍ
                        </span>
                      )}
                      {isSelected && <Check size={16} className="text-blue-600 mr-1" />}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
