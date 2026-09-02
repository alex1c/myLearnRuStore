import * as React from 'react'
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import * as DocumentPicker from 'expo-document-picker'
import { ScreenContainer } from '@/src/components/ScreenContainer'
import { PrimaryButton } from '@/src/components/ui/FormFields'
import { useAppData } from '@/src/context/AppDataContext'
import {
	importScheduleExport,
	parseScheduleExportJson,
	wasScheduleExportImported,
	type ScheduleExportPreview,
} from '@/src/services/schedule-export.service'

/** Preview and confirm schedule JSON import. */
export default function ScheduleImportScreen() {
	const router = useRouter()
	const { repositories, activePeriod, refresh } = useAppData()
	const [preview, setPreview] = React.useState<ScheduleExportPreview | null>(null)
	const [isImporting, setIsImporting] = React.useState(false)

	async function handlePickFile() {
		const result = await DocumentPicker.getDocumentAsync({
			type: 'application/json',
			copyToCacheDirectory: true,
		})

		if (result.canceled || !result.assets[0]) {
			return
		}

		try {
			const response = await fetch(result.assets[0].uri)
			const text = await response.text()
			setPreview(parseScheduleExportJson(text))
		} catch (error) {
			Alert.alert(
				'Ошибка',
				error instanceof Error ? error.message : 'Не удалось прочитать файл',
			)
		}
	}

	async function handleImport(force = false) {
		if (!repositories || !activePeriod || !preview) {
			return
		}

		const already = await wasScheduleExportImported(
			repositories,
			preview.document.exportId,
			activePeriod.id,
		)

		if (already && !force) {
			Alert.alert(
				'Уже импортировано',
				'Это расписание уже импортировалось. Импортировать ещё раз?',
				[
					{ text: 'Отмена', style: 'cancel' },
					{ text: 'Импортировать', onPress: () => void handleImport(true) },
				],
			)
			return
		}

		setIsImporting(true)
		try {
			const result = await importScheduleExport(
				repositories,
				preview.document,
				activePeriod.id,
			)
			await refresh()
			Alert.alert(
				'Готово',
				`Добавлено предметов: ${result.subjectsCreated}, занятий: ${result.entriesCreated}`,
				[{ text: 'OK', onPress: () => router.back() }],
			)
		} catch (error) {
			Alert.alert(
				'Ошибка импорта',
				error instanceof Error ? error.message : 'Не удалось импортировать',
			)
		} finally {
			setIsImporting(false)
		}
	}

	return (
		<ScreenContainer title="Импорт расписания">
			<ScrollView contentContainerStyle={styles.content}>
				{!preview ? (
					<>
						<Text style={styles.description}>
							Выберите JSON-файл, экспортированный из «Моя учёба».
						</Text>
						<PrimaryButton title="Выбрать файл" onPress={() => void handlePickFile()} />
					</>
				) : (
					<>
						<Text style={styles.sectionTitle}>Расписание</Text>
						<Text style={styles.value}>{preview.document.studyPeriodName}</Text>

						<View style={styles.statsRow}>
							<Text style={styles.stat}>Предметов: {preview.subjectCount}</Text>
							<Text style={styles.stat}>Занятий: {preview.entryCount}</Text>
							<Text style={styles.stat}>Преподавателей: {preview.teacherCount}</Text>
						</View>

						<PrimaryButton
							title={isImporting ? 'Импорт…' : 'Импортировать'}
							onPress={() => void handleImport()}
							disabled={isImporting}
						/>
						<PrimaryButton
							title="Выбрать другой файл"
							onPress={() => void handlePickFile()}
						/>
					</>
				)}
			</ScrollView>
		</ScreenContainer>
	)
}

const styles = StyleSheet.create({
	content: {
		paddingBottom: 32,
		gap: 12,
	},
	description: {
		fontSize: 15,
		color: '#64748B',
		marginBottom: 16,
		lineHeight: 22,
	},
	sectionTitle: {
		fontSize: 13,
		fontWeight: '700',
		color: '#64748B',
		textTransform: 'uppercase',
	},
	value: {
		fontSize: 20,
		fontWeight: '600',
		color: '#0F172A',
		marginBottom: 12,
	},
	statsRow: {
		gap: 6,
		marginBottom: 16,
	},
	stat: {
		fontSize: 15,
		color: '#334155',
	},
})
