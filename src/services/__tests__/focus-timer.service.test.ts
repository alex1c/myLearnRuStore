import {
	computeElapsedStudyMs,
	computeRemainingSeconds,
	createActiveTimerState,
	isTimerComplete,
	pauseTimer,
	resumeTimer,
} from '@/src/services/focus-timer.service'

describe('focus-timer.service', () => {
	const base = createActiveTimerState({
		subjectId: 'sub-1',
		plannedDurationSeconds: 25 * 60,
		startedAtMs: 1_000_000,
	})

	it('counts down remaining seconds from timestamps', () => {
		const atFiveMinutes = 1_000_000 + 5 * 60 * 1000
		expect(computeRemainingSeconds(atFiveMinutes, base)).toBe(20 * 60)
	})

	it('accounts for background elapsed time', () => {
		const afterBackground = 1_000_000 + 10 * 60 * 1000
		expect(computeRemainingSeconds(afterBackground, base)).toBe(15 * 60)
	})

	it('excludes paused time from elapsed study duration', () => {
		const paused = pauseTimer(1_000_000 + 5 * 60 * 1000, base)
		const afterPause = 1_000_000 + 15 * 60 * 1000
		expect(computeElapsedStudyMs(afterPause, paused)).toBe(5 * 60 * 1000)
	})

	it('resumes and accumulates pause duration', () => {
		const paused = pauseTimer(1_000_000 + 5 * 60 * 1000, base)
		const resumed = resumeTimer(1_000_000 + 8 * 60 * 1000, paused)
		const afterResume = 1_000_000 + 13 * 60 * 1000
		expect(computeElapsedStudyMs(afterResume, resumed)).toBe(10 * 60 * 1000)
	})

	it('detects timer completion', () => {
		const end = 1_000_000 + 25 * 60 * 1000
		expect(isTimerComplete(end, base)).toBe(true)
	})

	it('never returns negative remaining seconds', () => {
		const wayPast = 1_000_000 + 60 * 60 * 1000
		expect(computeRemainingSeconds(wayPast, base)).toBe(0)
	})

	it('recovers elapsed state after simulated restart', () => {
		const restartedNow = 1_000_000 + 20 * 60 * 1000
		expect(isTimerComplete(restartedNow, base)).toBe(false)
		expect(computeRemainingSeconds(restartedNow, base)).toBe(5 * 60)
	})
})
