import type { ClockTime } from '@/src/types/domain'

const TIME_PATTERN = /^(\d{2}):(\d{2})$/

interface TimeParts {
	hours: number
	minutes: number
}

/** Parse HH:MM into numeric parts. */
export function parseClockTime(value: string): TimeParts | null {
	const match = TIME_PATTERN.exec(value)
	if (!match) {
		return null
	}

	const hours = Number(match[1])
	const minutes = Number(match[2])

	if (!isValidTimeParts(hours, minutes)) {
		return null
	}

	return { hours, minutes }
}

/** Validate HH:MM clock time. Rejects 24:00 and invalid ranges. */
export function isValidClockTime(value: string): value is ClockTime {
	return parseClockTime(value) !== null
}

/** Validate hour/minute components. */
export function isValidTimeParts(hours: number, minutes: number): boolean {
	if (!Number.isInteger(hours) || !Number.isInteger(minutes)) {
		return false
	}

	if (hours < 0 || hours > 23) {
		return false
	}

	if (minutes < 0 || minutes > 59) {
		return false
	}

	return true
}

/** Convert HH:MM to minutes since midnight for comparisons. */
export function toMinutesSinceMidnight(time: ClockTime): number {
	const parts = parseClockTime(time)
	if (!parts) {
		throw new Error('Invalid clock time')
	}

	return parts.hours * 60 + parts.minutes
}

/** Return true when start is strictly before end. */
export function isStartBeforeEnd(start: ClockTime, end: ClockTime): boolean {
	return toMinutesSinceMidnight(start) < toMinutesSinceMidnight(end)
}

/** Format minutes since midnight as HH:MM. */
export function formatClockTime(hours: number, minutes: number): ClockTime {
	return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}
