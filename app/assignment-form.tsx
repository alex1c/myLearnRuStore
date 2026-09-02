import * as React from 'react'
import {
	Alert,
	Image,
	KeyboardAvoidingView,
	Modal,
	Platform,
	Pressable,
	ScrollView,
	StyleSheet,
	Text,
	View,
} from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { ScreenContainer } from '@/src/components/ScreenContainer'
import { PrimaryButton, TextField } from '@/src/components/ui/FormFields'
import { useAppData } from '@/src/context/AppDataContext'
import type { AssignmentPriority, AssignmentType, ReminderKind } from '@/src/types/domain'
import {
	addAssignmentPhoto,
	createAssignment,
	deleteAssignment,
	deleteAssignmentPhoto,
	updateAssignment,
} from '@/src/services/assignment.service'
import { getNotificationScheduler } from '@/src/services/notifications/expo-notification-scheduler'
import { findNextSubjectOccurrenceDate } from '@/src/services/next-lesson-deadline.service'
import {
	DATE_ONLY_REMINDER_PRESETS,
	TIMED_REMINDER_PRESETS,
} from '@/src/services/reminder.service'
import type { ReminderConfigInput } from '@/src/services/assignment-reminder-sync.service'
import {
	ASSIGNMENT_TYPE_OPTIONS,
	PRIORITY_OPTIONS,
} from '@/src/utils/assignment-labels'
import { getTomorrowLocalDate } from '@/src/services/deadline.service'
import { formatShortDate } from '@/src/utils/format'
import { ValidationError } from '@/src/utils/validation'
import { getAssignmentFocusSeconds } from '@/src/services/focus-session.service'
import { formatShareAssignment } from '@/src/services/share/share-formatters.service'
import { shareText } from '@/src/services/share/share.service'
import { formatAssignmentDueLabel } from '@/src/services/assignment-query.service'
import { formatDurationSeconds } from '@/src/utils/duration'
import type { AssignmentListItem } from '@/src/types/assignment'

