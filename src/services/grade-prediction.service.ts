import type { GradeScale } from '@/src/types/domain'
import {
	calculateAverage,
	getScaleMaximum,
	type GradeValueRow,
} from '@/src/services/grade-calculation.service'

const MAX_FUTURE_GRADES = 1000

export interface TargetProgressResult {
	status: 'achieved' | 'reachable' | 'unattainable_exact' | 'unattainable'
	gradesNeeded: number | null
	maxValueUsed: number
	futureWeight: number
	message?: string
}

/** Predict average after adding one future grade. */
export function predictAverageAfterGrade(
	existing: GradeValueRow[],
	futureValue: number,
	futureWeight = 1,
): number {
	const combined: GradeValueRow[] = [
		...existing,
		{ value: futureValue, weight: futureWeight },
	]
	return calculateAverage(combined) ?? futureValue
}

/** Find minimum grade value needed in one addition to reach target, or null. */
export function findMinimumGradeForTarget(
	existing: GradeValueRow[],
	target: number,
	scale: GradeScale,
	futureWeight = 1,
): number | null {
	const min = scale === 'FIVE_POINT' ? 2 : scale === 'TEN_POINT' ? 1 : 0
	const max = getScaleMaximum(scale)

	for (let value = min; value <= max; value += scale === 'FIVE_POINT' ? 1 : 0.01) {
		const testValue = scale === 'FIVE_POINT' ? value : Math.round(value * 100) / 100
		if (testValue > max) {
			break
		}

		const predicted = predictAverageAfterGrade(existing, testValue, futureWeight)
		if (predicted >= target) {
			return testValue
		}

		if (scale === 'FIVE_POINT') {
			continue
		}

		if (scale === 'TEN_POINT' && value >= max) {
			break
		}
	}

	// Integer scales: try discrete values for TEN_POINT
	if (scale === 'TEN_POINT') {
		for (let value = min; value <= max; value += 1) {
			if (predictAverageAfterGrade(existing, value, futureWeight) >= target) {
				return value
			}
		}
	}

	if (scale === 'HUNDRED_POINT') {
		for (let value = 0; value <= 100; value += 1) {
			if (predictAverageAfterGrade(existing, value, futureWeight) >= target) {
				return value
			}
		}
	}

	return null
}

/** How many max-value grades needed to reach target. */
export function calculateGradesNeededForTarget(
	existing: GradeValueRow[],
	target: number,
	scale: GradeScale,
	futureWeight = 1,
): TargetProgressResult {
	const current = calculateAverage(existing)
	const maxValue = getScaleMaximum(scale)

	if (current !== null && current >= target) {
		return {
			status: 'achieved',
			gradesNeeded: 0,
			maxValueUsed: maxValue,
			futureWeight,
		}
	}

	// Exact maximum target with existing lower grades — mathematically unreachable
	if (
		target >= maxValue &&
		existing.some((grade) => grade.value < maxValue)
	) {
		let reachable = false
		for (let n = 1; n <= MAX_FUTURE_GRADES; n += 1) {
			const simulated = [...existing]
			for (let i = 0; i < n; i += 1) {
				simulated.push({ value: maxValue, weight: futureWeight })
			}
			const avg = calculateAverage(simulated)
			if (avg !== null && avg >= target - 1e-9) {
				reachable = true
				break
			}
		}

		if (!reachable || Math.abs(target - maxValue) < 1e-9) {
			return {
				status: 'unattainable_exact',
				gradesNeeded: null,
				maxValueUsed: maxValue,
				futureWeight,
				message:
					'Точно ' +
					String(maxValue).replace('.', ',') +
					' при текущих оценках получить уже нельзя, но средний можно приблизить к ' +
					String(maxValue).replace('.', ','),
			}
		}
	}

	for (let n = 0; n <= MAX_FUTURE_GRADES; n += 1) {
		const simulated = [...existing]
		for (let i = 0; i < n; i += 1) {
			simulated.push({ value: maxValue, weight: futureWeight })
		}

		const avg = calculateAverage(simulated)
		if (avg !== null && avg >= target) {
			return {
				status: n === 0 ? 'achieved' : 'reachable',
				gradesNeeded: n,
				maxValueUsed: maxValue,
				futureWeight,
			}
		}
	}

	return {
		status: 'unattainable',
		gradesNeeded: null,
		maxValueUsed: maxValue,
		futureWeight,
		message: 'Цель недостижима при текущей шкале оценивания',
	}
}

/** Build prediction map for all discrete values on five-point scale. */
export function buildFivePointPredictions(
	existing: GradeValueRow[],
	futureWeight = 1,
): { value: number; average: number }[] {
	return [2, 3, 4, 5].map((value) => ({
		value,
		average: predictAverageAfterGrade(existing, value, futureWeight),
	}))
}
