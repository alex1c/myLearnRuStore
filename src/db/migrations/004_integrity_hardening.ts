import type { Migration } from '@/src/db/types'

/** Forward-only integrity fixes found during the Phase 3/4 checkpoint. */
export const migration004IntegrityHardening: Migration = {
	version: 4,
	name: 'grades_and_one_off_attendance_integrity',
	async up(db) {
		await db.execAsync(`
			ALTER TABLE attendance ADD COLUMN schedule_exception_id TEXT
				REFERENCES schedule_exceptions(id) ON DELETE SET NULL;

			DROP INDEX IF EXISTS uq_attendance_manual_occurrence;
			CREATE UNIQUE INDEX uq_attendance_manual_occurrence
				ON attendance(subject_id, attendance_date)
				WHERE schedule_entry_id IS NULL AND schedule_exception_id IS NULL;
			CREATE UNIQUE INDEX uq_attendance_added_occurrence
				ON attendance(schedule_exception_id)
				WHERE schedule_exception_id IS NOT NULL;

			CREATE TRIGGER trg_assignment_photo_limit
			BEFORE INSERT ON assignment_photos
			WHEN (SELECT COUNT(*) FROM assignment_photos WHERE assignment_id = NEW.assignment_id) >= 5
			BEGIN SELECT RAISE(ABORT, 'maximum 5 assignment photos'); END;

			CREATE TRIGGER trg_attendance_exception_subject_insert
			BEFORE INSERT ON attendance
			WHEN NEW.schedule_exception_id IS NOT NULL AND NOT EXISTS (
				SELECT 1 FROM schedule_exceptions
				WHERE id = NEW.schedule_exception_id
					AND exception_type = 'ADDED'
					AND subject_id = NEW.subject_id
					AND exception_date = NEW.attendance_date
			)
			BEGIN SELECT RAISE(ABORT, 'attendance added occurrence mismatch'); END;

			CREATE TRIGGER trg_assignment_linked_grade_subject_update
			BEFORE UPDATE OF subject_id ON assignments
			WHEN EXISTS (
				SELECT 1 FROM grades
				WHERE assignment_id = OLD.id AND subject_id <> NEW.subject_id
			)
			BEGIN SELECT RAISE(ABORT, 'assignment linked grade subject mismatch'); END;
		`)
	},
}
