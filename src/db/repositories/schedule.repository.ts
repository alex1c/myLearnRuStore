import type { DatabaseConnection } from '@/src/db/types'
import type { ScheduleEntry, ScheduleWeekCycle, Weekday } from '@/src/types/domain'
import { createId, nowTimestamp } from '@/src/utils/id'
import {
	validateClockTime,
	validateTimeRange,
} from '@/src/utils/validation'

interface ScheduleEntryRow {
	id: string
	study_period_id: string
	subject_id: string
	teacher_id: string | null
	room: string | null
	weekday: number
	start_time: string
	end_time: string
	lesson_type: string | null
	week_cycle: string
	created_at: string
	updated_at: string
}

function mapRow(row: ScheduleEntryRow): ScheduleEntry {
	return {
		id: row.id,
		studyPeriodId: row.study_period_id,
		subjectId: row.subject_id,
		teacherId: row.teacher_id,
		room: row.room,
		weekday: row.weekday as Weekday,
		startTime: row.start_time,
		endTime: row.end_time,
		lessonType: row.lesson_type,
		weekCycle: row.week_cycle as ScheduleWeekCycle,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	}
}

export interface CreateScheduleEntryInput {
	studyPeriodId: string
	subjectId: string
	teacherId?: string | null
	room?: string | null
	weekday: Weekday
	startTime: string
	endTime: string
	lessonType?: string | null
	weekCycle?: ScheduleWeekCycle
}

export class ScheduleRepository {
	constructor(private readonly db: DatabaseConnection) {}

	async listByStudyPeriod(studyPeriodId: string): Promise<ScheduleEntry[]> {
		const rows = await this.db.getAllAsync<ScheduleEntryRow>(
			`SELECT * FROM schedule_entries
			 WHERE study_period_id = ?
			 ORDER BY weekday ASC, start_time ASC`,
			[studyPeriodId],
		)
		return rows.map(mapRow)
	}

	async getById(id: string): Promise<ScheduleEntry | null> {
		const row = await this.db.getFirstAsync<ScheduleEntryRow>(
			'SELECT * FROM schedule_entries WHERE id = ?',
			[id],
		)
		return row ? mapRow(row) : null
	}

	async hasCycleSpecificEntries(studyPeriodId: string): Promise<boolean> {
		const row = await this.db.getFirstAsync<{ count: number }>(
			`SELECT COUNT(*) as count FROM schedule_entries
			 WHERE study_period_id = ? AND week_cycle IN ('CYCLE_0', 'CYCLE_1')`,
			[studyPeriodId],
		)
		return (row?.count ?? 0) > 0
	}

	async update(
		id: string,
		input: Partial<CreateScheduleEntryInput>,
	): Promise<ScheduleEntry> {
		const existing = await this.getById(id)
		if (!existing) {
			throw new Error('Schedule entry not found')
		}

		const startTime = input.startTime
			? validateClockTime(input.startTime, 'startTime')
			: existing.startTime
		const endTime = input.endTime
			? validateClockTime(input.endTime, 'endTime')
			: existing.endTime
		validateTimeRange(startTime, endTime)

		if (input.subjectId && input.studyPeriodId) {
			const subject = await this.db.getFirstAsync<{ study_period_id: string }>(
				'SELECT study_period_id FROM subjects WHERE id = ?',
				[input.subjectId],
			)
			if (!subject || subject.study_period_id !== input.studyPeriodId) {
				throw new Error('Schedule subject must belong to the study period')
			}
		}

		const updated: ScheduleEntry = {
			...existing,
			subjectId: input.subjectId ?? existing.subjectId,
			teacherId: input.teacherId !== undefined ? input.teacherId : existing.teacherId,
			room: input.room !== undefined ? input.room : existing.room,
			weekday: input.weekday ?? existing.weekday,
			startTime,
			endTime,
			lessonType: input.lessonType !== undefined ? input.lessonType : existing.lessonType,
			weekCycle: input.weekCycle ?? existing.weekCycle,
			updatedAt: nowTimestamp(),
		}

		await this.db.runAsync(
			`UPDATE schedule_entries SET
				subject_id = ?, teacher_id = ?, room = ?, weekday = ?,
				start_time = ?, end_time = ?, lesson_type = ?, week_cycle = ?, updated_at = ?
			 WHERE id = ?`,
			[
				updated.subjectId,
				updated.teacherId,
				updated.room,
				updated.weekday,
				updated.startTime,
				updated.endTime,
				updated.lessonType,
				updated.weekCycle,
				updated.updatedAt,
				id,
			],
		)

		return updated
	}

	async delete(id: string): Promise<void> {
		await this.db.runAsync('DELETE FROM schedule_entries WHERE id = ?', [id])
	}

	async create(input: CreateScheduleEntryInput): Promise<ScheduleEntry> {
		const startTime = validateClockTime(input.startTime, 'startTime')
		const endTime = validateClockTime(input.endTime, 'endTime')
		validateTimeRange(startTime, endTime)
		const subject = await this.db.getFirstAsync<{ study_period_id: string }>(
			'SELECT study_period_id FROM subjects WHERE id = ?',
			[input.subjectId],
		)
		if (!subject || subject.study_period_id !== input.studyPeriodId) {
			throw new Error('Schedule subject must belong to the study period')
		}

		const timestamp = nowTimestamp()
		const entry: ScheduleEntry = {
			id: createId(),
			studyPeriodId: input.studyPeriodId,
			subjectId: input.subjectId,
			teacherId: input.teacherId ?? null,
			room: input.room ?? null,
			weekday: input.weekday,
			startTime,
			endTime,
			lessonType: input.lessonType ?? null,
			weekCycle: input.weekCycle ?? 'EVERY_WEEK',
			createdAt: timestamp,
			updatedAt: timestamp,
		}

		await this.db.runAsync(
			`INSERT INTO schedule_entries (
				id, study_period_id, subject_id, teacher_id, room, weekday,
				start_time, end_time, lesson_type, week_cycle, created_at, updated_at
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			[
				entry.id,
				entry.studyPeriodId,
				entry.subjectId,
				entry.teacherId,
				entry.room,
				entry.weekday,
				entry.startTime,
				entry.endTime,
				entry.lessonType,
				entry.weekCycle,
				entry.createdAt,
				entry.updatedAt,
			],
		)

		return entry
	}
}
