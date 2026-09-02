/** Runtime state for an in-progress focus timer (persisted to active_focus_session). */
export type FocusTimerState = 'RUNNING' | 'PAUSED'

export interface ActiveFocusTimerState {
	subjectId: string
	assignmentId: string | null
	plannedDurationSeconds: number
	startedAt: string
	pausedAt: string | null
	accumulatedPauseMs: number
	state: FocusTimerState
	notifyOnComplete: boolean
	notificationId: string | null
}

/** Elapsed active study time excluding pauses (never negative). */
export function computeElapsedStudyMs(
	nowMs: number,
	state: ActiveFocusTimerState,
): number {
	const startedMs = Date.parse(state.startedAt)
	if (Number.isNaN(startedMs)) {
		return 0
	}

	let elapsed = nowMs - startedMs - state.accumulatedPauseMs

	if (state.state === 'PAUSED' && state.pausedAt) {
		const pausedMs = Date.parse(state.pausedAt)
		if (!Number.isNaN(pausedMs)) {
			elapsed -= nowMs - pausedMs
		}
	}

	return Math.max(0, elapsed)
}

/** Remaining seconds until planned duration is reached. */
export function computeRemainingSeconds(
	nowMs: number,
	state: ActiveFocusTimerState,
): number {
	const elapsedMs = computeElapsedStudyMs(nowMs, state)
	const remainingMs = state.plannedDurationSeconds * 1000 - elapsedMs
	return Math.max(0, Math.ceil(remainingMs / 1000))
}

/** True when planned duration has been fully consumed. */
export function isTimerComplete(
	nowMs: number,
	state: ActiveFocusTimerState,
): boolean {
	return computeRemainingSeconds(nowMs, state) <= 0
}

/** Pause an active timer at the given instant. */
export function pauseTimer(
	nowMs: number,
	state: ActiveFocusTimerState,
): ActiveFocusTimerState {
	if (state.state === 'PAUSED') {
		return state
	}

	return {
		...state,
		state: 'PAUSED',
		pausedAt: new Date(nowMs).toISOString(),
	}
}

/** Resume a paused timer and accumulate pause duration. */
export function resumeTimer(
	nowMs: number,
	state: ActiveFocusTimerState,
): ActiveFocusTimerState {
	if (state.state !== 'PAUSED' || !state.pausedAt) {
		return state
	}

	const pausedMs = Date.parse(state.pausedAt)
	const pauseDuration = Number.isNaN(pausedMs) ? 0 : nowMs - pausedMs

	return {
		...state,
		state: 'RUNNING',
		pausedAt: null,
		accumulatedPauseMs: state.accumulatedPauseMs + Math.max(0, pauseDuration),
	}
}

/** Absolute timestamp when the timer should fire completion (for notifications). */
export function computeExpectedEndMs(state: ActiveFocusTimerState): number {
	const startedMs = Date.parse(state.startedAt)
	let extraPause = state.accumulatedPauseMs

	if (state.state === 'PAUSED' && state.pausedAt) {
		const pausedMs = Date.parse(state.pausedAt)
		if (!Number.isNaN(pausedMs)) {
			extraPause += Date.now() - pausedMs
		}
	}

	return startedMs + state.plannedDurationSeconds * 1000 + extraPause
}

/** Build a new timer state when the user starts a session. */
export function createActiveTimerState(input: {
	subjectId: string
	assignmentId?: string | null
	plannedDurationSeconds: number
	startedAtMs: number
	notifyOnComplete?: boolean
}): ActiveFocusTimerState {
	return {
		subjectId: input.subjectId,
		assignmentId: input.assignmentId ?? null,
		plannedDurationSeconds: input.plannedDurationSeconds,
		startedAt: new Date(input.startedAtMs).toISOString(),
		pausedAt: null,
		accumulatedPauseMs: 0,
		state: 'RUNNING',
		notifyOnComplete: input.notifyOnComplete ?? false,
		notificationId: null,
	}
}
