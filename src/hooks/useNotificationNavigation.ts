import * as React from 'react'
import * as Notifications from 'expo-notifications'
import { useRouter } from 'expo-router'

/** Navigate to assignment when user taps a notification. */
export function useNotificationNavigation(): void {
	const router = useRouter()

	React.useEffect(() => {
		const subscription = Notifications.addNotificationResponseReceivedListener(
			(response) => {
				const assignmentId = response.notification.request.content.data
					?.assignmentId as string | undefined
				if (assignmentId) {
					router.push(`/assignment-form?id=${assignmentId}`)
				}
			},
		)

		void Notifications.getLastNotificationResponseAsync().then((response) => {
			const assignmentId = response?.notification.request.content.data
				?.assignmentId as string | undefined
			if (assignmentId) {
				router.push(`/assignment-form?id=${assignmentId}`)
			}
		})

		return () => subscription.remove()
	}, [router])
}
