import type { Migration } from '@/src/db/types'

/**
 * Phase 4 migration: subject grade scale, attendance target, grade-assignment link.
 */
export const migration003GradesAttendance: Migration = {
	version: 3,
	name: 'grades_attendance_enhancements',
	async up(db) {
		await db.execAsync(`
			ALTER TABLE subjects ADD COLUMN grade_scale TEXT NOT NULL DEFAULT 'FIVE_POINT'
				CHECK (grade_scale IN ('FIVE_POINT', 'TEN_POINT', 'HUNDRED_POINT', 'LETTER', 'CUSTOM'));
		`)

		await db.execAsync(`
			ALTER TABLE subjects ADD COLUMN attendance_target REAL
				CHECK (attendance_target IS NULL OR (attendance_target > 0 AND attendance_target <= 100));
		`)

		await db.execAsync(`
			ALTER TABLE grades ADD COLUMN assignment_id TEXT
				REFERENCES assignments(id) ON DELETE SET NULL;
		`)

		await db.execAsync(`
			CREATE INDEX IF NOT EXISTS idx_grades_assignment ON grades(assignment_id);
		`)

		await db.execAsync(`
			CREATE TRIGGER IF NOT EXISTS trg_grade_assignment_subject_insert
			BEFORE INSERT ON grades
			WHEN NEW.assignment_id IS NOT NULL AND NOT EXISTS (
				SELECT 1 FROM assignments
				WHERE id = NEW.assignment_id AND subject_id = NEW.subject_id
			)
			BEGIN SELECT RAISE(ABORT, 'grade assignment subject mismatch'); END;
		`)

		await db.execAsync(`
			CREATE TRIGGER IF NOT EXISTS trg_grade_assignment_subject_update
			BEFORE UPDATE OF subject_id, assignment_id ON grades
			WHEN NEW.assignment_id IS NOT NULL AND NOT EXISTS (
				SELECT 1 FROM assignments
				WHERE id = NEW.assignment_id AND subject_id = NEW.subject_id
			)
			BEGIN SELECT RAISE(ABORT, 'grade assignment subject mismatch'); END;
		`)
	},
}
