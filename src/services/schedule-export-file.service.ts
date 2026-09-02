import * as FileSystem from 'expo-file-system/legacy'
import type { ScheduleExportDocument } from '@/src/services/schedule-export.service'
import { serializeScheduleExport } from '@/src/services/schedule-export.service'
import { createId } from '@/src/utils/id'

const EXPORT_DIR = `${FileSystem.cacheDirectory ?? ''}schedule-exports`

/** Write schedule export JSON to a temporary cache file for sharing. */
export async function writeScheduleExportFile(
	document: ScheduleExportDocument,
): Promise<string> {
	const dirInfo = await FileSystem.getInfoAsync(EXPORT_DIR)
	if (!dirInfo.exists) {
		await FileSystem.makeDirectoryAsync(EXPORT_DIR, { intermediates: true })
	}

	const fileUri = `${EXPORT_DIR}/schedule-${createId()}.json`
	await FileSystem.writeAsStringAsync(fileUri, serializeScheduleExport(document), {
		encoding: FileSystem.EncodingType.UTF8,
	})

	return fileUri
}

/** Best-effort cleanup of old export files. */
export async function cleanupOldExportFiles(): Promise<void> {
	try {
		const dirInfo = await FileSystem.getInfoAsync(EXPORT_DIR)
		if (!dirInfo.exists) {
			return
		}

		const files = await FileSystem.readDirectoryAsync(EXPORT_DIR)
		await Promise.all(
			files.slice(0, -3).map((file) =>
				FileSystem.deleteAsync(`${EXPORT_DIR}/${file}`, { idempotent: true }),
			),
		)
	} catch {
		// Non-critical cache cleanup.
	}
}
