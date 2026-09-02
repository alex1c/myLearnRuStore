import type { Assignment, LocalDate } from '@/src/types/domain'

/** Assignment enriched with subject metadata for list rendering. */
export interface AssignmentListItem extends Assignment {
	subjectName: string
	subjectColor: string | null
	subjectIsArchived: boolean
	photoCount: number
	hasReminder: boolean
}

export type AssignmentFilter =
	| 'upcoming'
	| 'today'
	| 'tomorrow'
	| 'overdue'
	| 'all'

export interface AssignmentGroup {
	dateLabel: string
	dueDate: LocalDate
	items: AssignmentListItem[]
}
