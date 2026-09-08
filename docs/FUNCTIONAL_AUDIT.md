# Edupilot DZ — Functional Audit Report

**Date**: 2026-08-09  
**Application**: Edupilot DZ (Electron + React + TypeScript + SQLite)  
**Version**: 1.0.0

---

## Executive Summary

Edupilot DZ is a **functional Electron application** with:
- ✅ Solid database foundation (SQLite with Drizzle ORM)
- ✅ Secure Electron + React architecture (contextIsolation, sandbox)
- ✅ Core IPC API structure in place
- ✅ Basic CRUD for students, teachers, courses, groups, enrollments, payments
- ✅ Core attendance session and record model
- ✅ Internationalization (i18n) framework
- ⚠️ Heavy use of mock data in UI pages
- ⚠️ Visual design diverges from Figma in several places
- ⚠️ Profile images partially implemented (no admin photo)
- ⚠️ No normalized schedule slots (only JSON strings)
- ⚠️ Sessions exist but no regular session generation
- ⚠️ QR has single mode (no lookup mode)
- ⚠️ Settings pages incomplete
- ⚠️ Reports framework missing (print/PDF/CSV)
- ⚠️ No automatic lock mechanism
- ⚠️ No audit log display

---

## Database Schema Status

### ✅ Tables Present and Correct

| Table | Status | Notes |
|-------|--------|-------|
| `administrators` | ✅ | Has: id, username, passwordHash, fullName, role, preferredLanguage, isActive, createdAt, updatedAt. **Missing**: photo_path |
| `students` | ✅ | Has: id, studentNumber, names (Ar/Fr), gender, phone, guardian fields, photo_path (nullable), registrationDate, status, qrToken, qrTokenActive |
| `teachers` | ✅ | Has: id, firstName, lastName, phone, email, address, photo_path (nullable), status |
| `courses` | ✅ | Has: id, names (Ar/Fr/En), descriptions, defaultPrice, status |
| `groups` | ⚠️ | Has: courseId, teacherId, name, room, capacity, monthlyPrice, startDate, endDate, status. **Problem**: `scheduleJson` is denormalized text. No proper schedule slot table. |
| `enrollments` | ✅ | Has: studentId, groupId, agreedPrice, enrollmentDate, status. UNIQUE constraint on (student, group). |
| `attendance_sessions` | ✅ | Has: groupId, sessionDate, plannedStartTime, actualStartTime, endTime, lateThresholdMinutes, status, createdBy |
| `attendance_records` | ✅ | Has: sessionId, studentId, scannedAt, attendanceStatus, source, notes, createdBy. UNIQUE on (session, student). |
| `payments` | ✅ | Has: receiptNumber, studentId, enrollmentId, billingPeriod, amount, paymentMethod, paymentDate, reference, notes, receivedBy, status |
| `school_settings` | ✅ | Has: schoolName (Ar/Fr/En), phone, email, address, academicYear, currency, prefixes, defaultLanguage, backup settings |
| `audit_logs` | ✅ | Has: administratorId, action, entityType, entityId, sanitizedDetailsJson, createdAt. No password logging. |
| `appMetadata` | ✅ | Has: key, value, updatedAt. Used for schema version, first_run flag. |

### ⚠️ Missing Tables

#### `group_schedule_slots` (NEW - Must Create)
Normalized recurring schedule representation.

```sql
CREATE TABLE group_schedule_slots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  group_id INTEGER NOT NULL REFERENCES groups(id),
  weekday INTEGER NOT NULL CHECK(weekday >= 0 AND weekday <= 6), -- 0=Monday, 6=Sunday
  start_time TEXT NOT NULL,  -- HH:MM
  end_time TEXT NOT NULL,    -- HH:MM
  room TEXT,
  effective_from TEXT NOT NULL DEFAULT (date('now')),
  effective_until TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_by INTEGER REFERENCES administrators(id),
  UNIQUE(group_id, weekday, start_time)
);

CREATE INDEX idx_schedule_group ON group_schedule_slots(group_id);
CREATE INDEX idx_schedule_weekday ON group_schedule_slots(weekday);
CREATE INDEX idx_schedule_active ON group_schedule_slots(is_active);
```

#### `student_notes` (NEW - Optional but Recommended)
Administrative notes on student profile.

