import { pluralizeRu } from '@/src/utils/pluralize-ru'

describe('pluralizeRu', () => {
	it('picks Russian занятие forms', () => {
		expect(pluralizeRu(1, 'занятие', 'занятия', 'занятий')).toBe('занятие')
		expect(pluralizeRu(2, 'занятие', 'занятия', 'занятий')).toBe('занятия')
		expect(pluralizeRu(5, 'занятие', 'занятия', 'занятий')).toBe('занятий')
		expect(pluralizeRu(21, 'занятие', 'занятия', 'занятий')).toBe('занятие')
		expect(pluralizeRu(11, 'занятие', 'занятия', 'занятий')).toBe('занятий')
	})
})
