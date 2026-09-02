import type { GradeScale } from '@/src/types/domain'
import { ValidationError } from '@/src/utils/validation'
import {
	getScaleMaximum,
	getScaleMinimum,
} from '@/src/services/grade-calculation.service'

/** Validate grade value is within scale bounds. */
export function validateGradeForScale(value: number, scale: GradeScale): number {
	if (!Number.isFinite(value)) {
		throw new ValidationError('Оценка должна быть числом')
	}

	const min = getScaleMinimum(scale)
	const max = getScaleMaximum(scale)

	if (value < min || value > max) {
		throw new ValidationError(`Оценка должна быть от ${min} до ${max}`)
	}

	return value
}

/** Validate target grade for scale. */
export function validateTargetForScale(value: number, scale: GradeScale): number {
	if (!Number.isFinite(value)) {
		throw new ValidationError('Цель должна быть числом')
	}

	const min = getScaleMinimum(scale)
	const max = getScaleMaximum(scale)

	if (value < min || value > max) {
		throw new ValidationError(`Цель должна быть от ${min} до ${max}`)
	}

	return value
}

/** Validate attendance target percentage. */
export function validateAttendanceTarget(value: number): number {
	if (!Number.isFinite(value) || value <= 0 || value > 100) {
		throw new ValidationError('Цель посещаемости должна быть от 1 до 100')
	}

	return value
}

export const GRADE_TYPE_OPTIONS: { value: string; label: string }[] = [
	{ value: 'HOMEWORK', label: 'Домашняя работа' },
	{ value: 'ANSWER', label: 'Ответ' },
	{ value: 'TEST', label: 'Контрольная' },
	{ value: 'INDEPENDENT', label: 'Самостоятельная' },
	{ value: 'LAB', label: 'Лабораторная' },
	{ value: 'PROJECT', label: 'Проект' },
	{ value: 'EXAM', label: 'Экзамен' },
	{ value: 'OTHER', label: 'Другое' },
]

export const GRADE_SCALE_OPTIONS: { value: GradeScale; label: string }[] = [
	{ value: 'FIVE_POINT', label: '5-балльная (2–5)' },
	{ value: 'TEN_POINT', label: '10-балльная (1–10)' },
	{ value: 'HUNDRED_POINT', label: '100-балльная (0–100)' },
]

export function getGradeTypeLabel(type: string | null): string {
	if (!type) {
		return ''
	}

	return GRADE_TYPE_OPTIONS.find((item) => item.value === type)?.label ?? type
}
