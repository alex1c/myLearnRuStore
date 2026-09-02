import { Pressable, ScrollView, StyleSheet, Text } from 'react-native'
import type { LocalDate, Weekday } from '@/src/types/domain'
import { addDays, getTodayLocalDate, getWeekday } from '@/src/utils/dates'

const DAY_LABELS: { weekday: Weekday; label: string }[] = [
	{ weekday: 1, label: 'Пн' },
	{ weekday: 2, label: 'Вт' },
	{ weekday: 3, label: 'Ср' },
	{ weekday: 4, label: 'Чт' },
	{ weekday: 5, label: 'Пт' },
	{ weekday: 6, label: 'Сб' },
	{ weekday: 7, label: 'Вс' },
]

interface DaySelectorProps {
	weekStart: LocalDate
	selectedDate: LocalDate
	onSelectDate: (date: LocalDate) => void
}

/** Horizontal weekday selector for the schedule screen. */
export function DaySelector({ weekStart, selectedDate, onSelectDate }: DaySelectorProps) {
	const today = getTodayLocalDate()

	return (
		<ScrollView
			horizontal
			showsHorizontalScrollIndicator={false}
			contentContainerStyle={styles.row}
		>
			{DAY_LABELS.map((day, index) => {
				const date = addDays(weekStart, index)
				const isSelected = date === selectedDate
				const isToday = date === today

				return (
					<Pressable
						key={day.weekday}
						onPress={() => onSelectDate(date)}
						style={[
							styles.chip,
							isSelected && styles.chipSelected,
							isToday && !isSelected && styles.chipToday,
						]}
					>
						<Text style={[styles.label, isSelected && styles.labelSelected]}>
							{day.label}
						</Text>
						<Text style={[styles.dateNum, isSelected && styles.labelSelected]}>
							{date.slice(-2).replace(/^0/, '')}
						</Text>
					</Pressable>
				)
			})}
		</ScrollView>
	)
}

/** Get date for a weekday within a week starting at weekStart. */
export function getDateForWeekday(weekStart: LocalDate, weekday: Weekday): LocalDate {
	const startWeekday = getWeekday(weekStart)
	const offset = (weekday - startWeekday + 7) % 7
	return addDays(weekStart, offset)
}

const styles = StyleSheet.create({
	row: {
		gap: 8,
		paddingVertical: 4,
	},
	chip: {
		minWidth: 44,
		alignItems: 'center',
		paddingVertical: 8,
		paddingHorizontal: 10,
		borderRadius: 10,
		backgroundColor: '#F1F5F9',
	},
	chipSelected: {
		backgroundColor: '#2563EB',
	},
	chipToday: {
		borderWidth: 1,
		borderColor: '#2563EB',
	},
	label: {
		fontSize: 12,
		color: '#64748B',
		fontWeight: '600',
	},
	dateNum: {
		fontSize: 14,
		color: '#0F172A',
		fontWeight: '700',
		marginTop: 2,
	},
	labelSelected: {
		color: '#FFFFFF',
	},
})
