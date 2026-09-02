import * as Notifications from 'expo-notifications'
import type {
	NotificationScheduler,
	ScheduleNotificationInput,
} from '@/src/services/notifications/notification-scheduler.types'

/** Configure foreground notification behavior once at module load. */
Notifications.setNotificationHandler({
	handleNotification: async () => ({
		shouldShowAlert: true,
		shouldPlaySound: true,
		shouldSetBadge: false,
		shouldShowBanner: true,
		shouldShowList: true,
	}),
})

/** Expo Notifications implementation for Android/iOS. */
export class ExpoNotificationScheduler implements NotificationScheduler {
	async requestPermissions(): Promise<boolean> {
		const settings = await Notifications.getPermissionsAsync()
		if (settings.granted) {
			return true
		}

		const result = await Notifications.requestPermissionsAsync()
		return result.granted
	}

	async schedule(input: ScheduleNotificationInput): Promise<string | null> {
		if (input.fireAt.getTime() <= Date.now()) {
			return null
		}

		const id = await Notifications.scheduleNotificationAsync({
			content: {
				title: input.title,
				body: input.body,
				data: { assignmentId: input.assignmentId },
			},
			trigger: {
				type: Notifications.SchedulableTriggerInputTypes.DATE,
				date: input.fireAt,
			},
		})

		return id
	}

	async cancel(notificationId: string): Promise<void> {
		try {
			await Notifications.cancelScheduledNotificationAsync(notificationId)
		} catch {
			// Idempotent — OS may have already fired or removed the notification.
		}
	}

	async cancelAllForAssignment(assignmentId: string): Promise<void> {
		const scheduled = await Notifications.getAllScheduledNotificationsAsync()
		const matching = scheduled.filter(
			(item) => item.content.data?.assignmentId === assignmentId,
		)
		await Promise.all(matching.map((item) => this.cancel(item.identifier)))
	}
}

/** No-op scheduler for tests and unsupported environments. */
export class NoOpNotificationScheduler implements NotificationScheduler {
	async requestPermissions(): Promise<boolean> {
		return false
	}

	async schedule(): Promise<string | null> {
		return null
	}

	async cancel(): Promise<void> {}

	async cancelAllForAssignment(): Promise<void> {}
}

let schedulerInstance: NotificationScheduler | null = null

/** Returns singleton scheduler — Expo in production, no-op in Jest. */
export function getNotificationScheduler(): NotificationScheduler {
	if (!schedulerInstance) {
		schedulerInstance =
			process.env.NODE_ENV === 'test'
				? new NoOpNotificationScheduler()
				: new ExpoNotificationScheduler()
	}

	return schedulerInstance
}

/** Override scheduler in tests. */
export function setNotificationSchedulerForTests(
	scheduler: NotificationScheduler | null,
): void {
	schedulerInstance = scheduler
}
