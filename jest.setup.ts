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
	readAsStringAsync: jest.fn(async () => ''),
	writeAsStringAsync: jest.fn(async () => undefined),
	EncodingType: { Base64: 'base64' },
}))

jest.mock('expo-image-picker', () => ({
	launchCameraAsync: jest.fn(),
	launchImageLibraryAsync: jest.fn(),
}))

jest.mock('@react-native-async-storage/async-storage', () => ({
	setItem: jest.fn(async () => undefined),
	getItem: jest.fn(async () => null),
	removeItem: jest.fn(async () => undefined),
}))

jest.mock('@appmetrica/react-native-analytics', () => ({
	__esModule: true,
	default: {
		activate: jest.fn(),
		reportEvent: jest.fn(),
	},
}))

jest.mock('yandex-mobile-ads', () => ({
	MobileAds: { initialize: jest.fn(async () => undefined) },
	BannerView: () => null,
	InterstitialAdLoader: { load: jest.fn() },
}))

export {}
