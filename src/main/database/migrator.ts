import fs from 'node:fs'
import path from 'node:path'
import { getSqlite, getDatabasePath_ } from './connection'
import log from 'electron-log'
import { app } from 'electron'

// ─── Migration definitions ────────────────────────────────────────────────────

const MIGRATIONS: { version: number; name: string; sql: string }[] = [
  {
    version: 1,
    name: 'initial_schema',
    sql: `
      CREATE TABLE IF NOT EXISTS app_metadata (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key TEXT NOT NULL UNIQUE,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS administrators (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        full_name TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'admin' CHECK(role IN ('superadmin', 'admin')),
        preferred_language TEXT NOT NULL DEFAULT 'ar' CHECK(preferred_language IN ('ar', 'fr', 'en')),
        is_active INTEGER NOT NULL DEFAULT 1,
        failed_login_attempts INTEGER NOT NULL DEFAULT 0,
        locked_until TEXT,
        last_login_at TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS school_settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        school_name_ar TEXT NOT NULL DEFAULT '',
        school_name_fr TEXT NOT NULL DEFAULT '',
        school_name_en TEXT NOT NULL DEFAULT '',
        phone TEXT,
        email TEXT,
        address TEXT,
        academic_year TEXT NOT NULL DEFAULT '2025-2026',
        currency TEXT NOT NULL DEFAULT 'DZD',
        student_number_prefix TEXT NOT NULL DEFAULT 'ETU',
        receipt_prefix TEXT NOT NULL DEFAULT 'REC',
        default_language TEXT NOT NULL DEFAULT 'ar',
        backup_directory TEXT,
        automatic_backup_enabled INTEGER NOT NULL DEFAULT 0,
        backups_to_retain INTEGER NOT NULL DEFAULT 30,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS students (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        student_number TEXT NOT NULL UNIQUE,
        first_name_ar TEXT NOT NULL,
        last_name_ar TEXT NOT NULL,
        first_name_fr TEXT NOT NULL,
        last_name_fr TEXT NOT NULL,
        date_of_birth TEXT,
        gender TEXT NOT NULL CHECK(gender IN ('male', 'female')),
        phone TEXT,
        guardian_name TEXT,
        guardian_relationship TEXT,
        guardian_phone TEXT,
        secondary_phone TEXT,
        address TEXT,
        photo_path TEXT,
        registration_date TEXT NOT NULL DEFAULT (date('now')),
        status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'inactive', 'archived')),
        qr_token TEXT NOT NULL UNIQUE,
        qr_token_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        archived_at TEXT
      );

      CREATE UNIQUE INDEX IF NOT EXISTS idx_students_number ON students(student_number);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_students_qr ON students(qr_token);
      CREATE INDEX IF NOT EXISTS idx_students_name_ar ON students(last_name_ar);
      CREATE INDEX IF NOT EXISTS idx_students_name_fr ON students(last_name_fr);
      CREATE INDEX IF NOT EXISTS idx_students_status ON students(status);

      CREATE TABLE IF NOT EXISTS teachers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        phone TEXT,
        email TEXT,
        address TEXT,
        photo_path TEXT,
        status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'inactive', 'archived')),
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        archived_at TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_teachers_name ON teachers(last_name);
      CREATE INDEX IF NOT EXISTS idx_teachers_status ON teachers(status);

      CREATE TABLE IF NOT EXISTS courses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name_ar TEXT NOT NULL,
        name_fr TEXT NOT NULL,
        name_en TEXT NOT NULL DEFAULT '',
        description_ar TEXT,
        description_fr TEXT,
        description_en TEXT,
        default_price REAL NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'inactive')),
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS groups (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        course_id INTEGER NOT NULL REFERENCES courses(id),
        teacher_id INTEGER NOT NULL REFERENCES teachers(id),
        name TEXT NOT NULL,
        room TEXT,
        schedule_json TEXT,
        capacity INTEGER NOT NULL DEFAULT 30,
        monthly_price REAL NOT NULL DEFAULT 0,
        start_date TEXT NOT NULL,
        end_date TEXT,
        status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'inactive', 'completed')),
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_groups_course ON groups(course_id);
      CREATE INDEX IF NOT EXISTS idx_groups_teacher ON groups(teacher_id);
      CREATE INDEX IF NOT EXISTS idx_groups_status ON groups(status);

      CREATE TABLE IF NOT EXISTS enrollments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        student_id INTEGER NOT NULL REFERENCES students(id),
        group_id INTEGER NOT NULL REFERENCES groups(id),
        agreed_price REAL NOT NULL,
        enrollment_date TEXT NOT NULL DEFAULT (date('now')),
        status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'inactive', 'completed')),
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(student_id, group_id)
      );

      CREATE INDEX IF NOT EXISTS idx_enrollments_student ON enrollments(student_id);
      CREATE INDEX IF NOT EXISTS idx_enrollments_group ON enrollments(group_id);

      CREATE TABLE IF NOT EXISTS attendance_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        group_id INTEGER NOT NULL REFERENCES groups(id),
        session_date TEXT NOT NULL,
        planned_start_time TEXT,
        actual_start_time TEXT,
        end_time TEXT,
        room TEXT,
        late_threshold_minutes INTEGER NOT NULL DEFAULT 10,
        status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open', 'closed')),
        created_by INTEGER NOT NULL REFERENCES administrators(id),
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_sessions_group_date ON attendance_sessions(group_id, session_date);
      CREATE INDEX IF NOT EXISTS idx_sessions_date ON attendance_sessions(session_date);

      CREATE TABLE IF NOT EXISTS attendance_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id INTEGER NOT NULL REFERENCES attendance_sessions(id),
        student_id INTEGER NOT NULL REFERENCES students(id),
        scanned_at TEXT,
        attendance_status TEXT NOT NULL CHECK(attendance_status IN ('present', 'absent', 'late')),
        source TEXT NOT NULL DEFAULT 'qr' CHECK(source IN ('qr', 'manual')),
        notes TEXT,
        created_by INTEGER REFERENCES administrators(id),
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(session_id, student_id)
      );

      CREATE INDEX IF NOT EXISTS idx_attendance_session ON attendance_records(session_id);
      CREATE INDEX IF NOT EXISTS idx_attendance_student ON attendance_records(student_id);

      CREATE TABLE IF NOT EXISTS payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        receipt_number TEXT NOT NULL UNIQUE,
        student_id INTEGER NOT NULL REFERENCES students(id),
        enrollment_id INTEGER NOT NULL REFERENCES enrollments(id),
        billing_period TEXT NOT NULL,
        amount REAL NOT NULL CHECK(amount >= 0),
        payment_method TEXT NOT NULL CHECK(payment_method IN ('cash', 'transfer', 'check')),
        payment_date TEXT NOT NULL,
        reference TEXT,
        notes TEXT,
        received_by INTEGER NOT NULL REFERENCES administrators(id),
        status TEXT NOT NULL DEFAULT 'paid' CHECK(status IN ('paid', 'cancelled')),
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_receipt ON payments(receipt_number);
      CREATE INDEX IF NOT EXISTS idx_payments_student ON payments(student_id);
      CREATE INDEX IF NOT EXISTS idx_payments_date ON payments(payment_date);
      CREATE INDEX IF NOT EXISTS idx_payments_period ON payments(billing_period);

      CREATE TABLE IF NOT EXISTS audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        administrator_id INTEGER REFERENCES administrators(id),
        action TEXT NOT NULL,
        entity_type TEXT,
        entity_id INTEGER,
        sanitized_details_json TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_audit_admin ON audit_logs(administrator_id);
      CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action);
      CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity_type, entity_id);

      -- Seed: mark schema version
      INSERT OR IGNORE INTO app_metadata(key, value) VALUES('schema_version', '1');
      INSERT OR IGNORE INTO app_metadata(key, value) VALUES('first_run', 'true');
    `,
  },
  {
    version: 2,
    name: 'add_schedules_and_admin_photo',
    sql: `
      -- Add photo_path to administrators (nullable)
      ALTER TABLE administrators ADD COLUMN photo_path TEXT;

      -- Create group_schedule_slots for normalized recurring schedules
      CREATE TABLE IF NOT EXISTS group_schedule_slots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        group_id INTEGER NOT NULL REFERENCES groups(id),
        weekday INTEGER NOT NULL CHECK(weekday >= 0 AND weekday <= 6),
        start_time TEXT NOT NULL,
        end_time TEXT NOT NULL,
        room TEXT,
        effective_from TEXT NOT NULL DEFAULT (date('now')),
        effective_until TEXT,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        created_by INTEGER REFERENCES administrators(id),
        UNIQUE(group_id, weekday, start_time)
      );

      CREATE INDEX IF NOT EXISTS idx_schedule_group ON group_schedule_slots(group_id);
      CREATE INDEX IF NOT EXISTS idx_schedule_weekday ON group_schedule_slots(weekday);
      CREATE INDEX IF NOT EXISTS idx_schedule_active ON group_schedule_slots(is_active);

      -- Create student_notes table for administrative notes
      CREATE TABLE IF NOT EXISTS student_notes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        student_id INTEGER NOT NULL REFERENCES students(id),
        note_text TEXT NOT NULL,
        created_by INTEGER NOT NULL REFERENCES administrators(id),
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_notes_student ON student_notes(student_id);

      -- Extend attendance_sessions with session_type and cancelled_reason
      ALTER TABLE attendance_sessions ADD COLUMN session_type TEXT NOT NULL DEFAULT 'regular' 
        CHECK(session_type IN ('regular', 'extra', 'makeup', 'cancelled'));
      ALTER TABLE attendance_sessions ADD COLUMN schedule_slot_id INTEGER REFERENCES group_schedule_slots(id);
      ALTER TABLE attendance_sessions ADD COLUMN cancelled_reason TEXT;

      CREATE INDEX IF NOT EXISTS idx_sessions_type ON attendance_sessions(session_type);
      CREATE INDEX IF NOT EXISTS idx_sessions_schedule_slot ON attendance_sessions(schedule_slot_id);
    `,
  },
 {
  version: 3,
  name: 'fix_attendance_room_duplicate',
  sql: `
    SELECT 1;
  `,
},
{
  version: 4,
  name: 'credit_ledger_and_session_autogen',
  sql: `
    -- 1. Add payment type to support ledger model (credit top-up, deduction per session, transfer, refund)
    ALTER TABLE payments ADD COLUMN payment_type TEXT NOT NULL DEFAULT 'credit'
      CHECK(payment_type IN ('credit','deduction','transfer_in','transfer_out','refund'));
    -- Link deduction payments to specific sessions
    ALTER TABLE payments ADD COLUMN session_id INTEGER REFERENCES attendance_sessions(id);
    -- Make payment_method nullable for system-generated deductions
    -- (SQLite doesn't support DROP NOT NULL; we store empty string for auto deductions)

    -- 2. Add default_teacher_id to courses (subject → teacher relationship)
    ALTER TABLE courses ADD COLUMN default_teacher_id INTEGER REFERENCES teachers(id);

    -- 3. Clean up any existing duplicate attendance sessions before creating the unique index:
    --    First, remove duplicate attendance_records if a student has records in both canonical & duplicate sessions
    DELETE FROM attendance_records
    WHERE id IN (
      SELECT ar_dup.id
      FROM attendance_records ar_dup
      JOIN attendance_sessions s_dup ON ar_dup.session_id = s_dup.id
      JOIN attendance_sessions s_canon ON s_canon.group_id = s_dup.group_id
        AND s_canon.session_date = s_dup.session_date
        AND COALESCE(s_canon.schedule_slot_id, 0) = COALESCE(s_dup.schedule_slot_id, 0)
        AND s_canon.id < s_dup.id
      JOIN attendance_records ar_canon ON ar_canon.session_id = s_canon.id
        AND ar_canon.student_id = ar_dup.student_id
    );

    --    Second, re-point any remaining attendance_records from duplicate sessions to canonical session
    UPDATE attendance_records
    SET session_id = (
      SELECT MIN(s_canon.id)
      FROM attendance_sessions s_canon
      JOIN attendance_sessions s_dup ON s_canon.group_id = s_dup.group_id
        AND s_canon.session_date = s_dup.session_date
        AND COALESCE(s_canon.schedule_slot_id, 0) = COALESCE(s_dup.schedule_slot_id, 0)
      WHERE s_dup.id = attendance_records.session_id
    )
    WHERE session_id IN (
      SELECT id FROM attendance_sessions
      WHERE id NOT IN (
        SELECT MIN(id) FROM attendance_sessions
        GROUP BY group_id, session_date, COALESCE(schedule_slot_id, 0)
      )
    );

    --    Third, delete the duplicate attendance_sessions
    DELETE FROM attendance_sessions
    WHERE id NOT IN (
      SELECT MIN(id)
      FROM attendance_sessions
      GROUP BY group_id, session_date, COALESCE(schedule_slot_id, 0)
    );

    -- 4. Add unique constraint to prevent duplicate sessions (group + date + slot)
    --    SQLite can't add UNIQUE after creation, so we create a partial unique index
    CREATE UNIQUE INDEX IF NOT EXISTS idx_sessions_group_date_slot
      ON attendance_sessions(group_id, session_date, COALESCE(schedule_slot_id, 0));

    -- 5. Extend attendance_records to allow 'not_enrolled' status (pre-enrollment sessions)
    --    SQLite CHECK constraints can't be altered; the application enforces this at service level
    --    We add a new column to track this case cleanly
    ALTER TABLE attendance_records ADD COLUMN was_enrolled INTEGER NOT NULL DEFAULT 1;

    -- 6. Add credit balance index for fast lookups
    CREATE INDEX IF NOT EXISTS idx_payments_enrollment_type ON payments(enrollment_id, payment_type, status);
    CREATE INDEX IF NOT EXISTS idx_payments_session ON payments(session_id);

    -- 7. Update schema version
    INSERT OR REPLACE INTO app_metadata(key, value, updated_at) VALUES('schema_version', '4', datetime('now'));
  `,
},
  {
    version: 5,
    name: 'session_dedup_and_debt_tracking',
    sql: `
      -- 1. Merge and clean duplicate attendance sessions for same group, date and start time
      DELETE FROM attendance_records
      WHERE id IN (
        SELECT ar_dup.id
        FROM attendance_records ar_dup
        JOIN attendance_sessions s_dup ON ar_dup.session_id = s_dup.id
        JOIN attendance_sessions s_canon ON s_canon.group_id = s_dup.group_id
          AND s_canon.session_date = s_dup.session_date
          AND COALESCE(s_canon.planned_start_time, '') = COALESCE(s_dup.planned_start_time, '')
          AND s_canon.id < s_dup.id
        JOIN attendance_records ar_canon ON ar_canon.session_id = s_canon.id
          AND ar_canon.student_id = ar_dup.student_id
      );

      UPDATE attendance_records
      SET session_id = (
        SELECT MIN(s_canon.id)
        FROM attendance_sessions s_canon
        JOIN attendance_sessions s_dup ON s_canon.group_id = s_dup.group_id
          AND s_canon.session_date = s_dup.session_date
          AND COALESCE(s_canon.planned_start_time, '') = COALESCE(s_dup.planned_start_time, '')
        WHERE s_dup.id = attendance_records.session_id
      )
      WHERE session_id IN (
        SELECT id FROM attendance_sessions
        WHERE id NOT IN (
          SELECT MIN(id) FROM attendance_sessions
          GROUP BY group_id, session_date, COALESCE(planned_start_time, '')
        )
      );

      DELETE FROM attendance_sessions
      WHERE id NOT IN (
        SELECT MIN(id)
        FROM attendance_sessions
        GROUP BY group_id, session_date, COALESCE(planned_start_time, '')
      );

      -- 2. Create unique index to guarantee no duplicate session per group, date and start time
      CREATE UNIQUE INDEX IF NOT EXISTS idx_sessions_group_date_time
        ON attendance_sessions(group_id, session_date, COALESCE(planned_start_time, ''));

      -- 3. Add search indexes for payments and student lookups
      CREATE INDEX IF NOT EXISTS idx_payments_status_period ON payments(status, billing_period);
      CREATE INDEX IF NOT EXISTS idx_enrollments_student_status ON enrollments(student_id, status);

      -- 4. Update schema version
      INSERT OR REPLACE INTO app_metadata(key, value, updated_at) VALUES('schema_version', '5', datetime('now'));
    `,
  },
  {
    version: 6,
    name: 'add_course_id_to_teachers',
    sql: `
      ALTER TABLE teachers ADD COLUMN course_id INTEGER REFERENCES courses(id);
      CREATE INDEX IF NOT EXISTS idx_teachers_course ON teachers(course_id);
      INSERT OR REPLACE INTO app_metadata(key, value, updated_at) VALUES('schema_version', '6', datetime('now'));
    `,
  },
  {
    version: 7,
    name: 'add_price_to_attendance_sessions',
    sql: `
      ALTER TABLE attendance_sessions ADD COLUMN price INTEGER;
      INSERT OR REPLACE INTO app_metadata(key, value, updated_at) VALUES('schema_version', '7', datetime('now'));
    `,
  },
  {
    version: 8,
    name: 'inactive_status_and_enrollment_cancellation',
    sql: `
      -- Add is_inactive flag to attendance_records
      -- SQLite CHECK constraints cannot be altered, so we use a flag column
      -- to represent the 'inactive' status at the application layer
      ALTER TABLE attendance_records ADD COLUMN is_inactive INTEGER NOT NULL DEFAULT 0;

      -- Add cancellation fields to enrollments
      ALTER TABLE enrollments ADD COLUMN cancelled_at TEXT;
      ALTER TABLE enrollments ADD COLUMN cancel_reason TEXT;
      ALTER TABLE enrollments ADD COLUMN refund_amount REAL;

      -- Indexes for fast lookups
      CREATE INDEX IF NOT EXISTS idx_attendance_inactive ON attendance_records(is_inactive);
      CREATE INDEX IF NOT EXISTS idx_enrollments_cancelled ON enrollments(cancelled_at);

      INSERT OR REPLACE INTO app_metadata(key, value, updated_at)
        VALUES('schema_version', '8', datetime('now'));
    `,
  },
  {
    version: 9,
    name: 'ledger_normalization_and_late_removal',
    sql: `
      -- 1. Migrate any existing 'late' attendance records to 'present' (Requirement 8)
      UPDATE attendance_records SET attendance_status = 'present' WHERE attendance_status = 'late';

      -- 2. Ensure student_notes table exists (Requirement 44)
      CREATE TABLE IF NOT EXISTS student_notes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        student_id INTEGER NOT NULL REFERENCES students(id),
        note_text TEXT NOT NULL,
        created_by INTEGER NOT NULL REFERENCES administrators(id),
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_notes_student ON student_notes(student_id);

      -- 3. Recreate payments table to support full ledger model without restrictive CHECK constraints
      CREATE TABLE IF NOT EXISTS payments_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        receipt_number TEXT NOT NULL UNIQUE,
        student_id INTEGER NOT NULL REFERENCES students(id),
        enrollment_id INTEGER NOT NULL REFERENCES enrollments(id),
        billing_period TEXT NOT NULL DEFAULT '',
        amount REAL NOT NULL,
        payment_type TEXT NOT NULL DEFAULT 'credit',
        session_id INTEGER REFERENCES attendance_sessions(id),
        payment_method TEXT NOT NULL DEFAULT 'cash',
        payment_date TEXT NOT NULL,
        reference TEXT,
        notes TEXT,
        received_by INTEGER NOT NULL REFERENCES administrators(id),
        status TEXT NOT NULL DEFAULT 'paid',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      INSERT INTO payments_new (
        id, receipt_number, student_id, enrollment_id, billing_period,
        amount, payment_type, session_id, payment_method, payment_date,
        reference, notes, received_by, status, created_at, updated_at
      )
      SELECT
        id, receipt_number, student_id, enrollment_id, billing_period,
        amount, payment_type, session_id, COALESCE(payment_method, 'cash'), payment_date,
        reference, notes, received_by, status, created_at, updated_at
      FROM payments;

      DROP TABLE payments;
      ALTER TABLE payments_new RENAME TO payments;

      -- 4. Recreate all payment indexes
      CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_receipt ON payments(receipt_number);
      CREATE INDEX IF NOT EXISTS idx_payments_student ON payments(student_id);
      CREATE INDEX IF NOT EXISTS idx_payments_date ON payments(payment_date);
      CREATE INDEX IF NOT EXISTS idx_payments_period ON payments(billing_period);
      CREATE INDEX IF NOT EXISTS idx_payments_enrollment_type ON payments(enrollment_id, payment_type, status);
      CREATE INDEX IF NOT EXISTS idx_payments_session ON payments(session_id);
      CREATE INDEX IF NOT EXISTS idx_payments_status_period ON payments(status, billing_period);

      -- 5. Partial unique index to enforce strict session deduction idempotency (Requirement 13)
      CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_session_deduction
        ON payments(enrollment_id, session_id, payment_type)
        WHERE payment_type IN ('deduction', 'session_charge') AND status = 'paid';

      -- 6. Update schema version
      INSERT OR REPLACE INTO app_metadata(key, value, updated_at)
        VALUES('schema_version', '9', datetime('now'));
    `,
  },
]

