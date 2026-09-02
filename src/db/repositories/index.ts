import type { DatabaseConnection } from '@/src/db/types'
import { AppSettingsRepository } from '@/src/db/repositories/app-settings.repository'
import { AssignmentRepository } from '@/src/db/repositories/assignment.repository'
import { HolidayRepository } from '@/src/db/repositories/holiday.repository'
import { ScheduleExceptionRepository } from '@/src/db/repositories/schedule-exception.repository'
import { ScheduleRepository } from '@/src/db/repositories/schedule.repository'
import { StudyPeriodRepository } from '@/src/db/repositories/study-period.repository'
import { SubjectRepository } from '@/src/db/repositories/subject.repository'
import { TeacherRepository } from '@/src/db/repositories/teacher.repository'

/** Factory for repository instances bound to one DB connection. */
export function createRepositories(db: DatabaseConnection) {
	return {
		appSettings: new AppSettingsRepository(db),
		studyPeriods: new StudyPeriodRepository(db),
		subjects: new SubjectRepository(db),
		teachers: new TeacherRepository(db),
		schedule: new ScheduleRepository(db),
		scheduleExceptions: new ScheduleExceptionRepository(db),
		holidays: new HolidayRepository(db),
		assignments: new AssignmentRepository(db),
	}
}

export type Repositories = ReturnType<typeof createRepositories>
