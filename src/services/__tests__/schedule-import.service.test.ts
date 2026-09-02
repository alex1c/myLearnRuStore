import { openTestDatabase } from '@/src/db/adapters/sqljs-test-adapter'
import { bootstrapDatabase } from '@/src/db/database'
import { createRepositories } from '@/src/db/repositories'
import {
	buildScheduleExport,
	importScheduleExport,
	parseScheduleExportJson,
	serializeScheduleExport,
} from '@/src/services/schedule-export.service'

describe('schedule export/import', () => {
	it('exports and imports valid schedule JSON transactionally', async () => {
		const { connection } = await openTestDatabase()
		await bootstrapDatabase(connection)
		const repos = createRepositories(connection)

		const settings = await repos.appSettings.ensureExists()
		const period = await repos.studyPeriods.create({
			name: '1 semester',
			type: 'SEMESTER',
			startDate: '2026-09-01',
			endDate: '2027-06-30',
		})
		await repos.appSettings.setActiveStudyPeriod(period.id)

		const subject = await repos.subjects.create({
			studyPeriodId: period.id,
			name: 'Math',
		})
		await repos.schedule.create({
			studyPeriodId: period.id,
			subjectId: subject.id,
			weekday: 1,
			startTime: '09:00',
			endTime: '09:45',
		})

		const document = await buildScheduleExport(
			repos,
			settings,
			period.id,
			period.name,
		)
		const json = serializeScheduleExport(document)
		const preview = parseScheduleExportJson(json)

		const beforeEntries = await repos.schedule.listByStudyPeriod(period.id)
		const result = await importScheduleExport(repos, preview.document, period.id)
		const afterEntries = await repos.schedule.listByStudyPeriod(period.id)

		expect(result.entriesCreated).toBe(preview.entryCount)
		expect(afterEntries.length).toBe(beforeEntries.length + preview.entryCount)
	})

	it('rejects malformed JSON', () => {
		expect(() => parseScheduleExportJson('{bad')).toThrow('Invalid JSON')
	})

	it('rejects unsupported version', () => {
		const payload = JSON.stringify({
			kind: 'myLearnScheduleExport',
			version: 99,
			exportId: 'x',
			exportedAt: '2026-09-01',
			studyPeriodName: 'Test',
			cycleLength: 1,
			cycleAnchorDate: null,
			weekCycleMode: 'EVERY_WEEK',
			subjects: [],
			teachers: [],
			scheduleEntries: [],
		})
		expect(() => parseScheduleExportJson(payload)).toThrow('Unsupported export version')
	})

	it('detects duplicate export ids on repeat import', async () => {
		const { connection } = await openTestDatabase()
		await bootstrapDatabase(connection)
		const repos = createRepositories(connection)
		const settings = await repos.appSettings.ensureExists()
		const period = await repos.studyPeriods.create({
			name: '1 semester',
			type: 'SEMESTER',
			startDate: '2026-09-01',
			endDate: '2027-06-30',
		})

		const document = await buildScheduleExport(
			repos,
			settings,
			period.id,
			period.name,
		)
		await importScheduleExport(repos, document, period.id)
		const record = await repos.scheduleImports.findByExportAndPeriod(
			document.exportId,
			period.id,
		)
		expect(record).not.toBeNull()
	})

	it('rejects grade assignment subject mismatch on focus sessions', async () => {
		const { connection } = await openTestDatabase()
		await bootstrapDatabase(connection)
		const repos = createRepositories(connection)
		const period = await repos.studyPeriods.create({
			name: '1 semester',
			type: 'SEMESTER',
			startDate: '2026-09-01',
			endDate: '2027-06-30',
		})
		const math = await repos.subjects.create({
			studyPeriodId: period.id,
			name: 'Math',
		})
		const physics = await repos.subjects.create({
			studyPeriodId: period.id,
			name: 'Physics',
		})
		const assignment = await repos.assignments.create({
			subjectId: math.id,
			title: 'Test',
			dueDate: '2026-09-10',
		})

		await expect(
			repos.focusSessions.create({
				subjectId: physics.id,
				assignmentId: assignment.id,
				startedAt: '2026-09-01T10:00:00.000Z',
				endedAt: '2026-09-01T10:25:00.000Z',
				durationSeconds: 1500,
			}),
		).rejects.toThrow('Focus session assignment must belong to the same subject')
	})
})
