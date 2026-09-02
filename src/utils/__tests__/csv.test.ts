import { escapeCsvCell, buildCsvRow } from '@/src/utils/csv'

describe('csv utils', () => {
	it('escapes formula injection prefixes', () => {
		expect(escapeCsvCell('=SUM(A1)')).toBe("\"'=SUM(A1)\"")
		expect(escapeCsvCell('+123')).toBe("\"'+123\"")
		expect(escapeCsvCell('-100')).toBe("\"'-100\"")
		expect(escapeCsvCell('@cmd')).toBe("\"'@cmd\"")
	})

	it('quotes cells with commas and newlines', () => {
		expect(buildCsvRow(['Math', 'note, with comma'])).toBe('Math,"note, with comma"')
	})
})
