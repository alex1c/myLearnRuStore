import type { LocalDate } from '@/src/types/domain'
import type { ScheduleContext } from '@/src/types/schedule'
import { getScheduleForDate } from '@/src/services/occurrence.service'
import { addDays } from '@/src/utils/dates'

/** Default search horizon for next lesson of a subject. */
export const NEXT_LESSON_HORIZON_DAYS = 60

/** Find the next occurrence of a subject after a given date. */
export function findNextSubjectOccurrenceDate(
	subjectId: string,
	afterDate: LocalDate,
	context: ScheduleContext,
	horizonDays = NEXT_LESSON_HORIZON_DAYS,
): LocalDate | null {
	for (let offset = 1; offset <= horizonDays; offset += 1) {
		const candidate = addDays(afterDate, offset)
		const lessons = getScheduleForDate(candidate, context)
		const match = lessons.find(
			(lesson) => lesson.subjectId === subjectId && !lesson.isCancelled,
		)
		if (match) {
			return candidate
		}
	}

	return null
}
