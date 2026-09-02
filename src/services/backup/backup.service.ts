import * as FileSystem from 'expo-file-system/legacy'
import Constants from 'expo-constants'
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate'
import type { DatabaseConnection } from '@/src/db/types'
import type { Repositories } from '@/src/db/repositories'
import {
	BACKUP_KIND,
	BACKUP_VERSION,
	MAX_BACKUP_BYTES,
	MAX_BACKUP_PHOTOS,
	MAX_BACKUP_RECORDS,
	type BackupDataPayload,
	type BackupManifest,
	type BackupPhotoEntry,
	type BackupPreview,
	type ParsedBackupArchive,
} from '@/src/services/backup/backup.types'
import { reconcileAssignmentReminders } from '@/src/services/assignment-reminder-sync.service'
import * as Notifications from 'expo-notifications'

const MANIFEST_PATH = 'manifest.json'
const DATA_PATH = 'data.json'
const PHOTOS_PREFIX = 'photos/'

async function queryAll<T extends Record<string, unknown>>(
	db: DatabaseConnection,
	table: string,
): Promise<T[]> {
	return db.getAllAsync<T>(`SELECT * FROM ${table}`)
}

function isSafeArchivePath(path: string): boolean {
	if (!path || path.includes('\\') || path.includes('..')) {
		return false
	}

	if (path === MANIFEST_PATH || path === DATA_PATH) {
		return true
	}

	return path.startsWith(PHOTOS_PREFIX) && !path.slice(PHOTOS_PREFIX.length).includes('/')
}

function getDbConnection(repos: Repositories): DatabaseConnection {
	return repos.db
}

function uint8ToBase64(bytes: Uint8Array): string {
	let binary = ''
	for (let index = 0; index < bytes.length; index += 1) {
		binary += String.fromCharCode(bytes[index])
	}

	return btoa(binary)
}

/** Build portable backup archive as ZIP bytes. */
export async function createBackupArchive(repos: Repositories): Promise<Uint8Array> {
	const rawDb = getDbConnection(repos)

	const [
		appSettings,
		studyPeriods,
		teachers,
		subjects,
		scheduleEntries,
		scheduleExceptions,
		assignments,
		assignmentPhotos,
		assignmentReminders,
		grades,
		attendance,
		focusSessions,
		holidays,
		scheduleImportHistory,
	] = await Promise.all([
		queryAll(rawDb, 'app_settings'),
		queryAll(rawDb, 'study_periods'),
		queryAll(rawDb, 'teachers'),
		queryAll(rawDb, 'subjects'),
		queryAll(rawDb, 'schedule_entries'),
		queryAll(rawDb, 'schedule_exceptions'),
		queryAll(rawDb, 'assignments'),
		queryAll<{
			id: string
			assignment_id: string
			local_uri: string
			sort_order: number
			created_at: string
		}>(rawDb, 'assignment_photos'),
		queryAll(rawDb, 'assignment_reminders'),
		queryAll(rawDb, 'grades'),
		queryAll(rawDb, 'attendance'),
		queryAll(rawDb, 'focus_sessions'),
		queryAll(rawDb, 'holidays'),
		queryAll(rawDb, 'schedule_import_history'),
	])

	const portablePhotos: BackupPhotoEntry[] = []
	const zipEntries: Record<string, Uint8Array> = {}

	for (const photo of assignmentPhotos) {
		const archiveName = `${PHOTOS_PREFIX}${photo.id}.jpg`
		portablePhotos.push({
			id: photo.id,
			assignmentId: photo.assignment_id,
			archiveName,
			sortOrder: photo.sort_order,
			createdAt: photo.created_at,
		})

		try {
			const base64 = await FileSystem.readAsStringAsync(photo.local_uri, {
				encoding: FileSystem.EncodingType.Base64,
			})
			zipEntries[archiveName] = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0))
		} catch {
			throw new Error(`Missing photo file for backup: ${photo.id}`)
		}
	}

	const manifest: BackupManifest = {
		kind: BACKUP_KIND,
		version: BACKUP_VERSION,
		exportedAt: new Date().toISOString(),
		appVersion: Constants.expoConfig?.version ?? '1.0.0',
		counts: {
			studyPeriods: studyPeriods.length,
			subjects: subjects.length,
			scheduleEntries: scheduleEntries.length,
			assignments: assignments.length,
			grades: grades.length,
			photos: portablePhotos.length,
			focusSessions: focusSessions.length,
		},
	}

	const data: BackupDataPayload = {
		appSettings,
		studyPeriods,
		teachers,
		subjects,
		scheduleEntries,
		scheduleExceptions,
		assignments,
		assignmentPhotos: portablePhotos,
		assignmentReminders: assignmentReminders.map((row) => ({
			...row,
			notification_id: null,
		})),
		grades,
		attendance,
		focusSessions,
		holidays,
		scheduleImportHistory,
	}

	zipEntries[MANIFEST_PATH] = strToU8(JSON.stringify(manifest, null, 2))
	zipEntries[DATA_PATH] = strToU8(JSON.stringify(data))

	return zipSync(zipEntries)
}

