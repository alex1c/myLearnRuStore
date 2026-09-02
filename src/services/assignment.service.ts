import type { Repositories } from '@/src/db/repositories'
import type { CreateAssignmentInput } from '@/src/db/repositories/assignment.repository'
import type { Assignment } from '@/src/types/domain'
import {
	cancelAssignmentReminder,
	syncAssignmentReminder,
	type ReminderConfigInput,
	type ReminderSyncResult,
} from '@/src/services/assignment-reminder-sync.service'
import {
	addAssignmentPhoto,
	cleanupAssignmentPhotos,
	deleteAssignmentPhoto,
	deleteManagedFile,
} from '@/src/services/assignment-photo-storage.service'

export interface SaveAssignmentInput extends CreateAssignmentInput {
	reminder?: ReminderConfigInput
}

export interface SaveAssignmentResult {
	assignment: Assignment
	reminderWarning?: string
}

/** Create assignment with optional reminder scheduling. */
export async function createAssignment(
	repos: Repositories,
	input: SaveAssignmentInput,
	subjectName: string,
): Promise<SaveAssignmentResult> {
	const assignment = await repos.assignments.create(input)

	let reminderWarning: string | undefined
	if (input.reminder) {
		const result = await syncAssignmentReminder(
			repos,
			assignment,
			subjectName,
			input.reminder,
		)
		reminderWarning = result.warning
	}

	return { assignment, reminderWarning }
}

/** Update assignment and reschedule reminder if configured. */
export async function updateAssignment(
	repos: Repositories,
	id: string,
	input: Partial<SaveAssignmentInput>,
	subjectName: string,
): Promise<SaveAssignmentResult> {
	const assignment = await repos.assignments.update(id, input)

	let reminderWarning: string | undefined
	if (input.reminder) {
		const result = await syncAssignmentReminder(
			repos,
			assignment,
			subjectName,
			input.reminder,
		)
		reminderWarning = result.warning
	}

	return { assignment, reminderWarning }
}

/** Mark complete and cancel reminder. */
export async function completeAssignment(
	repos: Repositories,
	id: string,
): Promise<Assignment> {
	await cancelAssignmentReminder(repos, id)
	return repos.assignments.complete(id)
}

/** Reopen and restore reminder if still in future. */
export async function reopenAssignment(
	repos: Repositories,
	id: string,
	subjectName: string,
): Promise<Assignment> {
	const assignment = await repos.assignments.reopen(id)
	const reminder = await repos.assignmentReminders.getByAssignmentId(id)

	if (reminder?.enabled && reminder.reminderKind !== 'NONE') {
		await syncAssignmentReminder(repos, assignment, subjectName, {
			enabled: reminder.enabled,
			reminderKind: reminder.reminderKind,
			relativeMinutes: reminder.relativeMinutes,
			absoluteTime: reminder.absoluteTime,
			absoluteDayOffset: reminder.absoluteDayOffset,
		})
	}

	return assignment
}

/** Delete assignment, photos, and reminders. */
export async function deleteAssignment(
	repos: Repositories,
	id: string,
): Promise<void> {
	await cancelAssignmentReminder(repos, id)
	await cleanupAssignmentPhotos(repos, id)
	await repos.assignments.delete(id)
}

export {
	addAssignmentPhoto,
	deleteAssignmentPhoto,
	deleteManagedFile,
}
export type { ReminderConfigInput, ReminderSyncResult }
