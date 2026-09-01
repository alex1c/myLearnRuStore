import { addDays } from '@/src/utils/dates'
import {
	getCycleWeekForDate,
	getCycleWeekForDateWithOffset,
	mod,
	scheduleAppliesOnCycle,
} from '@/src/utils/week-cycle'

const ANCHOR = '2025-09-01'

describe('week cycle engine', () => {
	it('normalizes negative modulo values', () => {
		expect(mod(-1, 2)).toBe(1)
		expect(mod(-2, 2)).toBe(0)
		expect(mod(3, 2)).toBe(1)
	})

	it('returns cycle 0 on anchor week', () => {
		expect(getCycleWeekForDate(ANCHOR, ANCHOR, 2)).toBe(0)
	})

	it('returns cycle 1 on the next week', () => {
		expect(getCycleWeekForDate(addDays(ANCHOR, 7), ANCHOR, 2)).toBe(1)
	})

	it('returns cycle 1 on the week before anchor', () => {
		expect(getCycleWeekForDate(addDays(ANCHOR, -7), ANCHOR, 2)).toBe(1)
	})

	it('handles December to January transition', () => {
		const anchor = '2025-12-29'
		const afterNewYear = '2026-01-05'
		expect(getCycleWeekForDate(afterNewYear, anchor, 2)).toBe(1)
	})

	it('handles leap year week boundaries', () => {
		const anchor = '2024-02-26'
		expect(getCycleWeekForDateWithOffset(anchor, 7, 2)).toBe(1)
		expect(getCycleWeekForDateWithOffset(anchor, 14, 2)).toBe(0)
	})

	it('always returns 0 for single-week mode', () => {
		expect(getCycleWeekForDate('2026-05-01', ANCHOR, 1)).toBe(0)
	})

	it('filters schedule entries by cycle index', () => {
		expect(scheduleAppliesOnCycle('EVERY_WEEK', 0)).toBe(true)
		expect(scheduleAppliesOnCycle('CYCLE_0', 0)).toBe(true)
		expect(scheduleAppliesOnCycle('CYCLE_0', 1)).toBe(false)
		expect(scheduleAppliesOnCycle('CYCLE_1', 1)).toBe(true)
	})
})
