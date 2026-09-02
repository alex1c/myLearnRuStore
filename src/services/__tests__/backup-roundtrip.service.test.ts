import { strFromU8, unzipSync } from 'fflate'
import * as FileSystem from 'expo-file-system/legacy'
import { openTestDatabase } from '@/src/db/adapters/sqljs-test-adapter'
import { bootstrapDatabase } from '@/src/db/database'
import { createRepositories, type Repositories } from '@/src/db/repositories'
import type { DatabaseConnection } from '@/src/db/types'
import {
	createBackupArchive,
	parseBackupArchive,
	restoreBackupArchive,
} from '@/src/services/backup/backup.service'
import { BACKUP_KIND, BACKUP_VERSION } from '@/src/services/backup/backup.types'
import { reconcileAssignmentReminders } from '@/src/services/assignment-reminder-sync.service'
import {
	setNotificationSchedulerForTests,
} from '@/src/services/notifications/expo-notification-scheduler'
import type { NotificationScheduler } from '@/src/services/notifications/notification-scheduler.types'

/** Known source photo bytes for byte-equality assertions. */
const PHOTO_BYTES = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46])
const PHOTO_BASE64 = Buffer.from(PHOTO_BYTES).toString('base64')
const FAKE_NOTIFICATION_ID = 'fake-old-platform-notification-id'
const SOURCE_PHOTO_URI = 'file:///mock-documents/assignment-photos/src-a/photo-source.jpg'

/** In-memory FileSystem mock so backup/restore can roundtrip real bytes. */
function installMemoryFilesystem(): Map<string, string> {
	const store = new Map<string, string>()

	jest.mocked(FileSystem.readAsStringAsync).mockImplementation(async (uri) => {
		const value = store.get(uri)
		if (value === undefined) {
			throw new Error(`Missing file: ${uri}`)
		}
		return value
	})

	jest.mocked(FileSystem.writeAsStringAsync).mockImplementation(async (uri, contents) => {
		store.set(uri, String(contents))
	})

	jest.mocked(FileSystem.getInfoAsync).mockImplementation(async (uri) => ({
		exists: store.has(uri),
		uri,
		isDirectory: false,
	}))

	jest.mocked(FileSystem.makeDirectoryAsync).mockResolvedValue(undefined)
	jest.mocked(FileSystem.deleteAsync).mockImplementation(async (uri) => {
		for (const key of [...store.keys()]) {
			if (key === uri || key.startsWith(`${uri}/`)) {
				store.delete(key)
			}
		}
	})

	return store
}

function createMockScheduler(): NotificationScheduler & {
	scheduled: { assignmentId: string; fireAt: Date; id: string }[]
} {
	const scheduled: { assignmentId: string; fireAt: Date; id: string }[] = []
	let counter = 0

	return {
		scheduled,
		requestPermissions: jest.fn(async () => true),
		hasPermission: jest.fn(async () => true),
		isScheduled: jest.fn(async () => false),
		schedule: jest.fn(async (input) => {
			counter += 1
			const id = `restored-notif-${counter}`
			scheduled.push({ assignmentId: input.assignmentId, fireAt: input.fireAt, id })
			return id
		}),
		cancel: jest.fn(async () => undefined),
		cancelAllForAssignment: jest.fn(async () => undefined),
	}
}

async function assertNoForeignKeyViolations(db: DatabaseConnection): Promise<void> {
	const violations = await db.getAllAsync<Record<string, unknown>>(
		'PRAGMA foreign_key_check',
	)
	expect(violations).toEqual([])
}

