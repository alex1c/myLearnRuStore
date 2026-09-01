import { ScreenContainer } from '@/src/components/ScreenContainer'
import { EmptyState } from '@/src/components/EmptyState'

/** Grades tab foundation placeholder for Phase 4. */
export function GradesScreen() {
	return (
		<ScreenContainer title="Успеваемость">
			<EmptyState
				title="Оценки пока не добавлены"
				description="Здесь будут средний балл, вес оценок и цель по предмету."
			/>
		</ScreenContainer>
	)
}
