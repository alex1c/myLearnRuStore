import * as React from 'react'
import {
	Alert,
	Pressable,
	ScrollView,
	StyleSheet,
	Text,
	View,
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { ScreenContainer } from '@/src/components/ScreenContainer'
import { PrimaryButton } from '@/src/components/ui/FormFields'
import { useAppData } from '@/src/context/AppDataContext'
import {
	deleteFocusSession,
	finalizeFocusSession,
	getFocusRemainingSeconds,
	loadTodayFocusHistory,
	pauseFocusSession,
	resumeFocusSession,
	startFocusSession,
} from '@/src/services/focus-session.service'
import {
	computeElapsedStudyMs,
	type ActiveFocusTimerState,
} from '@/src/services/focus-timer.service'
import type { FocusSession } from '@/src/types/domain'
import { formatDurationSeconds, formatTimerDisplay } from '@/src/utils/duration'
import { getNotificationScheduler } from '@/src/services/notifications/expo-notification-scheduler'

const PRESETS = [15, 25, 45, 60]

/** Focus timer screen with timestamp-based countdown and today history. */
export default function FocusScreen() {
	const router = useRouter()
	const params = useLocalSearchParams<{
		subjectId?: string
		assignmentId?: string
	}>()
	const { repositories, activePeriod, refresh } = useAppData()

	const [subjects, setSubjects] = React.useState<
		Awaited<ReturnType<NonNullable<typeof repositories>['subjects']['listByStudyPeriod']>>
	>([])
	const [assignments, setAssignments] = React.useState<
		Awaited<ReturnType<NonNullable<typeof repositories>['assignments']['listActive']>>
	>([])
	const [subjectId, setSubjectId] = React.useState<string | null>(params.subjectId ?? null)
	const [assignmentId, setAssignmentId] = React.useState<string | null>(
		params.assignmentId ?? null,
	)
	const [durationMinutes, setDurationMinutes] = React.useState(25)
	const [customMinutes, setCustomMinutes] = React.useState('')
	const [notifyOnComplete, setNotifyOnComplete] = React.useState(false)
	const [active, setActive] = React.useState<ActiveFocusTimerState | null>(null)
	const [todaySessions, setTodaySessions] = React.useState<FocusSession[]>([])
	const [remainingSeconds, setRemainingSeconds] = React.useState(0)
	const [isComplete, setIsComplete] = React.useState(false)

	const loadHistory = React.useCallback(async () => {
		if (!repositories || !activePeriod) {
			return
		}

		const sessions = await loadTodayFocusHistory(repositories, activePeriod.id)
		setTodaySessions(sessions)
	}, [repositories, activePeriod])

	React.useEffect(() => {
		if (!repositories || !activePeriod) {
			return
		}

		void (async () => {
			const [subjectList, assignmentList, current] = await Promise.all([
				repositories.subjects.listByStudyPeriod(activePeriod.id),
				repositories.assignments.listActive(),
				repositories.activeFocus.get(),
			])

			const subjectIds = new Set(subjectList.map((item) => item.id))
			setSubjects(subjectList)
			setAssignments(assignmentList.filter((item) => subjectIds.has(item.subjectId)))
			setActive(current)
			if (current) {
				setRemainingSeconds(getFocusRemainingSeconds(current))
				setIsComplete(getFocusRemainingSeconds(current) <= 0)
			}
			await loadHistory()
		})()
	}, [repositories, activePeriod, loadHistory])

	React.useEffect(() => {
		if (!active || active.state === 'PAUSED') {
			return
		}

		const interval = setInterval(() => {
			const remaining = getFocusRemainingSeconds(active)
			setRemainingSeconds(remaining)
			if (remaining <= 0) {
				setIsComplete(true)
				clearInterval(interval)
				void handleAutoComplete()
			}
		}, 1000)

		return () => clearInterval(interval)
		// handleAutoComplete closes over active snapshot; re-bind when active changes.
		// eslint-disable-next-line react-hooks/exhaustive-deps -- intentional timer tick
	}, [active])

	async function handleAutoComplete() {
		if (!repositories || !active) {
			return
		}

		const result = await finalizeFocusSession(repositories, {
			state: active,
			endedAtMs: Date.now(),
			saveSession: true,
		})
		setActive(null)
		await refresh()
		await loadHistory()

		if (result) {
			Alert.alert('Готово!', 'Фокус-сессия завершена.')
		}
	}

	async function handleStart() {
		if (!repositories || !subjectId) {
			Alert.alert('Выберите предмет')
			return
		}

		const minutes = customMinutes
			? Number(customMinutes.replace(',', '.'))
			: durationMinutes

		if (!Number.isFinite(minutes) || minutes <= 0 || minutes > 240) {
			Alert.alert('Укажите длительность от 1 до 240 минут')
			return
		}

		if (notifyOnComplete) {
			const scheduler = getNotificationScheduler()
			const granted = await scheduler.hasPermission()
			if (!granted) {
				const requested = await scheduler.requestPermissions()
				if (!requested) {
					setNotifyOnComplete(false)
				}
			}
		}

		const state = await startFocusSession(repositories, {
			subjectId,
			assignmentId,
			plannedDurationSeconds: Math.round(minutes * 60),
			notifyOnComplete,
		})
		setActive(state)
		setRemainingSeconds(getFocusRemainingSeconds(state))
		setIsComplete(false)
	}

	async function handlePauseResume() {
		if (!repositories || !active) {
			return
		}

		if (active.state === 'RUNNING') {
			const next = await pauseFocusSession(repositories)
			setActive(next)
		} else {
			const next = await resumeFocusSession(repositories)
			setActive(next)
			if (next) {
				setRemainingSeconds(getFocusRemainingSeconds(next))
			}
		}
	}

	function handleFinishEarly() {
		if (!repositories || !active) {
			return
		}

		const elapsedMinutes = Math.floor(
			computeElapsedStudyMs(Date.now(), active) / 60_000,
		)

		Alert.alert(
			'Завершить досрочно?',
			`Сохранить ${Math.max(1, elapsedMinutes)} минут занятий?`,
			[
				{
					text: 'Не сохранять',
					style: 'destructive',
					onPress: () => {
						void (async () => {
							await finalizeFocusSession(repositories, {
								state: active,
								endedAtMs: Date.now(),
								saveSession: false,
							})
							setActive(null)
							setIsComplete(false)
							await refresh()
						})()
					},
				},
				{
					text: 'Сохранить',
					onPress: () => {
						void (async () => {
							await finalizeFocusSession(repositories, {
								state: active,
								endedAtMs: Date.now(),
								saveSession: true,
							})
							setActive(null)
							setIsComplete(false)
							await refresh()
							await loadHistory()
						})()
					},
				},
				{ text: 'Отмена', style: 'cancel' },
			],
		)
	}

	const subjectAssignments = assignments.filter(
		(item) => item.subjectId === subjectId && item.status !== 'COMPLETED',
	)
	const todayTotal = todaySessions.reduce(
		(sum, item) => sum + (item.durationSeconds ?? 0),
		0,
	)
	const subjectNames = new Map(subjects.map((item) => [item.id, item.name]))

	if (active) {
		return (
			<ScreenContainer title="Фокус">
				<View style={styles.timerContainer}>
					<Text style={styles.timerSubject}>
						{subjectNames.get(active.subjectId) ?? 'Предмет'}
					</Text>
					<Text style={styles.timerDisplay}>
						{formatTimerDisplay(remainingSeconds)}
					</Text>
					<Text style={styles.timerState}>
						{active.state === 'PAUSED' ? 'Пауза' : isComplete ? 'Завершено' : 'Идёт'}
					</Text>
					<View style={styles.timerActions}>
						<PrimaryButton
							title={active.state === 'PAUSED' ? 'Продолжить' : 'Пауза'}
							onPress={() => void handlePauseResume()}
						/>
						<Pressable onPress={handleFinishEarly} style={styles.secondaryAction}>
							<Text style={styles.secondaryActionText}>Завершить</Text>
						</Pressable>
					</View>
					{isComplete ? (
						<PrimaryButton
							title="Готово"
							onPress={() => void handleAutoComplete()}
						/>
					) : null}
				</View>
			</ScreenContainer>
		)
	}

	return (
		<ScreenContainer title="Фокус">
			<ScrollView contentContainerStyle={styles.content}>
				<Text style={styles.label}>Предмет</Text>
				<View style={styles.chips}>
					{subjects.map((item) => (
						<Pressable
							key={item.id}
							onPress={() => {
								setSubjectId(item.id)
								setAssignmentId(null)
							}}
							style={[
								styles.chip,
								subjectId === item.id && styles.chipActive,
							]}
						>
							<Text
								style={[
									styles.chipText,
									subjectId === item.id && styles.chipTextActive,
								]}
							>
								{item.name}
							</Text>
						</Pressable>
					))}
				</View>

				{subjectId && subjectAssignments.length > 0 ? (
					<>
						<Text style={styles.label}>Задание (необязательно)</Text>
						<View style={styles.chips}>
							<Pressable
								onPress={() => setAssignmentId(null)}
								style={[styles.chip, assignmentId === null && styles.chipActive]}
							>
								<Text style={styles.chipText}>Без задания</Text>
							</Pressable>
							{subjectAssignments.slice(0, 8).map((item) => (
								<Pressable
									key={item.id}
									onPress={() => setAssignmentId(item.id)}
									style={[
										styles.chip,
										assignmentId === item.id && styles.chipActive,
									]}
								>
									<Text style={styles.chipText} numberOfLines={1}>
										{item.title}
									</Text>
								</Pressable>
							))}
						</View>
					</>
				) : null}

				<Text style={styles.label}>Длительность</Text>
				<View style={styles.chips}>
					{PRESETS.map((minutes) => (
						<Pressable
							key={minutes}
							onPress={() => {
								setDurationMinutes(minutes)
								setCustomMinutes('')
							}}
							style={[
								styles.chip,
								durationMinutes === minutes && !customMinutes && styles.chipActive,
							]}
						>
							<Text style={styles.chipText}>{minutes} мин</Text>
						</Pressable>
					))}
				</View>

				<Pressable
					onPress={() => setNotifyOnComplete((value) => !value)}
					style={styles.notifyRow}
				>
					<Text style={styles.notifyLabel}>Уведомить по завершении</Text>
					<Text style={styles.notifyValue}>{notifyOnComplete ? 'Да' : 'Нет'}</Text>
				</Pressable>

				<PrimaryButton title="Начать" onPress={() => void handleStart()} />

				<Text style={styles.sectionTitle}>Сегодня</Text>
				{todaySessions.length === 0 ? (
					<Text style={styles.empty}>Сессий пока нет</Text>
				) : (
					todaySessions.map((session) => (
						<View key={session.id} style={styles.historyRow}>
							<Text style={styles.historyText}>
								{subjectNames.get(session.subjectId ?? '') ?? 'Предмет'} —{' '}
								{formatDurationSeconds(session.durationSeconds ?? 0)}
							</Text>
							<Pressable
								onPress={() => {
									Alert.alert('Удалить сессию?', undefined, [
										{ text: 'Отмена', style: 'cancel' },
										{
											text: 'Удалить',
											style: 'destructive',
											onPress: () => {
												void (async () => {
													await deleteFocusSession(repositories!, session.id)
													await loadHistory()
													await refresh()
												})()
											},
										},
									])
								}}
							>
								<Text style={styles.deleteLink}>Удалить</Text>
							</Pressable>
						</View>
					))
				)}
				{todaySessions.length > 0 ? (
					<Text style={styles.totalToday}>
						Всего сегодня: {formatDurationSeconds(todayTotal)}
					</Text>
				) : null}

				<Pressable onPress={() => router.push('/focus-stats')}>
					<Text style={styles.link}>Статистика занятий →</Text>
				</Pressable>
			</ScrollView>
		</ScreenContainer>
	)
}

const styles = StyleSheet.create({
	content: {
		paddingBottom: 32,
	},
	label: {
		fontSize: 14,
		fontWeight: '600',
		color: '#64748B',
		marginTop: 12,
		marginBottom: 8,
	},
	chips: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		gap: 8,
	},
	chip: {
		paddingHorizontal: 12,
		paddingVertical: 8,
		borderRadius: 20,
		backgroundColor: '#F1F5F9',
		maxWidth: '100%',
	},
	chipActive: {
		backgroundColor: '#2563EB',
	},
	chipText: {
		color: '#334155',
		fontSize: 14,
	},
	chipTextActive: {
		color: '#FFFFFF',
	},
	notifyRow: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		paddingVertical: 14,
		marginTop: 8,
	},
	notifyLabel: {
		fontSize: 15,
		color: '#0F172A',
	},
	notifyValue: {
		fontSize: 15,
		color: '#64748B',
	},
	sectionTitle: {
		fontSize: 13,
		fontWeight: '700',
		color: '#64748B',
		textTransform: 'uppercase',
		marginTop: 24,
		marginBottom: 8,
	},
	historyRow: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		paddingVertical: 8,
		borderBottomWidth: 1,
		borderBottomColor: '#E2E8F0',
	},
	historyText: {
		fontSize: 15,
		color: '#0F172A',
		flex: 1,
	},
	deleteLink: {
		color: '#DC2626',
		fontSize: 14,
	},
	totalToday: {
		fontSize: 15,
		fontWeight: '600',
		color: '#0F172A',
		marginTop: 12,
	},
	empty: {
		color: '#94A3B8',
		fontSize: 14,
	},
	link: {
		color: '#2563EB',
		fontSize: 16,
		marginTop: 16,
		paddingVertical: 8,
	},
	timerContainer: {
		flex: 1,
		alignItems: 'center',
		justifyContent: 'center',
		padding: 24,
	},
	timerSubject: {
		fontSize: 18,
		color: '#64748B',
		marginBottom: 16,
	},
	timerDisplay: {
		fontSize: 64,
		fontWeight: '700',
		color: '#0F172A',
		fontVariant: ['tabular-nums'],
	},
	timerState: {
		fontSize: 16,
		color: '#64748B',
		marginTop: 8,
		marginBottom: 32,
	},
	timerActions: {
		width: '100%',
		gap: 12,
	},
	secondaryAction: {
		alignItems: 'center',
		paddingVertical: 12,
	},
	secondaryActionText: {
		color: '#64748B',
		fontSize: 16,
	},
})
