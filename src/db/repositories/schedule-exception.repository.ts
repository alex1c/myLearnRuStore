import type { DatabaseConnection } from '@/src/db/types'
import type {
	ClockTime,
	LocalDate,
	ScheduleException,
	ScheduleExceptionType,
} from '@/src/types/domain'
import { createId, nowTimestamp } from '@/src/utils/id'
import {
	validateClockTime,
	validateLocalDate,
	validateOptionalClockTime,
	validateTimeRange,
} from '@/src/utils/validation'

interface ExceptionRow {
	id: string
	study_period_id: string
	exception_date: string
	schedule_entry_id: string | null
	exception_type: string
	subject_id: string | null
	teacher_id: string | null
	room: string | null
	start_time: string | null
	end_time: string | null
	new_date: string | null
	notes: string | null
	created_at: string
	updated_at: string
}

function mapRow(row: ExceptionRow): ScheduleException {
	return {
		id: row.id,
		studyPeriodId: row.study_period_id,
		exceptionDate: row.exception_date,
		scheduleEntryId: row.schedule_entry_id,
		exceptionType: row.exception_type as ScheduleExceptionType,
		subjectId: row.subject_id,
		teacherId: row.teacher_id,
		room: row.room,
		startTime: row.start_time,
		endTime: row.end_time,
		newDate: row.new_date,
		notes: row.notes,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	}
}

export interface CreateExceptionInput {
	studyPeriodId: string
	exceptionDate: LocalDate
	scheduleEntryId?: string | null
	exceptionType: ScheduleExceptionType
	subjectId?: string | null
	teacherId?: string | null
	room?: string | null
	startTime?: ClockTime | null
	endTime?: ClockTime | null
	newDate?: LocalDate | null
	notes?: string | null
}

export class ScheduleExceptionRepository {
	constructor(private readonly db: DatabaseConnection) {}

	async listByStudyPeriod(studyPeriodId: string): Promise<ScheduleException[]> {
		const rows = await this.db.getAllAsync<ExceptionRow>(
			'SELECT * FROM schedule_exceptions WHERE study_period_id = ?',
			[studyPeriodId],
		)
		return rows.map(mapRow)
	}

	async getForEntryOnDate(
		scheduleEntryId: string,
		exceptionDate: LocalDate,
	): Promise<ScheduleException | null> {
		const row = await this.db.getFirstAsync<ExceptionRow>(
			`SELECT * FROM schedule_exceptions
			 WHERE schedule_entry_id = ? AND exception_date = ?`,
			[scheduleEntryId, exceptionDate],
		)
		return row ? mapRow(row) : null
	}

	async cancelOccurrence(input: {
		studyPeriodId: string
		scheduleEntryId: string
		exceptionDate: LocalDate
	}): Promise<ScheduleException> {
		const existing = await this.getForEntryOnDate(
			input.scheduleEntryId,
			input.exceptionDate,
		)

		if (existing) {
			await this.db.runAsync('DELETE FROM schedule_exceptions WHERE id = ?', [existing.id])
		}

		return this.create({
			studyPeriodId: input.studyPeriodId,
			exceptionDate: input.exceptionDate,
			scheduleEntryId: input.scheduleEntryId,
			exceptionType: 'CANCELLED',
		})
	}

	async overrideOccurrence(input: {
		studyPeriodId: string
		scheduleEntryId: string
		exceptionDate: LocalDate
		startTime?: ClockTime | null
		endTime?: ClockTime | null
		teacherId?: string | null
		room?: string | null
	}): Promise<ScheduleException> {
		const startTime = input.startTime
			? validateClockTime(input.startTime, 'startTime')
			: null
		const endTime = input.endTime
			? validateClockTime(input.endTime, 'endTime')
			: null

		if (startTime && endTime) {
			validateTimeRange(startTime, endTime)
		}

		const existing = await this.getForEntryOnDate(
			input.scheduleEntryId,
			input.exceptionDate,
		)

		if (existing) {
			await this.db.runAsync('DELETE FROM schedule_exceptions WHERE id = ?', [existing.id])
		}

		return this.create({
			studyPeriodId: input.studyPeriodId,
			exceptionDate: input.exceptionDate,
			scheduleEntryId: input.scheduleEntryId,
			exceptionType: 'TIME_CHANGE',
			startTime,
			endTime,
			teacherId: input.teacherId ?? null,
			room: input.room ?? null,
		})
	}

	async createOneOffLesson(input: {
		studyPeriodId: string
		exceptionDate: LocalDate
		subjectId: string
		startTime: ClockTime
		endTime: ClockTime
		teacherId?: string | null
		room?: string | null
	}): Promise<ScheduleException> {
		return this.create({
			studyPeriodId: input.studyPeriodId,
			exceptionDate: input.exceptionDate,
			scheduleEntryId: null,
			exceptionType: 'ADDED',
			subjectId: input.subjectId,
			startTime: input.startTime,
			endTime: input.endTime,
			teacherId: input.teacherId ?? null,
			room: input.room ?? null,
		})
	}

	async create(input: CreateExceptionInput): Promise<ScheduleException> {
		validateLocalDate(input.exceptionDate, 'exceptionDate')
		if (input.newDate) {
			validateLocalDate(input.newDate, 'newDate')
		}

		const startTime = validateOptionalClockTime(input.startTime, 'startTime')
		const endTime = validateOptionalClockTime(input.endTime, 'endTime')
		if (startTime && endTime) {
			validateTimeRange(startTime, endTime)
		}

		const timestamp = nowTimestamp()
		const exception: ScheduleException = {
			id: createId(),
			studyPeriodId: input.studyPeriodId,
			exceptionDate: input.exceptionDate,
			scheduleEntryId: input.scheduleEntryId ?? null,
			exceptionType: input.exceptionType,
			subjectId: input.subjectId ?? null,
			teacherId: input.teacherId ?? null,
			room: input.room ?? null,
			startTime,
			endTime,
			newDate: input.newDate ?? null,
			notes: input.notes ?? null,
			createdAt: timestamp,
			updatedAt: timestamp,
		}

		await this.db.runAsync(
			`INSERT INTO schedule_exceptions (
				id, study_period_id, exception_date, schedule_entry_id, exception_type,
				subject_id, teacher_id, room, start_time, end_time, new_date, notes,
				created_at, updated_at
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			[
				exception.id,
				exception.studyPeriodId,
				exception.exceptionDate,
				exception.scheduleEntryId,
				exception.exceptionType,
				exception.subjectId,
				exception.teacherId,
				exception.room,
				exception.startTime,
				exception.endTime,
				exception.newDate,
				exception.notes,
				exception.createdAt,
				exception.updatedAt,
			],
		)

		return exception
	}

	async delete(id: string): Promise<void> {
		await this.db.runAsync('DELETE FROM schedule_exceptions WHERE id = ?', [id])
	}
}
