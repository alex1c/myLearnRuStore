import { buildFocusStatsSummary, filterSessionsByPeriod } from '@/src/services/focus-stats.service'
import type { FocusSession } from '@/src/types/domain'

function session(
	overrides: Partial<FocusSession> & { startedAt: string; durationSeconds: number },
): FocusSession {
	return {
		id: overrides.id ?? 's1',
		subjectId: overrides.subjectId ?? 'sub-1',
		assignmentId: null,
		startedAt: overrides.startedAt,
		endedAt: overrides.startedAt,
		durationSeconds: overrides.durationSeconds,
		completed: true,
		createdAt: overrides.startedAt,
	}
}

describe('focus-stats.service', () => {
	const names = new Map([['sub-1', 'Math'], ['sub-2', 'Physics']])

	it('aggregates total duration and session count', () => {
		const sessions = [
			session({ startedAt: '2026-09-01T10:00:00.000Z', durationSeconds: 1500 }),
			session({ id: 's2', startedAt: '2026-09-02T10:00:00.000Z', durationSeconds: 900 }),
		]

		const stats = buildFocusStatsSummary(sessions, names, 'all', '2026-09-02')
		expect(stats.totalSeconds).toBe(2400)
		expect(stats.sessionCount).toBe(2)
		expect(stats.averageSeconds).toBe(1200)
	})

	it('groups by subject descending time', () => {
		const sessions = [
			session({ subjectId: 'sub-1', startedAt: '2026-09-01T10:00:00.000Z', durationSeconds: 600 }),
			session({
				id: 's2',
				subjectId: 'sub-2',
				startedAt: '2026-09-01T11:00:00.000Z',
				durationSeconds: 1800,
			}),
		]

		const stats = buildFocusStatsSummary(sessions, names, 'all', '2026-09-02')
		expect(stats.bySubject[0].subjectName).toBe('Physics')
		expect(stats.bySubject[1].subjectName).toBe('Math')
	})

	it('filters by 7-day local range', () => {
		const sessions = [
			session({ startedAt: '2026-08-20T10:00:00.000Z', durationSeconds: 600 }),
			session({ id: 's2', startedAt: '2026-09-01T10:00:00.000Z', durationSeconds: 900 }),
		]

		const filtered = filterSessionsByPeriod(sessions, '7d', '2026-09-02')
		expect(filtered).toHaveLength(1)
		expect(filtered[0].durationSeconds).toBe(900)
	})

	it('handles zero sessions', () => {
		const stats = buildFocusStatsSummary([], names, '7d', '2026-09-02')
		expect(stats.totalSeconds).toBe(0)
		expect(stats.sessionCount).toBe(0)
		expect(stats.averageSeconds).toBe(0)
		expect(stats.bySubject).toEqual([])
	})

	it('handles sessions across midnight boundaries via date slice', () => {
		const sessions = [
			session({ startedAt: '2026-09-01T23:50:00.000Z', durationSeconds: 600 }),
			session({ id: 's2', startedAt: '2026-09-02T00:10:00.000Z', durationSeconds: 900 }),
		]

		const today = filterSessionsByPeriod(sessions, 'today', '2026-09-02')
		expect(today).toHaveLength(1)
		expect(today[0].durationSeconds).toBe(900)
	})
})
