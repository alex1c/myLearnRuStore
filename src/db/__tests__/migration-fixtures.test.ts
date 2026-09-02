import { openTestDatabase } from '@/src/db/adapters/sqljs-test-adapter'
import { getAppliedMigrationVersions, runMigrations } from '@/src/db/migrator'
import { migration001InitialSchema } from '@/src/db/migrations/001_initial_schema'
import { migration002AssignmentReminders } from '@/src/db/migrations/002_assignment_reminders'
import { migration003GradesAttendance } from '@/src/db/migrations/003_grades_attendance'
import { migration004IntegrityHardening } from '@/src/db/migrations/004_integrity_hardening'
import type { DatabaseConnection } from '@/src/db/types'
import { nowTimestamp } from '@/src/utils/id'

async function recordMigration(
	db: DatabaseConnection,
	version: number,
	name: string,
): Promise<void> {
	await db.runAsync(
		'INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)',
		[version, name, nowTimestamp()],
	)
}

async function assertNoForeignKeyViolations(db: DatabaseConnection): Promise<void> {
	const violations = await db.getAllAsync<Record<string, unknown>>(
		'PRAGMA foreign_key_check',
	)
	expect(violations).toEqual([])
}

/** Apply migrations through targetVersion and mark them applied. */
async function applyThrough(
	db: DatabaseConnection,
	targetVersion: number,
): Promise<void> {
	await db.execAsync('PRAGMA foreign_keys = ON;')
	const steps = [
		migration001InitialSchema,
		migration002AssignmentReminders,
		migration003GradesAttendance,
		migration004IntegrityHardening,
	]

	for (const step of steps) {
		if (step.version > targetVersion) {
			break
		}
		await step.up(db)
		await recordMigration(db, step.version, step.name)
	}
}

