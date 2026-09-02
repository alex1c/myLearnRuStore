import * as React from 'react'
import {
	Alert,
	KeyboardAvoidingView,
	Platform,
	Pressable,
	ScrollView,
	StyleSheet,
	Text,
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { ScreenContainer } from '@/src/components/ScreenContainer'
import { PrimaryButton, TextField } from '@/src/components/ui/FormFields'
import { useAppData } from '@/src/context/AppDataContext'
import { buildOccurrenceId, getScheduleForDate } from '@/src/services/occurrence.service'

/** Exception editor for a single lesson occurrence on a specific date. */
export default function LessonExceptionScreen() {
	const router = useRouter()
	const params = useLocalSearchParams<{
		entryId: string
		date: string
	}>()
	const { repositories, activePeriod, refresh, scheduleContext } = useAppData()

	const occurrence = React.useMemo(() => {
		if (!scheduleContext || !params.entryId || !params.date) {
			return null
		}

		return getScheduleForDate(params.date, scheduleContext).find(
			(item) => item.id === buildOccurrenceId(params.entryId, params.date),
		) ?? null
	}, [scheduleContext, params.entryId, params.date])

	const [startTime, setStartTime] = React.useState(occurrence?.startTime ?? '09:00')
	const [endTime, setEndTime] = React.useState(occurrence?.endTime ?? '09:45')
	const [teacherName, setTeacherName] = React.useState(occurrence?.teacherName ?? '')
	const [room, setRoom] = React.useState(occurrence?.room ?? '')
	const [isSaving, setIsSaving] = React.useState(false)

	const formKey = `${params.entryId ?? ''}:${params.date ?? ''}:${occurrence?.startTime ?? ''}`

	async function resolveTeacherId(): Promise<string | null> {
		if (!repositories || !teacherName.trim()) {
			return null
		}

		const teachers = await repositories.teachers.list()
		const existing = teachers.find(
			(item) => item.name.toLowerCase() === teacherName.trim().toLowerCase(),
		)
		if (existing) {
			return existing.id
		}

		const created = await repositories.teachers.create({ name: teacherName.trim() })
		return created.id
	}

	async function handleOverride() {
		if (!repositories || !activePeriod || !params.entryId || !params.date) {
			return
		}

		setIsSaving(true)
		try {
			const teacherId = await resolveTeacherId()
			await repositories.scheduleExceptions.overrideOccurrence({
				studyPeriodId: activePeriod.id,
				scheduleEntryId: params.entryId,
				exceptionDate: params.date,
				startTime,
				endTime,
				teacherId,
				room: room.trim() || null,
			})
			await refresh()
			router.back()
		} catch (error) {
			Alert.alert('Ошибка', error instanceof Error ? error.message : 'Не удалось сохранить')
		} finally {
			setIsSaving(false)
		}
	}

	async function handleCancel() {
		if (!repositories || !activePeriod || !params.entryId || !params.date) {
			return
		}

		Alert.alert('Отменить занятие на этот день?', '', [
			{ text: 'Нет', style: 'cancel' },
			{
				text: 'Отменить',
				style: 'destructive',
				onPress: () => {
					void (async () => {
						await repositories.scheduleExceptions.cancelOccurrence({
							studyPeriodId: activePeriod.id,
							scheduleEntryId: params.entryId,
							exceptionDate: params.date,
						})
						await refresh()
						router.back()
					})()
				},
			},
		])
	}

	return (
		<ScreenContainer title="Изменить только этот день">
			<KeyboardAvoidingView
				style={styles.flex}
				behavior={Platform.OS === 'ios' ? 'padding' : undefined}
			>
				<ScrollView key={formKey} contentContainerStyle={styles.content}>
					<Text style={styles.hint}>Регулярное расписание не изменится.</Text>
					<TextField label="Начало" value={startTime} onChangeText={setStartTime} />
					<TextField label="Конец" value={endTime} onChangeText={setEndTime} />
					<TextField label="Преподаватель" value={teacherName} onChangeText={setTeacherName} />
					<TextField label="Кабинет" value={room} onChangeText={setRoom} />
					<PrimaryButton title="Сохранить изменения" onPress={() => void handleOverride()} disabled={isSaving} />
					<Pressable onPress={() => void handleCancel()} style={styles.cancelButton}>
						<Text style={styles.cancelText}>Отменить занятие</Text>
					</Pressable>
				</ScrollView>
			</KeyboardAvoidingView>
		</ScreenContainer>
	)
}

const styles = StyleSheet.create({
	flex: { flex: 1 },
	content: { paddingBottom: 32 },
	hint: {
		fontSize: 14,
		color: '#64748B',
		marginBottom: 16,
	},
	cancelButton: {
		marginTop: 16,
		alignItems: 'center',
	},
	cancelText: {
		color: '#EF4444',
		fontSize: 15,
		fontWeight: '600',
	},
})
