import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native'

interface TextFieldProps {
	label: string
	value: string
	onChangeText: (value: string) => void
	placeholder?: string
	error?: string
	keyboardType?: 'default' | 'numeric'
}

/** Simple labeled text input for forms. */
export function TextField({
	label,
	value,
	onChangeText,
	placeholder,
	error,
	keyboardType = 'default',
}: TextFieldProps) {
	return (
		<View style={styles.field}>
			<Text style={styles.label}>{label}</Text>
			<TextInput
				value={value}
				onChangeText={onChangeText}
				placeholder={placeholder}
				keyboardType={keyboardType}
				style={[styles.input, error ? styles.inputError : null]}
				placeholderTextColor="#94A3B8"
			/>
			{error ? <Text style={styles.error}>{error}</Text> : null}
		</View>
	)
}

interface PrimaryButtonProps {
	title: string
	onPress: () => void
	disabled?: boolean
}

export function PrimaryButton({ title, onPress, disabled }: PrimaryButtonProps) {
	return (
		<Pressable
			onPress={onPress}
			disabled={disabled}
			style={[styles.button, disabled && styles.buttonDisabled]}
		>
			<Text style={styles.buttonText}>{title}</Text>
		</Pressable>
	)
}

const styles = StyleSheet.create({
	field: {
		marginBottom: 14,
	},
	label: {
		fontSize: 14,
		fontWeight: '600',
		color: '#334155',
		marginBottom: 6,
	},
	input: {
		borderWidth: 1,
		borderColor: '#CBD5E1',
		borderRadius: 10,
		paddingHorizontal: 12,
		paddingVertical: 10,
		fontSize: 16,
		color: '#0F172A',
		backgroundColor: '#FFFFFF',
	},
	inputError: {
		borderColor: '#EF4444',
	},
	error: {
		marginTop: 4,
		fontSize: 13,
		color: '#EF4444',
	},
	button: {
		backgroundColor: '#2563EB',
		borderRadius: 10,
		paddingVertical: 14,
		alignItems: 'center',
	},
	buttonDisabled: {
		opacity: 0.5,
	},
	buttonText: {
		color: '#FFFFFF',
		fontSize: 16,
		fontWeight: '600',
	},
})
