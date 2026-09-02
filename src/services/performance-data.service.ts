import type { Repositories } from '@/src/db/repositories'
import type { Grade, Subject } from '@/src/types/domain'
import {
	calculateAverage,
	formatGradeAverage,
	getRecentGradeValues,
	isTargetAchieved,
	usesWeightedAverage,
	type GradeValueRow,
} from '@/src/services/grade-calculation.service'
import {
	calculateAttendanceRate,
	calculateAdditionalAbsencesAllowed,
	calculateRequiredPresentsToReachTarget,
	formatAttendanceRate,
	summarizeAttendance,
} from '@/src/services/attendance-calculation.service'

/** Subject card data for performance list. */
export interface SubjectPerformanceSummary {
	subject: Subject
	average: number | null
	averageLabel: string
	isWeighted: boolean
	targetGrade: number | null
	targetAchieved: boolean
	belowTarget: boolean
	recentGrades: number[]
	gradeCount: number
}

/** Load performance summaries for all subjects in a period. */
export async function loadSubjectPerformanceSummaries(
	repos: Repositories,
	studyPeriodId: string,
): Promise<SubjectPerformanceSummary[]> {
	const subjects = await repos.subjects.listByStudyPeriod(studyPeriodId)
	const subjectIds = subjects.map((subject) => subject.id)
	const allGrades = await repos.grades.listBySubjectIds(subjectIds)

	const gradesBySubject = new Map<string, Grade[]>()
	for (const grade of allGrades) {
		const list = gradesBySubject.get(grade.subjectId) ?? []
		list.push(grade)
		gradesBySubject.set(grade.subjectId, list)
	}

	return subjects.map((subject) => {
		const grades = gradesBySubject.get(subject.id) ?? []
		const rows: GradeValueRow[] = grades.map((grade) => ({
			value: grade.value,
			weight: grade.weight,
		}))
		const average = calculateAverage(rows)

		return {
			subject,
			average,
			averageLabel: formatGradeAverage(average),
			isWeighted: usesWeightedAverage(rows),
			targetGrade: subject.targetGrade,
			targetAchieved: isTargetAchieved(average, subject.targetGrade),
			belowTarget:
				subject.targetGrade !== null &&
				average !== null &&
				average < subject.targetGrade,
			recentGrades: getRecentGradeValues(grades, 5),
			gradeCount: grades.length,
		}
	})
}

/** Load attendance summary for a subject. */
export async function loadAttendanceSummary(
	repos: Repositories,
	subjectId: string,
) {
	const records = await repos.attendance.listBySubject(subjectId)
	const counts = summarizeAttendance(records)
	const rate = calculateAttendanceRate(counts)

	return {
		counts,
		rate,
		rateLabel: formatAttendanceRate(rate),
		records,
	}
}

/** Compute attendance target helpers for subject details. */
export function getAttendanceTargetInsights(
	counts: ReturnType<typeof summarizeAttendance>,
	rate: number | null,
	targetPercent: number | null,
) {
	if (targetPercent === null) {
		return null
	}

	const absencesAllowed = calculateAdditionalAbsencesAllowed(counts, targetPercent)
	const presentsNeeded = calculateRequiredPresentsToReachTarget(counts, targetPercent)
	const belowTarget = rate !== null && rate < targetPercent / 100

	return {
		absencesAllowed,
		presentsNeeded,
		belowTarget,
	}
}
