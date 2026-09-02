import type { Repositories } from '@/src/db/repositories'
import type { FocusSession } from '@/src/types/domain'
import {
	cancelFocusCompletionNotification,
	scheduleFocusCompletionNotification,
} from '@/src/services/focus-notification.service'
import {
	buildFocusStatsSummary,
	filterSessionsByPeriod,
	sumAssignmentFocusSeconds,
	type FocusStatsPeriod,
	type FocusStatsSummary,
} from '@/src/services/focus-stats.service'
import {
	computeElapsedStudyMs,
	computeRemainingSeconds,
	createActiveTimerState,
	isTimerComplete,
	pauseTimer,
	resumeTimer,
	type ActiveFocusTimerState,
} from '@/src/services/focus-timer.service'
import { elapsedMsToSavedMinutes } from '@/src/utils/duration'

export interface FinalizeFocusResult {
	session: FocusSession
	wasAutoComplete: boolean
}

/** Start a new focus timer and persist active state. */
export async function startFocusSession(
	repos: Repositories,
	input: {
		subjectId: string
		assignmentId?: string | null
		plannedDurationSeconds: number
		notifyOnComplete?: boolean
	},
): Promise<ActiveFocusTimerState> {
	const existing = await repos.activeFocus.get()
	if (existing) {
		throw new Error('A focus session is already active')
	}

	const state = createActiveTimerState({
		subjectId: input.subjectId,
		assignmentId: input.assignmentId,
		plannedDurationSeconds: input.plannedDurationSeconds,
		startedAtMs: Date.now(),
		notifyOnComplete: input.notifyOnComplete,
	})

	const notificationId = await scheduleFocusCompletionNotification(state)
	state.notificationId = notificationId
	await repos.activeFocus.save(state)
	return state
}

/** Pause the active focus timer. */
export async function pauseFocusSession(
	repos: Repositories,
): Promise<ActiveFocusTimerState | null> {
	const current = await repos.activeFocus.get()
	if (!current) {
		return null
	}

	await cancelFocusCompletionNotification()
	const next = pauseTimer(Date.now(), current)
	next.notificationId = null
	await repos.activeFocus.save(next)
	return next
}

/** Resume a paused focus timer and reschedule notification if needed. */
export async function resumeFocusSession(
	repos: Repositories,
): Promise<ActiveFocusTimerState | null> {
	const current = await repos.activeFocus.get()
	if (!current) {
		return null
	}

	const next = resumeTimer(Date.now(), current)
	const notificationId = await scheduleFocusCompletionNotification(next)
	next.notificationId = notificationId
	await repos.activeFocus.save(next)
	return next
}

/** Finalize and persist a completed focus session (idempotent clear of active state). */
export async function finalizeFocusSession(
	repos: Repositories,
	input: {
		state: ActiveFocusTimerState
		endedAtMs: number
		saveSession: boolean
	},
): Promise<FinalizeFocusResult | null> {
	await cancelFocusCompletionNotification()

	const active = await repos.activeFocus.get()
	if (!active) {
		return null
	}

	await repos.activeFocus.clear()

	if (!input.saveSession) {
		return null
	}

	const elapsedMs = computeElapsedStudyMs(input.endedAtMs, input.state)
	const durationSeconds = Math.max(60, elapsedMsToSavedMinutes(elapsedMs) * 60)

	const session = await repos.focusSessions.create({
		subjectId: input.state.subjectId,
		assignmentId: input.state.assignmentId,
		startedAt: input.state.startedAt,
		endedAt: new Date(input.endedAtMs).toISOString(),
		durationSeconds,
		completed: isTimerComplete(input.endedAtMs, input.state),
	})

	return {
		session,
		wasAutoComplete: isTimerComplete(input.endedAtMs, input.state),
	}
}

/** Recover active timer on app bootstrap — auto-complete if elapsed. */
export async function recoverActiveFocusSession(
	repos: Repositories,
): Promise<FinalizeFocusResult | 'active' | null> {
	const state = await repos.activeFocus.get()
	if (!state) {
		return null
	}

	const nowMs = Date.now()
	if (!isTimerComplete(nowMs, state)) {
		return 'active'
	}

	return finalizeFocusSession(repos, {
		state,
		endedAtMs: nowMs,
		saveSession: true,
	})
}

/** Read remaining seconds for UI tick (derived from clock, not interval counter). */
export function getFocusRemainingSeconds(state: ActiveFocusTimerState): number {
	return computeRemainingSeconds(Date.now(), state)
}

/** Build focus stats for UI with subject name resolution. */
export async function loadFocusStats(
	repos: Repositories,
	studyPeriodId: string,
	period: FocusStatsPeriod,
): Promise<FocusStatsSummary> {
	const [sessions, subjects] = await Promise.all([
		repos.focusSessions.listAll(),
		repos.subjects.listByStudyPeriod(studyPeriodId),
	])

	const subjectIds = new Set(subjects.map((item) => item.id))
	const relevant = sessions.filter(
		(item) => item.subjectId && subjectIds.has(item.subjectId),
	)
	const names = new Map(subjects.map((item) => [item.id, item.name]))

	return buildFocusStatsSummary(relevant, names, period)
}

/** Today's completed focus sessions for the focus screen history section. */
export async function loadTodayFocusHistory(
	repos: Repositories,
	studyPeriodId: string,
): Promise<FocusSession[]> {
	const subjects = await repos.subjects.listByStudyPeriod(studyPeriodId)
	const subjectIds = new Set(subjects.map((item) => item.id))
	const sessions = await repos.focusSessions.listAll()

	return filterSessionsByPeriod(
		sessions.filter((item) => item.subjectId && subjectIds.has(item.subjectId)),
		'today',
	)
}

/** Total focus seconds linked to an assignment. */
export async function getAssignmentFocusSeconds(
	repos: Repositories,
	assignmentId: string,
): Promise<number> {
	const sessions = await repos.focusSessions.listByAssignment(assignmentId)
	return sumAssignmentFocusSeconds(sessions)
}

/** Delete a focus history row. */
export async function deleteFocusSession(
	repos: Repositories,
	sessionId: string,
): Promise<void> {
	await repos.focusSessions.delete(sessionId)
}