/** Populate DB A with realistic linked study data for backup roundtrip. */
async function populateSourceDatabase(
	repos: Repositories,
	db: DatabaseConnection,
	fsStore: Map<string, string>,
) {
	await repos.appSettings.updateUserMode('UNIVERSITY')
	await repos.appSettings.updateCycleSettings({
		weekCycleMode: 'TWO_WEEK',
		cycleLength: 2,
		cycleAnchorDate: '2026-09-01',
	})

	const period = await repos.studyPeriods.create({
		name: 'Fall 2026',
		type: 'SEMESTER',
		startDate: '2026-09-01',
		endDate: '2026-12-31',
		isActive: true,
	})
	await repos.appSettings.setActiveStudyPeriod(period.id)

	const teacherA = await repos.teachers.create({ name: 'Ivanov A.P.' })
	const teacherB = await repos.teachers.create({ name: 'Petrova M.S.' })

	const math = await repos.subjects.create({
		studyPeriodId: period.id,
		name: 'Mathematics',
		teacherId: teacherA.id,
		gradeScale: 'FIVE_POINT',
	})
	await repos.subjects.update(math.id, {
		targetGrade: 4.5,
		attendanceTarget: 85,
	})

	const history = await repos.subjects.create({
		studyPeriodId: period.id,
		name: 'History',
		teacherId: teacherB.id,
		gradeScale: 'FIVE_POINT',
	})

	const weekly = await repos.schedule.create({
		studyPeriodId: period.id,
		subjectId: math.id,
		weekday: 1,
		startTime: '09:00',
		endTime: '10:30',
		weekCycle: 'EVERY_WEEK',
		teacherId: teacherA.id,
		room: '101',
	})

	const cycle0 = await repos.schedule.create({
		studyPeriodId: period.id,
		subjectId: history.id,
		weekday: 3,
		startTime: '11:00',
		endTime: '12:30',
		weekCycle: 'CYCLE_0',
		teacherId: teacherB.id,
		room: '202',
	})

	const cycle1 = await repos.schedule.create({
		studyPeriodId: period.id,
		subjectId: history.id,
		weekday: 3,
		startTime: '11:00',
		endTime: '12:30',
		weekCycle: 'CYCLE_1',
		teacherId: teacherB.id,
		room: '203',
	})

	const cancelled = await repos.scheduleExceptions.cancelOccurrence({
		studyPeriodId: period.id,
		scheduleEntryId: weekly.id,
		exceptionDate: '2026-09-07',
	})

	const override = await repos.scheduleExceptions.create({
		studyPeriodId: period.id,
		exceptionDate: '2026-09-14',
		scheduleEntryId: weekly.id,
		exceptionType: 'TIME_CHANGE',
		startTime: '10:00',
		endTime: '11:30',
		room: '105',
		teacherId: teacherB.id,
	})

	const added = await repos.scheduleExceptions.createOneOffLesson({
		studyPeriodId: period.id,
		exceptionDate: '2026-09-10',
		subjectId: math.id,
		startTime: '14:00',
		endTime: '15:30',
		teacherId: teacherA.id,
		room: 'Lab-1',
	})

	const homework = await repos.assignments.create({
		subjectId: math.id,
		title: 'Homework set 1',
		dueDate: '2099-12-15',
		dueTime: '18:00',
		assignmentType: 'HOMEWORK',
		sourceScheduleEntryId: weekly.id,
		sourceOccurrenceDate: '2026-09-01',
	})

	const exam = await repos.assignments.create({
		subjectId: history.id,
		title: 'Midterm exam',
		dueDate: '2099-12-20',
		assignmentType: 'TEST',
	})

	fsStore.set(SOURCE_PHOTO_URI, PHOTO_BASE64)
	const photo = await repos.assignmentPhotos.create(homework.id, SOURCE_PHOTO_URI)

	await repos.assignmentReminders.upsert(homework.id, {
		enabled: true,
		reminderKind: 'RELATIVE',
		relativeMinutes: 60,
		scheduledAt: '2099-12-15T17:00:00.000Z',
		notificationId: FAKE_NOTIFICATION_ID,
	})

	const grade = await repos.grades.create({
		subjectId: math.id,
		value: 5,
		weight: 2,
		gradeScale: 'FIVE_POINT',
		date: '2026-09-05',
		gradeType: 'HOMEWORK',
		assignmentId: homework.id,
	})

	const attendanceRegular = await repos.attendance.upsert({
		subjectId: math.id,
		attendanceDate: '2026-09-01',
		status: 'PRESENT',
		scheduleEntryId: weekly.id,
	})

	const attendanceExcused = await repos.attendance.upsert({
		subjectId: history.id,
		attendanceDate: '2026-09-02',
		status: 'EXCUSED',
		scheduleEntryId: cycle0.id,
	})

	const attendanceAdded = await repos.attendance.upsert({
		subjectId: math.id,
		attendanceDate: '2026-09-10',
		status: 'ABSENT',
		scheduleExceptionId: added.id,
	})

	const holiday = await repos.holidays.create({
		name: 'Autumn break',
		startDate: '2026-11-01',
		endDate: '2026-11-07',
		studyPeriodId: period.id,
	})

	const focusPlain = await repos.focusSessions.create({
		subjectId: math.id,
		assignmentId: null,
		startedAt: '2026-09-03T10:00:00.000Z',
		endedAt: '2026-09-03T10:25:00.000Z',
		durationSeconds: 1500,
		completed: true,
	})

	const focusLinked = await repos.focusSessions.create({
		subjectId: math.id,
		assignmentId: homework.id,
		startedAt: '2026-09-04T12:00:00.000Z',
		endedAt: '2026-09-04T12:45:00.000Z',
		durationSeconds: 2700,
		completed: true,
	})

	const importHistory = await repos.scheduleImports.record({
		exportId: 'export-fixture-001',
		studyPeriodId: period.id,
	})

	await repos.activeFocus.save({
		subjectId: math.id,
		assignmentId: homework.id,
		plannedDurationSeconds: 1500,
		startedAt: '2026-09-05T08:00:00.000Z',
		pausedAt: null,
		accumulatedPauseMs: 0,
		state: 'RUNNING',
		notifyOnComplete: false,
		notificationId: 'active-focus-notif',
	})

	return {
		period,
		teacherA,
		teacherB,
		math,
		history,
		weekly,
		cycle0,
		cycle1,
		cancelled,
		override,
		added,
		homework,
		exam,
		photo,
		grade,
		attendanceRegular,
		attendanceExcused,
		attendanceAdded,
		holiday,
		focusPlain,
		focusLinked,
		importHistory,
	}
}