/** Add/edit assignment form presented as a modal route. */
export default function AssignmentFormScreen() {
	const router = useRouter()
	const params = useLocalSearchParams<{
		id?: string
		subjectId?: string
		scheduleEntryId?: string
		occurrenceDate?: string
	}>()
	const { repositories, activePeriod, scheduleContext, refresh } = useAppData()

	const isEdit = Boolean(params.id)
	const tomorrow = getTomorrowLocalDate()

	const [subjectId, setSubjectId] = React.useState<string | null>(params.subjectId ?? null)
	const [title, setTitle] = React.useState('')
	const [dueDate, setDueDate] = React.useState(
		params.occurrenceDate ? tomorrow : tomorrow,
	)
	const [dueTime, setDueTime] = React.useState('')
	const [assignmentType, setAssignmentType] = React.useState<AssignmentType>('HOMEWORK')
	const [priority, setPriority] = React.useState<AssignmentPriority>('NORMAL')
	const [notes, setNotes] = React.useState('')
	const [showAdvanced, setShowAdvanced] = React.useState(false)
	const [reminderEnabled, setReminderEnabled] = React.useState(false)
	const [reminderKind, setReminderKind] = React.useState<ReminderKind>('NONE')
	const [relativeMinutes, setRelativeMinutes] = React.useState<number | null>(null)
	const [subjects, setSubjects] = React.useState<
		Awaited<ReturnType<NonNullable<typeof repositories>['subjects']['listByStudyPeriod']>>
	>([])
	const [photos, setPhotos] = React.useState<
		Awaited<ReturnType<NonNullable<typeof repositories>['assignmentPhotos']['listByAssignment']>>
	>([])
	const [errors, setErrors] = React.useState<Record<string, string>>({})
	const [isSaving, setIsSaving] = React.useState(false)
	const [previewUri, setPreviewUri] = React.useState<string | null>(null)
	const [permissionExplainerVisible, setPermissionExplainerVisible] = React.useState(false)
	const [pendingReminderConfig, setPendingReminderConfig] =
		React.useState<ReminderConfigInput | null>(null)
	const [focusSeconds, setFocusSeconds] = React.useState(0)
	const [loadedItem, setLoadedItem] = React.useState<AssignmentListItem | null>(null)

	React.useEffect(() => {
		if (!repositories || !activePeriod) {
			return
		}

		void repositories.subjects.listByStudyPeriod(activePeriod.id).then(setSubjects)

		if (params.scheduleEntryId && !params.id) {
			void repositories.schedule.getById(params.scheduleEntryId).then((entry) => {
				if (entry) {
					setSubjectId(entry.subjectId)
				}
			})
		}

		if (params.id) {
			void (async () => {
				const item = await repositories.assignments.getListItemById(params.id!)
				if (!item) {
					return
				}

				setSubjectId(item.subjectId)
				setLoadedItem(item)
				setTitle(item.title)
				setDueDate(item.dueDate)
				setDueTime(item.dueTime ?? '')
				setAssignmentType(item.assignmentType)
				setPriority(item.priority)
				setNotes(item.notes ?? '')
				setPhotos(await repositories.assignmentPhotos.listByAssignment(params.id!))

				const reminder = await repositories.assignmentReminders.getByAssignmentId(
					params.id!,
				)
				if (reminder?.enabled) {
					setReminderEnabled(true)
					setReminderKind(reminder.reminderKind)
					setRelativeMinutes(reminder.relativeMinutes)
				}

				const focusTotal = await getAssignmentFocusSeconds(repositories, params.id!)
				setFocusSeconds(focusTotal)
			})()
		}
	}, [repositories, activePeriod, params.id, params.scheduleEntryId])

	const nextLessonDate = React.useMemo(() => {
		if (!scheduleContext || !subjectId || !params.occurrenceDate) {
			return null
		}

		return findNextSubjectOccurrenceDate(
			subjectId,
			params.occurrenceDate,
			scheduleContext,
		)
	}, [scheduleContext, subjectId, params.occurrenceDate])

	function buildReminderConfig(): ReminderConfigInput | undefined {
		if (!reminderEnabled || reminderKind === 'NONE') {
			return { enabled: false, reminderKind: 'NONE' }
		}

		return {
			enabled: true,
			reminderKind,
			relativeMinutes,
			absoluteTime:
				reminderKind === 'MORNING_OF_DUE'
					? '09:00'
					: reminderKind === 'EVENING_BEFORE'
						? '18:00'
						: reminderKind === 'DAY_BEFORE'
							? '09:00'
							: null,
			absoluteDayOffset:
				reminderKind === 'EVENING_BEFORE' || reminderKind === 'DAY_BEFORE' ? -1 : 0,
		}
	}

	async function handleSave(reminderOverride?: ReminderConfigInput) {
		if (!repositories || !subjectId) {
			setErrors({ subjectId: 'Выберите предмет' })
			return
		}

		if (!title.trim()) {
			setErrors({ title: 'Введите задание' })
			return
		}

		const subject = subjects.find((item) => item.id === subjectId)
		if (!subject) {
			return
		}

		setIsSaving(true)
		setErrors({})

		try {
			const reminder = reminderOverride ?? buildReminderConfig()
			const payload = {
				subjectId,
				title: title.trim(),
				dueDate,
				dueTime: dueTime.trim() || null,
				assignmentType,
				priority,
				notes: notes.trim() || null,
				sourceScheduleEntryId: params.scheduleEntryId ?? null,
				sourceOccurrenceDate: params.occurrenceDate ?? null,
				reminder,
			}

			let warning: string | undefined
			if (isEdit && params.id) {
				const result = await updateAssignment(
					repositories,
					params.id,
					payload,
					subject.name,
				)
				warning = result.reminderWarning
			} else {
				const result = await createAssignment(
					repositories,
					payload,
					subject.name,
				)
				warning = result.reminderWarning
			}

			await refresh()
			if (warning) {
				Alert.alert('Напоминание', warning)
			}
			router.back()
		} catch (error) {
			const message =
				error instanceof ValidationError
					? error.message
					: error instanceof Error
						? error.message
						: 'Не удалось сохранить'
			setErrors({ form: message })
		} finally {
			setIsSaving(false)
		}
	}

	async function handleDelete() {
		if (!repositories || !params.id) {
			return
		}

		Alert.alert('Удалить задание?', undefined, [
			{ text: 'Отмена', style: 'cancel' },
			{
				text: 'Удалить',
				style: 'destructive',
				onPress: async () => {
					await deleteAssignment(repositories, params.id!)
					await refresh()
					router.back()
				},
			},
		])
	}

	async function handlePickPhoto(useCamera: boolean) {
		if (!repositories || !params.id) {
			Alert.alert('Сначала сохраните задание, затем добавьте фото.')
			return
		}

		const picker = useCamera
			? ImagePicker.launchCameraAsync
			: ImagePicker.launchImageLibraryAsync

		const result = await picker({
			mediaTypes: ['images'],
			quality: 0.85,
		})

		if (result.canceled || !result.assets[0]) {
			return
		}

		await addAssignmentPhoto(repositories, params.id, result.assets[0].uri)
		setPhotos(await repositories.assignmentPhotos.listByAssignment(params.id))
	}

	async function enableReminderWithPermission(kind: ReminderKind, minutes?: number) {
		const scheduler = getNotificationScheduler()
		const granted = await scheduler.requestPermissions()
		if (!granted) {
			setReminderEnabled(false)
			setReminderKind('NONE')
			return
		}

		setReminderEnabled(true)
		setReminderKind(kind)
		setRelativeMinutes(minutes ?? null)
	}

	function requestReminderPermission(kind: ReminderKind, minutes?: number) {
		setPermissionExplainerVisible(true)
		setPendingReminderConfig({
			enabled: true,
			reminderKind: kind,
			relativeMinutes: minutes ?? null,
		})
	}

	const hasDueTime = dueTime.trim().length > 0
	const reminderPresets = hasDueTime
		? TIMED_REMINDER_PRESETS
		: DATE_ONLY_REMINDER_PRESETS

	return (
		<ScreenContainer title={isEdit ? 'Задание' : 'Новое задание'}>
			<KeyboardAvoidingView
				style={styles.flex}
				behavior={Platform.OS === 'ios' ? 'padding' : undefined}
			>
				<ScrollView contentContainerStyle={styles.form}>
					<Text style={styles.sectionLabel}>Предмет *</Text>
					<View style={styles.chipRow}>
						{subjects
							.filter((item) => !item.isArchived)
							.map((item) => (
								<Pressable
									key={item.id}
									onPress={() => setSubjectId(item.id)}
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
										{item.shortName ?? item.name}
									</Text>
								</Pressable>
							))}
					</View>
					{errors.subjectId ? (
						<Text style={styles.error}>{errors.subjectId}</Text>
					) : null}

					<TextField
						label="Задание *"
						value={title}
						onChangeText={setTitle}
						placeholder="№315–320"
						error={errors.title}
					/>

					<TextField
						label="Срок *"
						value={dueDate}
						onChangeText={setDueDate}
						placeholder="YYYY-MM-DD"
					/>

					{nextLessonDate ? (
						<Pressable
							onPress={() => setDueDate(nextLessonDate)}
							style={styles.nextLessonChip}
						>
							<Text style={styles.nextLessonText}>
								К следующему занятию — {formatShortDate(nextLessonDate)}
							</Text>
						</Pressable>
					) : null}

					<Pressable
						onPress={() => setShowAdvanced((value) => !value)}
						style={styles.advancedToggle}
					>
						<Text style={styles.advancedLabel}>
							{showAdvanced ? '▼ Дополнительно' : '▶ Дополнительно'}
						</Text>
					</Pressable>

					{showAdvanced ? (
						<View>
							<Text style={styles.sectionLabel}>Тип</Text>
							<View style={styles.chipRow}>
								{ASSIGNMENT_TYPE_OPTIONS.map((option) => (
									<Pressable
										key={option.value}
										onPress={() => setAssignmentType(option.value)}
										style={[
											styles.chip,
											assignmentType === option.value && styles.chipActive,
										]}
									>
										<Text style={styles.chipText}>{option.label}</Text>
									</Pressable>
								))}
							</View>

							<TextField
								label="Время (необязательно)"
								value={dueTime}
								onChangeText={setDueTime}
								placeholder="HH:MM"
							/>

							<Text style={styles.sectionLabel}>Приоритет</Text>
							<View style={styles.chipRow}>
								{PRIORITY_OPTIONS.map((option) => (
									<Pressable
										key={option.value}
										onPress={() => setPriority(option.value)}
										style={[
											styles.chip,
											priority === option.value && styles.chipActive,
										]}
									>
										<Text style={styles.chipText}>{option.label}</Text>
									</Pressable>
								))}
							</View>

							<TextField
								label="Заметка"
								value={notes}
								onChangeText={setNotes}
								placeholder="Дополнительные детали"
							/>

							<Text style={styles.sectionLabel}>Напоминание</Text>
							<View style={styles.chipRow}>
								<Pressable
									onPress={() => {
										setReminderEnabled(false)
										setReminderKind('NONE')
									}}
									style={[styles.chip, !reminderEnabled && styles.chipActive]}
								>
									<Text style={styles.chipText}>Без напоминания</Text>
								</Pressable>
								{reminderPresets.map((preset) => (
									<Pressable
										key={preset.label}
										onPress={() => {
											if (!reminderEnabled) {
												requestReminderPermission(
													preset.kind,
													'minutes' in preset ? preset.minutes : undefined,
												)
												return
											}
											void enableReminderWithPermission(
												preset.kind,
												'minutes' in preset ? preset.minutes : undefined,
											)
										}}
										style={styles.chip}
									>
										<Text style={styles.chipText}>{preset.label}</Text>
									</Pressable>
								))}
							</View>

							{isEdit ? (
								<View style={styles.photoSection}>
									<Text style={styles.sectionLabel}>Фото задания</Text>
									<View style={styles.photoRow}>
										{photos.map((photo) => (
											<Pressable
												key={photo.id}
												onPress={() => setPreviewUri(photo.localUri)}
												onLongPress={() => {
													Alert.alert('Удалить фото?', undefined, [
														{ text: 'Отмена', style: 'cancel' },
														{
															text: 'Удалить',
															style: 'destructive',
															onPress: async () => {
																await deleteAssignmentPhoto(
																	repositories!,
																	photo.id,
																)
																setPhotos(
																	await repositories!.assignmentPhotos.listByAssignment(
																		params.id!,
																	),
																)
															},
														},
													])
												}}
											>
												<Image
													source={{ uri: photo.localUri }}
													style={styles.thumbnail}
												/>
											</Pressable>
										))}
										<Pressable
											style={styles.addPhoto}
											onPress={() => {
												Alert.alert('Добавить фото', undefined, [
													{
														text: 'Камера',
														onPress: () => void handlePickPhoto(true),
													},
													{
														text: 'Галерея',
														onPress: () => void handlePickPhoto(false),
													},
													{ text: 'Отмена', style: 'cancel' },
												])
											}}
										>
											<Text style={styles.addPhotoText}>+</Text>
										</Pressable>
									</View>
								</View>
							) : null}
						</View>
					) : null}

					{errors.form ? <Text style={styles.error}>{errors.form}</Text> : null}

					<PrimaryButton
						title="Сохранить"
						onPress={() => void handleSave()}
						disabled={isSaving}
					/>

					{isEdit &&
					subjectId &&
					['TEST', 'EXAM', 'LAB', 'PROJECT'].includes(assignmentType) ? (
						<Pressable
							onPress={() =>
								router.push(
									`/grade-form?subjectId=${subjectId}&assignmentId=${params.id}&date=${dueDate}&gradeType=${assignmentType}`,
								)
							}
							style={styles.addGradeButton}
						>
							<Text style={styles.addGradeText}>Добавить оценку</Text>
						</Pressable>
					) : null}

					{isEdit && focusSeconds > 0 ? (
						<Text style={styles.focusTime}>
							Потрачено времени: {formatDurationSeconds(focusSeconds)}
						</Text>
					) : null}

					{isEdit && subjectId ? (
						<Pressable
							onPress={() =>
								router.push(
									`/focus?subjectId=${subjectId}&assignmentId=${params.id}`,
								)
							}
							style={styles.secondaryAction}
						>
							<Text style={styles.secondaryActionText}>Начать фокус</Text>
						</Pressable>
					) : null}

					{isEdit && subjectId ? (
						<Pressable
							onPress={() => {
								const subjectName =
									subjects.find((item) => item.id === subjectId)?.name ?? 'Предмет'
								void shareText(
									formatShareAssignment({
										subjectName,
										title,
										dueLabel: loadedItem
											? formatAssignmentDueLabel(loadedItem)
											: formatShortDate(dueDate),
										notes,
									}),
								)
							}}
							style={styles.secondaryAction}
						>
							<Text style={styles.secondaryActionText}>Поделиться заданием</Text>
						</Pressable>
					) : null}

					{isEdit ? (
						<Pressable onPress={() => void handleDelete()} style={styles.deleteButton}>
							<Text style={styles.deleteText}>Удалить задание</Text>
						</Pressable>
					) : null}
				</ScrollView>
			</KeyboardAvoidingView>

			<Modal visible={previewUri !== null} transparent animationType="fade">
				<Pressable style={styles.previewBackdrop} onPress={() => setPreviewUri(null)}>
					{previewUri ? (
						<Image source={{ uri: previewUri }} style={styles.previewImage} />
					) : null}
				</Pressable>
			</Modal>

			<Modal visible={permissionExplainerVisible} transparent animationType="fade">
				<View style={styles.permissionModal}>
					<View style={styles.permissionCard}>
						<Text style={styles.permissionTitle}>Разрешить напоминания?</Text>
						<Text style={styles.permissionBody}>
							Моя учёба сможет напоминать о заданиях и контрольных.
						</Text>
						<View style={styles.permissionActions}>
							<Pressable
								onPress={() => {
									setPermissionExplainerVisible(false)
									setPendingReminderConfig(null)
								}}
							>
								<Text style={styles.permissionCancel}>Не сейчас</Text>
							</Pressable>
							<Pressable
								onPress={async () => {
									setPermissionExplainerVisible(false)
									if (pendingReminderConfig) {
										await enableReminderWithPermission(
											pendingReminderConfig.reminderKind,
											pendingReminderConfig.relativeMinutes ?? undefined,
										)
									}
									setPendingReminderConfig(null)
								}}
							>
								<Text style={styles.permissionAllow}>Разрешить</Text>
							</Pressable>
						</View>
					</View>
				</View>
			</Modal>
		</ScreenContainer>
	)
}

