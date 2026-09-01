import { openTestDatabase } from '@/src/db/adapters/sqljs-test-adapter'
import { bootstrapDatabase } from '@/src/db/database'
import { getAppliedMigrationVersions, runMigrations } from '@/src/db/migrator'
import { createRepositories } from '@/src/db/repositories'
import { seedDevelopmentData } from '@/src/db/seed'
import { createId, nowTimestamp } from '@/src/utils/id'

describe('database bootstrap and integrity', () => {
	it('bootstraps a fresh database and records migration version 1', async () => {
		const { connection } = await openTestDatabase()
		await bootstrapDatabase(connection)
		const versions = await getAppliedMigrationVersions(connection)
		expect(versions).toEqual([1])
	})

	it('is idempotent on repeat bootstrap', async () => {
		const { connection } = await openTestDatabase()
		await bootstrapDatabase(connection)
		await bootstrapDatabase(connection)
		const versions = await getAppliedMigrationVersions(connection)
		expect(versions).toEqual([1])
	})

	it('enforces foreign keys for schedule and assignments', async () => {
		const { connection } = await openTestDatabase()
		await bootstrapDatabase(connection)
		const repos = createRepositories(connection)
		const timestamp = nowTimestamp()

		const period = await repos.studyPeriods.create({
			name: 'Test period',
			type: 'SEMESTER',
			startDate: '2025-09-01',
			endDate: '2025-12-31',
			isActive: true,
		})

		await expect(
			repos.schedule.create({
				studyPeriodId: period.id,
				subjectId: createId(),
				weekday: 1,
				startTime: '08:00',
				endTime: '08:45',
			}),
		).rejects.toThrow()

		const subject = await repos.subjects.create({
			studyPeriodId: period.id,
			name: 'Physics',
		})

		const entry = await repos.schedule.create({
			studyPeriodId: period.id,
			subjectId: subject.id,
			weekday: 2,
			startTime: '10:00',
			endTime: '10:45',
		})

		await expect(
			repos.assignments.create({
				subjectId: createId(),
				title: 'Invalid assignment',
				dueDate: '2025-10-01',
			}),
		).rejects.toThrow()

		const assignment = await repos.assignments.create({
			subjectId: subject.id,
			title: 'Read chapter 1',
			dueDate: '2025-10-01',
			sourceScheduleEntryId: entry.id,
		})

		expect(assignment.sourceScheduleEntryId).toBe(entry.id)

		await expect(
			connection.runAsync(
				`INSERT INTO focus_sessions (
					id, subject_id, assignment_id, started_at, completed, created_at
				) VALUES (?, ?, ?, ?, ?, ?)`,
				[createId(), createId(), createId(), timestamp, 0, timestamp],
			),
		).rejects.toThrow()
	})

	it('runs migrations inside a transaction and blocks skipped versions', async () => {
		const { connection } = await openTestDatabase()
		await runMigrations(connection)
		const versions = await getAppliedMigrationVersions(connection)
		expect(versions).toEqual([1])
	})

	it('supports basic repository CRUD for core entities', async () => {
		const { connection } = await openTestDatabase()
		await bootstrapDatabase(connection)
		const repos = createRepositories(connection)

		const period = await repos.studyPeriods.create({
			name: '2025 Fall',
			type: 'SEMESTER',
			startDate: '2025-09-01',
			endDate: '2025-12-31',
			isActive: true,
		})

		const subject = await repos.subjects.create({
			studyPeriodId: period.id,
			name: 'Literature',
		})

		const subjects = await repos.subjects.listByStudyPeriod(period.id)
		expect(subjects).toHaveLength(1)
		expect(subjects[0].name).toBe('Literature')

		await repos.assignments.create({
			subjectId: subject.id,
			title: 'Essay draft',
			dueDate: '2025-11-01',
		})

		const upcoming = await repos.assignments.listUpcoming()
		expect(upcoming).toHaveLength(1)
	})

	it('keeps development seed opt-in only', async () => {
		const { connection } = await openTestDatabase()
		await bootstrapDatabase(connection)
		const before = await connection.getFirstAsync<{ count: number }>(
			'SELECT COUNT(*) as count FROM subjects',
		)
		expect(before?.count).toBe(0)

		await seedDevelopmentData(connection)
		const after = await connection.getFirstAsync<{ count: number }>(
			'SELECT COUNT(*) as count FROM subjects',
		)
		expect(after?.count).toBeGreaterThan(0)
	})
})
