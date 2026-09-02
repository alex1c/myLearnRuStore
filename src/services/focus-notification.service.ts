import * as Notifications from 'expo-notifications'
import { Platform } from 'react-native'
import type { ActiveFocusTimerState } from '@/src/services/focus-timer.service'
import { computeExpectedEndMs } from '@/src/services/focus-timer.service'

const FOCUS_NOTIFICATION_ID = 'focus-session-complete'

/** Schedule or cancel focus completion notifications (separate from assignment reminders). */
export async function scheduleFocusCompletionNotification(
	state: ActiveFocusTimerState,
): Promise<string | null> {
	if (!state.notifyOnComplete) {
		return null
	}

	if (Platform.OS === 'android') {
		await Notifications.setNotificationChannelAsync('focus-timer', {
			name: 'Focus timer',
			importance: Notifications.AndroidImportance.HIGH,
		})
	}

	const fireAt = new Date(computeExpectedEndMs(state))
	if (fireAt.getTime() <= Date.now()) {
		return null
	}

	const granted = (await Notifications.getPermissionsAsync()).granted
	if (!granted) {
		return null
	}

	await cancelFocusCompletionNotification()

	const id = await Notifications.scheduleNotificationAsync({
		identifier: FOCUS_NOTIFICATION_ID,
		content: {
			title: 'Фокус завершён',
			body: 'Учебная сессия окончена.',
			data: { type: 'focus_complete' },
		},
		trigger: {
			type: Notifications.SchedulableTriggerInputTypes.DATE,
			date: fireAt,
			channelId: 'focus-timer',
		},
	})

	return id
}

/** Cancel any pending focus completion notification. */
export async function cancelFocusCompletionNotification(): Promise<void> {
	try {
		await Notifications.cancelScheduledNotificationAsync(FOCUS_NOTIFICATION_ID)
	} catch {
		// Idempotent — notification may already have fired.
	}
}
