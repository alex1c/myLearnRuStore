import { openTestDatabase } from '@/src/db/adapters/sqljs-test-adapter'
import { bootstrapDatabase } from '@/src/db/database'
import { createRepositories } from '@/src/db/repositories'
import {
	completeAssignment,
	createAssignment,
	reopenAssignment,
} from '@/src/services/assignment.service'
import {
	setNotificationSchedulerForTests,
} from '@/src/services/notifications/expo-notification-scheduler'
import type { NotificationScheduler } from '@/src/services/notifications/notification-scheduler.types'

function createMockScheduler(): NotificationScheduler & {
	scheduled: { assignmentId: string; fireAt: Date }[]
	cancelled: string[]
} {
	const scheduled: { assignmentId: string; fireAt: Date }[] = []
	const cancelled: string[] = []

	return {
		scheduled,
		cancelled,
		requestPermissions: jest.fn(async () => true),
		schedule: jest.fn(async (input) => {
			scheduled.push({ assignmentId: input.assignmentId, fireAt: input.fireAt })
			return `notif-${input.assignmentId}`
		}),
		cancel: jest.fn(async (id) => {
			cancelled.push(id)
		}),
		cancelAllForAssignment: jest.fn(async () => undefined),
	}
}

describe('assignment reminder sync', () => {
	afterEach(() => {
		setNotificationSchedulerForTests(null)
	})

	it('schedules reminder on create and cancels on complete', async () => {
		const scheduler = createMockScheduler()
		setNotificationSchedulerForTests(scheduler)

		const { connection } = await openTestDatabase()
		await bootstrapDatabase(connection)
		const repos = createRepositories(connection)

		const period = await repos.studyPeriods.create({
			name: '2026',
			type: 'YEAR',
			startDate: '2026-09-01',
			endDate: '2027-05-31',
			isActive: true,
		})
		const subject = await repos.subjects.create({
			studyPeriodId: period.id,
			name: 'Math',
		})

		const { assignment } = await createAssignment(
			repos,
			{
				subjectId: subject.id,
				title: 'Test',
				dueDate: '2099-12-31',
				dueTime: '12:00',
				reminder: {
					enabled: true,
					reminderKind: 'RELATIVE',
					relativeMinutes: 60,
				},
			},
			'Math',
		)

		expect(scheduler.scheduled).toHaveLength(1)

		await completeAssignment(repos, assignment.id)
		expect(scheduler.cancelled.length).toBeGreaterThan(0)

		await reopenAssignment(repos, assignment.id, 'Math')
		const reminder = await repos.assignmentReminders.getByAssignmentId(assignment.id)
		expect(reminder?.enabled).toBe(true)
	})
})
