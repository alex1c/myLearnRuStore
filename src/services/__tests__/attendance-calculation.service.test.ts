import {
	calculateAdditionalAbsencesAllowed,
	calculateAttendanceRate,
	calculateRequiredPresentsToReachTarget,
	summarizeAttendance,
} from '@/src/services/attendance-calculation.service'

describe('attendance-calculation.service', () => {
	it('calculates rate excluding excused from denominator', () => {
		const counts = summarizeAttendance([
			{ status: 'PRESENT' },
			{ status: 'PRESENT' },
			{ status: 'ABSENT' },
			{ status: 'EXCUSED' },
			{ status: 'EXCUSED' },
			{ status: 'EXCUSED' },
			{ status: 'PRESENT' },
			{ status: 'PRESENT' },
			{ status: 'PRESENT' },
			{ status: 'PRESENT' },
			{ status: 'PRESENT' },
			{ status: 'PRESENT' },
			{ status: 'ABSENT' },
		])
		expect(counts.present).toBe(8)
		expect(counts.absent).toBe(2)
		expect(counts.excused).toBe(3)
		expect(calculateAttendanceRate(counts)).toBeCloseTo(0.8)
	})

	it('calculates additional absences allowed', () => {
		const counts = { present: 8, absent: 2, excused: 0 }
		expect(calculateAdditionalAbsencesAllowed(counts, 75)).toBe(0)
	})

	it('calculates required presents when below target', () => {
		const counts = { present: 7, absent: 3, excused: 0 }
		const needed = calculateRequiredPresentsToReachTarget(counts, 80)
		expect(needed).toBeGreaterThan(0)
	})

	it('reports exact 100% as unattainable after any absence', () => {
		expect(calculateRequiredPresentsToReachTarget(
			{ present: 8, absent: 1, excused: 0 }, 100,
		)).toBeNull()
	})
})
