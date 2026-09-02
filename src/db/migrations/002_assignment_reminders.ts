import type { Migration } from '@/src/db/types'

/**
 * Phase 3 migration: source occurrence date on assignments and reminder intent table.
 * Reminder platform IDs are stored separately from business fields.
 */
export const migration002AssignmentReminders: Migration = {
	version: 2,
	name: 'assignment_reminders_and_source_occurrence',
	async up(db) {
		await db.execAsync(`
			ALTER TABLE assignments ADD COLUMN source_occurrence_date TEXT;
		`)

		await db.execAsync(`
			CREATE TABLE IF NOT EXISTS assignment_reminders (
				id TEXT PRIMARY KEY NOT NULL,
				assignment_id TEXT NOT NULL UNIQUE,
				enabled INTEGER NOT NULL DEFAULT 0 CHECK (enabled IN (0, 1)),
				reminder_kind TEXT NOT NULL DEFAULT 'NONE' CHECK (
					reminder_kind IN (
						'NONE',
						'RELATIVE',
						'MORNING_OF_DUE',
						'EVENING_BEFORE',
						'DAY_BEFORE',
						'CUSTOM_ABSOLUTE'
					)
				),
				relative_minutes INTEGER,
				absolute_time TEXT CHECK (
					absolute_time IS NULL OR (
						absolute_time GLOB '[0-9][0-9]:[0-9][0-9]' AND absolute_time < '24:00'
					)
				),
				absolute_day_offset INTEGER NOT NULL DEFAULT 0,
				scheduled_at TEXT,
				notification_id TEXT,
				created_at TEXT NOT NULL,
				updated_at TEXT NOT NULL,
				FOREIGN KEY (assignment_id) REFERENCES assignments(id) ON DELETE CASCADE
			);
		`)

		await db.execAsync(`
			CREATE INDEX IF NOT EXISTS idx_assignment_photos_assignment
			ON assignment_photos(assignment_id);
		`)
	},
}
