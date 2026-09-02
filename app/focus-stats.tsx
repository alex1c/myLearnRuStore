import * as React from 'react'
import {
	Pressable,
	ScrollView,
	StyleSheet,
	Text,
	View,
} from 'react-native'
import { useRouter } from 'expo-router'
import { WeeklyActivityChart } from '@/src/components/FocusCharts'
import { ScreenContainer } from '@/src/components/ScreenContainer'
import { useAppData } from '@/src/context/AppDataContext'
import { loadFocusStats } from '@/src/services/focus-session.service'
import type { FocusStatsPeriod } from '@/src/services/focus-stats.service'
import { formatShareFocusStats } from '@/src/services/share/share-formatters.service'
import { shareText } from '@/src/services/share/share.service'
import { formatDurationSeconds } from '@/src/utils/duration'
import { AdBanner } from '@/src/components/AdBanner'
import { YANDEX_BANNER_FOCUS_ID } from '@/src/config/ads'

const PERIODS: { id: FocusStatsPeriod; label: string }[] = [
	{ id: 'today', label: 'Сегодня' },
	{ id: '7d', label: '7 дней' },
	{ id: '30d', label: '30 дней' },
	{ id: 'all', label: 'Всё' },
]

/** Study time statistics by subject and period. */
export default function FocusStatsScreen() {
	const router = useRouter()
	const { repositories, activePeriod, refreshKey } = useAppData()
	const [period, setPeriod] = React.useState<FocusStatsPeriod>('7d')
	const [stats, setStats] = React.useState<
		Awaited<ReturnType<typeof loadFocusStats>> | null
	>(null)

	React.useEffect(() => {
		if (!repositories || !activePeriod) {
			return
		}

		let mounted = true
		void loadFocusStats(repositories, activePeriod.id, period).then((result) => {
			if (mounted) {
				setStats(result)
			}
		})

		return () => {
			mounted = false
		}
	}, [repositories, activePeriod, period, refreshKey])

	const periodLabel = PERIODS.find((item) => item.id === period)?.label ?? period

	return (
		<ScreenContainer title="Статистика занятий">
			<ScrollView contentContainerStyle={styles.content}>
				<View style={styles.chips}>
					{PERIODS.map((item) => (
						<Pressable
							key={item.id}
							onPress={() => setPeriod(item.id)}
							style={[styles.chip, period === item.id && styles.chipActive]}
						>
							<Text
								style={[
									styles.chipText,
									period === item.id && styles.chipTextActive,
								]}
							>
								{item.label}
							</Text>
						</Pressable>
					))}
				</View>

				{stats ? (
					<>
						<View style={styles.summaryCard}>
							<Text style={styles.summaryLabel}>Всего занятий</Text>
							<Text style={styles.summaryValue}>
								{formatDurationSeconds(stats.totalSeconds)}
							</Text>
							<Text style={styles.summaryMeta}>
								Сессий: {stats.sessionCount} · Средняя:{' '}
								{formatDurationSeconds(stats.averageSeconds)}
							</Text>
						</View>

						{stats.dailyActivity.length > 0 ? (
							<>
								<Text style={styles.sectionTitle}>Активность</Text>
								<WeeklyActivityChart days={stats.dailyActivity} />
							</>
						) : null}

						<Text style={styles.sectionTitle}>По предметам</Text>
						{stats.bySubject.length === 0 ? (
							<Text style={styles.empty}>Нет данных за период</Text>
						) : (
							stats.bySubject.map((item) => (
								<Pressable
									key={item.subjectId}
									onPress={() =>
										router.push(`/focus-stats?subjectId=${item.subjectId}`)
									}
									style={styles.subjectRow}
								>
									<Text style={styles.subjectName}>{item.subjectName}</Text>
									<Text style={styles.subjectTime}>
										{formatDurationSeconds(item.totalSeconds)}
									</Text>
								</Pressable>
							))
						)}

						<Pressable
							onPress={() => {
								void shareText(
									formatShareFocusStats(periodLabel, stats),
									'Статистика учёбы',
								)
							}}
							style={styles.shareButton}
						>
							<Text style={styles.shareButtonText}>Поделиться статистикой</Text>
						</Pressable>
					</>
				) : (
					<Text style={styles.empty}>Загрузка…</Text>
				)}
				<AdBanner adUnitId={YANDEX_BANNER_FOCUS_ID} style={styles.adBanner} />
			</ScrollView>
		</ScreenContainer>
	)
}

const styles = StyleSheet.create({
	content: {
		paddingBottom: 32,
	},
	chips: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		gap: 8,
		marginBottom: 16,
	},
	chip: {
		paddingHorizontal: 12,
		paddingVertical: 8,
		borderRadius: 20,
		backgroundColor: '#F1F5F9',
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
	summaryCard: {
		backgroundColor: '#F8FAFC',
		borderRadius: 12,
		padding: 16,
		marginBottom: 16,
	},
	summaryLabel: {
		fontSize: 13,
		color: '#64748B',
	},
	summaryValue: {
		fontSize: 28,
		fontWeight: '700',
		color: '#0F172A',
		marginTop: 4,
	},
	summaryMeta: {
		fontSize: 14,
		color: '#64748B',
		marginTop: 8,
	},
	sectionTitle: {
		fontSize: 13,
		fontWeight: '700',
		color: '#64748B',
		textTransform: 'uppercase',
		marginTop: 16,
		marginBottom: 8,
	},
	subjectRow: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		paddingVertical: 12,
		borderBottomWidth: 1,
		borderBottomColor: '#E2E8F0',
	},
	subjectName: {
		fontSize: 16,
		color: '#0F172A',
		flex: 1,
	},
	subjectTime: {
		fontSize: 16,
		color: '#334155',
		fontWeight: '500',
	},
	empty: {
		color: '#94A3B8',
		fontSize: 14,
	},
	shareButton: {
		marginTop: 24,
		paddingVertical: 12,
	},
	shareButtonText: {
		color: '#2563EB',
		fontSize: 16,
		textAlign: 'center',
	},
	adBanner: {
		marginTop: 24,
	},
})
