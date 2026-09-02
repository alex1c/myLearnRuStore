jest.mock('expo-crypto', () => ({
	randomUUID: () => require('crypto').randomUUID(),
}))

jest.mock('expo-notifications', () => ({
	setNotificationHandler: jest.fn(),
	getPermissionsAsync: jest.fn(async () => ({ granted: true })),
	requestPermissionsAsync: jest.fn(async () => ({ granted: true })),
	scheduleNotificationAsync: jest.fn(async () => 'mock-notification-id'),
	cancelScheduledNotificationAsync: jest.fn(async () => undefined),
	getAllScheduledNotificationsAsync: jest.fn(async () => []),
	addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
	getLastNotificationResponseAsync: jest.fn(async () => null),
	SchedulableTriggerInputTypes: { DATE: 'date' },
}))

jest.mock('expo-file-system/legacy', () => ({
	documentDirectory: 'file:///mock-documents/',
	getInfoAsync: jest.fn(async () => ({ exists: false })),
	makeDirectoryAsync: jest.fn(async () => undefined),
	copyAsync: jest.fn(async () => undefined),
	deleteAsync: jest.fn(async () => undefined),
}))

jest.mock('expo-image-picker', () => ({
	launchCameraAsync: jest.fn(),
	launchImageLibraryAsync: jest.fn(),
}))

export {}