/** Parse and validate backup ZIP archive. */
export function parseBackupArchive(bytes: Uint8Array): ParsedBackupArchive {
	if (bytes.byteLength > MAX_BACKUP_BYTES) {
		throw new Error('Backup file is too large')
	}

	let entries: Record<string, Uint8Array>
	try {
		entries = unzipSync(bytes)
	} catch {
		throw new Error('Invalid backup archive')
	}

	for (const path of Object.keys(entries)) {
		if (!isSafeArchivePath(path)) {
			throw new Error('Unsafe path in backup archive')
		}
	}

	const manifestRaw = entries[MANIFEST_PATH]
	const dataRaw = entries[DATA_PATH]
	if (!manifestRaw || !dataRaw) {
		throw new Error('Backup archive is missing required files')
	}

	let manifest: BackupManifest
	let data: BackupDataPayload
	try {
		manifest = JSON.parse(strFromU8(manifestRaw)) as BackupManifest
		data = JSON.parse(strFromU8(dataRaw)) as BackupDataPayload
	} catch {
		throw new Error('Malformed backup JSON')
	}

	if (manifest.kind !== BACKUP_KIND) {
		throw new Error('Unsupported backup kind')
	}

	if (manifest.version !== BACKUP_VERSION) {
		throw new Error('Unsupported backup version')
	}

	const totalRecords =
		data.studyPeriods.length +
		data.subjects.length +
		data.scheduleEntries.length +
		data.assignments.length +
		data.grades.length +
		data.attendance.length +
		data.focusSessions.length

	if (totalRecords > MAX_BACKUP_RECORDS) {
		throw new Error('Backup contains too many records')
	}

	if (data.assignmentPhotos.length > MAX_BACKUP_PHOTOS) {
		throw new Error('Backup contains too many photos')
	}

	const photos = new Map<string, Uint8Array>()
	for (const photo of data.assignmentPhotos) {
		if (!photo.archiveName.startsWith(PHOTOS_PREFIX)) {
			throw new Error('Invalid photo archive reference')
		}

		const photoBytes = entries[photo.archiveName]
		if (!photoBytes) {
			throw new Error(`Missing photo in archive: ${photo.id}`)
		}

		photos.set(photo.id, photoBytes)
	}

	validateReferences(data)

	return { manifest, data, photos }
}

function validateReferences(data: BackupDataPayload): void {
	const periodIds = new Set(data.studyPeriods.map((row) => String(row.id)))
	const subjectIds = new Set(data.subjects.map((row) => String(row.id)))
	const assignmentIds = new Set(data.assignments.map((row) => String(row.id)))

	for (const subject of data.subjects) {
		if (!periodIds.has(String(subject.study_period_id))) {
			throw new Error('Backup subject references unknown study period')
		}
	}

	for (const entry of data.scheduleEntries) {
		if (!periodIds.has(String(entry.study_period_id))) {
			throw new Error('Backup schedule entry references unknown study period')
		}

		if (!subjectIds.has(String(entry.subject_id))) {
			throw new Error('Backup schedule entry references unknown subject')
		}
	}

	for (const assignment of data.assignments) {
		if (!subjectIds.has(String(assignment.subject_id))) {
			throw new Error('Backup assignment references unknown subject')
		}
	}

	for (const grade of data.grades) {
		if (!subjectIds.has(String(grade.subject_id))) {
			throw new Error('Backup grade references unknown subject')
		}
	}

	for (const photo of data.assignmentPhotos) {
		if (!assignmentIds.has(photo.assignmentId)) {
			throw new Error('Backup photo references unknown assignment')
		}
	}
}

export function buildBackupPreview(parsed: ParsedBackupArchive): BackupPreview {
	return {
		manifest: parsed.manifest,
		counts: parsed.manifest.counts,
		exportedAt: parsed.manifest.exportedAt,
	}
}

/** Full replace restore — current local data is replaced transactionally. */
export async function restoreBackupArchive(
	repos: Repositories,
	parsed: ParsedBackupArchive,
): Promise<void> {
	const db = getDbConnection(repos)

	try {
		const scheduled = await Notifications.getAllScheduledNotificationsAsync()
		await Promise.all(
			scheduled.map((item) =>
				Notifications.cancelScheduledNotificationAsync(item.identifier),
			),
		)
	} catch {
		// Non-critical — reconciliation rebuilds from persisted intent.
	}

	await repos.runInTransaction(async () => {
		await clearAllData(db)
		await insertBackupData(db, parsed)
	})

	await reconcileAssignmentReminders(repos)
}