```sql
CREATE TABLE student_notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL REFERENCES students(id),
  note_text TEXT NOT NULL,
  created_by INTEGER NOT NULL REFERENCES administrators(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_notes_student ON student_notes(student_id);
```

### ⚠️ Required Field Additions

#### `administrators.photo_path` (NEW)
Store relative path to admin profile image.

```sql
ALTER TABLE administrators ADD COLUMN photo_path TEXT;
```

---

## IPC API Status

### ✅ Implemented Methods

#### Auth
- `auth.login(username, password)` ✅
- `auth.logout()` ✅
- `auth.getSession()` ✅
- `auth.checkFirstRun()` ✅
- `auth.completeSetup(...)` ✅
- `auth.changePassword(currentPassword, newPassword)` ⚠️ Handler exists but unclear if fully wired

#### Students
- `students.list(opts)` ✅
- `students.getById(id)` ✅
- `students.create(data)` ✅
- `students.update(id, data)` ✅
- `students.archive(id)` ✅
- `students.regenQR(id)` ✅
- `students.getPhotoUrl(filename, entityType)` ✅

#### Teachers
- `teachers.list(opts)` ✅
- `teachers.create(data)` ✅
- `teachers.update(id, data)` ✅
- `teachers.archive(id)` ✅

#### Courses
- `courses.list(opts)` ✅
- `courses.create(data)` ✅
- `courses.update(id, data)` ✅

#### Groups
- `groups.list(opts)` ✅
- `groups.byCourse(courseId)` ✅
- `groups.create(data)` ✅
- `groups.update(id, data)` ✅

#### Enrollments
- `enrollments.create(data)` ✅
- `enrollments.byStudent(studentId)` ✅
- `enrollments.byGroup(groupId)` ✅

#### Attendance
- `attendance.startSession(data)` ✅
- `attendance.scan(sessionId, token)` ✅
- `attendance.markManually(data)` ✅
- `attendance.endSession(sessionId)` ✅
- `attendance.getSession(id)` ✅
- `attendance.listSessions(opts)` ✅

#### Payments
- `payments.list(opts)` ✅
- `payments.create(data)` ✅
- `payments.cancel(id, reason)` ✅
- `payments.byStudent(studentId)` ✅

#### Settings
- `settings.get()` ✅
- `settings.update(data)` ✅

#### Backups
- `backups.create(destinationDir)` ✅
- `backups.list()` ✅
- `backups.verify(backupPath)` ✅
- `backups.restore(backupPath, confirmPassword)` ✅

#### Media
- `media.uploadPhoto(sourcePath, entityType, entityId)` ✅

#### App
- `app.getVersion()` ✅
- `app.getPaths()` ✅
- `app.openBackupDialog()` ✅
- `app.openSaveDialog()` ✅
- `app.print()` ✅
- `app.printToPdf(opts)` ✅

### ⚠️ Missing or Incomplete Methods

#### Media / Profile Photos
- **Missing**: `media.selectProfileImage()` — File dialog for selecting image  
- **Missing**: `media.removeProfileImage(entityType, entityId)` — Clean up managed image
- **Missing**: `media.uploadAdminPhoto(sourcePath)` — Specific admin photo upload

#### Schedule Management
- **Missing**: `schedules.list(groupId)` — List recurring slots for group
- **Missing**: `schedules.create(groupId, data)` — Add weekly slot
- **Missing**: `schedules.update(slotId, data)` — Modify slot
- **Missing**: `schedules.delete(slotId)` — Remove slot

#### Sessions
- **Missing**: `sessions.generateFromSchedule(groupId, startDate, endDate)` — Generate upcoming session instances
- **Missing**: `sessions.createExtra(groupId, data)` — Add extra session
- **Missing**: `sessions.cancel(sessionId)` — Mark as cancelled
- **Missing**: `sessions.complete(sessionId)` — Close session
- **Missing**: `sessions.getUpcoming(opts)` — List upcoming sessions
- **Missing**: `sessions.getByGroup(groupId)` — Sessions for group

#### Attendance
- **Missing**: `attendance.lookupStudent(token)` — Student lookup mode (no attendance record)
- **Missing**: `attendance.getStudentSummary(studentId, sessionId)` — Reception desk view
- **Missing**: `attendance.getRemainingSessionsCount(enrollmentId)` — Count future sessions