describe('backup populated roundtrip', () => {
	afterEach(() => {
		setNotificationSchedulerForTests(null)
		jest.clearAllMocks()
	})

	it('roundtrips populated DB through production backup/restore with photos and reminders', async () => {
		const fsStore = installMemoryFilesystem()
		const scheduler = createMockScheduler()
		setNotificationSchedulerForTests(scheduler)

		// --- Database A: populate and create backup via production service ---
		const { connection: dbA } = await openTestDatabase()
		await bootstrapDatabase(dbA)
		const reposA = createRepositories(dbA)
		const fixture = await populateSourceDatabase(reposA, dbA, fsStore)

		expect(await reposA.activeFocus.get()).not.toBeNull()

		const archiveBytes = await createBackupArchive(reposA)
		expect(archiveBytes.byteLength).toBeGreaterThan(0)

		const entries = unzipSync(archiveBytes)
		expect(entries['manifest.json']).toBeDefined()
		expect(entries['data.json']).toBeDefined()
		expect(entries[`photos/${fixture.photo.id}.jpg`]).toBeDefined()

		const dataJson = strFromU8(entries['data.json']!)
		expect(dataJson).not.toContain(SOURCE_PHOTO_URI)
		expect(dataJson).not.toContain('file:///mock-documents/')
		expect(dataJson).not.toContain(FAKE_NOTIFICATION_ID)

		const parsed = parseBackupArchive(archiveBytes)
		expect(parsed.manifest.kind).toBe(BACKUP_KIND)
		expect(parsed.manifest.version).toBe(BACKUP_VERSION)
		expect(parsed.manifest.counts.subjects).toBe(2)
		expect(parsed.manifest.counts.photos).toBe(1)
		expect(parsed.photos.get(fixture.photo.id)).toEqual(PHOTO_BYTES)

		const portableReminder = parsed.data.assignmentReminders.find(
			(row) => String(row.assignment_id) === fixture.homework.id,
		)
		expect(portableReminder?.notification_id).toBeNull()
		expect(portableReminder?.enabled).toBe(1)
		expect(portableReminder?.scheduled_at).toBe('2099-12-15T17:00:00.000Z')

		// --- Database B: seed unrelated data, then REPLACE via production restore ---
		const { connection: dbB } = await openTestDatabase()
		await bootstrapDatabase(dbB)
		const reposB = createRepositories(dbB)

		const unrelatedPeriod = await reposB.studyPeriods.create({
			name: 'Should Vanish',
			type: 'YEAR',
			startDate: '2020-01-01',
			endDate: '2020-12-31',
			isActive: true,
		})
		const unrelatedSubject = await reposB.subjects.create({
			studyPeriodId: unrelatedPeriod.id,
			name: 'Unrelated Subject',
		})
		await reposB.assignments.create({
			subjectId: unrelatedSubject.id,
			title: 'Unrelated assignment',
			dueDate: '2020-06-01',
		})

		await restoreBackupArchive(reposB, parsed)

		// Replace semantics: unrelated B data is gone
		expect(
			await dbB.getFirstAsync('SELECT id FROM study_periods WHERE id = ?', [
				unrelatedPeriod.id,
			]),
		).toBeNull()
		expect(
			await dbB.getFirstAsync('SELECT id FROM subjects WHERE id = ?', [
				unrelatedSubject.id,
			]),
		).toBeNull()

		await assertNoForeignKeyViolations(dbB)

		// Settings (portable)
		const settings = await reposB.appSettings.get()
		expect(settings?.userMode).toBe('UNIVERSITY')
		expect(settings?.weekCycleMode).toBe('TWO_WEEK')
		expect(settings?.cycleLength).toBe(2)
		expect(settings?.cycleAnchorDate).toBe('2026-09-01')
		expect(settings?.activeStudyPeriodId).toBe(fixture.period.id)

		const period = await reposB.studyPeriods.getById(fixture.period.id)
		expect(period?.name).toBe('Fall 2026')
		expect(period?.isActive).toBe(true)

		const teachers = await dbB.getAllAsync<{ id: string; name: string }>(
			'SELECT id, name FROM teachers ORDER BY name',
		)
		expect(teachers).toEqual([
			{ id: fixture.teacherA.id, name: 'Ivanov A.P.' },
			{ id: fixture.teacherB.id, name: 'Petrova M.S.' },
		])

		const math = await reposB.subjects.getById(fixture.math.id)
		expect(math?.name).toBe('Mathematics')
		expect(math?.targetGrade).toBe(4.5)
		expect(math?.attendanceTarget).toBe(85)
		expect(math?.teacherId).toBe(fixture.teacherA.id)

		const schedule = await reposB.schedule.listByStudyPeriod(fixture.period.id)
		expect(schedule).toHaveLength(3)
		expect(schedule.find((row) => row.id === fixture.weekly.id)?.weekCycle).toBe('EVERY_WEEK')
		expect(schedule.find((row) => row.id === fixture.cycle0.id)?.weekCycle).toBe('CYCLE_0')
		expect(schedule.find((row) => row.id === fixture.cycle1.id)?.weekCycle).toBe('CYCLE_1')

		const exceptions = await reposB.scheduleExceptions.listByStudyPeriod(fixture.period.id)
		expect(exceptions.find((row) => row.id === fixture.cancelled.id)?.exceptionType).toBe(
			'CANCELLED',
		)
		const restoredOverride = exceptions.find((row) => row.id === fixture.override.id)
		expect(restoredOverride?.exceptionType).toBe('TIME_CHANGE')
		expect(restoredOverride?.room).toBe('105')
		expect(restoredOverride?.teacherId).toBe(fixture.teacherB.id)
		expect(restoredOverride?.startTime).toBe('10:00')

		const restoredAdded = exceptions.find((row) => row.id === fixture.added.id)
		expect(restoredAdded?.exceptionType).toBe('ADDED')
		expect(restoredAdded?.subjectId).toBe(fixture.math.id)

		const homework = await reposB.assignments.getById(fixture.homework.id)
		expect(homework?.title).toBe('Homework set 1')
		expect(homework?.sourceScheduleEntryId).toBe(fixture.weekly.id)
		expect(homework?.sourceOccurrenceDate).toBe('2026-09-01')
		expect(homework?.assignmentType).toBe('HOMEWORK')

		const exam = await reposB.assignments.getById(fixture.exam.id)
		expect(exam?.assignmentType).toBe('TEST')

		// Photo roundtrip
		const photos = await reposB.assignmentPhotos.listByAssignment(fixture.homework.id)
		expect(photos).toHaveLength(1)
		expect(photos[0].id).toBe(fixture.photo.id)
		expect(photos[0].localUri).not.toBe(SOURCE_PHOTO_URI)
		expect(photos[0].localUri).toContain('assignment-photos/restores/')
		expect(fsStore.has(photos[0].localUri)).toBe(true)
		expect(fsStore.get(photos[0].localUri)).toBe(PHOTO_BASE64)
		expect(
			Buffer.from(fsStore.get(photos[0].localUri)!, 'base64'),
		).toEqual(Buffer.from(PHOTO_BYTES))

		// Reminder intent preserved; old platform ID reset
		const reminder = await reposB.assignmentReminders.getByAssignmentId(fixture.homework.id)
		expect(reminder?.enabled).toBe(true)
		expect(reminder?.reminderKind).toBe('RELATIVE')
		expect(reminder?.relativeMinutes).toBe(60)
		expect(reminder?.scheduledAt).toBe('2099-12-15T17:00:00.000Z')
		expect(reminder?.notificationId).not.toBe(FAKE_NOTIFICATION_ID)

		// restoreBackupArchive already reconciled once — exactly one schedule call
		expect(scheduler.scheduled).toHaveLength(1)
		expect(scheduler.scheduled[0].assignmentId).toBe(fixture.homework.id)
		expect(scheduler.scheduled[0].id).not.toBe(FAKE_NOTIFICATION_ID)
		expect(reminder?.notificationId).toBe(scheduler.scheduled[0].id)

		// Second reconciliation must not duplicate while platform ID is considered scheduled
		jest.mocked(scheduler.isScheduled).mockResolvedValue(true)
		await reconcileAssignmentReminders(reposB)
		expect(scheduler.scheduled).toHaveLength(1)

		const grade = await reposB.grades.getByAssignmentId(fixture.homework.id)
		expect(grade?.id).toBe(fixture.grade.id)
		expect(grade?.value).toBe(5)
		expect(grade?.weight).toBe(2)
		expect(grade?.assignmentId).toBe(fixture.homework.id)

		const attendanceRows = await dbB.getAllAsync<{
			id: string
			schedule_entry_id: string | null
			schedule_exception_id: string | null
			status: string
		}>('SELECT id, schedule_entry_id, schedule_exception_id, status FROM attendance')
		expect(attendanceRows).toHaveLength(3)
		expect(
			attendanceRows.find((row) => row.id === fixture.attendanceRegular.id),
		).toMatchObject({
			schedule_entry_id: fixture.weekly.id,
			status: 'PRESENT',
		})
		expect(
			attendanceRows.find((row) => row.id === fixture.attendanceAdded.id),
		).toMatchObject({
			schedule_exception_id: fixture.added.id,
			status: 'ABSENT',
		})
		expect(
			attendanceRows.find((row) => row.id === fixture.attendanceExcused.id)?.status,
		).toBe('EXCUSED')

		const holidays = await reposB.holidays.listByStudyPeriod(fixture.period.id)
		expect(holidays.find((row) => row.id === fixture.holiday.id)?.name).toBe('Autumn break')

		const focusSessions = await dbB.getAllAsync<{ id: string; assignment_id: string | null }>(
			'SELECT id, assignment_id FROM focus_sessions ORDER BY started_at',
		)
		expect(focusSessions).toEqual([
			{ id: fixture.focusPlain.id, assignment_id: null },
			{ id: fixture.focusLinked.id, assignment_id: fixture.homework.id },
		])

		const importRow = await reposB.scheduleImports.findByExportAndPeriod(
			'export-fixture-001',
			fixture.period.id,
		)
		expect(importRow?.id).toBe(fixture.importHistory.id)

		// Active focus intentionally excluded from portable backup
		expect(await reposB.activeFocus.get()).toBeNull()
		expect(
			await dbB.getFirstAsync('SELECT * FROM active_focus_session'),
		).toBeNull()
	})
})
