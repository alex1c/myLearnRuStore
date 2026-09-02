import type { LocalDate } from '@/src/types/domain'
import { addDays, getTodayLocalDate, startOfWeek } from '@/src/utils/dates'
import { getCycleWeekForDate } from '@/src/utils/week-cycle'

/**
 * Compute canonical cycle_anchor_date from user's current-week selection.
 * If user says current week is cycle 0 (числитель), anchor = this Monday.
 * If cycle 1 (знаменатель), anchor = previous Monday.
 */
export function computeAnchorDateFromCurrentWeek(
	selectedCycleIndex: 0 | 1,
	referenceDate: LocalDate = getTodayLocalDate(),
): LocalDate {
	const weekStart = startOfWeek(referenceDate, 1)
	if (selectedCycleIndex === 0) {
		return weekStart
	}

	return addDays(weekStart, -7)
}

/** Infer which cycle index the reference date falls on. */
export function getCurrentCycleIndex(
	anchorDate: LocalDate,
	cycleLength: 1 | 2,
	referenceDate: LocalDate = getTodayLocalDate(),
): number {
	if (cycleLength === 1) {
		return 0
	}

	return getCycleWeekForDate(referenceDate, anchorDate, 2)
}
