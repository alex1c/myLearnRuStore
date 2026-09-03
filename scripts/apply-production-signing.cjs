const fs = require('node:fs')
const path = require('node:path')

/**
 * Apply production signing logic to generated android/app/build.gradle.
 *
 * This script is intentionally deterministic and idempotent:
 * - safe to run multiple times;
 * - never writes secret values;
 * - only injects references to external properties/env vars.
 */
function applyProductionSigning() {
	const buildGradlePath = path.join(
		process.cwd(),
		'android',
		'app',
		'build.gradle',
	)

	if (!fs.existsSync(buildGradlePath)) {
		throw new Error(`Missing file: ${buildGradlePath}`)
	}

	let gradle = fs.readFileSync(buildGradlePath, 'utf8')

	if (!gradle.includes('def getExternalSecret(String name)')) {
		gradle = gradle.replace(
			"def jscFlavor = 'io.github.react-native-community:jsc-android:2026004.+'",
			`def jscFlavor = 'io.github.react-native-community:jsc-android:2026004.+'

/**
 * Resolve sensitive signing values from external sources only.
 * Priority:
 * 1) Gradle property (e.g. ~/.gradle/gradle.properties or -P)
 * 2) Environment variable
 */
def getExternalSecret(String name) {
    def fromGradle = findProperty(name)
    if (fromGradle != null && fromGradle.toString().trim()) {
        return fromGradle.toString().trim()
    }

    def fromEnv = System.getenv(name)
    if (fromEnv != null && fromEnv.toString().trim()) {
        return fromEnv.toString().trim()
    }

    return null
}`,
		)
	}

	gradle = gradle.replace(
		/signingConfigs\s*\{\s*debug\s*\{\s*storeFile file\('debug\.keystore'\)\s*storePassword 'android'\s*keyAlias 'androiddebugkey'\s*keyPassword 'android'\s*\}\s*\}/m,
		`signingConfigs {
        debug {
            storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
        release {
            def storeFilePath = getExternalSecret('MYLEARN_STORE_FILE')
            def storePass = getExternalSecret('MYLEARN_STORE_PASSWORD')
            def keyAliasName = getExternalSecret('MYLEARN_KEY_ALIAS')
            def keyPass = getExternalSecret('MYLEARN_KEY_PASSWORD')

            if (storeFilePath != null && storePass != null && keyAliasName != null && keyPass != null) {
                storeFile file(storeFilePath)
                storePassword storePass
                keyAlias keyAliasName
                keyPassword keyPass
            }
        }
    }`,
	)

	gradle = gradle.replace(
		/release\s*\{\s*\/\/ Caution! In production, you need to generate your own keystore file\.\s*\/\/ see https:\/\/reactnative\.dev\/docs\/signed-apk-android\.\s*signingConfig signingConfigs\.debug/m,
		`release {
            if (
                getExternalSecret('MYLEARN_STORE_FILE') != null &&
                getExternalSecret('MYLEARN_STORE_PASSWORD') != null &&
                getExternalSecret('MYLEARN_KEY_ALIAS') != null &&
                getExternalSecret('MYLEARN_KEY_PASSWORD') != null
            ) {
                signingConfig signingConfigs.release
            } else {
                throw new GradleException(
                    'Missing external production signing secrets. ' +
                    'Set MYLEARN_STORE_FILE, MYLEARN_STORE_PASSWORD, MYLEARN_KEY_ALIAS, MYLEARN_KEY_PASSWORD.',
                )
            }`,
	)

	fs.writeFileSync(buildGradlePath, gradle, 'utf8')
}

applyProductionSigning()
