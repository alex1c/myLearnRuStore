import type { AssignmentListItem, AssignmentFilter, AssignmentGroup } from '@/src/types/assignment'
import {
	compareAssignments,
	getAssignmentDeadlineState,
	getTomorrowLocalDate,
	isAssignmentActive,
	isAssignmentOverdue,
} from '@/src/services/deadline.service'
import { formatRelativeDayLabel, formatShortDate } from '@/src/utils/format'
import { getTodayLocalDate, addDays } from '@/src/utils/dates'
import { isTestOrExam } from '@/src/utils/assignment-labels'

/** Filter assignments by chip selection. */
export function filterAssignments(
	items: AssignmentListItem[],
	filter: AssignmentFilter,
	now: Date = new Date(),
): AssignmentListItem[] {
	const today = getTodayLocalDate(now)
	const tomorrow = getTomorrowLocalDate(now)

	let filtered: AssignmentListItem[]

	switch (filter) {
		case 'today':
			filtered = items.filter(
				(item) =>
					isAssignmentActive(item.status) &&
					item.dueDate === today,
			)
			break
		case 'tomorrow':
			filtered = items.filter(
				(item) =>
					isAssignmentActive(item.status) &&
					item.dueDate === tomorrow,
			)
			break
		case 'overdue':
			filtered = items.filter(
				(item) =>
					isAssignmentActive(item.status) && isAssignmentOverdue(item, now),
			)
			break
		case 'all':
			filtered = [...items]
			break
		case 'upcoming':
		default:
			filtered = items.filter(
				(item) =>
					isAssignmentActive(item.status) &&
					(item.dueDate >= today || isAssignmentOverdue(item, now)),
			)
			break
	}

	return [...filtered].sort((a, b) => compareAssignments(a, b, now))
}

/** Group assignments by due date for section headers. */
export function groupAssignmentsByDate(
	items: AssignmentListItem[],
	now: Date = new Date(),
): AssignmentGroup[] {
	const today = getTodayLocalDate(now)
	const tomorrow = getTomorrowLocalDate(now)
	const groups = new Map<string, AssignmentListItem[]>()

	for (const item of items) {
		const key = item.dueDate
		const list = groups.get(key) ?? []
		list.push(item)
		groups.set(key, list)
	}

	const sortedDates = [...groups.keys()].sort()
	return sortedDates.map((dueDate) => {
		let dateLabel: string
		if (dueDate === today) {
			dateLabel = 'Сегодня'
		} else if (dueDate === tomorrow) {
			dateLabel = 'Завтра'
		} else {
			dateLabel = formatShortDate(dueDate)
		}

		return {
			dateLabel,
			dueDate,
			items: groups.get(dueDate) ?? [],
		}
	})
}

/** Split active and completed for «Все» filter. */
export function splitActiveAndCompleted(items: AssignmentListItem[]): {
	active: AssignmentListItem[]
	completed: AssignmentListItem[]
} {
	const active: AssignmentListItem[] = []
	const completed: AssignmentListItem[] = []

	for (const item of items) {
		if (item.status === 'COMPLETED') {
			completed.push(item)
		} else {
			active.push(item)
		}
	}

	return { active, completed }
}

/** Top assignments for Today dashboard — overdue first, then today, then nearest. */
export function pickTodayAssignments(
	items: AssignmentListItem[],
	limit = 5,
	now: Date = new Date(),
): AssignmentListItem[] {
	const active = items.filter((item) => isAssignmentActive(item.status))
	const sorted = [...active].sort((a, b) => compareAssignments(a, b, now))
	return sorted.slice(0, limit)
}

/** Count overdue active assignments. */
export function countOverdue(items: AssignmentListItem[], now: Date = new Date()): number {
	return items.filter(
		(item) => isAssignmentActive(item.status) && isAssignmentOverdue(item, now),
	).length
}

/** Upcoming TEST/EXAM within horizon for Today «Скоро» section. */
export function pickUpcomingTestsExams(
	items: AssignmentListItem[],
	horizonDays = 14,
	now: Date = new Date(),
): AssignmentListItem[] {
	const today = getTodayLocalDate(now)
	const horizonEnd = addDays(today, horizonDays)

	return items
		.filter(
			(item) =>
				isAssignmentActive(item.status) &&
				isTestOrExam(item.assignmentType) &&
				item.dueDate >= today &&
				item.dueDate <= horizonEnd,
		)
		.sort((a, b) => compareAssignments(a, b, now))
		.slice(0, 3)
}

/** Format due label for cards. */
export function formatAssignmentDueLabel(
	item: AssignmentListItem,
	now: Date = new Date(),
): string {
	const today = getTodayLocalDate(now)
	const relative = formatRelativeDayLabel(item.dueDate, today)
	const timePart = item.dueTime ? ` ${item.dueTime}` : ''
	const state = getAssignmentDeadlineState(item, now)

	if (state === 'OVERDUE') {
		return `просрочено · ${formatShortDate(item.dueDate)}${timePart}`
	}

	if (item.dueDate === today || item.dueDate === getTomorrowLocalDate(now)) {
		return `${relative}${timePart}`
	}

	return `${formatShortDate(item.dueDate)}${timePart}`
}
