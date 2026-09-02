import { strToU8, zipSync } from 'fflate'
import { parseBackupArchive } from '@/src/services/backup/backup.service'
import { BACKUP_KIND, BACKUP_VERSION } from '@/src/services/backup/backup.types'

function buildMinimalBackupZip(): Uint8Array {
	const manifest = {
		kind: BACKUP_KIND,
		version: BACKUP_VERSION,
		exportedAt: '2026-09-02T10:00:00.000Z',
		appVersion: '1.0.0',
		counts: {
			studyPeriods: 1,
			subjects: 1,
			scheduleEntries: 0,
			assignments: 0,
			grades: 0,
			photos: 0,
			focusSessions: 0,
		},
	}

	const data = {
		appSettings: [{ id: 's1' }],
		studyPeriods: [{ id: 'p1' }],
		teachers: [],
		subjects: [{ id: 'sub1', study_period_id: 'p1' }],
		scheduleEntries: [],
		scheduleExceptions: [],
		assignments: [],
		assignmentPhotos: [],
		assignmentReminders: [],
		grades: [],
		attendance: [],
		focusSessions: [],
		holidays: [],
		scheduleImportHistory: [],
	}

	return zipSync({
		'manifest.json': strToU8(JSON.stringify(manifest)),
		'data.json': strToU8(JSON.stringify(data)),
	})
}

describe('backup.service validation', () => {
	it('parses valid backup archive', () => {
		const parsed = parseBackupArchive(buildMinimalBackupZip())
		expect(parsed.manifest.kind).toBe(BACKUP_KIND)
		expect(parsed.data.subjects).toHaveLength(1)
	})

	it('rejects unsupported version', () => {
		const bad = zipSync({
			'manifest.json': strToU8(JSON.stringify({ kind: BACKUP_KIND, version: 99 })),
			'data.json': strToU8('{}'),
		})

		expect(() => parseBackupArchive(bad)).toThrow('Unsupported backup version')
	})

	it('rejects path traversal in zip', () => {
		const bad = zipSync({
			'../evil.json': strToU8('{}'),
			'manifest.json': strToU8('{}'),
			'data.json': strToU8('{}'),
		})

		expect(() => parseBackupArchive(bad)).toThrow('Unsafe path in backup archive')
	})

	it('rejects broken subject reference', () => {
		const manifest = {
			kind: BACKUP_KIND,
			version: BACKUP_VERSION,
			exportedAt: '2026-09-02',
			appVersion: '1.0.0',
			counts: {},
		}

		const data = {
			appSettings: [],
			studyPeriods: [],
			teachers: [],
			subjects: [{ id: 'sub1', study_period_id: 'missing' }],
			scheduleEntries: [],
			scheduleExceptions: [],
			assignments: [],
			assignmentPhotos: [],
			assignmentReminders: [],
			grades: [],
			attendance: [],
			focusSessions: [],
			holidays: [],
			scheduleImportHistory: [],
		}

		const bad = zipSync({
			'manifest.json': strToU8(JSON.stringify(manifest)),
			'data.json': strToU8(JSON.stringify(data)),
		})

		expect(() => parseBackupArchive(bad)).toThrow('Backup subject references unknown study period')
	})
})
