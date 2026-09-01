import type { DatabaseConnection } from '@/src/db/types'

/**
 * Initial schema migration.
 * Classrooms are stored as room TEXT snapshots on schedule tables.
 */
export const migration001InitialSchema = {
	version: 1,
	name: 'initial_schema',
	async up(db: DatabaseConnection): Promise<void> {
		await db.execAsync(`
			CREATE TABLE IF NOT EXISTS schema_migrations (
				version INTEGER PRIMARY KEY NOT NULL,
				name TEXT NOT NULL,
				applied_at TEXT NOT NULL
			);

			CREATE TABLE IF NOT EXISTS study_periods (
				id TEXT PRIMARY KEY NOT NULL,
				name TEXT NOT NULL,
				type TEXT NOT NULL CHECK (type IN ('YEAR', 'SEMESTER', 'QUARTER')),
				start_date TEXT NOT NULL,
				end_date TEXT NOT NULL,
				is_active INTEGER NOT NULL DEFAULT 0 CHECK (is_active IN (0, 1)),
				created_at TEXT NOT NULL,
				updated_at TEXT NOT NULL
			);

			CREATE TABLE IF NOT EXISTS teachers (
				id TEXT PRIMARY KEY NOT NULL,
				name TEXT NOT NULL,
				notes TEXT,
				created_at TEXT NOT NULL,
				updated_at TEXT NOT NULL
			);

			CREATE TABLE IF NOT EXISTS app_settings (
				id TEXT PRIMARY KEY NOT NULL,
				user_mode TEXT NOT NULL CHECK (user_mode IN ('SCHOOL', 'COLLEGE', 'UNIVERSITY')),
				active_study_period_id TEXT REFERENCES study_periods(id) ON DELETE SET NULL,
				default_reminder_minutes INTEGER NOT NULL DEFAULT 30,
				week_cycle_mode TEXT NOT NULL DEFAULT 'EVERY_WEEK'
					CHECK (week_cycle_mode IN ('EVERY_WEEK', 'TWO_WEEK')),
				cycle_anchor_date TEXT,
				cycle_length INTEGER NOT NULL DEFAULT 1 CHECK (cycle_length IN (1, 2)),
				first_day_of_week INTEGER NOT NULL DEFAULT 1
					CHECK (first_day_of_week BETWEEN 1 AND 7),
				created_at TEXT NOT NULL,
				updated_at TEXT NOT NULL
			);

			CREATE TABLE IF NOT EXISTS subjects (
				id TEXT PRIMARY KEY NOT NULL,
				study_period_id TEXT NOT NULL REFERENCES study_periods(id) ON DELETE CASCADE,
				name TEXT NOT NULL,
				short_name TEXT,
				color TEXT,
				room_default TEXT,
				teacher_id TEXT REFERENCES teachers(id) ON DELETE SET NULL,
				target_grade REAL,
				sort_order INTEGER NOT NULL DEFAULT 0,
				is_archived INTEGER NOT NULL DEFAULT 0 CHECK (is_archived IN (0, 1)),
				created_at TEXT NOT NULL,
				updated_at TEXT NOT NULL
			);

			CREATE TABLE IF NOT EXISTS schedule_entries (
				id TEXT PRIMARY KEY NOT NULL,
				study_period_id TEXT NOT NULL REFERENCES study_periods(id) ON DELETE CASCADE,
				subject_id TEXT NOT NULL REFERENCES subjects(id) ON DELETE RESTRICT,
				teacher_id TEXT REFERENCES teachers(id) ON DELETE SET NULL,
				room TEXT,
				weekday INTEGER NOT NULL CHECK (weekday BETWEEN 1 AND 7),
				start_time TEXT NOT NULL,
				end_time TEXT NOT NULL,
				lesson_type TEXT,
				week_cycle TEXT NOT NULL DEFAULT 'EVERY_WEEK'
					CHECK (week_cycle IN ('EVERY_WEEK', 'CYCLE_0', 'CYCLE_1')),
				created_at TEXT NOT NULL,
				updated_at TEXT NOT NULL
			);

			CREATE TABLE IF NOT EXISTS schedule_exceptions (
				id TEXT PRIMARY KEY NOT NULL,
				study_period_id TEXT NOT NULL REFERENCES study_periods(id) ON DELETE CASCADE,
				exception_date TEXT NOT NULL,
				schedule_entry_id TEXT REFERENCES schedule_entries(id) ON DELETE CASCADE,
				exception_type TEXT NOT NULL CHECK (
					exception_type IN (
						'CANCELLED',
						'RESCHEDULED',
						'ROOM_CHANGE',
						'TEACHER_CHANGE',
						'TIME_CHANGE',
						'ADDED'
					)
				),
				subject_id TEXT REFERENCES subjects(id) ON DELETE SET NULL,
				teacher_id TEXT REFERENCES teachers(id) ON DELETE SET NULL,
				room TEXT,
				start_time TEXT,
				end_time TEXT,
				new_date TEXT,
				notes TEXT,
				created_at TEXT NOT NULL,
				updated_at TEXT NOT NULL
			);

			CREATE TABLE IF NOT EXISTS assignments (
				id TEXT PRIMARY KEY NOT NULL,
				subject_id TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
				title TEXT NOT NULL,
				description TEXT,
				due_date TEXT NOT NULL,
				due_time TEXT,
				priority TEXT NOT NULL DEFAULT 'NORMAL'
					CHECK (priority IN ('LOW', 'NORMAL', 'HIGH')),
				status TEXT NOT NULL DEFAULT 'PENDING'
					CHECK (status IN ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED')),
				assignment_type TEXT NOT NULL DEFAULT 'HOMEWORK'
					CHECK (assignment_type IN (
						'HOMEWORK', 'PROJECT', 'ESSAY', 'LAB', 'TEST', 'EXAM', 'OTHER'
					)),
				source_schedule_entry_id TEXT REFERENCES schedule_entries(id) ON DELETE SET NULL,
				completed_at TEXT,
				notes TEXT,
				created_at TEXT NOT NULL,
				updated_at TEXT NOT NULL
			);

			CREATE TABLE IF NOT EXISTS assignment_photos (
				id TEXT PRIMARY KEY NOT NULL,
				assignment_id TEXT NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
				local_uri TEXT NOT NULL,
				created_at TEXT NOT NULL
			);

			CREATE TABLE IF NOT EXISTS grades (
				id TEXT PRIMARY KEY NOT NULL,
				subject_id TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
				value REAL NOT NULL,
				weight REAL NOT NULL DEFAULT 1.0,
				grade_type TEXT,
				grade_scale TEXT NOT NULL DEFAULT 'FIVE_POINT'
					CHECK (grade_scale IN (
						'FIVE_POINT', 'TEN_POINT', 'HUNDRED_POINT', 'LETTER', 'CUSTOM'
					)),
				date TEXT NOT NULL,
				note TEXT,
				created_at TEXT NOT NULL,
				updated_at TEXT NOT NULL
			);

			CREATE TABLE IF NOT EXISTS attendance (
				id TEXT PRIMARY KEY NOT NULL,
				subject_id TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
				schedule_entry_id TEXT REFERENCES schedule_entries(id) ON DELETE SET NULL,
				attendance_date TEXT NOT NULL,
				status TEXT NOT NULL CHECK (status IN ('PRESENT', 'ABSENT', 'EXCUSED')),
				notes TEXT,
				created_at TEXT NOT NULL,
				updated_at TEXT NOT NULL,
				UNIQUE (subject_id, schedule_entry_id, attendance_date)
			);

			CREATE TABLE IF NOT EXISTS focus_sessions (
				id TEXT PRIMARY KEY NOT NULL,
				subject_id TEXT REFERENCES subjects(id) ON DELETE SET NULL,
				assignment_id TEXT REFERENCES assignments(id) ON DELETE SET NULL,
				started_at TEXT NOT NULL,
				ended_at TEXT,
				duration_seconds INTEGER,
				completed INTEGER NOT NULL DEFAULT 0 CHECK (completed IN (0, 1)),
				created_at TEXT NOT NULL
			);

			CREATE TABLE IF NOT EXISTS holidays (
				id TEXT PRIMARY KEY NOT NULL,
				name TEXT NOT NULL,
				start_date TEXT NOT NULL,
				end_date TEXT NOT NULL,
				study_period_id TEXT REFERENCES study_periods(id) ON DELETE CASCADE,
				created_at TEXT NOT NULL,
				updated_at TEXT NOT NULL
			);

			CREATE INDEX IF NOT EXISTS idx_subjects_study_period
				ON subjects(study_period_id);
			CREATE INDEX IF NOT EXISTS idx_schedule_entries_period_weekday
				ON schedule_entries(study_period_id, weekday);
			CREATE INDEX IF NOT EXISTS idx_assignments_subject_due
				ON assignments(subject_id, due_date);
			CREATE INDEX IF NOT EXISTS idx_grades_subject_date
				ON grades(subject_id, date);
			CREATE INDEX IF NOT EXISTS idx_attendance_subject_date
				ON attendance(subject_id, attendance_date);
		`)
	},
}
