import type { Repositories } from '@/src/db/repositories'
import type { Assignment, ReminderKind } from '@/src/types/domain'
import {
	getNotificationScheduler,
} from '@/src/services/notifications/expo-notification-scheduler'
import {
	buildReminderNotificationBody,
	computeReminderFireDate,
} from '@/src/services/reminder.service'
import { nowTimestamp } from '@/src/utils/id'

export interface ReminderConfigInput {
	enabled: boolean
	reminderKind: ReminderKind
	relativeMinutes?: number | null
	absoluteTime?: string | null
	absoluteDayOffset?: number
}

export interface ReminderSyncResult {
	success: boolean
	warning?: string
}

/** Cancel platform notification and clear stored notification id. */
export async function cancelAssignmentReminder(
	repos: Repositories,
	assignmentId: string,
): Promise<void> {
	const reminder = await repos.assignmentReminders.getByAssignmentId(assignmentId)
	if (reminder?.notificationId) {
		await getNotificationScheduler().cancel(reminder.notificationId)
	}

	if (reminder) {
		await repos.assignmentReminders.upsert(assignmentId, {
			enabled: reminder.enabled,
			reminderKind: reminder.reminderKind,
			relativeMinutes: reminder.relativeMinutes,
			absoluteTime: reminder.absoluteTime,
			absoluteDayOffset: reminder.absoluteDayOffset,
			scheduledAt: reminder.scheduledAt,
			notificationId: null,
		})
	}
}

/** Schedule or reschedule reminder from persisted intent. */
export async function syncAssignmentReminder(
	repos: Repositories,
	assignment: Assignment,
	subjectName: string,
	config: ReminderConfigInput,
): Promise<ReminderSyncResult> {
	await cancelAssignmentReminder(repos, assignment.id)

	if (!config.enabled || config.reminderKind === 'NONE') {
		await repos.assignmentReminders.upsert(assignment.id, {
			enabled: false,
			reminderKind: 'NONE',
			relativeMinutes: null,
			absoluteTime: null,
			absoluteDayOffset: 0,
			scheduledAt: null,
			notificationId: null,
		})
		return { success: true }
	}

	const fireDate = computeReminderFireDate(assignment, config)
	if (!fireDate) {
		await repos.assignmentReminders.upsert(assignment.id, {
			enabled: true,
			reminderKind: config.reminderKind,
			relativeMinutes: config.relativeMinutes ?? null,
			absoluteTime: config.absoluteTime ?? null,
			absoluteDayOffset: config.absoluteDayOffset ?? 0,
			scheduledAt: null,
			notificationId: null,
		})
		return { success: true }
	}

	const scheduler = getNotificationScheduler()
	const { title, body } = buildReminderNotificationBody(assignment, subjectName)
	const notificationId = await scheduler.schedule({
		assignmentId: assignment.id,
		title,
		body,
		fireAt: fireDate,
	})

	const scheduledAt = fireDate.toISOString()

	await repos.assignmentReminders.upsert(assignment.id, {
		enabled: true,
		reminderKind: config.reminderKind,
		relativeMinutes: config.relativeMinutes ?? null,
		absoluteTime: config.absoluteTime ?? null,
		absoluteDayOffset: config.absoluteDayOffset ?? 0,
		scheduledAt,
		notificationId,
	})

	if (!notificationId) {
		return {
			success: false,
			warning: 'Задание сохранено, но напоминание включить не удалось.',
		}
	}

	return { success: true }
}

/** Reconcile all future reminders on app bootstrap — cancel and reschedule deterministically. */
export async function reconcileAssignmentReminders(
	repos: Repositories,
): Promise<void> {
	const nowIso = nowTimestamp()
	const reminders = await repos.assignmentReminders.listEnabledFuture(nowIso)
	const scheduler = getNotificationScheduler()

	for (const reminder of reminders) {
		const assignment = await repos.assignments.getById(reminder.assignmentId)
		if (!assignment) {
			continue
		}

		const listItem = await repos.assignments.getListItemById(assignment.id)
		if (!listItem) {
			continue
		}

		if (reminder.notificationId && await scheduler.isScheduled(reminder.notificationId)) {
			continue
		}

		const fireDate = reminder.scheduledAt ? new Date(reminder.scheduledAt) : null
		if (!fireDate || fireDate.getTime() <= Date.now()) {
			continue
		}

		// Reconciliation never prompts. Persisted intent remains enabled so the user
		// can restore it explicitly after granting permission.
		if (!await scheduler.hasPermission()) {
			continue
		}

		const { title, body } = buildReminderNotificationBody(assignment, listItem.subjectName)
		const notificationId = await scheduler.schedule({
			assignmentId: assignment.id,
			title,
			body,
			fireAt: fireDate,
		})

		if (notificationId) {
			await repos.assignmentReminders.updateNotificationId(
				assignment.id,
				notificationId,
				reminder.scheduledAt,
			)
		}
	}
}
