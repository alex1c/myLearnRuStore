import type { LocalDate, Weekday } from '@/src/types/domain'

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/

interface DateParts {
	year: number
	month: number
	day: number
}

/** Parse YYYY-MM-DD into numeric parts without ISO string Date parsing. */
export function parseLocalDate(value: string): DateParts | null {
	const match = DATE_PATTERN.exec(value)
	if (!match) {
		return null
	}

	const year = Number(match[1])
	const month = Number(match[2])
	const day = Number(match[3])

	if (!isValidDateParts(year, month, day)) {
		return null
	}

	return { year, month, day }
}

/** Validate a local calendar date string. */
export function isValidLocalDate(value: string): value is LocalDate {
	return parseLocalDate(value) !== null
}

/** Return true when year/month/day form a real civil calendar date. */
export function isValidDateParts(year: number, month: number, day: number): boolean {
	if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
		return false
	}

	if (month < 1 || month > 12 || day < 1) {
		return false
	}

	const daysInMonth = getDaysInMonth(year, month)
	return day <= daysInMonth
}

/** Days in month accounting for leap years. */
export function getDaysInMonth(year: number, month: number): number {
	const monthLengths = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
	if (month === 2 && isLeapYear(year)) {
		return 29
	}

	return monthLengths[month - 1]
}

/** Leap year check using Gregorian rules. */
export function isLeapYear(year: number): boolean {
	return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
}

/**
 * Convert a civil date to a day index for safe arithmetic.
 * Uses a fixed epoch of 1970-01-01 = 0.
 */
export function toDayIndex(parts: DateParts): number {
	const { year, month, day } = parts
	const monthOffset = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334]
	let days = (year - 1970) * 365
	days += Math.floor((year - 1969) / 4)
	days -= Math.floor((year - 1901) / 100)
	days += Math.floor((year - 1601) / 400)
	days += monthOffset[month - 1] + day - 1

	if (month > 2 && isLeapYear(year)) {
		days += 1
	}

	return days
}

/** Convert day index back to YYYY-MM-DD. */
export function fromDayIndex(dayIndex: number): LocalDate {
	let remaining = dayIndex
	let year = 1970

	while (true) {
		const yearLength = isLeapYear(year) ? 366 : 365
		if (remaining < yearLength) {
			break
		}

		remaining -= yearLength
		year += 1
	}

	let month = 1
	while (month <= 12) {
		const monthLength = getDaysInMonth(year, month)
		if (remaining < monthLength) {
			break
		}

		remaining -= monthLength
		month += 1
	}

	const day = remaining + 1
	return formatLocalDate(year, month, day)
}

/** Format numeric parts as YYYY-MM-DD. */
export function formatLocalDate(year: number, month: number, day: number): LocalDate {
	const monthText = String(month).padStart(2, '0')
	const dayText = String(day).padStart(2, '0')
	return `${year}-${monthText}-${dayText}`
}

/** Signed day difference: to - from. */
export function daysBetween(from: LocalDate, to: LocalDate): number {
	const fromParts = parseLocalDate(from)
	const toParts = parseLocalDate(to)

	if (!fromParts || !toParts) {
		throw new Error('Invalid local date passed to daysBetween')
	}

	return toDayIndex(toParts) - toDayIndex(fromParts)
}

/** Compare two local dates. Returns negative if a < b. */
export function compareLocalDates(a: LocalDate, b: LocalDate): number {
	return -daysBetween(a, b)
}

/** Add signed days to a local date. */
export function addDays(date: LocalDate, amount: number): LocalDate {
	const parts = parseLocalDate(date)
	if (!parts) {
		throw new Error('Invalid local date passed to addDays')
	}

	return fromDayIndex(toDayIndex(parts) + amount)
}

/**
 * ISO weekday for a local date: 1 = Monday … 7 = Sunday.
 * Uses Zeller-like algorithm on civil calendar values only.
 */
export function getWeekday(date: LocalDate): Weekday {
	const parts = parseLocalDate(date)
	if (!parts) {
		throw new Error('Invalid local date passed to getWeekday')
	}

	const { year, month, day } = parts
	let y = year
	let m = month

	if (m < 3) {
		m += 12
		y -= 1
	}

	const k = y % 100
	const j = Math.floor(y / 100)
	const h = (day + Math.floor((13 * (m + 1)) / 5) + k + Math.floor(k / 4) + Math.floor(j / 4) + 5 * j) % 7
	const weekday = ((h + 5) % 7) + 1
	return weekday as Weekday
}

/** Start of week containing the given date (Monday-based by default). */
export function startOfWeek(date: LocalDate, firstDayOfWeek: Weekday = 1): LocalDate {
	const weekday = getWeekday(date)
	const offset = (weekday - firstDayOfWeek + 7) % 7
	return addDays(date, -offset)
}

/** Human-readable Russian date for the Today screen. */
export function formatDisplayDate(date: LocalDate): string {
	const parts = parseLocalDate(date)
	if (!parts) {
		return date
	}

	const weekdays = [
		'воскресенье',
		'понедельник',
		'вторник',
		'среда',
		'четверг',
		'пятница',
		'суббота',
	]
	const months = [
		'января',
		'февраля',
		'марта',
		'апреля',
		'мая',
		'июня',
		'июля',
		'августа',
		'сентября',
		'октября',
		'ноября',
		'декабря',
	]

	const weekday = getWeekday(date)
	const weekdayLabel = weekdays[weekday === 7 ? 0 : weekday]
	return `${parts.day} ${months[parts.month - 1]}, ${weekdayLabel}`
}

/** Current local calendar date as YYYY-MM-DD. */
export function getTodayLocalDate(now: Date = new Date()): LocalDate {
	return formatLocalDate(now.getFullYear(), now.getMonth() + 1, now.getDate())
}
