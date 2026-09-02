import type { Migration } from '@/src/db/types'

/** Active focus timer persistence and schedule import deduplication. */
export const migration005FocusAndImport: Migration = {
	version: 5,
	name: 'focus_timer_and_schedule_import',
	async up(db) {
		await db.execAsync(`
			CREATE TABLE IF NOT EXISTS active_focus_session (
				id INTEGER PRIMARY KEY CHECK (id = 1),
				subject_id TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
				assignment_id TEXT REFERENCES assignments(id) ON DELETE SET NULL,
				planned_duration_seconds INTEGER NOT NULL CHECK (planned_duration_seconds > 0),
				started_at TEXT NOT NULL,
				paused_at TEXT,
				accumulated_pause_ms INTEGER NOT NULL DEFAULT 0 CHECK (accumulated_pause_ms >= 0),
				notify_on_complete INTEGER NOT NULL DEFAULT 0 CHECK (notify_on_complete IN (0, 1)),
				notification_id TEXT,
				state TEXT NOT NULL CHECK (state IN ('RUNNING', 'PAUSED'))
			);

			CREATE TRIGGER IF NOT EXISTS trg_active_focus_assignment_subject_insert
			BEFORE INSERT ON active_focus_session
			WHEN NEW.assignment_id IS NOT NULL AND NOT EXISTS (
				SELECT 1 FROM assignments
				WHERE id = NEW.assignment_id AND subject_id = NEW.subject_id
			)
			BEGIN SELECT RAISE(ABORT, 'active focus assignment subject mismatch'); END;

			CREATE TRIGGER IF NOT EXISTS trg_active_focus_assignment_subject_update
			BEFORE UPDATE OF subject_id, assignment_id ON active_focus_session
			WHEN NEW.assignment_id IS NOT NULL AND NOT EXISTS (
				SELECT 1 FROM assignments
				WHERE id = NEW.assignment_id AND subject_id = NEW.subject_id
			)
			BEGIN SELECT RAISE(ABORT, 'active focus assignment subject mismatch'); END;

			CREATE TABLE IF NOT EXISTS schedule_import_history (
				id TEXT PRIMARY KEY NOT NULL,
				export_id TEXT NOT NULL,
				imported_at TEXT NOT NULL,
				study_period_id TEXT NOT NULL REFERENCES study_periods(id) ON DELETE CASCADE
			);

			CREATE UNIQUE INDEX IF NOT EXISTS uq_schedule_import_export_period
				ON schedule_import_history(export_id, study_period_id);

			CREATE INDEX IF NOT EXISTS idx_focus_sessions_started_at
				ON focus_sessions(started_at);
			CREATE INDEX IF NOT EXISTS idx_focus_sessions_subject
				ON focus_sessions(subject_id);
		`)
	},
}
