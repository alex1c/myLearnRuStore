import type { DatabaseConnection } from '@/src/db/types'
import type { Teacher } from '@/src/types/domain'
import { createId, nowTimestamp } from '@/src/utils/id'

interface TeacherRow {
	id: string
	name: string
	notes: string | null
	created_at: string
	updated_at: string
}

function mapRow(row: TeacherRow): Teacher {
	return {
		id: row.id,
		name: row.name,
		notes: row.notes,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	}
}

export class TeacherRepository {
	constructor(private readonly db: DatabaseConnection) {}

	async list(): Promise<Teacher[]> {
		const rows = await this.db.getAllAsync<TeacherRow>(
			'SELECT * FROM teachers ORDER BY name ASC',
		)
		return rows.map(mapRow)
	}

	async getById(id: string): Promise<Teacher | null> {
		const row = await this.db.getFirstAsync<TeacherRow>(
			'SELECT * FROM teachers WHERE id = ?',
			[id],
		)
		return row ? mapRow(row) : null
	}

	async create(input: { name: string; notes?: string | null }): Promise<Teacher> {
		const name = input.name.trim()
		if (!name) {
			throw new Error('Teacher name is required')
		}

		const timestamp = nowTimestamp()
		const teacher: Teacher = {
			id: createId(),
			name,
			notes: input.notes ?? null,
			createdAt: timestamp,
			updatedAt: timestamp,
		}

		await this.db.runAsync(
			`INSERT INTO teachers (id, name, notes, created_at, updated_at)
			 VALUES (?, ?, ?, ?, ?)`,
			[teacher.id, teacher.name, teacher.notes, teacher.createdAt, teacher.updatedAt],
		)

		return teacher
	}
}
