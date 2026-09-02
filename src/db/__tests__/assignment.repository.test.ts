import { openTestDatabase } from '@/src/db/adapters/sqljs-test-adapter'
import { bootstrapDatabase } from '@/src/db/database'
import { getAppliedMigrationVersions, runMigrations } from '@/src/db/migrator'
import { migration001InitialSchema } from '@/src/db/migrations/001_initial_schema'
import { createRepositories } from '@/src/db/repositories'
import { nowTimestamp } from '@/src/utils/id'

describe('assignment repository', () => {
	it('creates, edits, completes, reopens, and deletes assignments', async () => {
		const { connection } = await openTestDatabase()
		await bootstrapDatabase(connection)
		const repos = createRepositories(connection)

		const period = await repos.studyPeriods.create({
			name: '2026',
			type: 'YEAR',
			startDate: '2026-09-01',
			endDate: '2027-05-31',
			isActive: true,
		})

		const subject = await repos.subjects.create({
			studyPeriodId: period.id,
			name: 'Math',
		})

		const entry = await repos.schedule.create({
			studyPeriodId: period.id,
			subjectId: subject.id,
			weekday: 1,
			startTime: '09:00',
			endTime: '09:45',
		})

		const created = await repos.assignments.create({
			subjectId: subject.id,
			title: '№1–5',
			dueDate: '2026-09-10',
			sourceScheduleEntryId: entry.id,
			sourceOccurrenceDate: '2026-09-08',
		})

		expect(created.sourceOccurrenceDate).toBe('2026-09-08')

		const updated = await repos.assignments.update(created.id, {
			title: '№1–10',
			dueTime: '18:00',
		})
		expect(updated.title).toBe('№1–10')
		expect(updated.dueTime).toBe('18:00')

		const completed = await repos.assignments.complete(created.id)
		expect(completed.status).toBe('COMPLETED')
		expect(completed.completedAt).not.toBeNull()

		const reopened = await repos.assignments.reopen(created.id)
		expect(reopened.status).toBe('PENDING')
		expect(reopened.completedAt).toBeNull()

		await repos.assignments.delete(created.id)
		expect(await repos.assignments.getById(created.id)).toBeNull()
	})

	it('rejects cross-subject source schedule link', async () => {
		const { connection } = await openTestDatabase()
		await bootstrapDatabase(connection)
		const repos = createRepositories(connection)

		const period = await repos.studyPeriods.create({
			name: '2026',
			type: 'YEAR',
			startDate: '2026-09-01',
			endDate: '2027-05-31',
			isActive: true,
		})

		const math = await repos.subjects.create({
			studyPeriodId: period.id,
			name: 'Math',
		})
		const history = await repos.subjects.create({
			studyPeriodId: period.id,
			name: 'History',
		})

		const entry = await repos.schedule.create({
			studyPeriodId: period.id,
			subjectId: history.id,
			weekday: 2,
			startTime: '10:00',
			endTime: '10:45',
		})

		await expect(
			repos.assignments.create({
				subjectId: math.id,
				title: 'Mismatch',
				dueDate: '2026-09-10',
				sourceScheduleEntryId: entry.id,
			}),
		).rejects.toThrow('must match')
	})

	it('upgrades from migration v1 to v2', async () => {
		const { connection } = await openTestDatabase()
		await connection.execAsync('PRAGMA foreign_keys = ON;')
		await migration001InitialSchema.up(connection)
		await connection.runAsync(
			'INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)',
			[1, migration001InitialSchema.name, nowTimestamp()],
		)
		expect(await getAppliedMigrationVersions(connection)).toEqual([1])

		const reposV1 = createRepositories(connection)
		const period = await reposV1.studyPeriods.create({
			name: 'Legacy',
			type: 'YEAR',
			startDate: '2026-09-01',
			endDate: '2027-05-31',
			isActive: true,
		})
		const subjectId = 'legacy-subject'
		await connection.runAsync(
			`INSERT INTO subjects (
				id, study_period_id, name, short_name, color, room_default,
				teacher_id, target_grade, sort_order, is_archived, created_at, updated_at
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			[
				subjectId,
				period.id,
				'Physics',
				null,
				null,
				null,
				null,
				null,
				0,
				0,
				nowTimestamp(),
				nowTimestamp(),
			],
		)
		await connection.runAsync(
			`INSERT INTO assignments (
				id, subject_id, title, description, due_date, due_time,
				priority, status, assignment_type, source_schedule_entry_id,
				completed_at, notes, created_at, updated_at
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			[
				'legacy-assignment',
				subjectId,
				'Lab report',
				null,
				'2026-10-01',
				null,
				'NORMAL',
				'PENDING',
				'HOMEWORK',
				null,
				null,
				null,
				nowTimestamp(),
				nowTimestamp(),
			],
		)

		await runMigrations(connection)
		expect(await getAppliedMigrationVersions(connection)).toEqual([1, 2, 3, 4, 5])

		const reposV2 = createRepositories(connection)
		const list = await reposV2.assignments.listAll()
		expect(list).toHaveLength(1)
		expect(list[0].title).toBe('Lab report')

		await reposV2.assignmentReminders.upsert(list[0].id, {
			enabled: true,
			reminderKind: 'MORNING_OF_DUE',
			absoluteTime: '09:00',
			absoluteDayOffset: 0,
		})

		const reminder = await reposV2.assignmentReminders.getByAssignmentId(list[0].id)
		expect(reminder?.reminderKind).toBe('MORNING_OF_DUE')
	})
})
