import type { Repositories } from '@/src/db/repositories'
import type { AppSettings, ScheduleWeekCycle, Weekday } from '@/src/types/domain'
import { createId, nowTimestamp } from '@/src/utils/id'

export const SCHEDULE_EXPORT_KIND = 'myLearnScheduleExport' as const
export const SCHEDULE_EXPORT_VERSION = 1 as const
export const MAX_IMPORT_FILE_BYTES = 512_000

export interface ScheduleExportSubject {
	exportSubjectId: string
	name: string
	shortName: string | null
	color: string | null
	roomDefault: string | null
	teacherExportId: string | null
	sortOrder: number
}

export interface ScheduleExportTeacher {
	exportTeacherId: string
	name: string
	notes: string | null
}

export interface ScheduleExportEntry {
	exportEntryId: string
	exportSubjectId: string
	exportTeacherId: string | null
	room: string | null
	weekday: Weekday
	startTime: string
	endTime: string
	lessonType: string | null
	weekCycle: ScheduleWeekCycle
}

export interface ScheduleExportDocument {
	kind: typeof SCHEDULE_EXPORT_KIND
	version: typeof SCHEDULE_EXPORT_VERSION
	exportId: string
	exportedAt: string
	studyPeriodName: string
	cycleLength: 1 | 2
	cycleAnchorDate: string | null
	weekCycleMode: AppSettings['weekCycleMode']
	subjects: ScheduleExportSubject[]
	teachers: ScheduleExportTeacher[]
	scheduleEntries: ScheduleExportEntry[]
}

export interface ScheduleExportPreview {
	document: ScheduleExportDocument
	subjectCount: number
	entryCount: number
	teacherCount: number
}

/** Build a portable schedule export for the active study period. */
export async function buildScheduleExport(
	repos: Repositories,
	settings: AppSettings,
	studyPeriodId: string,
	studyPeriodName: string,
): Promise<ScheduleExportDocument> {
	const [subjects, teachers, entries] = await Promise.all([
		repos.subjects.listByStudyPeriod(studyPeriodId),
		repos.teachers.list(),
		repos.schedule.listByStudyPeriod(studyPeriodId),
	])

	const teacherById = new Map(teachers.map((item) => [item.id, item]))
	const subjectExportIds = new Map(subjects.map((item) => [item.id, createId()]))
	const teacherExportIds = new Map<string, string>()

	const exportTeachers: ScheduleExportTeacher[] = []
	for (const subject of subjects) {
		if (subject.teacherId && !teacherExportIds.has(subject.teacherId)) {
			const teacher = teacherById.get(subject.teacherId)
			if (teacher) {
				teacherExportIds.set(subject.teacherId, createId())
				exportTeachers.push({
					exportTeacherId: teacherExportIds.get(subject.teacherId)!,
					name: teacher.name,
					notes: teacher.notes,
				})
			}
		}
	}

	for (const entry of entries) {
		if (entry.teacherId && !teacherExportIds.has(entry.teacherId)) {
			const teacher = teacherById.get(entry.teacherId)
			if (teacher) {
				teacherExportIds.set(entry.teacherId, createId())
				exportTeachers.push({
					exportTeacherId: teacherExportIds.get(entry.teacherId)!,
					name: teacher.name,
					notes: teacher.notes,
				})
			}
		}
	}

	exportTeachers.sort((a, b) => a.name.localeCompare(b.name, 'ru'))

	return {
		kind: SCHEDULE_EXPORT_KIND,
		version: SCHEDULE_EXPORT_VERSION,
		exportId: createId(),
		exportedAt: nowTimestamp(),
		studyPeriodName,
		cycleLength: settings.cycleLength,
		cycleAnchorDate: settings.cycleAnchorDate,
		weekCycleMode: settings.weekCycleMode,
		subjects: subjects.map((subject) => ({
			exportSubjectId: subjectExportIds.get(subject.id)!,
			name: subject.name,
			shortName: subject.shortName,
			color: subject.color,
			roomDefault: subject.roomDefault,
			teacherExportId: subject.teacherId
				? teacherExportIds.get(subject.teacherId) ?? null
				: null,
			sortOrder: subject.sortOrder,
		})),
		teachers: exportTeachers,
		scheduleEntries: entries.map((entry) => ({
			exportEntryId: createId(),
			exportSubjectId: subjectExportIds.get(entry.subjectId)!,
			exportTeacherId: entry.teacherId
				? teacherExportIds.get(entry.teacherId) ?? null
				: null,
			room: entry.room,
			weekday: entry.weekday,
			startTime: entry.startTime,
			endTime: entry.endTime,
			lessonType: entry.lessonType,
			weekCycle: entry.weekCycle,
		})),
	}
}

/** Serialize export document to pretty JSON. */
export function serializeScheduleExport(document: ScheduleExportDocument): string {
	return JSON.stringify(document, null, 2)
}