#### Reports
- **Missing**: `reports.generateEnrollment(filters)` — Enrollment report data
- **Missing**: `reports.generateAttendance(filters)` — Attendance report data
- **Missing**: `reports.generateRevenue(filters)` — Revenue report data
- **Missing**: `reports.generateOutstanding(filters)` — Outstanding payments report
- **Missing**: `reports.exportCSV(reportData)` — Export to CSV
- **Missing**: `reports.exportPDF(reportData)` — Export to PDF

#### Settings / Security
- **Missing**: `settings.getAdministrator()` — Get current admin profile
- **Missing**: `settings.updateAdministrator(data)` — Update admin name, language, photo
- **Missing**: `settings.listAuditLogs(opts)` — Get audit log entries
- **Missing**: `settings.setAutoLock(minutes)` — Configure idle lock
- **Missing**: `settings.getAutoLockStatus()` — Get lock configuration

#### QR / Print
- **Missing**: `qr.generateStudentCard(studentId)` — Generate card image/HTML
- **Missing**: `qr.printStudentCard(studentId)` — Invoke print preview/PDF

---

## UI / Page Status

### Dashboard
- Status: **Basic**
- Issues:
  - ✅ Layout exists
  - ⚠️ Uses mock data
  - ⚠️ Numbers hardcoded (no DB queries)
  - ⚠️ No real session list
  - ⚠️ No real attendance today

### Students
- Status: **Partially Functional**
- Issues:
  - ✅ Table and card views exist
  - ✅ Search, filter, pagination
  - ⚠️ Uses mock data instead of IPC
  - ⚠️ Create/edit/archive not wired to IPC
  - ⚠️ No photo upload UI
  - ⚠️ No card generation UI

### Student Profile
- Status: **Basic**
- Issues:
  - ⚠️ Uses mock data
  - ⚠️ Tabs exist but not functional
  - ⚠️ No real notes support
  - ⚠️ No real payment/attendance data
  - ⚠️ No schedule display
  - ❌ Does not match Figma design (layout different, styling different)

### Student Card
- Status: **Missing**
- Issues:
  - ❌ No dedicated StudentCard component
  - ❌ No print/PDF preview
  - ❌ No CR80 print CSS

### Courses & Groups
- Status: **Partially Functional**
- Issues:
  - ⚠️ Uses mock data
  - ⚠️ Add course/group forms exist
  - ⚠️ No database persistence
  - ⚠️ No schedule slot management UI
  - ⚠️ Schedule display is non-functional ("No course" placeholder)
  - ⚠️ Course expansion doesn't show real group details
  - ⚠️ No real session list per group

### Teachers
- Status: **Minimal**
- Issues:
  - ⚠️ No dedicated Teachers page
  - ⚠️ Teachers listed in course edit only
  - ⚠️ No teacher CRUD UI
  - ⚠️ No photo management
  - ⚠️ No teaching schedule view

### Attendance
- Status: **Partially Functional**
- Issues:
  - ⚠️ QR scan workflow exists
  - ⚠️ Uses mock data for students
  - ⚠️ No real session selection
  - ⚠️ Only one QR mode (attendance mode)
  - ❌ No "Student Lookup" mode
  - ⚠️ Session selection doesn't work (no real sessions)
  - ⚠️ Sound toggle exists but not functional

### Payments
- Status: **Partial**
- Issues:
  - ⚠️ Uses mock data
  - ⚠️ Summary cards hardcoded
  - ⚠️ Payment table exists
  - ⚠️ No receipt printing
  - ⚠️ No PDF export

### Reports
- Status: **Missing**
- Issues:
  - ⚠️ Navigation menu exists
  - ❌ No Reports page component
  - ❌ No report generation logic
  - ❌ No CSV export
  - ❌ No PDF export
  - ❌ No print preview

### Settings
- Status: **Partial UI, Non-Functional**
- Issues:
  - ⚠️ Layout matches Figma somewhat
  - ⚠️ School Profile tab exists but not wired
  - ⚠️ Application settings tab exists but not wired
  - ⚠️ Backup tab exists but not fully functional
  - ⚠️ Security tab has password form but not wired
  - ❌ No admin profile section
  - ❌ No audit log view
  - ❌ No automatic lock configuration
  - ❌ Change password not wired

