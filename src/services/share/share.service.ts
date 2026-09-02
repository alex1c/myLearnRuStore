import * as Sharing from 'expo-sharing'
import { Share } from 'react-native'
import { ANALYTICS_EVENTS } from '@/src/config/analytics'
import { trackEvent } from '@/src/services/analytics/analytics.service'
import { maybeShowInterstitial } from '@/src/services/ads/ads-runtime.service'

/** Share plain text via the system share sheet. */
export async function shareText(message: string, title?: string): Promise<void> {
	await Share.share({ message, title })
	trackEvent(ANALYTICS_EVENTS.SCHEDULE_SHARED, { share_type: 'text' })
	void maybeShowInterstitial('share_completed')
}

/** Share a local file URI (JSON export) when the platform supports it. */
export async function shareFileUri(uri: string, mimeType: string): Promise<void> {
	const canShare = await Sharing.isAvailableAsync()
	if (!canShare) {
		throw new Error('Sharing is not available on this device')
	}

	await Sharing.shareAsync(uri, {
		mimeType,
		dialogTitle: 'Поделиться',
	})
	trackEvent(ANALYTICS_EVENTS.SCHEDULE_SHARED, { share_type: 'file' })
	void maybeShowInterstitial('export_completed')
}
