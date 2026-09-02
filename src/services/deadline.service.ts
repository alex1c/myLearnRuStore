import type { Assignment, AssignmentStatus, ClockTime, LocalDate } from '@/src/types/domain'
import { addDays, getTodayLocalDate } from '@/src/utils/dates'
import { toMinutesSinceMidnight } from '@/src/utils/time'

export type { DeadlineState } from '@/src/types/domain'

/** Whether an active assignment is past its deadline in local time. */
export function isAssignmentOverdue(
	assignment: Pick<Assignment, 'dueDate' | 'dueTime' | 'status'>,
	now: Date = new Date(),
): boolean {
	if (assignment.status === 'COMPLETED' || assignment.status === 'CANCELLED') {
		return false
	}

	const today = getTodayLocalDate(now)

	if (assignment.dueDate < today) {
		return true
	}

	if (assignment.dueDate > today) {
		return false
	}

	// Same calendar day: date-only deadlines are not overdue until day ends.
	if (!assignment.dueTime) {
		return false
	}

	const currentMinutes = now.getHours() * 60 + now.getMinutes()
	return currentMinutes >= toMinutesSinceMidnight(assignment.dueTime)
}

/** Classify deadline state for filters and UI badges. */
export function getAssignmentDeadlineState(
	assignment: Pick<Assignment, 'dueDate' | 'dueTime' | 'status'>,
	now: Date = new Date(),
): import('@/src/types/domain').DeadlineState {
	if (assignment.status === 'COMPLETED' || assignment.status === 'CANCELLED') {
		return 'COMPLETED'
	}

	if (isAssignmentOverdue(assignment, now)) {
		return 'OVERDUE'
	}

	const today = getTodayLocalDate(now)
	if (assignment.dueDate === today) {
		return 'DUE_TODAY'
	}

	return 'UPCOMING'
}

/** Sort key time — date-only assignments sort at end of day. */
export function getAssignmentSortTime(dueTime: ClockTime | null): string {
	return dueTime ?? '23:59'
}

/** Priority weight for sorting (higher = more important). */
export function getPriorityWeight(priority: Assignment['priority']): number {
	switch (priority) {
		case 'HIGH':
			return 2
		case 'NORMAL':
			return 1
		case 'LOW':
			return 0
	}
}

/** Compare two assignments for list ordering. */
export function compareAssignments(
	a: Assignment,
	b: Assignment,
	now: Date = new Date(),
): number {
	const aOverdue = isAssignmentOverdue(a, now)
	const bOverdue = isAssignmentOverdue(b, now)
	if (aOverdue !== bOverdue) {
		return aOverdue ? -1 : 1
	}

	if (a.dueDate !== b.dueDate) {
		return a.dueDate < b.dueDate ? -1 : 1
	}

	const timeCompare = getAssignmentSortTime(a.dueTime).localeCompare(
		getAssignmentSortTime(b.dueTime),
	)
	if (timeCompare !== 0) {
		return timeCompare
	}

	const priorityDiff = getPriorityWeight(b.priority) - getPriorityWeight(a.priority)
	if (priorityDiff !== 0) {
		return priorityDiff
	}

	return a.createdAt.localeCompare(b.createdAt)
}

/** Whether assignment is active (not completed/cancelled). */
export function isAssignmentActive(status: AssignmentStatus): boolean {
	return status === 'PENDING' || status === 'IN_PROGRESS'
}

/** Tomorrow's local date string. */
export function getTomorrowLocalDate(now: Date = new Date()): LocalDate {
	return addDays(getTodayLocalDate(now), 1)
}
