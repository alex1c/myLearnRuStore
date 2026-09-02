import type { AssignmentType, AssignmentPriority } from '@/src/types/domain'

/** Russian labels for assignment types shown in UI. */
export const ASSIGNMENT_TYPE_LABELS: Record<AssignmentType, string> = {
	HOMEWORK: 'Домашнее задание',
	PROJECT: 'Проект',
	ESSAY: 'Реферат / эссе',
	LAB: 'Лабораторная',
	TEST: 'Контрольная',
	EXAM: 'Экзамен',
	OTHER: 'Другое',
}

/** Short badge labels for non-homework types. */
export const ASSIGNMENT_TYPE_BADGE: Record<AssignmentType, string> = {
	HOMEWORK: 'ДЗ',
	PROJECT: 'Проект',
	ESSAY: 'Эссе',
	LAB: 'Лаб.',
	TEST: 'Контрольная',
	EXAM: 'Экзамен',
	OTHER: 'Другое',
}

export const ASSIGNMENT_TYPE_OPTIONS: { value: AssignmentType; label: string }[] = [
	{ value: 'HOMEWORK', label: ASSIGNMENT_TYPE_LABELS.HOMEWORK },
	{ value: 'TEST', label: ASSIGNMENT_TYPE_LABELS.TEST },
	{ value: 'EXAM', label: ASSIGNMENT_TYPE_LABELS.EXAM },
	{ value: 'LAB', label: ASSIGNMENT_TYPE_LABELS.LAB },
	{ value: 'PROJECT', label: ASSIGNMENT_TYPE_LABELS.PROJECT },
	{ value: 'ESSAY', label: ASSIGNMENT_TYPE_LABELS.ESSAY },
	{ value: 'OTHER', label: ASSIGNMENT_TYPE_LABELS.OTHER },
]

export const PRIORITY_LABELS: Record<AssignmentPriority, string> = {
	LOW: 'Обычный',
	NORMAL: 'Обычный',
	HIGH: 'Важное',
}

export const PRIORITY_OPTIONS: { value: AssignmentPriority; label: string }[] = [
	{ value: 'NORMAL', label: 'Обычный' },
	{ value: 'HIGH', label: 'Важное' },
]

/** Whether type should show a badge in list cards. */
export function shouldShowTypeBadge(type: AssignmentType): boolean {
	return type !== 'HOMEWORK'
}

/** Whether type is a test/exam for Today «Скоро» section. */
export function isTestOrExam(type: AssignmentType): boolean {
	return type === 'TEST' || type === 'EXAM'
}
