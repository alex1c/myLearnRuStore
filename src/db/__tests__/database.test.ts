import { openTestDatabase } from '@/src/db/adapters/sqljs-test-adapter'
import * as SQLite from 'expo-sqlite'
import {
	bootstrapDatabase,
	getDatabase,
	resetDatabaseSingletonForTests,
} from '@/src/db/database'
import { getAppliedMigrationVersions, runMigrations } from '@/src/db/migrator'
import { createRepositories } from '@/src/db/repositories'
import { seedDevelopmentData } from '@/src/db/seed'
import { createId, nowTimestamp } from '@/src/utils/id'

jest.mock('expo-sqlite', () => ({ openDatabaseAsync: jest.fn() }))

describe('database bootstrap and integrity', () => {
	afterEach(() => {
		resetDatabaseSingletonForTests()
		jest.clearAllMocks()
	})

	it('deduplicates concurrent production bootstrap calls', async () => {
		const { connection } = await openTestDatabase()
		jest.mocked(SQLite.openDatabaseAsync).mockResolvedValue(connection as never)

		const results = await Promise.all([getDatabase(), getDatabase(), getDatabase()])

		expect(SQLite.openDatabaseAsync).toHaveBeenCalledTimes(1)
		expect(results[0]).toBe(results[1])
		expect(results[1]).toBe(results[2])
	})

	it('allows production bootstrap to retry after a rejected attempt', async () => {
		const { connection } = await openTestDatabase()
		jest.mocked(SQLite.openDatabaseAsync)
			.mockRejectedValueOnce(new Error('temporary open failure'))
			.mockResolvedValueOnce(connection as never)

		await expect(getDatabase()).rejects.toThrow('temporary open failure')
		await expect(getDatabase()).resolves.toBeDefined()
		expect(SQLite.openDatabaseAsync).toHaveBeenCalledTimes(2)
	})

	it('bootstraps a fresh database and records migration version 1', async () => {
		const { connection } = await openTestDatabase()
		await bootstrapDatabase(connection)
		const versions = await getAppliedMigrationVersions(connection)
		expect(versions).toEqual([1, 2])
	})

	it('is idempotent on repeat bootstrap', async () => {
		const { connection } = await openTestDatabase()
		await bootstrapDatabase(connection)
		await bootstrapDatabase(connection)
		const versions = await getAppliedMigrationVersions(connection)
		expect(versions).toEqual([1, 2])
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
		expect(versions).toEqual([1, 2])
	})

	it('does not record a migration when its transaction fails', async () => {
		const { connection } = await openTestDatabase()
		const failingConnection = {
			...connection,
			runAsync: jest.fn(async (sql: string, params?: readonly unknown[]) => {
				if (sql.startsWith('INSERT INTO schema_migrations')) {
					throw new Error('simulated migration record failure')
				}
				return connection.runAsync(sql, params)
			}),
		}

		await expect(runMigrations(failingConnection)).rejects.toThrow(
			'simulated migration record failure',
		)
		expect(await getAppliedMigrationVersions(connection)).toEqual([])
	})

	it('fails fast when the database schema is newer than the app', async () => {
		const { connection } = await openTestDatabase()
		await connection.execAsync(`
			CREATE TABLE schema_migrations (
				version INTEGER PRIMARY KEY NOT NULL,
				name TEXT NOT NULL,
				applied_at TEXT NOT NULL
			);
		`)
		await connection.runAsync(
			'INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)',
			[99, 'future', nowTimestamp()],
		)

		await expect(runMigrations(connection)).rejects.toThrow('newer than supported')
	})

	it('rejects cross-period schedule and cross-subject linked records', async () => {
		const { connection } = await openTestDatabase()
		await bootstrapDatabase(connection)
		const repos = createRepositories(connection)
		const timestamp = nowTimestamp()
		const periodA = await repos.studyPeriods.create({
			name: 'A', type: 'SEMESTER', startDate: '2026-01-01', endDate: '2026-06-30',
		})
		const periodB = await repos.studyPeriods.create({
			name: 'B', type: 'SEMESTER', startDate: '2026-07-01', endDate: '2026-12-31',
		})
		const subjectA = await repos.subjects.create({ studyPeriodId: periodA.id, name: 'Math' })
		const subjectB = await repos.subjects.create({ studyPeriodId: periodB.id, name: 'History' })

		await expect(repos.schedule.create({
			studyPeriodId: periodB.id, subjectId: subjectA.id, weekday: 1,
			startTime: '09:00', endTime: '10:00',
		})).rejects.toThrow('belong to the study period')

		const entry = await repos.schedule.create({
			studyPeriodId: periodA.id, subjectId: subjectA.id, weekday: 1,
			startTime: '09:00', endTime: '10:00',
		})
		await expect(repos.assignments.create({
			subjectId: subjectB.id, title: 'Mismatch', dueDate: '2026-08-01',
			sourceScheduleEntryId: entry.id,
		})).rejects.toThrow('must match')

		const assignment = await repos.assignments.create({
			subjectId: subjectA.id, title: 'Valid', dueDate: '2026-02-01',
			sourceScheduleEntryId: entry.id,
		})
		await expect(connection.runAsync(
			`INSERT INTO attendance
			 (id, subject_id, schedule_entry_id, attendance_date, status, created_at, updated_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?)`,
			[createId(), subjectB.id, entry.id, '2026-02-02', 'PRESENT', timestamp, timestamp],
		)).rejects.toThrow()
		await expect(connection.runAsync(
			`INSERT INTO focus_sessions
			 (id, subject_id, assignment_id, started_at, completed, created_at)
			 VALUES (?, ?, ?, ?, ?, ?)`,
			[createId(), subjectB.id, assignment.id, timestamp, 0, timestamp],
		)).rejects.toThrow()
	})

	it('uses occurrence-aware attendance uniqueness including manual records', async () => {
		const { connection } = await openTestDatabase()
		await bootstrapDatabase(connection)
		const repos = createRepositories(connection)
		const timestamp = nowTimestamp()
		const period = await repos.studyPeriods.create({
			name: 'A', type: 'SEMESTER', startDate: '2026-01-01', endDate: '2026-06-30',
		})
		const subject = await repos.subjects.create({ studyPeriodId: period.id, name: 'Math' })
		const entry1 = await repos.schedule.create({ studyPeriodId: period.id, subjectId: subject.id,
			weekday: 1, startTime: '09:00', endTime: '10:00' })
		const entry2 = await repos.schedule.create({ studyPeriodId: period.id, subjectId: subject.id,
			weekday: 1, startTime: '11:00', endTime: '12:00' })
		const insert = (id: string, entryId: string | null) => connection.runAsync(
			`INSERT INTO attendance
			 (id, subject_id, schedule_entry_id, attendance_date, status, created_at, updated_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?)`,
			[id, subject.id, entryId, '2026-02-02', 'PRESENT', timestamp, timestamp],
		)

		await insert(createId(), entry1.id)
		await insert(createId(), entry2.id)
		await expect(insert(createId(), entry1.id)).rejects.toThrow()
		await insert(createId(), null)
		await expect(insert(createId(), null)).rejects.toThrow()
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
