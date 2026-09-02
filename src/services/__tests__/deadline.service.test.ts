import {
	getAssignmentDeadlineState,
	isAssignmentOverdue,
} from '@/src/services/deadline.service'
import type { Assignment } from '@/src/types/domain'

function makeAssignment(
	overrides: Partial<Assignment> = {},
): Pick<Assignment, 'dueDate' | 'dueTime' | 'status'> {
	return {
		dueDate: '2026-09-02',
		dueTime: null,
		status: 'PENDING',
		...overrides,
	}
}

function localDate(year: number, month: number, day: number, hour = 12, minute = 0): Date {
	return new Date(year, month - 1, day, hour, minute, 0, 0)
}

describe('deadline.service', () => {
	it('date-only today is not overdue during today', () => {
		const now = localDate(2026, 9, 2, 23, 59)
		const assignment = makeAssignment({ dueDate: '2026-09-02', dueTime: null })
		expect(isAssignmentOverdue(assignment, now)).toBe(false)
		expect(getAssignmentDeadlineState(assignment, now)).toBe('DUE_TODAY')
	})

	it('date-only yesterday is overdue', () => {
		const now = localDate(2026, 9, 3, 10, 0)
		const assignment = makeAssignment({ dueDate: '2026-09-02', dueTime: null })
		expect(isAssignmentOverdue(assignment, now)).toBe(true)
		expect(getAssignmentDeadlineState(assignment, now)).toBe('OVERDUE')
	})

	it('timed today before deadline is not overdue', () => {
		const now = localDate(2026, 9, 2, 9, 0)
		const assignment = makeAssignment({ dueDate: '2026-09-02', dueTime: '10:00' })
		expect(isAssignmentOverdue(assignment, now)).toBe(false)
	})

	it('timed today after deadline is overdue', () => {
		const now = localDate(2026, 9, 2, 10, 30)
		const assignment = makeAssignment({ dueDate: '2026-09-02', dueTime: '10:00' })
		expect(isAssignmentOverdue(assignment, now)).toBe(true)
	})

	it('completed is never overdue', () => {
		const now = localDate(2026, 9, 5, 10, 0)
		const assignment = makeAssignment({
			dueDate: '2026-09-01',
			dueTime: '08:00',
			status: 'COMPLETED',
		})
		expect(isAssignmentOverdue(assignment, now)).toBe(false)
		expect(getAssignmentDeadlineState(assignment, now)).toBe('COMPLETED')
	})

	it('handles year/month boundary', () => {
		const now = localDate(2027, 1, 1, 0, 1)
		const assignment = makeAssignment({ dueDate: '2026-12-31', dueTime: null })
		expect(isAssignmentOverdue(assignment, now)).toBe(true)
	})
})
