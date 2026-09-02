import {
	calculateAverage,
	calculateSimpleAverage,
	calculateWeightedAverage,
	isTargetAchieved,
	usesWeightedAverage,
} from '@/src/services/grade-calculation.service'
import {
	buildFivePointPredictions,
	calculateGradesNeededForTarget,
	predictAverageAfterGrade,
} from '@/src/services/grade-prediction.service'

describe('grade-calculation.service', () => {
	it('calculates simple average', () => {
		expect(calculateSimpleAverage([{ value: 4, weight: 1 }, { value: 5, weight: 1 }])).toBe(4.5)
	})

	it('returns null for empty grades', () => {
		expect(calculateAverage([])).toBeNull()
	})

	it('calculates weighted average', () => {
		const grades = [
			{ value: 4, weight: 1 },
			{ value: 5, weight: 2 },
		]
		expect(calculateWeightedAverage(grades)).toBeCloseTo(14 / 3)
		expect(usesWeightedAverage(grades)).toBe(true)
	})

	it('uses simple average when all weights are 1', () => {
		const grades = [{ value: 3, weight: 1 }, { value: 5, weight: 1 }]
		expect(usesWeightedAverage(grades)).toBe(false)
		expect(calculateAverage(grades)).toBe(4)
	})
})

describe('grade-prediction.service', () => {
	it('predicts average after future grade', () => {
		const existing = [{ value: 4, weight: 1 }, { value: 5, weight: 1 }]
		expect(predictAverageAfterGrade(existing, 5)).toBeCloseTo(14 / 3)
	})

	it('builds five-point predictions for [4,5] + future 5', () => {
		const predictions = buildFivePointPredictions([{ value: 4, weight: 1 }, { value: 5, weight: 1 }])
		const five = predictions.find((item) => item.value === 5)
		expect(five?.average).toBeCloseTo(14 / 3)
	})

	it('detects target already achieved', () => {
		const result = calculateGradesNeededForTarget(
			[{ value: 5, weight: 1 }],
			4.5,
			'FIVE_POINT',
		)
		expect(result.status).toBe('achieved')
	})

	it('finds grades needed for target', () => {
		const result = calculateGradesNeededForTarget(
			[{ value: 4, weight: 1 }],
			4.5,
			'FIVE_POINT',
		)
		expect(result.status).toBe('reachable')
		expect(result.gradesNeeded).toBe(1)
	})

	it('handles impossible exact 5.00 target', () => {
		const result = calculateGradesNeededForTarget(
			[{ value: 4, weight: 1 }, { value: 5, weight: 1 }],
			5,
			'FIVE_POINT',
		)
		expect(result.status).toBe('unattainable_exact')
	})
})

describe('target comparison rounding', () => {
	it('does not mark target achieved from display rounding only', () => {
		const average = 4.495
		const target = 4.5
		expect(isTargetAchieved(average, target)).toBe(false)
	})
})
