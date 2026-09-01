import {
	isStartBeforeEnd,
	isValidClockTime,
	parseClockTime,
	toMinutesSinceMidnight,
} from '@/src/utils/time'

describe('time utilities', () => {
	it('validates HH:MM values', () => {
		expect(isValidClockTime('08:30')).toBe(true)
		expect(isValidClockTime('23:59')).toBe(true)
		expect(isValidClockTime('24:00')).toBe(false)
		expect(isValidClockTime('08:60')).toBe(false)
		expect(isValidClockTime('8:30')).toBe(false)
	})

	it('parses clock time parts', () => {
		expect(parseClockTime('09:15')).toEqual({ hours: 9, minutes: 15 })
	})

	it('compares start and end times', () => {
		expect(isStartBeforeEnd('08:30', '09:15')).toBe(true)
		expect(isStartBeforeEnd('09:15', '08:30')).toBe(false)
		expect(isStartBeforeEnd('09:00', '09:00')).toBe(false)
	})

	it('converts to minutes since midnight', () => {
		expect(toMinutesSinceMidnight('01:30')).toBe(90)
	})
})
