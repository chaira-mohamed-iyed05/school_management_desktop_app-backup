/**
 * StudentTicket - thermal receipt/ticket format for students.
 * Designed for 80mm thermal paper printers.
 * Replaces the CR80 card as requested by client.
 */
import React from "react"

// Mini QR pattern renderer
function QRPattern({ token, size = 96 }: { token: string; size?: number }) {
  const CELLS = 17
  const cells: boolean[] = []
  for (let r = 0; r < CELLS; r++) {
    for (let c = 0; c < CELLS; c++) {
      const topLeft = r < 5 && c < 5
      const topRight = r < 5 && c >= CELLS - 5
      const bottomLeft = r >= CELLS - 5 && c < 5
      if (topLeft || topRight || bottomLeft) {
        const isFrame =
          r === 0 || r === 4 || c === 0 || c === 4 ||
          (topRight && (r === 0 || r === 4 || c === CELLS - 5 || c === CELLS - 1)) ||
          (bottomLeft && (r === CELLS - 5 || r === CELLS - 1 || c === 0 || c === 4))
        const isCenter =
          (topLeft && r >= 1 && r <= 3 && c >= 1 && c <= 3) ||
          (topRight && r >= 1 && r <= 3 && c >= CELLS - 4 && c <= CELLS - 2) ||
          (bottomLeft && r >= CELLS - 4 && r <= CELLS - 2 && c >= 1 && c <= 3)
        cells.push(isFrame || isCenter)
        continue
      }
      const seed = token.charCodeAt((r * CELLS + c) % token.length)
      cells.push((seed + r * 3 + c * 7) % 3 !== 0)
    }
  }
  const cell = size / CELLS
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${CELLS}, ${cell}px)`, width: size, height: size, background: "white", padding: 2, border: "1px solid #000" }}>
      {cells.map((dark, i) => (
        <div key={i} style={{ width: cell, height: cell, background: dark ? "#000" : "#fff" }} />
      ))}
    </div>
  )
}

function Dashes() {
  return <div style={{ width: "100%", borderTop: "1px dashed #ccc", margin: "8px 0" }} />
}

export interface StudentTicketProps {
  student: {
    id: number
    studentNumber: string
    firstNameAr?: string
    lastNameAr?: string
    firstNameFr: string
    lastNameFr: string
    qrToken: string
    status: "active" | "inactive" | "archived"
  }
  courseName?: string
  groupName?: string
  schoolName?: string
  academicYear?: string
  photoUrl?: string | null
  forPrint?: boolean
}

export default function StudentTicket({ student, courseName, groupName, schoolName = "إيدوبيلوت الجزائر", academicYear = "2025-2026", photoUrl, forPrint = false }: StudentTicketProps) {
  const fullNameAr = `${student.lastNameAr || student.lastNameFr || ''} ${student.firstNameAr || student.firstNameFr || ''}`.trim()
  const fullNameFr = `${student.firstNameFr} ${student.lastNameFr}`.trim()
  const isActive = student.status === "active"
  const now = new Date().toLocaleDateString("ar-DZ", { day: "2-digit", month: "2-digit", year: "numeric" })

  return (
    <div dir="rtl" style={{ width: 320, fontFamily: 'system-ui, -apple-system, sans-serif', background: "#fff", color: "#000", fontSize: 11, userSelect: "none", border: forPrint ? "none" : "1px dashed #bbb", borderRadius: forPrint ? 0 : 6, overflow: "hidden" }}>
      <div style={{ background: "#000", color: "#fff", padding: "10px 12px", textAlign: "center" }}>
        <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: 1 }}>{schoolName}</div>
        <div style={{ fontSize: 10, marginTop: 2, opacity: 0.85 }}>الموسم الدراسي {academicYear}</div>
      </div>
      <div style={{ padding: "12px 14px" }}>
        <div style={{ textAlign: "center", fontSize: 12, fontWeight: 700, letterSpacing: 1, marginBottom: 6 }}>✦ بطاقة تسجيل الحضور ✦</div>
        <Dashes />
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
          <div style={{ width: 56, height: 56, flexShrink: 0, borderRadius: 6, border: "1px solid #000", overflow: "hidden", background: "#f0f0f0", display: "flex", alignItems: "center", justifyContent: "center" }}>
            {photoUrl ? (
              <img src={photoUrl} alt={fullNameAr} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              <span style={{ fontSize: 20, fontWeight: 700, color: "#666" }}>{student.firstNameAr?.charAt(0) || student.firstNameFr.charAt(0)}</span>
            )}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 13, lineHeight: 1.3 }}>{fullNameAr}</div>
            {fullNameFr && (
              <div style={{ fontSize: 10, color: "#666", direction: "ltr", textAlign: "right", marginTop: 2, fontFamily: "sans-serif" }}>{fullNameFr}</div>
            )}
            <div style={{ fontSize: 11, fontFamily: "monospace", marginTop: 4, color: "#333", direction: "ltr", textAlign: "right" }}>رقم: {student.studentNumber}</div>
            <div style={{ display: "inline-block", fontSize: 9, padding: "1px 6px", borderRadius: 4, border: `1px solid ${isActive ? "#000" : "#888"}`, background: isActive ? "#000" : "#f0f0f0", color: isActive ? "#fff" : "#666", marginTop: 4, fontWeight: 700 }}>
              {isActive ? "نشط" : "غير نشط"}
            </div>
          </div>
        </div>
        <Dashes />
        {(courseName || groupName) && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span style={{ color: "#555" }}>المادة / الدورة:</span>
              <span style={{ fontWeight: 700 }}>{courseName ?? "--"}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span style={{ color: "#555" }}>الفوج الدراسي:</span>
              <span style={{ fontWeight: 700 }}>{groupName ?? "--"}</span>
            </div>
            <Dashes />
          </>
        )}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, margin: "8px 0" }}>
          <QRPattern token={student.qrToken} size={100} />
          <div style={{ fontSize: 10, color: "#555", textAlign: "center", fontWeight: 600 }}>مسح الرمز لتسجيل الحضور</div>
          <div style={{ fontFamily: 'monospace', fontSize: 9, letterSpacing: 1, color: "#666", border: "1px solid #ddd", padding: "2px 8px", borderRadius: 4, maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} dir="ltr">
            {student.qrToken}
          </div>
        </div>
        <Dashes />
        <div style={{ textAlign: "center", fontSize: 9, color: "#777", lineHeight: 1.6 }}>
          <div>تاريخ الإصدار: {now}</div>
          <div style={{ marginTop: 2 }}>هذه البطاقة مخصصة لإثبات الهوية وتسجيل الحضور.</div>
          <div>في حال ضياعها يرجى إبلاغ إدارة المدرسة.</div>
        </div>
      </div>
    </div>
  )
}
