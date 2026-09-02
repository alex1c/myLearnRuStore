import * as React from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { ScreenContainer } from '@/src/components/ScreenContainer'
import { useAppData } from '@/src/context/AppDataContext'

/** Read-only teachers list for Phase 2 settings. */
export default function TeachersScreen() {
	const { repositories, refreshKey } = useAppData()
	const [teachers, setTeachers] = React.useState<
		Awaited<ReturnType<NonNullable<typeof repositories>['teachers']['list']>>
	>([])

	React.useEffect(() => {
		if (!repositories) {
			return
		}

		void repositories.teachers.list().then(setTeachers)
	}, [repositories, refreshKey])

	return (
		<ScreenContainer title="Преподаватели">
			<ScrollView>
				{teachers.length === 0 ? (
					<Text style={styles.empty}>Преподаватели появятся при добавлении занятий.</Text>
				) : (
					teachers.map((teacher) => (
						<View key={teacher.id} style={styles.row}>
							<Text style={styles.name}>{teacher.name}</Text>
						</View>
					))
				)}
			</ScrollView>
		</ScreenContainer>
	)
}

const styles = StyleSheet.create({
	row: {
		paddingVertical: 12,
		borderBottomWidth: 1,
		borderBottomColor: '#E2E8F0',
	},
	name: {
		fontSize: 16,
		color: '#0F172A',
	},
	empty: {
		fontSize: 14,
		color: '#64748B',
		marginTop: 8,
	},
})
