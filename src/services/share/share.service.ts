import * as Sharing from 'expo-sharing'
import { Share } from 'react-native'

/** Share plain text via the system share sheet. */
export async function shareText(message: string, title?: string): Promise<void> {
	await Share.share({ message, title })
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
}
