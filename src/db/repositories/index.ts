import type { DatabaseConnection } from '@/src/db/types'
import { AppSettingsRepository } from '@/src/db/repositories/app-settings.repository'
import { AssignmentRepository } from '@/src/db/repositories/assignment.repository'
import { ScheduleRepository } from '@/src/db/repositories/schedule.repository'
import { StudyPeriodRepository } from '@/src/db/repositories/study-period.repository'
import { SubjectRepository } from '@/src/db/repositories/subject.repository'

/** Factory for repository instances bound to one DB connection. */
export function createRepositories(db: DatabaseConnection) {
	return {
		appSettings: new AppSettingsRepository(db),
		studyPeriods: new StudyPeriodRepository(db),
		subjects: new SubjectRepository(db),
		schedule: new ScheduleRepository(db),
		assignments: new AssignmentRepository(db),
	}
}

export type Repositories = ReturnType<typeof createRepositories>
