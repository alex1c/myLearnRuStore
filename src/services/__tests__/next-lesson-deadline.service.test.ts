import { findNextSubjectOccurrenceDate } from '@/src/services/next-lesson-deadline.service'
import type { ScheduleContext } from '@/src/types/schedule'

function buildContext(
	overrides: Partial<ScheduleContext> = {},
): ScheduleContext {
	return {
		studyPeriodId: 'period-1',
		cycleLength: 1,
		cycleAnchorDate: '2026-09-01',
		entries: [],
		exceptions: [],
		holidays: [],
		subjects: new Map(),
		teachers: new Map(),
		...overrides,
	}
}

describe('next-lesson-deadline.service', () => {
	it('finds next weekly occurrence', () => {
		const context = buildContext({
			entries: [
				{
					id: 'entry-1',
					studyPeriodId: 'period-1',
					subjectId: 'math',
					teacherId: null,
					room: null,
					weekday: 4,
					startTime: '10:00',
					endTime: '10:45',
					lessonType: null,
					weekCycle: 'EVERY_WEEK',
					createdAt: '2026-01-01T00:00:00.000Z',
					updatedAt: '2026-01-01T00:00:00.000Z',
				},
			],
			subjects: new Map([['math', { id: 'math', name: 'Math' } as never]]),
		})

		const next = findNextSubjectOccurrenceDate('math', '2026-09-02', context)
		expect(next).toBe('2026-09-03')
	})

	it('returns null when no next lesson in horizon', () => {
		const context = buildContext()
		expect(findNextSubjectOccurrenceDate('math', '2026-09-02', context, 7)).toBeNull()
	})
})
