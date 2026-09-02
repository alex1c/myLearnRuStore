import type { LocalDate } from '@/src/types/domain'
import type { NextLessonResult, ScheduleContext, ScheduleOccurrence } from '@/src/types/schedule'
import { addDays, getTodayLocalDate } from '@/src/utils/dates'
import {
	formatRelativeDayLabel,
	formatShortDate,
	getCurrentClockTime,
	minutesUntilTime,
} from '@/src/utils/format'
import { toMinutesSinceMidnight } from '@/src/utils/time'
import { getScheduleForDate } from '@/src/services/occurrence.service'

/** Determine timing status of an occurrence relative to current clock time. */
export function getLessonTimingStatus(
	occurrence: ScheduleOccurrence,
	now: string = getCurrentClockTime(),
): 'upcoming' | 'ongoing' | 'finished' {
	const nowMinutes = toMinutesSinceMidnight(now)
	const start = toMinutesSinceMidnight(occurrence.startTime)
	const end = toMinutesSinceMidnight(occurrence.endTime)

	if (nowMinutes < start) {
		return 'upcoming'
	}

	if (nowMinutes >= start && nowMinutes < end) {
		return 'ongoing'
	}

	return 'finished'
}

/** Find the next future occurrence within a day horizon. */
export function findNextFutureOccurrence(
	startDate: LocalDate,
	context: ScheduleContext,
	horizonDays = 14,
	today: LocalDate = getTodayLocalDate(),
	now: string = getCurrentClockTime(),
): { occurrence: ScheduleOccurrence; date: LocalDate } | null {
	for (let offset = 0; offset <= horizonDays; offset += 1) {
		const date = addDays(startDate, offset)
		const lessons = getScheduleForDate(date, context)

		for (const lesson of lessons) {
			if (date === today) {
				const status = getLessonTimingStatus(lesson, now)
				if (status === 'finished') {
					continue
				}
			}

			return { occurrence: lesson, date }
		}
	}

	return null
}

/** Compute Today screen next-lesson state for a given date. */
export function getTodayLessonState(
	context: ScheduleContext,
	today: LocalDate = getTodayLocalDate(),
	now: string = getCurrentClockTime(),
): NextLessonResult {
	const todayLessons = getScheduleForDate(today, context)

	if (todayLessons.length === 0) {
		const hasAnySchedule = context.entries.length > 0
		const nextFuture = findNextFutureOccurrence(
			addDays(today, 1),
			context,
			14,
			today,
			now,
		)

		return {
			status: hasAnySchedule ? 'no_lessons_today' : 'empty_schedule',
			occurrence: null,
			minutesUntil: null,
			minutesRemaining: null,
			nextFuture: nextFuture
				? {
						occurrence: nextFuture.occurrence,
						date: nextFuture.date,
						dateLabel: `${formatRelativeDayLabel(nextFuture.date, today)} ${nextFuture.occurrence.startTime}`,
					}
				: null,
		}
	}

	const ongoing = todayLessons.find(
		(lesson) => getLessonTimingStatus(lesson, now) === 'ongoing',
	)
	if (ongoing) {
		const remaining = toMinutesSinceMidnight(ongoing.endTime) - toMinutesSinceMidnight(now)
		return {
			status: 'ongoing',
			occurrence: ongoing,
			minutesUntil: null,
			minutesRemaining: Math.max(0, remaining),
			nextFuture: null,
		}
	}

	const upcoming = todayLessons.find(
		(lesson) => getLessonTimingStatus(lesson, now) === 'upcoming',
	)
	if (upcoming) {
		return {
			status: 'upcoming',
			occurrence: upcoming,
			minutesUntil: minutesUntilTime(upcoming.startTime, now),
			minutesRemaining: null,
			nextFuture: null,
		}
	}

	const nextFuture = findNextFutureOccurrence(addDays(today, 1), context, 14, today, now)

	return {
		status: 'finished_today',
		occurrence: null,
		minutesUntil: null,
		minutesRemaining: null,
		nextFuture: nextFuture
			? {
					occurrence: nextFuture.occurrence,
					date: nextFuture.date,
					dateLabel: `${formatRelativeDayLabel(nextFuture.date, today)} ${nextFuture.occurrence.startTime}`,
				}
			: null,
	}
}

/** Format next future lesson for display. */
export function formatNextFutureLabel(
	nextFuture: NextLessonResult['nextFuture'],
	today: LocalDate = getTodayLocalDate(),
): string | null {
	if (!nextFuture) {
		return null
	}

	const dayPart = formatRelativeDayLabel(nextFuture.date, today)
	const subject = nextFuture.occurrence.subjectShortName ?? nextFuture.occurrence.subjectName
	return `${subject} · ${dayPart} ${nextFuture.occurrence.startTime}`
}

/** Format date for finished-today next lesson with full date fallback. */
export function formatNextFutureDetailed(
	nextFuture: NonNullable<NextLessonResult['nextFuture']>,
	today: LocalDate = getTodayLocalDate(),
): string {
	const subject = nextFuture.occurrence.subjectShortName ?? nextFuture.occurrence.subjectName
	const dayLabel = formatRelativeDayLabel(nextFuture.date, today)

	if (dayLabel === 'сегодня' || dayLabel === 'завтра') {
		return `${subject} · ${dayLabel} ${nextFuture.occurrence.startTime}`
	}

	return `${subject} · ${formatShortDate(nextFuture.date)} ${nextFuture.occurrence.startTime}`
}