describe('migration fixtures to latest schema', () => {
	it('upgrades v1 fixture data to v5 and preserves assignments', async () => {
		const { connection } = await openTestDatabase()
		await applyThrough(connection, 1)
		const ts = nowTimestamp()

		await connection.runAsync(
			`INSERT INTO study_periods
			 (id, name, type, start_date, end_date, is_active, created_at, updated_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
			['p1', 'Legacy Year', 'YEAR', '2026-09-01', '2027-05-31', 1, ts, ts],
		)
		await connection.runAsync(
			`INSERT INTO subjects
			 (id, study_period_id, name, short_name, color, room_default, teacher_id,
			  target_grade, sort_order, is_archived, created_at, updated_at)
			 VALUES (?, ?, ?, NULL, NULL, NULL, NULL, NULL, 0, 0, ?, ?)`,
			['s1', 'p1', 'Physics', ts, ts],
		)
		await connection.runAsync(
			`INSERT INTO assignments
			 (id, subject_id, title, description, due_date, due_time, priority, status,
			  assignment_type, source_schedule_entry_id, completed_at, notes, created_at, updated_at)
			 VALUES (?, ?, ?, NULL, ?, NULL, 'NORMAL', 'PENDING', 'HOMEWORK', NULL, NULL, NULL, ?, ?)`,
			['a1', 's1', 'Lab report', '2026-10-01', ts, ts],
		)

		await runMigrations(connection)
		expect(await getAppliedMigrationVersions(connection)).toEqual([1, 2, 3, 4, 5])
		await assertNoForeignKeyViolations(connection)

		const assignment = await connection.getFirstAsync<{ title: string; source_occurrence_date: string | null }>(
			"SELECT title, source_occurrence_date FROM assignments WHERE id = 'a1'",
		)
		expect(assignment).toEqual({ title: 'Lab report', source_occurrence_date: null })

		const subject = await connection.getFirstAsync<{ grade_scale: string }>(
			"SELECT grade_scale FROM subjects WHERE id = 's1'",
		)
		expect(subject?.grade_scale).toBe('FIVE_POINT')
	})

	it('upgrades v2 fixture and preserves reminder intent', async () => {
		const { connection } = await openTestDatabase()
		await applyThrough(connection, 2)
		const ts = nowTimestamp()

		await connection.runAsync(
			`INSERT INTO study_periods
			 (id, name, type, start_date, end_date, is_active, created_at, updated_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
			['p2', 'v2 period', 'SEMESTER', '2026-01-01', '2026-06-30', 1, ts, ts],
		)
		await connection.runAsync(
			`INSERT INTO subjects
			 (id, study_period_id, name, short_name, color, room_default, teacher_id,
			  target_grade, sort_order, is_archived, created_at, updated_at)
			 VALUES (?, ?, ?, NULL, NULL, NULL, NULL, NULL, 0, 0, ?, ?)`,
			['s2', 'p2', 'Math', ts, ts],
		)
		await connection.runAsync(
			`INSERT INTO assignments
			 (id, subject_id, title, description, due_date, due_time, priority, status,
			  assignment_type, source_schedule_entry_id, completed_at, notes, created_at, updated_at,
			  source_occurrence_date)
			 VALUES (?, ?, ?, NULL, ?, NULL, 'NORMAL', 'PENDING', 'HOMEWORK', NULL, NULL, NULL, ?, ?, ?)`,
			['a2', 's2', 'Essay', '2026-03-01', ts, ts, '2026-02-20'],
		)
		await connection.runAsync(
			`INSERT INTO assignment_reminders
			 (id, assignment_id, enabled, reminder_kind, relative_minutes, absolute_time,
			  absolute_day_offset, scheduled_at, notification_id, created_at, updated_at)
			 VALUES (?, ?, 1, 'RELATIVE', 30, NULL, 0, ?, 'legacy-notif', ?, ?)`,
			['r2', 'a2', '2026-03-01T08:00:00.000Z', ts, ts],
		)

		await runMigrations(connection)
		expect(await getAppliedMigrationVersions(connection)).toEqual([1, 2, 3, 4, 5])
		await assertNoForeignKeyViolations(connection)

		const reminder = await connection.getFirstAsync<{
			reminder_kind: string
			notification_id: string | null
			relative_minutes: number
		}>("SELECT reminder_kind, notification_id, relative_minutes FROM assignment_reminders WHERE id = 'r2'")
		expect(reminder).toEqual({
			reminder_kind: 'RELATIVE',
			notification_id: 'legacy-notif',
			relative_minutes: 30,
		})

		const assignment = await connection.getFirstAsync<{ source_occurrence_date: string }>(
			"SELECT source_occurrence_date FROM assignments WHERE id = 'a2'",
		)
		expect(assignment?.source_occurrence_date).toBe('2026-02-20')
	})

	it('upgrades v3 fixture and preserves grades plus attendance', async () => {
		const { connection } = await openTestDatabase()
		await applyThrough(connection, 3)
		const ts = nowTimestamp()

		await connection.runAsync(
			`INSERT INTO study_periods
			 (id, name, type, start_date, end_date, is_active, created_at, updated_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
			['p3', 'v3 period', 'SEMESTER', '2026-01-01', '2026-06-30', 1, ts, ts],
		)
		await connection.runAsync(
			`INSERT INTO subjects
			 (id, study_period_id, name, short_name, color, room_default, teacher_id,
			  target_grade, sort_order, is_archived, created_at, updated_at, grade_scale, attendance_target)
			 VALUES (?, ?, ?, NULL, NULL, NULL, NULL, 4.5, 0, 0, ?, ?, 'FIVE_POINT', 90)`,
			['s3', 'p3', 'Biology', ts, ts],
		)
		await connection.runAsync(
			`INSERT INTO schedule_entries
			 (id, study_period_id, subject_id, teacher_id, room, weekday, start_time, end_time,
			  lesson_type, week_cycle, created_at, updated_at)
			 VALUES (?, ?, ?, NULL, '101', 1, '09:00', '10:00', NULL, 'EVERY_WEEK', ?, ?)`,
			['e3', 'p3', 's3', ts, ts],
		)
		await connection.runAsync(
			`INSERT INTO assignments
			 (id, subject_id, title, description, due_date, due_time, priority, status,
			  assignment_type, source_schedule_entry_id, completed_at, notes, created_at, updated_at,
			  source_occurrence_date)
			 VALUES (?, ?, ?, NULL, ?, NULL, 'NORMAL', 'PENDING', 'HOMEWORK', NULL, NULL, NULL, ?, ?, NULL)`,
			['a3', 's3', 'Quiz prep', '2026-02-10', ts, ts],
		)
		await connection.runAsync(
			`INSERT INTO grades
			 (id, subject_id, value, weight, grade_type, grade_scale, date, note, created_at, updated_at, assignment_id)
			 VALUES (?, ?, 5, 2, 'TEST', 'FIVE_POINT', '2026-02-01', NULL, ?, ?, ?)`,
			['g3', 's3', ts, ts, 'a3'],
		)
		await connection.runAsync(
			`INSERT INTO attendance
			 (id, subject_id, schedule_entry_id, attendance_date, status, notes, created_at, updated_at)
			 VALUES (?, ?, ?, '2026-02-02', 'PRESENT', NULL, ?, ?)`,
			['att3', 's3', 'e3', ts, ts],
		)

		await runMigrations(connection)
		expect(await getAppliedMigrationVersions(connection)).toEqual([1, 2, 3, 4, 5])
		await assertNoForeignKeyViolations(connection)

		const grade = await connection.getFirstAsync<{ value: number; assignment_id: string }>(
			"SELECT value, assignment_id FROM grades WHERE id = 'g3'",
		)
		expect(grade).toEqual({ value: 5, assignment_id: 'a3' })

		const attendance = await connection.getFirstAsync<{
			status: string
			schedule_exception_id: string | null
		}>("SELECT status, schedule_exception_id FROM attendance WHERE id = 'att3'")
		expect(attendance).toEqual({ status: 'PRESENT', schedule_exception_id: null })
	})

	it('upgrades v4 fixture and preserves one-off attendance identity', async () => {
		const { connection } = await openTestDatabase()
		await applyThrough(connection, 4)
		const ts = nowTimestamp()

		await connection.runAsync(
			`INSERT INTO study_periods
			 (id, name, type, start_date, end_date, is_active, created_at, updated_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
			['p4', 'v4 period', 'SEMESTER', '2026-01-01', '2026-06-30', 1, ts, ts],
		)
		await connection.runAsync(
			`INSERT INTO subjects
			 (id, study_period_id, name, short_name, color, room_default, teacher_id,
			  target_grade, sort_order, is_archived, created_at, updated_at, grade_scale, attendance_target)
			 VALUES (?, ?, ?, NULL, NULL, NULL, NULL, NULL, 0, 0, ?, ?, 'FIVE_POINT', NULL)`,
			['s4', 'p4', 'Chemistry', ts, ts],
		)
		await connection.runAsync(
			`INSERT INTO schedule_exceptions
			 (id, study_period_id, exception_date, schedule_entry_id, exception_type,
			  subject_id, teacher_id, room, start_time, end_time, new_date, notes, created_at, updated_at)
			 VALUES (?, ?, '2026-03-10', NULL, 'ADDED', ?, NULL, 'Lab', '14:00', '15:00', NULL, NULL, ?, ?)`,
			['ex4', 'p4', 's4', ts, ts],
		)
		await connection.runAsync(
			`INSERT INTO attendance
			 (id, subject_id, schedule_entry_id, schedule_exception_id, attendance_date,
			  status, notes, created_at, updated_at)
			 VALUES (?, ?, NULL, ?, '2026-03-10', 'EXCUSED', NULL, ?, ?)`,
			['att4', 's4', 'ex4', ts, ts],
		)

		await runMigrations(connection)
		expect(await getAppliedMigrationVersions(connection)).toEqual([1, 2, 3, 4, 5])
		await assertNoForeignKeyViolations(connection)

		const attendance = await connection.getFirstAsync<{
			schedule_exception_id: string
			status: string
		}>("SELECT schedule_exception_id, status FROM attendance WHERE id = 'att4'")
		expect(attendance).toEqual({
			schedule_exception_id: 'ex4',
			status: 'EXCUSED',
		})

		const activeFocusExists = await connection.getFirstAsync<{ name: string }>(
			"SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'active_focus_session'",
		)
		expect(activeFocusExists?.name).toBe('active_focus_session')
	})
})
