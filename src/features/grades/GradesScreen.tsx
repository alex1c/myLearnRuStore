import * as React from 'react'
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native'
import { useRouter } from 'expo-router'
import { EmptyState } from '@/src/components/EmptyState'
import { SubjectPerformanceCard } from '@/src/components/SubjectPerformanceCard'
import { ScreenContainer } from '@/src/components/ScreenContainer'
import { useAppData } from '@/src/context/AppDataContext'
import { loadSubjectPerformanceSummaries } from '@/src/services/performance-data.service'
import { AdBanner } from '@/src/components/AdBanner'
import { YANDEX_BANNER_PERFORMANCE_ID } from '@/src/config/ads'

/** Performance tab — subject list with averages and targets. */
export function GradesScreen() {
	const router = useRouter()
	const { repositories, activePeriod, refreshKey } = useAppData()
	const [summaries, setSummaries] = React.useState<
		Awaited<ReturnType<typeof loadSubjectPerformanceSummaries>>
	>([])

	React.useEffect(() => {
		if (!repositories || !activePeriod) {
			return
		}

		let mounted = true
		void loadSubjectPerformanceSummaries(repositories, activePeriod.id).then((result) => {
			if (mounted) {
				setSummaries(result)
			}
		})
		return () => {
			mounted = false
		}
	}, [repositories, activePeriod, refreshKey])

	const hasAnyGrades = summaries.some((item) => item.gradeCount > 0)

	return (
		<ScreenContainer title="Успеваемость">
			<ScrollView
				showsVerticalScrollIndicator={false}
				contentContainerStyle={styles.scroll}
			>
				{summaries.length === 0 ? (
					<EmptyState
						title="Добавьте предметы"
						description="Сначала настройте предметы в расписании."
					/>
				) : !hasAnyGrades ? (
					<EmptyState
						title="Оценок пока нет"
						description="Добавляйте оценки, чтобы видеть средний балл и прогноз."
						actionLabel="Добавить оценку"
						onActionPress={() => router.push('/grade-form')}
					/>
				) : (
					summaries.map((summary) => (
						<SubjectPerformanceCard
							key={summary.subject.id}
							summary={summary}
							onPress={() =>
								router.push(`/subject-performance?id=${summary.subject.id}`)
							}
						/>
					))
				)}
				<AdBanner adUnitId={YANDEX_BANNER_PERFORMANCE_ID} style={styles.adBanner} />
			</ScrollView>

			<Pressable
				style={styles.fab}
				onPress={() => router.push('/grade-form')}
				accessibilityRole="button"
				accessibilityLabel="Добавить оценку"
			>
				<Text style={styles.fabText}>+</Text>
			</Pressable>
		</ScreenContainer>
	)
}

const styles = StyleSheet.create({
	scroll: { paddingBottom: 96 },
	adBanner: { marginTop: 16 },
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
	fabText: {
		color: '#FFFFFF',
		fontSize: 28,
		lineHeight: 30,
	},
})
