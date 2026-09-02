import type { DatabaseConnection } from '@/src/db/types'
import type { AssignmentReminder, ReminderKind, Timestamp } from '@/src/types/domain'
import { createId, nowTimestamp } from '@/src/utils/id'

interface ReminderRow {
	id: string
	assignment_id: string
	enabled: number
	reminder_kind: string
	relative_minutes: number | null
	absolute_time: string | null
	absolute_day_offset: number
	scheduled_at: string | null
	notification_id: string | null
	created_at: string
	updated_at: string
}

function mapRow(row: ReminderRow): AssignmentReminder {
	return {
		id: row.id,
		assignmentId: row.assignment_id,
		enabled: row.enabled === 1,
		reminderKind: row.reminder_kind as ReminderKind,
		relativeMinutes: row.relative_minutes,
		absoluteTime: row.absolute_time,
		absoluteDayOffset: row.absolute_day_offset,
		scheduledAt: row.scheduled_at,
		notificationId: row.notification_id,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	}
}

export interface UpsertReminderInput {
	enabled: boolean
	reminderKind: ReminderKind
	relativeMinutes?: number | null
	absoluteTime?: string | null
	absoluteDayOffset?: number
	scheduledAt?: Timestamp | null
	notificationId?: string | null
}

export class AssignmentReminderRepository {
	constructor(private readonly db: DatabaseConnection) {}

	async getByAssignmentId(assignmentId: string): Promise<AssignmentReminder | null> {
		const row = await this.db.getFirstAsync<ReminderRow>(
			'SELECT * FROM assignment_reminders WHERE assignment_id = ?',
			[assignmentId],
		)
		return row ? mapRow(row) : null
	}

	async listEnabledFuture(nowIso: string): Promise<AssignmentReminder[]> {
		const rows = await this.db.getAllAsync<ReminderRow>(
			`SELECT r.* FROM assignment_reminders r
			 INNER JOIN assignments a ON a.id = r.assignment_id
			 WHERE r.enabled = 1
			   AND a.status IN ('PENDING', 'IN_PROGRESS')
			   AND r.scheduled_at IS NOT NULL
			   AND r.scheduled_at > ?`,
			[nowIso],
		)
		return rows.map(mapRow)
	}

	async upsert(assignmentId: string, input: UpsertReminderInput): Promise<AssignmentReminder> {
		const existing = await this.getByAssignmentId(assignmentId)
		const timestamp = nowTimestamp()

		if (existing) {
			const updated: AssignmentReminder = {
				...existing,
				enabled: input.enabled,
				reminderKind: input.reminderKind,
				relativeMinutes: input.relativeMinutes ?? null,
				absoluteTime: input.absoluteTime ?? null,
				absoluteDayOffset: input.absoluteDayOffset ?? 0,
				scheduledAt:
					input.scheduledAt !== undefined ? input.scheduledAt : existing.scheduledAt,
				notificationId:
					input.notificationId !== undefined
						? input.notificationId
						: existing.notificationId,
				updatedAt: timestamp,
			}

			await this.db.runAsync(
				`UPDATE assignment_reminders SET
					enabled = ?, reminder_kind = ?, relative_minutes = ?,
					absolute_time = ?, absolute_day_offset = ?,
					scheduled_at = ?, notification_id = ?, updated_at = ?
				 WHERE id = ?`,
				[
					updated.enabled ? 1 : 0,
					updated.reminderKind,
					updated.relativeMinutes,
					updated.absoluteTime,
					updated.absoluteDayOffset,
					updated.scheduledAt,
					updated.notificationId,
					updated.updatedAt,
					existing.id,
				],
			)

			return updated
		}

		const reminder: AssignmentReminder = {
			id: createId(),
			assignmentId,
			enabled: input.enabled,
			reminderKind: input.reminderKind,
			relativeMinutes: input.relativeMinutes ?? null,
			absoluteTime: input.absoluteTime ?? null,
			absoluteDayOffset: input.absoluteDayOffset ?? 0,
			scheduledAt: input.scheduledAt ?? null,
			notificationId: input.notificationId ?? null,
			createdAt: timestamp,
			updatedAt: timestamp,
		}

		await this.db.runAsync(
			`INSERT INTO assignment_reminders (
				id, assignment_id, enabled, reminder_kind, relative_minutes,
				absolute_time, absolute_day_offset, scheduled_at, notification_id,
				created_at, updated_at
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			[
				reminder.id,
				reminder.assignmentId,
				reminder.enabled ? 1 : 0,
				reminder.reminderKind,
				reminder.relativeMinutes,
				reminder.absoluteTime,
				reminder.absoluteDayOffset,
				reminder.scheduledAt,
				reminder.notificationId,
				reminder.createdAt,
				reminder.updatedAt,
			],
		)

		return reminder
	}

	async deleteByAssignmentId(assignmentId: string): Promise<void> {
		await this.db.runAsync('DELETE FROM assignment_reminders WHERE assignment_id = ?', [
			assignmentId,
		])
	}

	async updateNotificationId(
		assignmentId: string,
		notificationId: string | null,
		scheduledAt: Timestamp | null,
	): Promise<void> {
		await this.db.runAsync(
			`UPDATE assignment_reminders SET notification_id = ?, scheduled_at = ?, updated_at = ?
			 WHERE assignment_id = ?`,
			[notificationId, scheduledAt, nowTimestamp(), assignmentId],
		)
	}
}
