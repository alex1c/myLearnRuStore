import * as FileSystem from 'expo-file-system/legacy'
import type { Repositories } from '@/src/db/repositories'
import { MAX_ASSIGNMENT_PHOTOS } from '@/src/db/repositories/assignment-photo.repository'
import { createId } from '@/src/utils/id'

const PHOTO_ROOT = `${FileSystem.documentDirectory ?? ''}assignment-photos`

async function ensureAssignmentPhotoDir(assignmentId: string): Promise<string> {
	const dir = `${PHOTO_ROOT}/${assignmentId}`
	const info = await FileSystem.getInfoAsync(dir)
	if (!info.exists) {
		await FileSystem.makeDirectoryAsync(dir, { intermediates: true })
	}
	return dir
}

/** Copy picked image into managed storage and persist DB row. */
export async function addAssignmentPhoto(
	repos: Repositories,
	assignmentId: string,
	sourceUri: string,
): Promise<void> {
	const count = await repos.assignmentPhotos.countByAssignment(assignmentId)
	if (count >= MAX_ASSIGNMENT_PHOTOS) {
		throw new Error(`Максимум ${MAX_ASSIGNMENT_PHOTOS} фото на задание`)
	}

	const dir = await ensureAssignmentPhotoDir(assignmentId)
	const destUri = `${dir}/${createId()}.jpg`

	try {
		await FileSystem.copyAsync({ from: sourceUri, to: destUri })
	} catch {
		throw new Error('Не удалось сохранить фото')
	}

	await repos.assignmentPhotos.create(assignmentId, destUri)
}

/** Delete managed file best-effort. */
export async function deleteManagedFile(uri: string): Promise<void> {
	try {
		const info = await FileSystem.getInfoAsync(uri)
		if (info.exists) {
			await FileSystem.deleteAsync(uri, { idempotent: true })
		}
	} catch {
		// Best-effort — orphaned files are recoverable.
	}
}

/** Delete photo file and DB row. */
export async function deleteAssignmentPhoto(
	repos: Repositories,
	photoId: string,
): Promise<void> {
	const photo = await repos.assignmentPhotos.getById(photoId)
	if (!photo) {
		return
	}

	await repos.assignmentPhotos.delete(photoId)
	await deleteManagedFile(photo.localUri)
}

/** Remove all managed photos for an assignment. */
export async function cleanupAssignmentPhotos(
	repos: Repositories,
	assignmentId: string,
): Promise<void> {
	const photos = await repos.assignmentPhotos.deleteByAssignment(assignmentId)
	await Promise.all(photos.map((photo) => deleteManagedFile(photo.localUri)))

	const dir = `${PHOTO_ROOT}/${assignmentId}`
	try {
		await FileSystem.deleteAsync(dir, { idempotent: true })
	} catch {
		// Best-effort directory cleanup.
	}
}

export { MAX_ASSIGNMENT_PHOTOS }
