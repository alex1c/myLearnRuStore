export const BACKUP_KIND = 'myLearnBackup' as const
export const BACKUP_VERSION = 1 as const
export const MAX_BACKUP_BYTES = 50 * 1024 * 1024
export const MAX_BACKUP_RECORDS = 20_000
export const MAX_BACKUP_PHOTOS = 500

export interface BackupManifest {
	kind: typeof BACKUP_KIND
	version: typeof BACKUP_VERSION
	exportedAt: string
	appVersion: string
	counts: {
		studyPeriods: number
		subjects: number
		scheduleEntries: number
		assignments: number
		grades: number
		photos: number
		focusSessions: number
	}
}

export interface BackupPhotoEntry {
	id: string
	assignmentId: string
	archiveName: string
	sortOrder: number
	createdAt: string
}

export interface BackupDataPayload {
	appSettings: Record<string, unknown>[]
	studyPeriods: Record<string, unknown>[]
	teachers: Record<string, unknown>[]
	subjects: Record<string, unknown>[]
	scheduleEntries: Record<string, unknown>[]
	scheduleExceptions: Record<string, unknown>[]
	assignments: Record<string, unknown>[]
	assignmentPhotos: BackupPhotoEntry[]
	assignmentReminders: Record<string, unknown>[]
	grades: Record<string, unknown>[]
	attendance: Record<string, unknown>[]
	focusSessions: Record<string, unknown>[]
	holidays: Record<string, unknown>[]
	scheduleImportHistory: Record<string, unknown>[]
}

export interface BackupPreview {
	manifest: BackupManifest
	counts: BackupManifest['counts']
	exportedAt: string
}

export interface ParsedBackupArchive {
	manifest: BackupManifest
	data: BackupDataPayload
	photos: Map<string, Uint8Array>
}
