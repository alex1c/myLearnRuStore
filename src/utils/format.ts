import type { LocalDate, ClockTime } from '@/src/types/domain'
import { addDays, getWeekday, parseLocalDate } from '@/src/utils/dates'
import { formatClockTime, toMinutesSinceMidnight } from '@/src/utils/time'

const MONTHS_SHORT = [
	'янв', 'фев', 'мар', 'апр', 'мая', 'июн',
	'июл', 'авг', 'сен', 'окт', 'ноя', 'дек',
]

const MONTHS_GENITIVE = [
	'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
	'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
]

const WEEKDAY_SHORT = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб']

/** Format week range like "2–8 сентября". */
export function formatWeekRange(weekStart: LocalDate): string {
	const weekEnd = addDays(weekStart, 6)
	const startParts = parseLocalDate(weekStart)
	const endParts = parseLocalDate(weekEnd)

	if (!startParts || !endParts) {
		return weekStart
	}

	if (startParts.month === endParts.month) {
		return `${startParts.day}–${endParts.day} ${MONTHS_GENITIVE[startParts.month - 1]}`
	}

	return `${startParts.day} ${MONTHS_SHORT[startParts.month - 1]} – ${endParts.day} ${MONTHS_SHORT[endParts.month - 1]}`
}

/** Short date label for next-lesson hints. */
export function formatShortDate(date: LocalDate): string {
	const parts = parseLocalDate(date)
	if (!parts) {
		return date
	}

	return `${parts.day} ${MONTHS_GENITIVE[parts.month - 1]}`
}

/** Relative day label: сегодня / завтра / weekday. */
export function formatRelativeDayLabel(
	date: LocalDate,
	today: LocalDate,
): string {
	if (date === today) {
		return 'сегодня'
	}

	if (date === addDays(today, 1)) {
		return 'завтра'
	}

	const weekday = getWeekday(date)
	return WEEKDAY_SHORT[weekday === 7 ? 0 : weekday].toLowerCase()
}

/** Current local clock time as HH:MM. */
export function getCurrentClockTime(): ClockTime {
	const now = new Date()
	return formatClockTime(now.getHours(), now.getMinutes())
}

/** Minutes from now until a clock time today (negative if passed). */
export function minutesUntilTime(time: ClockTime, now: ClockTime = getCurrentClockTime()): number {
	return toMinutesSinceMidnight(time) - toMinutesSinceMidnight(now)
}

/** Human-readable "через N мин" label. */
export function formatMinutesUntil(minutes: number): string {
	if (minutes <= 0) {
		return 'сейчас'
	}

	if (minutes < 60) {
		return `через ${minutes} мин`
	}

	const hours = Math.floor(minutes / 60)
	const mins = minutes % 60
	if (mins === 0) {
		return `через ${hours} ч`
	}

	return `через ${hours} ч ${mins} мин`
}

/** Format time range for lesson cards. */
export function formatTimeRange(start: ClockTime, end: ClockTime): string {
	return `${start}–${end}`
}
