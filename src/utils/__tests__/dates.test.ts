import {
	addDays,
	compareLocalDates,
	daysBetween,
	formatLocalDate,
	getDaysInMonth,
	getWeekday,
	isLeapYear,
	isValidLocalDate,
	parseLocalDate,
} from '@/src/utils/dates'

describe('dates utilities', () => {
	it('validates YYYY-MM-DD including leap day', () => {
		expect(isValidLocalDate('2024-02-29')).toBe(true)
		expect(isValidLocalDate('2023-02-29')).toBe(false)
		expect(isValidLocalDate('2024-13-01')).toBe(false)
		expect(isValidLocalDate('24-02-29')).toBe(false)
	})

	it('detects leap years', () => {
		expect(isLeapYear(2024)).toBe(true)
		expect(isLeapYear(1900)).toBe(false)
		expect(isLeapYear(2000)).toBe(true)
	})

	it('compares local dates without ISO string parsing', () => {
		expect(compareLocalDates('2025-12-31', '2026-01-01')).toBeLessThan(0)
		expect(compareLocalDates('2026-01-01', '2025-12-31')).toBeGreaterThan(0)
	})

	it('adds days across month and year boundaries', () => {
		expect(addDays('2025-12-31', 1)).toBe('2026-01-01')
		expect(addDays('2024-02-28', 1)).toBe('2024-02-29')
		expect(addDays('2023-02-28', 1)).toBe('2023-03-01')
	})

	it('calculates signed day differences', () => {
		expect(daysBetween('2025-09-01', '2025-09-08')).toBe(7)
		expect(daysBetween('2025-09-08', '2025-09-01')).toBe(-7)
	})

	it('returns ISO weekday with Monday = 1', () => {
		expect(getWeekday('2025-09-01')).toBe(1)
		expect(getWeekday('2025-09-07')).toBe(7)
	})

	it('round-trips day index conversion', () => {
		const parts = parseLocalDate('2025-09-01')
		expect(parts).not.toBeNull()
		if (!parts) {
			return
		}

		const formatted = formatLocalDate(parts.year, parts.month, parts.day)
		expect(formatted).toBe('2025-09-01')
		expect(getDaysInMonth(2024, 2)).toBe(29)
	})
})
