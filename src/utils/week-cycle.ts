import type { LocalDate } from '@/src/types/domain'
import { addDays, daysBetween, startOfWeek } from '@/src/utils/dates'

/** Safe modulo that works for negative numbers in JS. */
export function mod(value: number, divisor: number): number {
	return ((value % divisor) + divisor) % divisor
}

/**
 * Returns the cycle index for a date relative to an anchor week.
 * Anchor week is always cycle 0.
 * cycleLength 1 always returns 0.
 * cycleLength 2 alternates 0/1 by whole weeks from anchor Monday.
 */
export function getCycleWeekForDate(
	date: LocalDate,
	anchorDate: LocalDate,
	cycleLength: 1 | 2,
): number {
	if (cycleLength === 1) {
		return 0
	}

	const anchorWeekStart = startOfWeek(anchorDate, 1)
	const dateWeekStart = startOfWeek(date, 1)
	const weekDiff = Math.floor(daysBetween(anchorWeekStart, dateWeekStart) / 7)
	return mod(weekDiff, 2)
}

/** Map cycle index to schedule week cycle filter value. */
export function cycleIndexToWeekCycle(
	cycleIndex: number,
): 'EVERY_WEEK' | 'CYCLE_0' | 'CYCLE_1' {
	if (cycleIndex === 0) {
		return 'CYCLE_0'
	}

	return 'CYCLE_1'
}

/** Check whether a schedule entry applies on the given cycle index. */
export function scheduleAppliesOnCycle(
	entryWeekCycle: 'EVERY_WEEK' | 'CYCLE_0' | 'CYCLE_1',
	cycleIndex: number,
): boolean {
	if (entryWeekCycle === 'EVERY_WEEK') {
		return true
	}

	if (entryWeekCycle === 'CYCLE_0') {
		return cycleIndex === 0
	}

	return cycleIndex === 1
}

/** Convenience helper for tests around anchor transitions. */
export function getCycleWeekForDateWithOffset(
	anchorDate: LocalDate,
	dayOffset: number,
	cycleLength: 1 | 2,
): number {
	const date = addDays(anchorDate, dayOffset)
	return getCycleWeekForDate(date, anchorDate, cycleLength)
}
