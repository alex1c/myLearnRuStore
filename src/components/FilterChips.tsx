import { Pressable, ScrollView, StyleSheet, Text } from 'react-native'
import type { AssignmentFilter } from '@/src/types/assignment'

const FILTERS: { key: AssignmentFilter; label: string }[] = [
	{ key: 'upcoming', label: 'Ближайшие' },
	{ key: 'today', label: 'Сегодня' },
	{ key: 'tomorrow', label: 'Завтра' },
	{ key: 'overdue', label: 'Просрочено' },
	{ key: 'all', label: 'Все' },
]

interface FilterChipsProps {
	selected: AssignmentFilter
	onSelect: (filter: AssignmentFilter) => void
}

/** Horizontal filter chips for assignments tab. */
export function FilterChips({ selected, onSelect }: FilterChipsProps) {
	return (
		<ScrollView
			horizontal
			showsHorizontalScrollIndicator={false}
			contentContainerStyle={styles.row}
		>
			{FILTERS.map((filter) => {
				const isActive = filter.key === selected
				return (
					<Pressable
						key={filter.key}
						onPress={() => onSelect(filter.key)}
						style={[styles.chip, isActive && styles.chipActive]}
					>
						<Text style={[styles.chipText, isActive && styles.chipTextActive]}>
							{filter.label}
						</Text>
					</Pressable>
				)
			})}
		</ScrollView>
	)
}

const styles = StyleSheet.create({
	row: {
		gap: 6,
		paddingBottom: 12,
		// Keep trailing peek intentional so «Просрочено» is not mid-cut.
		paddingRight: 28,
	},
	chip: {
		paddingHorizontal: 12,
		paddingVertical: 8,
		borderRadius: 20,
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
		fontWeight: '500',
	},
	chipTextActive: {
		color: '#FFFFFF',
	},
})
