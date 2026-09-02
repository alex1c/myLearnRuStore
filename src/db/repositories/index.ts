import type { DatabaseConnection } from '@/src/db/types'
import { AppSettingsRepository } from '@/src/db/repositories/app-settings.repository'
import { AttendanceRepository } from '@/src/db/repositories/attendance.repository'
import { GradeRepository } from '@/src/db/repositories/grade.repository'
import { AssignmentRepository } from '@/src/db/repositories/assignment.repository'
import { AssignmentPhotoRepository } from '@/src/db/repositories/assignment-photo.repository'
import { AssignmentReminderRepository } from '@/src/db/repositories/assignment-reminder.repository'
import { HolidayRepository } from '@/src/db/repositories/holiday.repository'
import { ScheduleExceptionRepository } from '@/src/db/repositories/schedule-exception.repository'
import { ScheduleRepository } from '@/src/db/repositories/schedule.repository'
import { StudyPeriodRepository } from '@/src/db/repositories/study-period.repository'
import { SubjectRepository } from '@/src/db/repositories/subject.repository'
import { TeacherRepository } from '@/src/db/repositories/teacher.repository'
import { FocusSessionRepository } from '@/src/db/repositories/focus-session.repository'
import { ActiveFocusRepository } from '@/src/db/repositories/active-focus.repository'
import { ScheduleImportRepository } from '@/src/db/repositories/schedule-import.repository'

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
		assignmentPhotos: new AssignmentPhotoRepository(db),
		assignmentReminders: new AssignmentReminderRepository(db),
		grades: new GradeRepository(db),
		attendance: new AttendanceRepository(db),
		focusSessions: new FocusSessionRepository(db),
		activeFocus: new ActiveFocusRepository(db),
		scheduleImports: new ScheduleImportRepository(db),
		runInTransaction: (task: () => Promise<void>) => db.withTransactionAsync(task),
	}
}

export type Repositories = ReturnType<typeof createRepositories>