---

## Figma Fidelity Issues

### Student Profile Page
- **Issue**: Current layout uses 3-column grid; Figma shows left card + main tabs layout
- **Fix**: Restructure to match Figma: left identity card, main tabbed content panel

### Student Card
- **Issue**: No component exists; Figma shows dark navy card with school logo, student info, QR
- **Fix**: Create dedicated StudentCard component matching Figma design exactly

### Courses & Groups Timetable
- **Issue**: Current UI shows "No course" placeholders; not connected to real schedule data
- **Fix**: Display real group_schedule_slots data in clean 7-day or columnar layout

### Settings Page
- **Issue**: Tab navigation and styling partially matches Figma but not complete
- **Fix**: Ensure exact spacing, colors, active state match Figma

### Attendance Page
- **Issue**: Current QR scan interface is basic; doesn't match Figma layout
- **Fix**: Align with Figma for session selector, scan result card

### Payments Page
- **Issue**: Summary cards are mostly UI; values are hardcoded
- **Fix**: Connect to real DB queries for revenue, collected, outstanding, overdue

### Reports Page
- **Issue**: Page doesn't exist
- **Fix**: Create page matching Figma design with report cards

---

## Profile Image Implementation Status

### Current State
- ✅ `students.photo_path` field exists (nullable)
- ✅ `teachers.photo_path` field exists (nullable)
- ❌ `administrators.photo_path` field **missing** — Must add
- ⚠️ Image import workflow not implemented (no file dialog, no validation)
- ⚠️ Image storage not organized (no managed media folder structure)
- ⚠️ `getPhotoUrl()` IPC exists but implementation unclear
- ✅ Backup likely covers photos (needs verification)

### Required Implementation
1. Create managed media folder structure:
   ```
   app.getPath("userData")/media/
   ├── administrators/
   ├── students/
   └── teachers/
   ```
2. Implement image selection dialog (IPC)
3. Validate and process images (JPEG, PNG, WebP only)
4. Generate safe random filenames
5. Store only relative paths in SQLite
6. Update all UI components to display images or initials fallback
7. Include images in backup/restore

---

## Data Model Issues

### Courses & Groups Hierarchy
- **Issue**: No normalized schedule representation
  - Current: `groups.schedule_json` contains text like "Mon/Wed 08:00–10:00"
  - Problem: Hard to query, iterate, or validate
- **Fix**: Create `group_schedule_slots` table as specified above

### Session Generation
- **Issue**: `attendance_sessions` exist but no mechanism to generate them
  - Recurring schedules are stored as JSON, not in slots
  - No session generation from weekly patterns
  - Sessions must be manually created
- **Fix**: Implement `sessions.generateFromSchedule()` to create instances for 8–12 week window

### Session Types & Extra Sessions
- **Issue**: Current schema has only `status` field (open/closed), no type field
  - Cannot distinguish regular vs. extra sessions
  - Cannot cancel a session vs. close it
- **Fix**: Extend `attendance_sessions` table:
  ```sql
  ALTER TABLE attendance_sessions ADD COLUMN session_type TEXT DEFAULT 'regular' 
    CHECK(session_type IN ('regular', 'extra', 'makeup', 'cancelled'));
  ALTER TABLE attendance_sessions ADD COLUMN cancelled_reason TEXT;
  ```

### Attendance Uniqueness
- **Issue**: UNIQUE(session_id, student_id) is correct
- **Status**: ✅ Already implemented