/** Parse and validate untrusted schedule export JSON. */
export function parseScheduleExportJson(raw: string): ScheduleExportPreview {
	if (raw.length > MAX_IMPORT_FILE_BYTES) {
		throw new Error('Import file is too large')
	}

	let parsed: unknown
	try {
		parsed = JSON.parse(raw)
	} catch {
		throw new Error('Invalid JSON file')
	}

	const document = validateScheduleExportDocument(parsed)

	return {
		document,
		subjectCount: document.subjects.length,
		entryCount: document.scheduleEntries.length,
		teacherCount: document.teachers.length,
	}
}

function validateScheduleExportDocument(value: unknown): ScheduleExportDocument {
	if (!value || typeof value !== 'object') {
		throw new Error('Invalid export format')
	}

	const doc = value as Record<string, unknown>
	if (doc.kind !== SCHEDULE_EXPORT_KIND) {
		throw new Error('Unsupported export kind')
	}

	if (doc.version !== SCHEDULE_EXPORT_VERSION) {
		throw new Error('Unsupported export version')
	}

	if (typeof doc.exportId !== 'string' || doc.exportId.length > 64) {
		throw new Error('Invalid export id')
	}

	if (typeof doc.exportedAt !== 'string') {
		throw new Error('Invalid exportedAt')
	}

	if (typeof doc.studyPeriodName !== 'string' || doc.studyPeriodName.length > 200) {
		throw new Error('Invalid study period name')
	}

	if (doc.cycleLength !== 1 && doc.cycleLength !== 2) {
		throw new Error('Invalid cycle length')
	}

	if (
		doc.cycleAnchorDate !== null &&
		(typeof doc.cycleAnchorDate !== 'string' || doc.cycleAnchorDate.length > 10)
	) {
		throw new Error('Invalid cycle anchor date')
	}

	if (!Array.isArray(doc.subjects) || doc.subjects.length > 100) {
		throw new Error('Invalid subjects list')
	}

	if (!Array.isArray(doc.teachers) || doc.teachers.length > 200) {
		throw new Error('Invalid teachers list')
	}

	if (!Array.isArray(doc.scheduleEntries) || doc.scheduleEntries.length > 500) {
		throw new Error('Invalid schedule entries list')
	}

	const subjectIds = new Set<string>()
	const subjects = doc.subjects.map((item, index) => {
		const row = item as Record<string, unknown>
		if (typeof row.exportSubjectId !== 'string' || row.exportSubjectId.length > 64) {
			throw new Error(`Invalid subject id at ${index}`)
		}

		if (subjectIds.has(row.exportSubjectId)) {
			throw new Error('Duplicate subject export id')
		}

		subjectIds.add(row.exportSubjectId)

		if (typeof row.name !== 'string' || row.name.trim().length === 0 || row.name.length > 200) {
			throw new Error(`Invalid subject name at ${index}`)
		}

		return {
			exportSubjectId: row.exportSubjectId,
			name: row.name.trim(),
			shortName: typeof row.shortName === 'string' ? row.shortName.slice(0, 50) : null,
			color: typeof row.color === 'string' ? row.color.slice(0, 20) : null,
			roomDefault: typeof row.roomDefault === 'string' ? row.roomDefault.slice(0, 100) : null,
			teacherExportId:
				typeof row.teacherExportId === 'string' ? row.teacherExportId : null,
			sortOrder: typeof row.sortOrder === 'number' ? row.sortOrder : 0,
		}
	})

	const teacherIds = new Set<string>()
	const teachers = doc.teachers.map((item, index) => {
		const row = item as Record<string, unknown>
		if (typeof row.exportTeacherId !== 'string' || row.exportTeacherId.length > 64) {
			throw new Error(`Invalid teacher id at ${index}`)
		}

		if (teacherIds.has(row.exportTeacherId)) {
			throw new Error('Duplicate teacher export id')
		}

		teacherIds.add(row.exportTeacherId)

		if (typeof row.name !== 'string' || row.name.trim().length === 0 || row.name.length > 200) {
			throw new Error(`Invalid teacher name at ${index}`)
		}

		return {
			exportTeacherId: row.exportTeacherId,
			name: row.name.trim(),
			notes: typeof row.notes === 'string' ? row.notes.slice(0, 500) : null,
		}
	})

	const entryIds = new Set<string>()
	const scheduleEntries = doc.scheduleEntries.map((item, index) => {
		const row = item as Record<string, unknown>
		if (typeof row.exportEntryId !== 'string' || row.exportEntryId.length > 64) {
			throw new Error(`Invalid entry id at ${index}`)
		}

		if (entryIds.has(row.exportEntryId)) {
			throw new Error('Duplicate schedule entry export id')
		}

		entryIds.add(row.exportEntryId)

		if (
			typeof row.exportSubjectId !== 'string' ||
			!subjectIds.has(row.exportSubjectId)
		) {
			throw new Error(`Missing subject reference at ${index}`)
		}

		if (
			row.exportTeacherId !== null &&
			(typeof row.exportTeacherId !== 'string' || !teacherIds.has(row.exportTeacherId))
		) {
			throw new Error(`Missing teacher reference at ${index}`)
		}

		const weekday = row.weekday
		if (typeof weekday !== 'number' || weekday < 1 || weekday > 7) {
			throw new Error(`Invalid weekday at ${index}`)
		}

		if (typeof row.startTime !== 'string' || typeof row.endTime !== 'string') {
			throw new Error(`Invalid time at ${index}`)
		}

		const weekCycle = row.weekCycle
		if (
			weekCycle !== 'EVERY_WEEK' &&
			weekCycle !== 'CYCLE_0' &&
			weekCycle !== 'CYCLE_1'
		) {
			throw new Error(`Invalid week cycle at ${index}`)
		}

		return {
			exportEntryId: row.exportEntryId,
			exportSubjectId: row.exportSubjectId,
			exportTeacherId:
				typeof row.exportTeacherId === 'string' ? row.exportTeacherId : null,
			room: typeof row.room === 'string' ? row.room.slice(0, 100) : null,
			weekday: weekday as Weekday,
			startTime: row.startTime,
			endTime: row.endTime,
			lessonType: typeof row.lessonType === 'string' ? row.lessonType.slice(0, 50) : null,
			weekCycle: weekCycle as ScheduleExportEntry['weekCycle'],
		}
	})

	return {
		kind: SCHEDULE_EXPORT_KIND,
		version: SCHEDULE_EXPORT_VERSION,
		exportId: doc.exportId,
		exportedAt: doc.exportedAt,
		studyPeriodName: doc.studyPeriodName,
		cycleLength: doc.cycleLength,
		cycleAnchorDate: doc.cycleAnchorDate as string | null,
		weekCycleMode: doc.weekCycleMode as AppSettings['weekCycleMode'],
		subjects,
		teachers,
		scheduleEntries,
	}
}

