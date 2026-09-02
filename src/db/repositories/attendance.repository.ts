import type { DatabaseConnection } from '@/src/db/types'
import type { Attendance, AttendanceStatus, LocalDate } from '@/src/types/domain'
import { createId, nowTimestamp } from '@/src/utils/id'
import { validateLocalDate } from '@/src/utils/validation'

interface AttendanceRow {
	id: string
	subject_id: string
	schedule_entry_id: string | null
	attendance_date: string
	status: string
	notes: string | null
	created_at: string
	updated_at: string
}

function mapRow(row: AttendanceRow): Attendance {
	return {
		id: row.id,
		subjectId: row.subject_id,
		scheduleEntryId: row.schedule_entry_id,
		attendanceDate: row.attendance_date,
		status: row.status as AttendanceStatus,
		notes: row.notes,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	}
}

export interface UpsertAttendanceInput {
	subjectId: string
	attendanceDate: LocalDate
	status: AttendanceStatus
	scheduleEntryId?: string | null
	notes?: string | null
}

export class AttendanceRepository {
	constructor(private readonly db: DatabaseConnection) {}

	private async validateScheduleIntegrity(
		subjectId: string,
		scheduleEntryId: string | null | undefined,
	): Promise<void> {
		if (!scheduleEntryId) {
			return
		}

		const entry = await this.db.getFirstAsync<{ subject_id: string }>(
			'SELECT subject_id FROM schedule_entries WHERE id = ?',
			[scheduleEntryId],
		)
		if (!entry || entry.subject_id !== subjectId) {
			throw new Error('Attendance subject must match its schedule entry')
		}
	}

	async listBySubject(subjectId: string): Promise<Attendance[]> {
		const rows = await this.db.getAllAsync<AttendanceRow>(
			`SELECT * FROM attendance WHERE subject_id = ?
			 ORDER BY attendance_date DESC, created_at DESC`,
			[subjectId],
		)
		return rows.map(mapRow)
	}

	async getByScheduleOccurrence(
		scheduleEntryId: string,
		attendanceDate: LocalDate,
	): Promise<Attendance | null> {
		const row = await this.db.getFirstAsync<AttendanceRow>(
			`SELECT * FROM attendance
			 WHERE schedule_entry_id = ? AND attendance_date = ?`,
			[scheduleEntryId, attendanceDate],
		)
		return row ? mapRow(row) : null
	}

	async getManualForDate(
		subjectId: string,
		attendanceDate: LocalDate,
	): Promise<Attendance | null> {
		const row = await this.db.getFirstAsync<AttendanceRow>(
			`SELECT * FROM attendance
			 WHERE subject_id = ? AND attendance_date = ? AND schedule_entry_id IS NULL`,
			[subjectId, attendanceDate],
		)
		return row ? mapRow(row) : null
	}

	/** Create or update attendance for a schedule occurrence. */
	async upsert(input: UpsertAttendanceInput): Promise<Attendance> {
		const date = validateLocalDate(input.attendanceDate, 'attendanceDate')
		await this.validateScheduleIntegrity(input.subjectId, input.scheduleEntryId)

		if (input.scheduleEntryId) {
			const existing = await this.getByScheduleOccurrence(
				input.scheduleEntryId,
				date,
			)
			if (existing) {
				return this.update(existing.id, {
					status: input.status,
					notes: input.notes ?? null,
				})
			}
		} else {
			const existing = await this.getManualForDate(input.subjectId, date)
			if (existing) {
				return this.update(existing.id, {
					status: input.status,
					notes: input.notes ?? null,
				})
			}
		}

		const timestamp = nowTimestamp()
		const record: Attendance = {
			id: createId(),
			subjectId: input.subjectId,
			scheduleEntryId: input.scheduleEntryId ?? null,
			attendanceDate: date,
			status: input.status,
			notes: input.notes ?? null,
			createdAt: timestamp,
			updatedAt: timestamp,
		}

		await this.db.runAsync(
			`INSERT INTO attendance (
				id, subject_id, schedule_entry_id, attendance_date,
				status, notes, created_at, updated_at
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
			[
				record.id,
				record.subjectId,
				record.scheduleEntryId,
				record.attendanceDate,
				record.status,
				record.notes,
				record.createdAt,
				record.updatedAt,
			],
		)

		return record
	}

	async update(
		id: string,
		input: { status?: AttendanceStatus; notes?: string | null },
	): Promise<Attendance> {
		const existing = await this.db.getFirstAsync<AttendanceRow>(
			'SELECT * FROM attendance WHERE id = ?',
			[id],
		)
		if (!existing) {
			throw new Error('Attendance record not found')
		}

		const updated: Attendance = {
			...mapRow(existing),
			status: input.status ?? (existing.status as AttendanceStatus),
			notes: input.notes !== undefined ? input.notes : existing.notes,
			updatedAt: nowTimestamp(),
		}

		await this.db.runAsync(
			`UPDATE attendance SET status = ?, notes = ?, updated_at = ? WHERE id = ?`,
			[updated.status, updated.notes, updated.updatedAt, id],
		)

		return updated
	}

	async delete(id: string): Promise<void> {
		await this.db.runAsync('DELETE FROM attendance WHERE id = ?', [id])
	}
}
