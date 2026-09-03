const { withAppBuildGradle } = require('expo/config-plugins')

/**
 * Inject production signing logic into generated android/app/build.gradle.
 *
 * Why this exists:
 * - `android/` is generated and ignored in this repository.
 * - We still need a reproducible release signing setup for `expo prebuild --clean`.
 * - Secrets must stay outside git-tracked files.
 *
 * External values expected at build time (Gradle property or environment variable):
 * - MYLEARN_STORE_FILE
 * - MYLEARN_STORE_PASSWORD
 * - MYLEARN_KEY_ALIAS
 * - MYLEARN_KEY_PASSWORD
 */
module.exports = function withProductionSigning(config) {
	return withAppBuildGradle(config, (configWithGradle) => {
		if (configWithGradle.modResults.language !== 'groovy') {
			return configWithGradle
		}

		const contents = configWithGradle.modResults.contents
		const marker = "def jscFlavor = 'io.github.react-native-community:jsc-android:2026004.+'"
		const helper = `
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
}
`

		let next = contents

		if (!next.includes('def getExternalSecret(String name)')) {
			next = next.replace(marker, `${marker}\n${helper}`)
		}

		if (
			next.includes('signingConfig signingConfigs.debug') &&
			!next.includes('Missing external production signing secrets')
		) {
			next = next.replace(
				`    signingConfigs {
        debug {
            storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
    }`,
				`    signingConfigs {
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

			next = next.replace(
				`        release {
            // Caution! In production, you need to generate your own keystore file.
            // see https://reactnative.dev/docs/signed-apk-android.
            signingConfig signingConfigs.debug`,
				`        release {
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
		}

		configWithGradle.modResults.contents = next
		return configWithGradle
	})
}
