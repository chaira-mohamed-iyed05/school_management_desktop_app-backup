# Edupilot DZ — Application Stability & Crash Audit

This document records the diagnostics, root causes, and corrective measures implemented for all stability, keyboard, and crash issues identified in Edupilot DZ.

---

## 1. Identified Issues & Root Causes

### Issue 1.1: Random Blank Screen (White Screen of Death)
- **Root Cause**: The React renderer lacked a top-level Error Boundary. Any runtime exception occurring during rendering (e.g., encountering a `null` or malformed object in Student Profile, Notes, or Payments) caused React to completely unmount the component tree.
- **Correction**: 
  - Implemented `src/renderer/components/ErrorBoundary.tsx` wrapping all application routes in `App.tsx`.
  - Provides a localized recovery interface ("Restart this view", "Return to Dashboard") so users are never left on a blank screen.
  - Safely logs technical diagnostics to local file logs via IPC without displaying SQL, stack traces, filesystem paths, or sensitive student PII to users.

### Issue 1.2: Inability to Type into Inputs / Focus Hijacking
- **Root Cause**:
  1. `Attendance.tsx` used unconditional delayed focus timers (`setTimeout(() => inputRef.current?.focus(), 100)`) after scan events, stealing keyboard focus even when the user had navigated to a search input, notes field, or modal.
  2. Hardware USB QR/barcode scanners emulate keyboard wedge devices; keystrokes could trigger global hotkeys or scanner logic while users were actively editing text.
- **Correction**:
  - Implemented `isTypingTarget` guard in `src/renderer/utils/scannerGuard.ts`.
  - Ignored scanner interception whenever `event.target` is an `input`, `textarea`, `select`, `[contenteditable]`, or inside a dialog.
  - Constrained scanner auto-refocus so it only activates when no other editable element is focused.

### Issue 1.3: Student Notes Crash & State Loss
- **Root Cause**:
  - Notes were previously held only in local component state or unstructured `localStorage`, with no database persistence.
  - Clicking Save caused race conditions, state collisions on profile switches, and unhandled `null` errors.
  - Rapid double-clicking created duplicate notes or threw unhandled promise rejections.
- **Correction**:
  - Built a persistent SQLite service (`src/main/services/notes.service.ts`) backed by the `student_notes` table.
  - Implemented full CRUD with IPC channels (`notes:list`, `notes:create`, `notes:update`, `notes:delete`).
  - Added UI submit protection: save button disabled while in-flight, content preserved on failure, and duplicate submissions blocked.

### Issue 1.4: Main Process Crash Handling & Logging
- **Root Cause**:
  - The Electron main process did not listen for `uncaughtException`, `unhandledRejection`, `render-process-gone`, or `child-process-gone`.
  - Node-level errors crashed the application silently without localized or diagnostic logging.
- **Correction**:
  - Registered centralized `process.on('uncaughtException')` and `process.on('unhandledRejection')` in `src/main/main.ts`.
  - Added listeners on `mainWindow.webContents` for `render-process-gone` and `did-fail-load`.
  - Added `app.on('child-process-gone')` with structured diagnostic logging to `electron-log`.
  - Sanitized all logged errors to strictly omit passwords, auth tokens, and student personal data.

### Issue 1.5: Database Locking & Multi-Step Transaction Inconsistencies
- **Root Cause**:
  - Destructive operations such as group balance transfers, session refunds, and enrollment cancellations executed multiple separate SQL statements without wrapping them in atomic transactions.
  - If a step failed mid-way, partial writes corrupted student credit balances.
- **Correction**:
  - Wrapped all balance mutations, transfers, session status changes, and cancellations in atomic SQLite transactions (`sqlite.transaction(() => { ... })()`).
  - Enforced single-statement database operations with automated rollback on any error.

### Issue 1.6: Double-Click and Idempotency Hazards
- **Root Cause**:
  - Destructive/financial buttons (e.g., Transfer, Cancel enrollment, Refund, Scan attendance) did not disable during async operations, allowing users to double-click and trigger duplicate charges or refunds.
- **Correction**:
  - Added loading/disabled states to all financial and destructive buttons.
  - Introduced a partial unique index in SQLite (`idx_payments_session_deduction`) ensuring a session cannot be charged more than once for any student enrollment.
