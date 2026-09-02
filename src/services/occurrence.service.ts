import type { LocalDate, ScheduleException, Weekday } from '@/src/types/domain'
import type { ScheduleContext, ScheduleOccurrence } from '@/src/types/schedule'
import { getWeekday } from '@/src/utils/dates'
import { getCycleWeekForDate, scheduleAppliesOnCycle } from '@/src/utils/week-cycle'
import { toMinutesSinceMidnight } from '@/src/utils/time'

/** Build stable occurrence identity for regular lessons. */
export function buildOccurrenceId(
	scheduleEntryId: string,
	occurrenceDate: LocalDate,
): string {
	return `${scheduleEntryId}:${occurrenceDate}`
}

/** Check whether a date falls inside any holiday range. */
export function isHolidayDate(date: LocalDate, context: ScheduleContext): boolean {
	return context.holidays.some((holiday) => {
		return date >= holiday.startDate && date <= holiday.endDate
	})
}

/** Find exceptions for a specific entry on a date. */
function getEntryExceptions(
	entryId: string,
	date: LocalDate,
	context: ScheduleContext,
): ScheduleException[] {
	return context.exceptions.filter(
		(item) => item.scheduleEntryId === entryId && item.exceptionDate === date,
	)
}

/** Find lessons rescheduled TO this date from another day. */
function getRescheduledToDate(
	date: LocalDate,
	context: ScheduleContext,
): ScheduleException[] {
	return context.exceptions.filter(
		(item) =>
			item.exceptionType === 'RESCHEDULED' &&
			item.newDate === date &&
			item.scheduleEntryId !== null,
	)
}

/** Find one-off ADDED lessons for a date. */
function getAddedLessons(
	date: LocalDate,
	context: ScheduleContext,
): ScheduleException[] {
	return context.exceptions.filter(
		(item) =>
			item.exceptionType === 'ADDED' &&
			item.exceptionDate === date &&
			item.scheduleEntryId === null,
	)
}

/** Apply exception overrides onto base occurrence fields. */
function applyExceptionOverrides(
	base: Omit<ScheduleOccurrence, 'id' | 'isCancelled' | 'isOneOff' | 'isRescheduled'>,
	exceptions: ScheduleException[],
	context: ScheduleContext,
): Omit<ScheduleOccurrence, 'id' | 'isCancelled' | 'isOneOff' | 'isRescheduled'> {
	let result = { ...base }

	for (const exception of exceptions) {
		if (exception.exceptionType === 'CANCELLED') {
			continue
		}

		if (exception.startTime) {
			result.startTime = exception.startTime
		}

		if (exception.endTime) {
			result.endTime = exception.endTime
		}

		if (exception.room !== null && exception.room !== undefined) {
			result.room = exception.room
		}

		if (exception.teacherId) {
			result.teacherId = exception.teacherId
			result.teacherName = context.teachers.get(exception.teacherId)?.name ?? null
		}
	}

	return result
}

/** Build occurrence from a regular schedule entry. */
function buildFromEntry(
	entry: import('@/src/types/domain').ScheduleEntry,
	date: LocalDate,
	context: ScheduleContext,
	exceptions: ScheduleException[],
	isRescheduled = false,
): ScheduleOccurrence | null {
	const isCancelled = exceptions.some((item) => item.exceptionType === 'CANCELLED')
	const isMovedAway = exceptions.some(
		(item) => item.exceptionType === 'RESCHEDULED' && item.newDate && item.newDate !== date,
	)

	if (isCancelled || isMovedAway) {
		return null
	}

	const subject = context.subjects.get(entry.subjectId)
	if (!subject) {
		return null
	}

	const teacher = entry.teacherId
		? context.teachers.get(entry.teacherId) ?? null
		: null

	const base = {
		scheduleEntryId: entry.id,
		exceptionId: null,
		occurrenceDate: date,
		subjectId: entry.subjectId,
		subjectName: subject.name,
		subjectShortName: subject.shortName,
		subjectColor: subject.color,
		teacherId: entry.teacherId,
		teacherName: teacher?.name ?? null,
		room: entry.room ?? subject.roomDefault,
		startTime: entry.startTime,
		endTime: entry.endTime,
		lessonType: entry.lessonType,
		weekCycle: entry.weekCycle,
	}

	const merged = applyExceptionOverrides(base, exceptions, context)

	return {
		id: buildOccurrenceId(entry.id, date),
		...merged,
		isCancelled: false,
		isOneOff: false,
		isRescheduled,
	}
}

