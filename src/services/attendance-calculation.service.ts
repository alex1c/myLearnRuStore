import type { AttendanceStatus } from '@/src/types/domain'

export interface AttendanceCounts {
	present: number
	absent: number
	excused: number
}

/** Summarize attendance records into counts. */
export function summarizeAttendance(
	records: { status: AttendanceStatus }[],
): AttendanceCounts {
	const counts: AttendanceCounts = { present: 0, absent: 0, excused: 0 }

	for (const record of records) {
		switch (record.status) {
			case 'PRESENT':
				counts.present += 1
				break
			case 'ABSENT':
				counts.absent += 1
				break
			case 'EXCUSED':
				counts.excused += 1
				break
		}
	}

	return counts
}

/**
 * Attendance rate = PRESENT / (PRESENT + ABSENT).
 * EXCUSED records are excluded from the denominator.
 */
export function calculateAttendanceRate(counts: AttendanceCounts): number | null {
	const denominator = counts.present + counts.absent
	if (denominator === 0) {
		return null
	}

	return counts.present / denominator
}

/** Format rate as percentage string with one decimal. */
export function formatAttendanceRate(rate: number | null): string {
	if (rate === null) {
		return '—'
	}

	return `${(rate * 100).toFixed(1).replace('.', ',')}%`
}

/** Max additional absences while staying at or above threshold (0–1). */
export function calculateAdditionalAbsencesAllowed(
	counts: AttendanceCounts,
	thresholdPercent: number,
): number {
	const threshold = thresholdPercent / 100
	const { present, absent } = counts

	if (present + absent === 0) {
		return 0
	}

	const currentRate = present / (present + absent)
	if (currentRate < threshold) {
		return 0
	}

	for (let n = 0; n <= 10000; n += 1) {
		const rate = present / (present + absent + n)
		if (rate < threshold) {
			return Math.max(0, n - 1)
		}
	}

	return 10000
}

/** Min consecutive presents needed to reach threshold when currently below. */
export function calculateRequiredPresentsToReachTarget(
	counts: AttendanceCounts,
	thresholdPercent: number,
): number | null {
	const threshold = thresholdPercent / 100
	const { present, absent } = counts
	const total = present + absent

	if (total === 0) {
		return null
	}

	const currentRate = present / total
	if (currentRate >= threshold) {
		return 0
	}

	for (let k = 1; k <= 10000; k += 1) {
		const rate = (present + k) / (total + k)
		if (rate >= threshold) {
			return k
		}
	}

	return null
}

/** Whether attendance is below the configured target. */
export function isBelowAttendanceTarget(
	rate: number | null,
	targetPercent: number | null,
): boolean {
	if (rate === null || targetPercent === null) {
		return false
	}

	return rate < targetPercent / 100
}
