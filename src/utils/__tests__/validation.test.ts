import { ValidationError, validateStudyPeriodRange, validateSubjectName } from '@/src/utils/validation'

describe('validation utilities', () => {
	it('requires non-empty subject names', () => {
		expect(() => validateSubjectName('   ')).toThrow(ValidationError)
		expect(validateSubjectName(' Math ')).toBe('Math')
	})

	it('validates study period ranges', () => {
		expect(() =>
			validateStudyPeriodRange('2025-12-01', '2025-09-01'),
		).toThrow(ValidationError)
	})
})