### Referential Integrity
- **Status**: ✅ Foreign keys mostly present
- **Issue**: No explicit FK for `attendance_sessions.schedule_slot_id` (doesn't exist yet)

---

## Internationalization (i18n) Status

### Current Support
- ✅ i18next framework installed
- ✅ Arabic, French, English declared
- ✅ React-i18next integrated

### Coverage Issues
- ⚠️ Many new features not yet translated:
  - Sessions
  - Extra session
  - Next session
  - Remaining sessions
  - Change password
  - Activity log
  - Student lookup
  - Print preview
  - Save PDF
  - Session status
  - Session type

### Required Actions
- Add translation keys for all new features
- Ensure Arabic is RTL-aware in new components
- Ensure French and English are LTR

---

## Security & Architecture

### ✅ Electron Security Current State
- `contextIsolation: true`
- `nodeIntegration: false`
- `sandbox: true`
- Preload API properly typed
- No direct `fs`, `ipcRenderer` exposure

### ⚠️ Security Concerns to Address
- Password change handler may not be fully isolated
- Image upload needs validation against path traversal
- Backup restore needs password verification
- No session timeout / automatic lock (must implement)
- Audit log doesn't track all actions yet

---

## Missing Business Logic

### Profile Image Selection & Upload
- No file dialog → image selection
- No image validation (format, size)
- No managed storage
- No deletion/replacement logic

### Schedule Slot Management
- No UI to create/edit/delete recurring schedule slots
- No weekly schedule view

### Session Generation
- No automatic generation from schedules
- No idempotency check (prevent duplicates)
- No configurable window (8–12 weeks)

### Extra Sessions
- No UI to create extra sessions
- No validation against teacher conflicts
- No room conflict detection

### QR Lookup Mode
- Only attendance mode implemented
- Lookup mode missing (scan → show profile, don't record attendance)

### Attendance Manual Correction
- No UI to edit recorded attendance
- No correction logging

### Remaining Sessions Calculation
- No method to count future sessions
- Current code undefined behavior

### Automatic Lock
- No implementation
- No idle detection
- No unlock via password

### Audit Log Display
- Audit log table exists
- No UI to view audit entries
- No filtering or search

### Reports
- No generation logic
- No CSV export
- No PDF export
- No print preview (window.print() only)

### Receipt Printing
- No dedicated receipt layout
- No print preview

---

## Backup & Restore

### Current Status
- ✅ `backups.create()` exists
- ✅ `backups.list()` exists
- ✅ `backups.verify()` exists
- ✅ `backups.restore()` exists
- ⚠️ Media files may not be included (must verify)

### Required Actions
1. Verify backup includes:
   - SQLite database
   - `media/administrators/` photos
   - `media/students/` photos
   - `media/teachers/` photos
   - `media/school/` logo
2. Update restore to reconstruct media folder structure
3. Test backup → restore → all images displayed

---

## Database State

### First Run Behavior
- ✅ `auth.checkFirstRun()` detects first run
- ✅ `auth.completeSetup()` initializes school + admin
- ⚠️ Need to verify school logo upload during setup

### Migrations
- ✅ Migration system in place (version tracking via app_metadata)
- ✅ Pre-migration backups created
- ⚠️ No migration 2 (must add for new tables/fields)

---

## Build & Testing Status

### Available Commands
- ✅ `pnpm dev` — Development mode
- ✅ `pnpm build` — Production build
- ✅ `pnpm typecheck` — TypeScript check
- ✅ `pnpm lint` — ESLint
- ✅ `pnpm test` — Vitest (unit tests)
- ✅ `pnpm test:e2e` — Playwright E2E
- ✅ `pnpm dist:win` — Build Windows installer

### Test Coverage
- ⚠️ No indication of current test coverage
- ❌ No test files visible for new features

---

## Installer & Packaging

### Current Status
- ✅ electron-builder configured
- ✅ `pnpm dist:win` produces NSIS installer
- ⚠️ Must verify seed data is not included in production build

---

## Summary of Required Changes

### Phase 1: Database & Backend
1. ✅ Create `group_schedule_slots` migration
2. ✅ Create `student_notes` migration (optional)
3. ✅ Add `administrators.photo_path` migration
4. ✅ Extend `attendance_sessions` schema (session_type, cancelled_reason)
5. ✅ Implement schedule slot IPC handlers
6. ✅ Implement session generation logic
7. ✅ Implement QR lookup mode handler
8. ✅ Implement reports generation logic
9. ✅ Implement audit log reading
10. ✅ Implement admin profile update handler

### Phase 2: IPC API Expansion
1. ✅ Add `schedules.*` methods
2. ✅ Add `sessions.*` methods
3. ✅ Add `reports.*` methods
4. ✅ Add `settings.getAdministrator()` and `settings.updateAdministrator()`
5. ✅ Add `settings.setAutoLock()` and `settings.getAutoLockStatus()`
6. ✅ Add `media.selectProfileImage()`
7. ✅ Add `media.removeProfileImage()`
8. ✅ Add `attendance.lookupStudent()`
9. ✅ Add `settings.listAuditLogs()`

### Phase 3: Profile Image Workflow
1. ✅ Create managed media folder structure
2. ✅ Implement image selection dialog (IPC)
3. ✅ Implement image validation and processing
4. ✅ Update student/teacher/admin create/edit forms
5. ✅ Ensure images appear in all required locations
6. ✅ Update backup/restore to handle media

### Phase 4: UI Component Restoration & Creation
1. ✅ Restore Student Profile to Figma design
2. ✅ Create dedicated StudentCard component
3. ✅ Implement student card print/PDF/preview
4. ✅ Restore Courses & Groups to match Figma
5. ✅ Implement schedule slot management UI
6. ✅ Create weekly timetable display
7. ✅ Restore Settings page to Figma design
8. ✅ Implement all Settings tabs fully
9. ✅ Create Reports page
10. ✅ Create Attendance page redesign with session selection

### Phase 5: Feature Implementation
1. ✅ Implement schedule slot CRUD
2. ✅ Implement session generation
3. ✅ Implement extra session creation
4. ✅ Implement dual QR modes (attendance + lookup)
5. ✅ Implement receipt printing
6. ✅ Implement report generation (enrollment, attendance, revenue, outstanding)
7. ✅ Implement CSV export
8. ✅ Implement PDF export with print preview
9. ✅ Implement automatic lock
10. ✅ Implement audit log viewing

### Phase 6: Internationalization
1. ✅ Add translation keys for all new features
2. ✅ Ensure Arabic RTL in new components
3. ✅ Test all languages on all new pages

### Phase 7: Testing & Verification
1. ✅ Run typecheck, lint, test, build
2. ✅ Test all E2E workflows (session, attendance, extra session, QR lookup, reports, etc.)
3. ✅ Test backup → restore with images
4. ✅ Test packaged Windows application
5. ✅ Visual QA against Figma

---

## Prioritized Task List

### Critical Path (Must Complete)
1. Database migrations (new tables, new fields)
2. Schedule slot IPC handlers
3. Session generation
4. QR lookup mode
5. Student profile restoration to Figma
6. Student card component + print
7. Settings page restoration
8. Password change wiring
9. Audit log viewing
10. Reports framework

### High Priority (Should Complete)
1. Admin photo support
2. Weekly timetable display
3. Extra session creation
4. Automatic lock
5. PDF export for reports

### Medium Priority (Nice to Have)
1. Receipt printing optimization
2. Teacher schedule view
3. Room conflict detection
4. Teacher conflict detection
5. Manual attendance correction UI

### Low Priority (Future)
1. Advanced analytics
2. SMS notifications
3. Student portal
4. Parent app

---

## Known Risks

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Migrating old schedule_json | High | Create migration with parsing; preserve old field; manual cleanup UI |
| Session generation idempotency | High | UNIQUE constraint on (group, date, start_time, regular slot) |
| Image storage on first run | Medium | Create media folder on app startup |
| Backup compatibility | Medium | Test restore on clean install |
| Print dialog behavior (no preview) | High | Implement in-app print preview before system dialog |
| Mock data in production | High | Search and remove all mock data from production builds |
| Schema version mismatch | Medium | Comprehensive pre-migration backup |

---

## Verification Checklist

- [ ] All database migrations applied without error
- [ ] All IPC handlers registered and working
- [ ] All pages render without TypeScript errors
- [ ] All pages use real database data (no mock data in production UI)
- [ ] All buttons do something (no `onClick={() => {}}`)
- [ ] Profile images appear and persist after restart
- [ ] Backup includes media files
- [ ] Restore restores media files
- [ ] Student card prints correctly (CR80)
- [ ] Reports preview works
- [ ] PDF export works
- [ ] CSV export works
- [ ] Arabic RTL is correct
- [ ] French LTR is correct
- [ ] English LTR is correct
- [ ] `pnpm typecheck` passes
- [ ] `pnpm lint` passes
- [ ] `pnpm test` passes (or N/A if no tests)
- [ ] `pnpm build` succeeds
- [ ] `pnpm dist:win` succeeds
- [ ] Packaged app starts and runs without errors

---

**End of Audit**
