import type { GradeScale } from '@/src/types/domain'

/** Minimal grade row for calculations. */
export interface GradeValueRow {
	value: number
	weight: number
}

/** Get maximum achievable value for a grading scale. */
export function getScaleMaximum(scale: GradeScale): number {
	switch (scale) {
		case 'FIVE_POINT':
			return 5
		case 'TEN_POINT':
			return 10
		case 'HUNDRED_POINT':
			return 100
		default:
			return 100
	}
}

/** Get minimum valid value for a grading scale. */
export function getScaleMinimum(scale: GradeScale): number {
	switch (scale) {
		case 'FIVE_POINT':
			return 2
		case 'TEN_POINT':
			return 1
		case 'HUNDRED_POINT':
			return 0
		default:
			return 0
	}
}

/** Whether any grade uses non-default weight. */
export function usesWeightedAverage(grades: GradeValueRow[]): boolean {
	return grades.some((grade) => grade.weight !== 1)
}

/** Simple arithmetic mean. Returns null when no grades. */
export function calculateSimpleAverage(grades: GradeValueRow[]): number | null {
	if (grades.length === 0) {
		return null
	}

	const sum = grades.reduce((total, grade) => total + grade.value, 0)
	return sum / grades.length
}

/** Weighted average: Σ(value×weight) / Σ(weight). Returns null when empty. */
export function calculateWeightedAverage(grades: GradeValueRow[]): number | null {
	if (grades.length === 0) {
		return null
	}

	let weightedSum = 0
	let totalWeight = 0

	for (const grade of grades) {
		weightedSum += grade.value * grade.weight
		totalWeight += grade.weight
	}

	if (totalWeight <= 0) {
		return null
	}

	return weightedSum / totalWeight
}

/** Primary average metric — weighted when any weight != 1. */
export function calculateAverage(grades: GradeValueRow[]): number | null {
	if (grades.length === 0) {
		return null
	}

	return usesWeightedAverage(grades)
		? calculateWeightedAverage(grades)
		: calculateSimpleAverage(grades)
}

/** Compare raw average against raw target (no display rounding). */
export function isTargetAchieved(average: number | null, target: number | null): boolean {
	if (average === null || target === null) {
		return false
	}

	return average >= target
}

/** Format average for UI with decimal comma (2 decimal places). */
export function formatGradeAverage(value: number | null): string {
	if (value === null) {
		return '—'
	}

	return value.toFixed(2).replace('.', ',')
}

/** Format single grade value for display. */
export function formatGradeValue(value: number, scale: GradeScale): string {
	if (scale === 'FIVE_POINT' || scale === 'TEN_POINT') {
		const rounded = Math.round(value * 100) / 100
		return String(rounded).replace('.', ',')
	}

	return value.toFixed(2).replace('.', ',')
}

/** Parse user numeric input accepting comma or dot decimal separator. */
export function parseDecimalInput(input: string): number | null {
	const normalized = input.trim().replace(',', '.')
	if (!normalized) {
		return null
	}

	const value = Number(normalized)
	return Number.isFinite(value) ? value : null
}

/** Count grades by rounded value for five-point distribution stats. */
export function countFivePointDistribution(
	grades: GradeValueRow[],
): Record<number, number> {
	const counts: Record<number, number> = { 2: 0, 3: 0, 4: 0, 5: 0 }

	for (const grade of grades) {
		const rounded = Math.round(grade.value)
		if (rounded >= 2 && rounded <= 5) {
			counts[rounded] = (counts[rounded] ?? 0) + 1
		}
	}

	return counts
}

/** Last N grade values for dynamics display. */
export function getRecentGradeValues(
	grades: { value: number; date: string }[],
	limit = 5,
): number[] {
	return [...grades]
		.sort((a, b) => b.date.localeCompare(a.date))
		.slice(0, limit)
		.map((grade) => grade.value)
		.reverse()
}