/** Check whether this export was already imported into the period. */
export async function wasScheduleExportImported(
	repos: Repositories,
	exportId: string,
	studyPeriodId: string,
): Promise<boolean> {
	const existing = await repos.scheduleImports.findByExportAndPeriod(
		exportId,
		studyPeriodId,
	)
	return existing !== null
}

/** Import validated schedule export into the active study period (transactional). */
export async function importScheduleExport(
	repos: Repositories,
	document: ScheduleExportDocument,
	studyPeriodId: string,
): Promise<{ subjectsCreated: number; entriesCreated: number }> {
	let subjectsCreated = 0
	let entriesCreated = 0

	await repos.runInTransaction(async () => {
		const existingTeachers = await repos.teachers.list()
		const teacherMap = new Map<string, string>()

		for (const teacher of document.teachers) {
			const normalized = teacher.name.trim().toLowerCase()
			const match = existingTeachers.find(
				(item) => item.name.trim().toLowerCase() === normalized,
			)

			if (match) {
				teacherMap.set(teacher.exportTeacherId, match.id)
			} else {
				const created = await repos.teachers.create({
					name: teacher.name,
					notes: teacher.notes,
				})
				teacherMap.set(teacher.exportTeacherId, created.id)
				existingTeachers.push(created)
			}
		}

		const existingSubjects = await repos.subjects.listByStudyPeriod(studyPeriodId)
		const subjectMap = new Map<string, string>()

		for (const subject of document.subjects) {
			const normalized = subject.name.trim().toLowerCase()
			const match = existingSubjects.find(
				(item) => item.name.trim().toLowerCase() === normalized,
			)

			if (match) {
				subjectMap.set(subject.exportSubjectId, match.id)
			} else {
				const created = await repos.subjects.create({
					studyPeriodId,
					name: subject.name,
					shortName: subject.shortName,
					color: subject.color,
					roomDefault: subject.roomDefault,
					teacherId: subject.teacherExportId
						? teacherMap.get(subject.teacherExportId) ?? null
						: null,
					sortOrder: subject.sortOrder,
				})
				subjectMap.set(subject.exportSubjectId, created.id)
				existingSubjects.push(created)
				subjectsCreated += 1
			}
		}

		for (const entry of document.scheduleEntries) {
			const subjectId = subjectMap.get(entry.exportSubjectId)
			if (!subjectId) {
				throw new Error('Schedule entry references unknown subject')
			}

			await repos.schedule.create({
				studyPeriodId,
				subjectId,
				teacherId: entry.exportTeacherId
					? teacherMap.get(entry.exportTeacherId) ?? null
					: null,
				room: entry.room,
				weekday: entry.weekday,
				startTime: entry.startTime,
				endTime: entry.endTime,
				lessonType: entry.lessonType,
				weekCycle: entry.weekCycle,
			})
			entriesCreated += 1
		}

		await repos.scheduleImports.record({
			exportId: document.exportId,
			studyPeriodId,
		})
	})

	return { subjectsCreated, entriesCreated }
}
