import * as React from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { ScreenContainer } from '@/src/components/ScreenContainer'
import { useAppData } from '@/src/context/AppDataContext'

/** Read-only subjects list for Phase 2 settings. */
export default function SubjectsScreen() {
	const { repositories, activePeriod, refreshKey } = useAppData()
	const [subjects, setSubjects] = React.useState<
		Awaited<ReturnType<NonNullable<typeof repositories>['subjects']['listByStudyPeriod']>>
	>([])

	React.useEffect(() => {
		if (!repositories || !activePeriod) {
			return
		}

		void repositories.subjects.listByStudyPeriod(activePeriod.id).then(setSubjects)
	}, [repositories, activePeriod, refreshKey])

	return (
		<ScreenContainer title="Предметы">
			<ScrollView>
				{subjects.map((subject) => (
					<View key={subject.id} style={styles.row}>
						<View
							style={[styles.dot, { backgroundColor: subject.color ?? '#94A3B8' }]}
						/>
						<View style={styles.info}>
							<Text style={styles.name}>{subject.name}</Text>
							{subject.shortName ? (
								<Text style={styles.meta}>{subject.shortName}</Text>
							) : null}
						</View>
					</View>
				))}
			</ScrollView>
		</ScreenContainer>
	)
}

const styles = StyleSheet.create({
	row: {
		flexDirection: 'row',
		alignItems: 'center',
		paddingVertical: 12,
		borderBottomWidth: 1,
		borderBottomColor: '#E2E8F0',
	},
	dot: {
		width: 10,
		height: 10,
		borderRadius: 5,
		marginRight: 12,
	},
	info: {
		flex: 1,
	},
	name: {
		fontSize: 16,
		color: '#0F172A',
	},
	meta: {
		fontSize: 13,
		color: '#64748B',
	},
})
