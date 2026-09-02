import * as React from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { ScreenContainer } from '@/src/components/ScreenContainer'
import { PrimaryButton } from '@/src/components/ui/FormFields'
import { useAppData } from '@/src/context/AppDataContext'
import type { AttendanceStatus } from '@/src/types/domain'
import { getTodayLocalDate } from '@/src/utils/dates'

const STATUS_OPTIONS: { value: AttendanceStatus; label: string }[] = [
	{ value: 'PRESENT', label: 'Был' },
	{ value: 'ABSENT', label: 'Пропустил' },
	{ value: 'EXCUSED', label: 'Уважительная' },
]

/** Mark attendance for a lesson occurrence or manually. */
export default function AttendanceFormScreen() {
	const router = useRouter()
	const params = useLocalSearchParams<{
		subjectId?: string
		scheduleEntryId?: string
		date?: string
	}>()
	const { repositories, refresh } = useAppData()

	const [status, setStatus] = React.useState<AttendanceStatus>('PRESENT')
	const [isSaving, setIsSaving] = React.useState(false)
	const date = params.date ?? getTodayLocalDate()

	async function handleSave() {
		if (!repositories || !params.subjectId) {
			return
		}

		setIsSaving(true)
		try {
			await repositories.attendance.upsert({
				subjectId: params.subjectId,
				attendanceDate: date,
				status,
				scheduleEntryId: params.scheduleEntryId ?? null,
			})
			await refresh()
			router.back()
		} finally {
			setIsSaving(false)
		}
	}

	return (
		<ScreenContainer title="Посещаемость">
			<ScrollView contentContainerStyle={styles.form}>
				<Text style={styles.date}>{date}</Text>
				<Text style={styles.label}>Статус</Text>
				<View style={styles.options}>
					{STATUS_OPTIONS.map((option) => (
						<Pressable
							key={option.value}
							onPress={() => setStatus(option.value)}
							style={[styles.option, status === option.value && styles.optionActive]}
						>
							<Text
								style={[
									styles.optionText,
									status === option.value && styles.optionTextActive,
								]}
							>
								{option.label}
							</Text>
						</Pressable>
					))}
				</View>
				<PrimaryButton
					title="Сохранить"
					onPress={() => void handleSave()}
					disabled={isSaving}
				/>
			</ScrollView>
		</ScreenContainer>
	)
}

const styles = StyleSheet.create({
	form: { paddingBottom: 32 },
	date: { fontSize: 16, fontWeight: '600', marginBottom: 16, color: '#0F172A' },
	label: { fontSize: 14, fontWeight: '600', color: '#334155', marginBottom: 8 },
	options: { gap: 8, marginBottom: 20 },
	option: {
		padding: 14,
		borderRadius: 10,
		backgroundColor: '#F1F5F9',
		borderWidth: 1,
		borderColor: '#E2E8F0',
	},
	optionActive: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
	optionText: { fontSize: 16, color: '#0F172A', textAlign: 'center' },
	optionTextActive: { color: '#FFFFFF', fontWeight: '600' },
})
