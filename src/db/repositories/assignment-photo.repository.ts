import type { DatabaseConnection } from '@/src/db/types'
import type { AssignmentPhoto } from '@/src/types/domain'
import { createId, nowTimestamp } from '@/src/utils/id'

interface PhotoRow {
	id: string
	assignment_id: string
	local_uri: string
	created_at: string
}

function mapRow(row: PhotoRow): AssignmentPhoto {
	return {
		id: row.id,
		assignmentId: row.assignment_id,
		localUri: row.local_uri,
		createdAt: row.created_at,
	}
}

/** Maximum photos allowed per assignment. */
export const MAX_ASSIGNMENT_PHOTOS = 5

export class AssignmentPhotoRepository {
	constructor(private readonly db: DatabaseConnection) {}

	async getById(id: string): Promise<AssignmentPhoto | null> {
		const row = await this.db.getFirstAsync<PhotoRow>(
			'SELECT * FROM assignment_photos WHERE id = ?',
			[id],
		)
		return row ? mapRow(row) : null
	}

	async listByAssignment(assignmentId: string): Promise<AssignmentPhoto[]> {
		const rows = await this.db.getAllAsync<PhotoRow>(
			'SELECT * FROM assignment_photos WHERE assignment_id = ? ORDER BY created_at ASC',
			[assignmentId],
		)
		return rows.map(mapRow)
	}

	async countByAssignment(assignmentId: string): Promise<number> {
		const row = await this.db.getFirstAsync<{ count: number }>(
			'SELECT COUNT(*) AS count FROM assignment_photos WHERE assignment_id = ?',
			[assignmentId],
		)
		return row?.count ?? 0
	}

	async create(assignmentId: string, localUri: string): Promise<AssignmentPhoto> {
		const count = await this.countByAssignment(assignmentId)
		if (count >= MAX_ASSIGNMENT_PHOTOS) {
			throw new Error(`Maximum ${MAX_ASSIGNMENT_PHOTOS} photos per assignment`)
		}

		const photo: AssignmentPhoto = {
			id: createId(),
			assignmentId,
			localUri,
			createdAt: nowTimestamp(),
		}

		await this.db.runAsync(
			'INSERT INTO assignment_photos (id, assignment_id, local_uri, created_at) VALUES (?, ?, ?, ?)',
			[photo.id, photo.assignmentId, photo.localUri, photo.createdAt],
		)

		return photo
	}

	async delete(id: string): Promise<AssignmentPhoto | null> {
		const existing = await this.db.getFirstAsync<PhotoRow>(
			'SELECT * FROM assignment_photos WHERE id = ?',
			[id],
		)
		if (!existing) {
			return null
		}

		await this.db.runAsync('DELETE FROM assignment_photos WHERE id = ?', [id])
		return mapRow(existing)
	}

	async deleteByAssignment(assignmentId: string): Promise<AssignmentPhoto[]> {
		const photos = await this.listByAssignment(assignmentId)
		await this.db.runAsync('DELETE FROM assignment_photos WHERE assignment_id = ?', [
			assignmentId,
		])
		return photos
	}
}