async function clearAllData(db: DatabaseConnection): Promise<void> {
	await db.execAsync(`
		DELETE FROM active_focus_session;
		DELETE FROM assignment_reminders;
		DELETE FROM assignment_photos;
		DELETE FROM grades;
		DELETE FROM attendance;
		DELETE FROM focus_sessions;
		DELETE FROM assignments;
		DELETE FROM schedule_exceptions;
		DELETE FROM schedule_entries;
		DELETE FROM holidays;
		DELETE FROM schedule_import_history;
		DELETE FROM subjects;
		DELETE FROM teachers;
		DELETE FROM study_periods;
		DELETE FROM app_settings;
	`)
}

async function insertRow(
	db: DatabaseConnection,
	table: string,
	row: Record<string, unknown>,
): Promise<void> {
	const columns = Object.keys(row)
	const placeholders = columns.map(() => '?').join(', ')
	await db.runAsync(
		`INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`,
		columns.map((key) => row[key]),
	)
}

async function insertBackupData(
	db: DatabaseConnection,
	parsed: ParsedBackupArchive,
): Promise<void> {
	const { data, photos } = parsed

	for (const row of data.appSettings) {
		await insertRow(db, 'app_settings', row)
	}

	for (const row of data.studyPeriods) {
		await insertRow(db, 'study_periods', row)
	}

	for (const row of data.teachers) {
		await insertRow(db, 'teachers', row)
	}

	for (const row of data.subjects) {
		await insertRow(db, 'subjects', row)
	}

	for (const row of data.scheduleEntries) {
		await insertRow(db, 'schedule_entries', row)
	}

	for (const row of data.scheduleExceptions) {
		await insertRow(db, 'schedule_exceptions', row)
	}

	for (const row of data.holidays) {
		await insertRow(db, 'holidays', row)
	}

	for (const row of data.assignments) {
		await insertRow(db, 'assignments', row)
	}

	for (const photo of data.assignmentPhotos) {
		const photoBytes = photos.get(photo.id)
		if (!photoBytes) {
			throw new Error(`Photo bytes missing during restore: ${photo.id}`)
		}

		const localUri = await writeRestoredPhoto(photo.assignmentId, photo.id, photoBytes)
		await insertRow(db, 'assignment_photos', {
			id: photo.id,
			assignment_id: photo.assignmentId,
			local_uri: localUri,
			sort_order: photo.sortOrder,
			created_at: photo.createdAt,
		})
	}

	for (const row of data.assignmentReminders) {
		await insertRow(db, 'assignment_reminders', {
			...row,
			notification_id: null,
		})
	}

	for (const row of data.grades) {
		await insertRow(db, 'grades', row)
	}

	for (const row of data.attendance) {
		await insertRow(db, 'attendance', row)
	}

	for (const row of data.focusSessions) {
		await insertRow(db, 'focus_sessions', row)
	}

	for (const row of data.scheduleImportHistory) {
		await insertRow(db, 'schedule_import_history', row)
	}
}

async function writeRestoredPhoto(
	assignmentId: string,
	photoId: string,
	bytes: Uint8Array,
): Promise<string> {
	const root = `${FileSystem.documentDirectory ?? ''}assignment-photos/${assignmentId}`
	const dirInfo = await FileSystem.getInfoAsync(root)
	if (!dirInfo.exists) {
		await FileSystem.makeDirectoryAsync(root, { intermediates: true })
	}

	const destUri = `${root}/${photoId}.jpg`
	await FileSystem.writeAsStringAsync(destUri, uint8ToBase64(bytes), {
		encoding: FileSystem.EncodingType.Base64,
	})

	return destUri
}

/** Write backup ZIP to cache and return file URI for sharing. */
export async function writeBackupFile(bytes: Uint8Array): Promise<string> {
	const dir = `${FileSystem.cacheDirectory ?? ''}backups`
	const dirInfo = await FileSystem.getInfoAsync(dir)
	if (!dirInfo.exists) {
		await FileSystem.makeDirectoryAsync(dir, { intermediates: true })
	}

	const date = new Date().toISOString().slice(0, 10)
	const uri = `${dir}/mylearn-backup-${date}.zip`
	await FileSystem.writeAsStringAsync(uri, uint8ToBase64(bytes), {
		encoding: FileSystem.EncodingType.Base64,
	})

	return uri
}
