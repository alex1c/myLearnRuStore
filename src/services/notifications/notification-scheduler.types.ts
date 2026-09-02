export interface ScheduleNotificationInput {
	assignmentId: string
	title: string
	body: string
	fireAt: Date
}

/** Platform-agnostic notification scheduling boundary for tests and production. */
export interface NotificationScheduler {
	requestPermissions(): Promise<boolean>
	hasPermission(): Promise<boolean>
	isScheduled(notificationId: string): Promise<boolean>
	schedule(input: ScheduleNotificationInput): Promise<string | null>
	cancel(notificationId: string): Promise<void>
	cancelAllForAssignment(assignmentId: string): Promise<void>
}
