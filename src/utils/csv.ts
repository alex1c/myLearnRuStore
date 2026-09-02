/** Escape a CSV cell and protect against spreadsheet formula injection. */
export function escapeCsvCell(value: string | number | null | undefined): string {
	if (value === null || value === undefined) {
		return ''
	}

	const text = String(value)
	const needsFormulaGuard = /^[=+\-@]/.test(text)
	const guarded = needsFormulaGuard ? `'${text}` : text
	const escaped = guarded.replace(/"/g, '""')

	if (/[",\n\r]/.test(escaped) || needsFormulaGuard) {
		return `"${escaped}"`
	}

	return escaped
}

/** Build a CSV row from cell values. */
export function buildCsvRow(cells: (string | number | null | undefined)[]): string {
	return cells.map(escapeCsvCell).join(',')
}

/** Build a full CSV document with header row. */
export function buildCsvDocument(
	header: string[],
	rows: (string | number | null | undefined)[][],
): string {
	return [buildCsvRow(header), ...rows.map(buildCsvRow)].join('\n')
}