// ─── Migration runner ─────────────────────────────────────────────────────────

export async function runMigrations(): Promise<void> {
  const sqlite = getSqlite()

  // Ensure app_metadata exists first (bootstrapping)
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS app_metadata (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT NOT NULL UNIQUE,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `)

  const getVersion = sqlite.prepare<[], { value: string }>(
    `SELECT value FROM app_metadata WHERE key = 'schema_version' LIMIT 1`
  )

  const row = getVersion.get()
  const currentVersion = row ? parseInt(row.value, 10) : 0

  const pendingMigrations = MIGRATIONS.filter((m) => m.version > currentVersion)

  if (pendingMigrations.length === 0) {
    log.info(`Database schema is up to date (version ${currentVersion})`)
    return
  }

  log.info(`Running ${pendingMigrations.length} migration(s) from version ${currentVersion}`)

  for (const migration of pendingMigrations) {
    log.info(`Applying migration ${migration.version}: ${migration.name}`)

    // Back up DB before applying migration (if DB already has data)
    if (currentVersion > 0) {
      await backupBeforeMigration(migration.version)
    }

    const applyMigration = sqlite.transaction(() => {
      // Strip single-line SQL comments (-- ...) before splitting on semicolons
      // to prevent comment text (e.g. "-- we store X; we do Y") from being sent as SQL
      const stripped = migration.sql
        .split('\n')
        .map((line) => {
          const commentIdx = line.indexOf('--')
          return commentIdx >= 0 ? line.slice(0, commentIdx) : line
        })
        .join('\n')

      const statements = stripped
        .split(';')
        .map((s) => s.trim())
        .filter((s) => s.length > 0)

      for (const statement of statements) {
        try {
          sqlite.exec(statement)
        } catch (err: any) {
          const errMsg = String(err?.message || err).toLowerCase()
          if (errMsg.includes('duplicate column name') || errMsg.includes('already exists')) {
            log.warn(`[Migrator] Column or index already exists in migration ${migration.version}: ${statement}`)
          } else {
            throw err
          }
        }
      }

      sqlite.prepare(
        `INSERT OR REPLACE INTO app_metadata(key, value, updated_at) VALUES('schema_version', ?, datetime('now'))`
      ).run(String(migration.version))
    })

    try {
      applyMigration()
      log.info(`Migration ${migration.version} applied successfully`)
    } catch (err) {
      log.error(`Migration ${migration.version} failed:`, err)
      throw err
    }
  }

  log.info(`Migrations complete. Schema now at version ${pendingMigrations[pendingMigrations.length - 1]?.version}`)
}

async function backupBeforeMigration(migrationVersion: number): Promise<void> {
  try {
    const dbPath = getDatabasePath_()
    const backupDir = path.join(app.getPath('userData'), 'backups', 'pre-migration')
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true })
    }
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    const backupPath = path.join(backupDir, `pre-migration-v${migrationVersion}-${timestamp}.sqlite`)
    fs.copyFileSync(dbPath, backupPath)
    log.info('Pre-migration backup created:', backupPath)
  } catch (err) {
    log.warn('Could not create pre-migration backup:', err)
    // Non-fatal — migration proceeds
  }
}

export function isFirstRun(): boolean {
  try {
    const sqlite = getSqlite()
    const adminCount = sqlite.prepare<[], { count: number }>(
      `SELECT COUNT(*) as count FROM administrators WHERE is_active = 1`
    ).get()
    const settingsCount = sqlite.prepare<[], { count: number }>(
      `SELECT COUNT(*) as count FROM school_settings`
    ).get()

    if (!adminCount || adminCount.count === 0) {
      return true
    }
    if (!settingsCount || settingsCount.count === 0) {
      return true
    }

    const row = sqlite.prepare<[], { value: string }>(
      `SELECT value FROM app_metadata WHERE key = 'first_run' LIMIT 1`
    ).get()
    return row?.value === 'true'
  } catch {
    return true
  }
}

export function markSetupComplete(): void {
  const sqlite = getSqlite()
  sqlite.prepare(
    `INSERT OR REPLACE INTO app_metadata(key, value, updated_at) VALUES('first_run', 'false', datetime('now'))`
  ).run()
}
