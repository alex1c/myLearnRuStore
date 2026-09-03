import * as React from 'react'
import {
	Pressable,
	ScrollView,
	StyleSheet,
	Text,
	TextInput,
	View,
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { ScreenContainer } from '@/src/components/ScreenContainer'
import { SectionCard } from '@/src/components/SectionCard'
import { useAppData } from '@/src/context/AppDataContext'
import type { Grade, Subject } from '@/src/types/domain'
import {
	calculateAverage,
	countFivePointDistribution,
	formatGradeAverage,
	formatGradeValue,
	getRecentGradeValues,
	isTargetAchieved,
	usesWeightedAverage,
	type GradeValueRow,
} from '@/src/services/grade-calculation.service'
import {
	buildFivePointPredictions,
	calculateGradesNeededForTarget,
	findMinimumGradeForTarget,
} from '@/src/services/grade-prediction.service'
import {
	getAttendanceTargetInsights,
	loadAttendanceSummary,
} from '@/src/services/performance-data.service'
import { parseDecimalInput } from '@/src/services/grade-calculation.service'
import { formatShortDate } from '@/src/utils/format'
import { getGradeTypeLabel } from '@/src/utils/grade-labels'
import { loadFocusStats } from '@/src/services/focus-session.service'
import { formatShareGradeProgress } from '@/src/services/share/share-formatters.service'
import { shareText } from '@/src/services/share/share.service'
import { formatDurationSeconds } from '@/src/utils/duration'
import { pluralizeRu } from '@/src/utils/pluralize-ru'

/** Subject performance details with forecast, target, history, attendance. */
export default function SubjectPerformanceScreen() {
	const router = useRouter()
	const params = useLocalSearchParams<{ id?: string }>()
	const { repositories, settings, refresh, refreshKey, activePeriod } = useAppData()
	const isStudent = settings?.userMode !== 'SCHOOL'

	const [subject, setSubject] = React.useState<Subject | null>(null)
	const [grades, setGrades] = React.useState<Grade[]>([])
	const [futureWeight, setFutureWeight] = React.useState('1')
	const [targetInput, setTargetInput] = React.useState('')
	const [showTargetEdit, setShowTargetEdit] = React.useState(false)
	const [attendanceData, setAttendanceData] = React.useState<
		Awaited<ReturnType<typeof loadAttendanceSummary>> | null
	>(null)
	const [focusSeconds30d, setFocusSeconds30d] = React.useState(0)

	React.useEffect(() => {
		if (!repositories || !params.id) {
			return
		}

		let mounted = true
		void (async () => {
			const subj = await repositories.subjects.getById(params.id!)
			const gradeList = await repositories.grades.listBySubject(params.id!)
			const attendance = isStudent
				? await loadAttendanceSummary(repositories, params.id!)
				: null
			const focusStats = activePeriod
				? await loadFocusStats(repositories, activePeriod.id, '30d')
				: null
			const subjectFocus = focusStats?.bySubject.find(
				(item) => item.subjectId === params.id,
			)

			if (mounted) {
				setSubject(subj)
				setGrades(gradeList)
				setAttendanceData(attendance)
				setFocusSeconds30d(subjectFocus?.totalSeconds ?? 0)
				if (subj?.targetGrade !== null && subj?.targetGrade !== undefined) {
					setTargetInput(String(subj.targetGrade).replace('.', ','))
				}
			}
		})()

		return () => {
			mounted = false
		}
	}, [repositories, params.id, refreshKey, isStudent, activePeriod])

	if (!subject) {
		return (
			<ScreenContainer title="Предмет">
				<Text style={styles.loading}>Загрузка…</Text>
			</ScreenContainer>
		)
	}

	const rows: GradeValueRow[] = grades.map((grade) => ({
		value: grade.value,
		weight: grade.weight,
	}))
	const average = calculateAverage(rows)
	const weighted = usesWeightedAverage(rows)
	const target = subject.targetGrade
	const achieved = isTargetAchieved(average, target)
	const futureWeightNum = parseDecimalInput(futureWeight) ?? 1
	const targetProgress =
		target !== null
			? calculateGradesNeededForTarget(rows, target, subject.gradeScale, futureWeightNum)
			: null
	const minGradeNeeded =
		target !== null
			? findMinimumGradeForTarget(rows, target, subject.gradeScale, futureWeightNum)
			: null
	const predictions =
		subject.gradeScale === 'FIVE_POINT'
			? buildFivePointPredictions(rows, futureWeightNum)
			: []

	const distribution =
		subject.gradeScale === 'FIVE_POINT' ? countFivePointDistribution(rows) : null
	const dynamics = getRecentGradeValues(grades, 5)

	const attendanceInsights =
		attendanceData && subject.attendanceTarget !== null
			? getAttendanceTargetInsights(
					attendanceData.counts,
					attendanceData.rate,
					subject.attendanceTarget,
				)
			: null

	async function handleSaveTarget() {
		if (!repositories || !subject) {
			return
		}

		const value = parseDecimalInput(targetInput)
		if (value === null) {
			return
		}

		const updated = await repositories.subjects.update(subject.id, {
			targetGrade: value,
		})
		setSubject(updated)
		setShowTargetEdit(false)
		await refresh()
	}

	return (
		<ScreenContainer title={subject.name}>
			<ScrollView contentContainerStyle={styles.scroll}>
				<SectionCard title={weighted ? 'Средневзвешенный балл' : 'Средний балл'}>
					<Text style={styles.bigNumber}>
						{grades.length === 0 ? 'Оценок пока нет' : formatGradeAverage(average)}
					</Text>
					<Text style={styles.meta}>Оценок: {grades.length}</Text>
					<Pressable
						onPress={() => {
							if (!subject) {
								return
							}

							void shareText(
								formatShareGradeProgress({
									subject,
									average,
									recentGrades: grades,
								}),
							)
						}}
						style={styles.linkButton}
					>
						<Text style={styles.linkText}>Поделиться прогрессом</Text>
					</Pressable>
				</SectionCard>

				{focusSeconds30d > 0 ? (
					<SectionCard title="Время занятий">
						<Text style={styles.meta}>
							за 30 дней: {formatDurationSeconds(focusSeconds30d)}
						</Text>
						<Pressable
							onPress={() => router.push('/focus-stats')}
							style={styles.linkButton}
						>
							<Text style={styles.linkText}>Статистика →</Text>
						</Pressable>
					</SectionCard>
				) : null}

				<SectionCard title="Цель">
					<View style={styles.targetRow}>
						<Text style={styles.bigNumber}>
							{target !== null ? formatGradeAverage(target) : 'Не задана'}
						</Text>
						<Pressable
							onPress={() => setShowTargetEdit((value) => !value)}
							style={styles.linkButton}
						>
							<Text style={styles.linkText}>Изменить цель</Text>
						</Pressable>
					</View>
					{showTargetEdit ? (
						<View style={styles.targetEdit}>
							<TextInput
								value={targetInput}
								onChangeText={setTargetInput}
								placeholder="4,50"
								keyboardType="numeric"
								style={styles.weightInput}
							/>
							<Pressable onPress={() => void handleSaveTarget()}>
								<Text style={styles.linkText}>Сохранить цель</Text>
							</Pressable>
						</View>
					) : null}
					{achieved ? (
						<Text style={styles.achieved}>Цель достигнута 🎯</Text>
					) : null}
				</SectionCard>

				{grades.length > 0 && subject.gradeScale === 'FIVE_POINT' ? (
					<SectionCard title="Что будет со средним?">
						<Text style={styles.hint}>Если следующая оценка будет:</Text>
						<View style={styles.predictionGrid}>
							{predictions.map((item) => (
								<View key={item.value} style={styles.predictionCell}>
									<Text style={styles.predictionValue}>{item.value}</Text>
									<Text style={styles.predictionArrow}>→</Text>
									<Text style={styles.predictionAvg}>
										{formatGradeAverage(item.average)}
									</Text>
								</View>
							))}
						</View>
						<Text style={styles.weightLabel}>Вес следующей оценки</Text>
						<TextInput
							value={futureWeight}
							onChangeText={setFutureWeight}
							keyboardType="numeric"
							style={styles.weightInput}
						/>
					</SectionCard>
				) : null}

				{target !== null && targetProgress ? (
					<SectionCard title={`До цели ${formatGradeAverage(target)}`}>
						{targetProgress.status === 'achieved' ? (
							<Text style={styles.achieved}>Цель достигнута 🎯</Text>
						) : targetProgress.status === 'unattainable_exact' ? (
							<Text style={styles.warning}>{targetProgress.message}</Text>
						) : targetProgress.gradesNeeded !== null ? (
							<Text style={styles.targetText}>
								Нужно примерно{' '}
								<Text style={styles.bold}>
									{targetProgress.gradesNeeded}{' '}
									{targetProgress.gradesNeeded === 1 ? 'пятёрка' : 'пятёрок'} подряд
								</Text>
								{'\n'}
								<Text style={styles.hint}>при весе {futureWeightNum}</Text>
							</Text>
						) : (
							<Text style={styles.warning}>{targetProgress.message}</Text>
						)}
						{minGradeNeeded !== null && !achieved ? (
							<Text style={styles.hint}>
								Чтобы средний после следующей оценки стал не ниже{' '}
								{formatGradeAverage(target)} — нужна {formatGradeValue(minGradeNeeded, subject.gradeScale)}
							</Text>
						) : minGradeNeeded === null && !achieved ? (
							<Text style={styles.hint}>Одной оценки недостаточно</Text>
						) : null}
					</SectionCard>
				) : null}

				{distribution ? (
					<SectionCard title="Статистика">
						<Text style={styles.meta}>
							5: {distribution[5]} · 4: {distribution[4]} · 3: {distribution[3]} · 2:{' '}
							{distribution[2]}
						</Text>
						{dynamics.length > 0 ? (
							<Text style={styles.meta}>
								Последние 5:{' '}
								{dynamics.map((v) => formatGradeValue(v, subject.gradeScale)).join(' → ')}
							</Text>
						) : null}
					</SectionCard>
				) : null}

				<SectionCard title="История">
					{grades.length === 0 ? (
						<Text style={styles.meta}>Оценок пока нет</Text>
					) : (
						grades.map((grade) => (
							<Pressable
								key={grade.id}
								onPress={() => router.push(`/grade-form?id=${grade.id}`)}
								style={styles.historyRow}
							>
								<View style={styles.historyLeft}>
									<Text style={styles.historyDate}>{formatShortDate(grade.date)}</Text>
									{grade.gradeType ? (
										<Text style={styles.historyType}>
											{getGradeTypeLabel(grade.gradeType)}
										</Text>
									) : null}
								</View>
								<Text style={styles.historyValue}>
									{formatGradeValue(grade.value, grade.gradeScale)}
								</Text>
							</Pressable>
						))
					)}
				</SectionCard>

				{isStudent && attendanceData ? (
					<SectionCard title="Посещаемость">
						<Text style={styles.bigNumber}>{attendanceData.rateLabel}</Text>
						<Text style={styles.meta}>
							Посещено: {attendanceData.counts.present} · Пропущено:{' '}
							{attendanceData.counts.absent} · Уважительно:{' '}
							{attendanceData.counts.excused}
						</Text>
						<Text style={styles.hint}>
							Посещаемость = присутствия / (присутствия + пропуски). Уважительные не
							снижают процент.
						</Text>
						{attendanceInsights?.belowTarget ? (
							<Text style={styles.warning}>
								Сейчас ниже цели {subject.attendanceTarget}%.
								{attendanceInsights.presentsNeeded
									? ` Нужно посетить ещё ${attendanceInsights.presentsNeeded} ${pluralizeRu(
											attendanceInsights.presentsNeeded,
											'занятие',
											'занятия',
											'занятий',
										)} подряд.`
									: ''}
							</Text>
						) : attendanceInsights && subject.attendanceTarget !== null ? (
							<Text style={styles.meta}>
								Можно пропустить ещё {attendanceInsights.absencesAllowed}{' '}
								{pluralizeRu(
									attendanceInsights.absencesAllowed,
									'занятие',
									'занятия',
									'занятий',
								)}
								, чтобы остаться выше {subject.attendanceTarget}%.
							</Text>
						) : null}
						<Pressable
							onPress={() => router.push(`/attendance-form?subjectId=${subject.id}`)}
							style={styles.linkButton}
						>
							<Text style={styles.linkText}>+ Добавить посещение</Text>
						</Pressable>
					</SectionCard>
				) : null}
			</ScrollView>

			<Pressable
				style={styles.fab}
				onPress={() => router.push(`/grade-form?subjectId=${subject.id}`)}
			>
				<Text style={styles.fabText}>+</Text>
			</Pressable>
		</ScreenContainer>
	)
}

const styles = StyleSheet.create({
	scroll: { paddingBottom: 96 },
	loading: { color: '#64748B', padding: 16 },
	bigNumber: {
		fontSize: 28,
		fontWeight: '700',
		color: '#0F172A',
	},
	meta: {
		fontSize: 14,
		color: '#64748B',
		marginTop: 4,
		lineHeight: 20,
	},
	targetRow: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
	},
	targetEdit: { marginTop: 8, gap: 8 },
	linkButton: { paddingVertical: 8 },
	linkText: { color: '#2563EB', fontSize: 14, fontWeight: '600' },
	achieved: {
		color: '#16A34A',
		fontWeight: '600',
		marginTop: 8,
	},
	warning: { color: '#DC2626', marginTop: 8, lineHeight: 20 },
	hint: { fontSize: 13, color: '#64748B', marginTop: 4 },
	predictionGrid: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		gap: 8,
		marginTop: 8,
	},
	predictionCell: {
		width: '47%',
		flexDirection: 'row',
		alignItems: 'center',
		gap: 6,
		backgroundColor: '#F8FAFC',
		padding: 10,
		borderRadius: 8,
	},
	predictionValue: { fontSize: 18, fontWeight: '700', color: '#0F172A' },
	predictionArrow: { color: '#94A3B8' },
	predictionAvg: { fontSize: 16, fontWeight: '600', color: '#2563EB' },
	weightLabel: { fontSize: 13, color: '#64748B', marginTop: 12 },
	weightInput: {
		borderWidth: 1,
		borderColor: '#CBD5E1',
		borderRadius: 8,
		padding: 10,
		marginTop: 4,
		fontSize: 16,
	},
	targetText: { fontSize: 15, color: '#0F172A', lineHeight: 22 },
	bold: { fontWeight: '700' },
	historyRow: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		paddingVertical: 10,
		borderBottomWidth: 1,
		borderBottomColor: '#F1F5F9',
	},
	historyLeft: { flex: 1 },
	historyDate: { fontSize: 14, color: '#0F172A', fontWeight: '600' },
	historyType: { fontSize: 13, color: '#64748B' },
	historyValue: { fontSize: 20, fontWeight: '700', color: '#0F172A' },
	fab: {
		position: 'absolute',
		right: 20,
		bottom: 24,
		width: 56,
		height: 56,
		borderRadius: 28,
		backgroundColor: '#2563EB',
		alignItems: 'center',
		justifyContent: 'center',
		elevation: 4,
	},
	fabText: { color: '#FFF', fontSize: 28 },
})
