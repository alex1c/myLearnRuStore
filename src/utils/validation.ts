import type { LocalDate, ClockTime } from '@/src/types/domain'
import {
	isValidLocalDate,
	compareLocalDates,
} from '@/src/utils/dates'
import { isValidClockTime, isStartBeforeEnd } from '@/src/utils/time'

export class ValidationError extends Error {
	constructor(message: string) {
		super(message)
		this.name = 'ValidationError'
	}
}

/** Assert a non-empty trimmed subject name. */
export function validateSubjectName(name: string): string {
	const trimmed = name.trim()
	if (!trimmed) {
		throw new ValidationError('Subject name is required')
	}

	return trimmed
}

/** Validate a local date string or throw. */
export function validateLocalDate(value: string, fieldName: string): LocalDate {
	if (!isValidLocalDate(value)) {
		throw new ValidationError(`${fieldName} must be a valid YYYY-MM-DD date`)
	}

	return value
}

/** Validate optional local date. */
export function validateOptionalLocalDate(
	value: string | null | undefined,
	fieldName: string,
): LocalDate | null {
	if (value === null || value === undefined || value === '') {
		return null
	}

	return validateLocalDate(value, fieldName)
}

/** Validate HH:MM or throw. */
export function validateClockTime(value: string, fieldName: string): ClockTime {
	if (!isValidClockTime(value)) {
		throw new ValidationError(`${fieldName} must be a valid HH:MM time`)
	}

	return value
}

/** Validate optional clock time. */
export function validateOptionalClockTime(
	value: string | null | undefined,
	fieldName: string,
): ClockTime | null {
	if (value === null || value === undefined || value === '') {
		return null
	}

	return validateClockTime(value, fieldName)
}

/** Ensure study period start is on or before end. */
export function validateStudyPeriodRange(startDate: LocalDate, endDate: LocalDate): void {
	validateLocalDate(startDate, 'startDate')
	validateLocalDate(endDate, 'endDate')

	if (compareLocalDates(startDate, endDate) > 0) {
		throw new ValidationError('Study period start must be on or before end date')
	}
}

/** Ensure schedule start time is before end time. */
export function validateTimeRange(startTime: ClockTime, endTime: ClockTime): void {
	validateClockTime(startTime, 'startTime')
	validateClockTime(endTime, 'endTime')

	if (!isStartBeforeEnd(startTime, endTime)) {
		throw new ValidationError('Start time must be before end time')
	}
}

/** Validate numeric grade payload. */
export function validateGradeValue(value: number): number {
	if (!Number.isFinite(value)) {
		throw new ValidationError('Grade value must be a finite number')
	}

	return value
}

/** Validate positive grade weight. */
export function validateGradeWeight(weight: number): number {
	if (!Number.isFinite(weight) || weight <= 0) {
		throw new ValidationError('Grade weight must be a positive number')
	}

	return weight
}

/** Validate week cycle settings. */
export function validateCycleSettings(
	cycleLength: number,
	anchorDate: string | null,
): { cycleLength: 1 | 2; anchorDate: LocalDate | null } {
	if (cycleLength !== 1 && cycleLength !== 2) {
		throw new ValidationError('Cycle length must be 1 or 2')
	}

	if (cycleLength === 2 && !anchorDate) {
		throw new ValidationError('Cycle anchor date is required for two-week mode')
	}

	if (anchorDate) {
		validateLocalDate(anchorDate, 'cycleAnchorDate')
	}

	return {
		cycleLength: cycleLength as 1 | 2,
		anchorDate: anchorDate as LocalDate | null,
	}
}