const styles = StyleSheet.create({
	flex: { flex: 1 },
	form: { paddingBottom: 32 },
	sectionLabel: {
		fontSize: 14,
		fontWeight: '600',
		color: '#334155',
		marginBottom: 8,
	},
	chipRow: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		gap: 8,
		marginBottom: 12,
	},
	chip: {
		paddingHorizontal: 12,
		paddingVertical: 8,
		borderRadius: 8,
		backgroundColor: '#F1F5F9',
		borderWidth: 1,
		borderColor: '#E2E8F0',
	},
	chipActive: {
		backgroundColor: '#2563EB',
		borderColor: '#2563EB',
	},
	chipText: {
		fontSize: 13,
		color: '#475569',
	},
	chipTextActive: {
		color: '#FFFFFF',
	},
	advancedToggle: {
		marginVertical: 8,
	},
	advancedLabel: {
		fontSize: 14,
		color: '#2563EB',
		fontWeight: '600',
	},
	nextLessonChip: {
		backgroundColor: '#EEF2FF',
		padding: 10,
		borderRadius: 8,
		marginBottom: 12,
	},
	nextLessonText: {
		color: '#4338CA',
		fontSize: 14,
		fontWeight: '500',
	},
	error: {
		color: '#EF4444',
		fontSize: 13,
		marginBottom: 8,
	},
	deleteButton: {
		marginTop: 16,
		alignItems: 'center',
		padding: 12,
	},
	addGradeButton: {
		marginTop: 12,
		alignItems: 'center',
		padding: 12,
		backgroundColor: '#EEF2FF',
		borderRadius: 10,
	},
	addGradeText: {
		color: '#4338CA',
		fontSize: 15,
		fontWeight: '600',
	},
	focusTime: {
		marginTop: 12,
		fontSize: 14,
		color: '#64748B',
	},
	secondaryAction: {
		marginTop: 8,
		alignItems: 'center',
		padding: 10,
	},
	secondaryActionText: {
		color: '#2563EB',
		fontSize: 15,
		fontWeight: '500',
	},
	deleteText: {
		color: '#DC2626',
		fontSize: 15,
	},
	photoSection: {
		marginTop: 8,
	},
	photoRow: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		gap: 8,
	},
	thumbnail: {
		width: 72,
		height: 72,
		borderRadius: 8,
	},
	addPhoto: {
		width: 72,
		height: 72,
		borderRadius: 8,
		borderWidth: 1,
		borderColor: '#CBD5E1',
		borderStyle: 'dashed',
		alignItems: 'center',
		justifyContent: 'center',
	},
	addPhotoText: {
		fontSize: 24,
		color: '#64748B',
	},
	previewBackdrop: {
		flex: 1,
		backgroundColor: 'rgba(0,0,0,0.9)',
		alignItems: 'center',
		justifyContent: 'center',
	},
	previewImage: {
		width: '90%',
		height: '70%',
		resizeMode: 'contain',
	},
	permissionModal: {
		flex: 1,
		backgroundColor: 'rgba(0,0,0,0.4)',
		justifyContent: 'center',
		padding: 24,
	},
	permissionCard: {
		backgroundColor: '#FFFFFF',
		borderRadius: 12,
		padding: 20,
	},
	permissionTitle: {
		fontSize: 18,
		fontWeight: '700',
		color: '#0F172A',
		marginBottom: 8,
	},
	permissionBody: {
		fontSize: 15,
		color: '#475569',
		lineHeight: 22,
		marginBottom: 16,
	},
	permissionActions: {
		flexDirection: 'row',
		justifyContent: 'flex-end',
		gap: 16,
	},
	permissionCancel: {
		color: '#64748B',
		fontSize: 15,
	},
	permissionAllow: {
		color: '#2563EB',
		fontSize: 15,
		fontWeight: '600',
	},
})