/** Build occurrence from ADDED exception. */
function buildFromAdded(
	exception: ScheduleException,
	date: LocalDate,
	context: ScheduleContext,
): ScheduleOccurrence | null {
	if (!exception.subjectId || !exception.startTime || !exception.endTime) {
		return null
	}

	const subject = context.subjects.get(exception.subjectId)
	if (!subject) {
		return null
	}

	const teacher = exception.teacherId
		? context.teachers.get(exception.teacherId) ?? null
		: null

	return {
		id: `added:${exception.id}`,
		scheduleEntryId: null,
		exceptionId: exception.id,
		occurrenceDate: date,
		subjectId: exception.subjectId,
		subjectName: subject.name,
		subjectShortName: subject.shortName,
		subjectColor: subject.color,
		teacherId: exception.teacherId,
		teacherName: teacher?.name ?? null,
		room: exception.room ?? subject.roomDefault,
		startTime: exception.startTime,
		endTime: exception.endTime,
		lessonType: null,
		weekCycle: 'EVERY_WEEK',
		isCancelled: false,
		isOneOff: true,
		isRescheduled: false,
	}
}

/**
 * Resolve all lesson occurrences for a specific calendar date.
 * Applies week cycle, holidays, and schedule exceptions.
 */
export function getScheduleForDate(
	date: LocalDate,
	context: ScheduleContext,
): ScheduleOccurrence[] {
	const onHoliday = isHolidayDate(date, context)
	const weekday = getWeekday(date) as Weekday
	const cycleIndex =
		context.cycleLength === 2 && context.cycleAnchorDate
			? getCycleWeekForDate(date, context.cycleAnchorDate, 2)
			: 0

	const occurrences: ScheduleOccurrence[] = []

	if (!onHoliday) {
		for (const entry of context.entries) {
			if (entry.weekday !== weekday) {
				continue
			}

			if (!scheduleAppliesOnCycle(entry.weekCycle, cycleIndex)) {
				continue
			}

			const exceptions = getEntryExceptions(entry.id, date, context)
			const occurrence = buildFromEntry(entry, date, context, exceptions)
			if (occurrence) {
				occurrences.push(occurrence)
			}
		}
	}

	for (const rescheduled of getRescheduledToDate(date, context)) {
		if (!rescheduled.scheduleEntryId) {
			continue
		}

		const entry = context.entries.find((item) => item.id === rescheduled.scheduleEntryId)
		if (!entry) {
			continue
		}

		const exceptions = [
			rescheduled,
			...getEntryExceptions(entry.id, date, context),
		]
		const occurrence = buildFromEntry(entry, date, context, exceptions, true)
		if (occurrence) {
			occurrences.push(occurrence)
		}
	}

	for (const added of getAddedLessons(date, context)) {
		const occurrence = buildFromAdded(added, date, context)
		if (occurrence) {
			occurrences.push(occurrence)
		}
	}

	return occurrences.sort(
		(a, b) => toMinutesSinceMidnight(a.startTime) - toMinutesSinceMidnight(b.startTime),
	)
}

/** Get cycle index for a date using schedule context settings. */
export function getCycleIndexForDate(
	date: LocalDate,
	context: ScheduleContext,
): number {
	if (context.cycleLength === 1 || !context.cycleAnchorDate) {
		return 0
	}

	return getCycleWeekForDate(date, context.cycleAnchorDate, 2)
}
