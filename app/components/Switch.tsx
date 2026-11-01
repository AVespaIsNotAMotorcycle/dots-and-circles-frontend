import styles from './switch.module.css';

// A row of joined buttons choosing one of options, each [value, text]
export default function Switch<T extends string>({
	label,
	options,
	value,
	onChange,
}: {
	// What's being chosen, for screen readers
	label: string;
	options: [T, string][];
	value: T;
	onChange: (value: T) => void;
}) {
	return (
		<div className={styles.switch} role="group" aria-label={label}>
			{options.map(([option, text]) => (
				<button
					key={option}
					type="button"
					aria-pressed={value === option}
					className={value === option ? styles.selected : undefined}
					onClick={() => { onChange(option); }}
				>
					{text}
				</button>
			))}
		</div>
	);
}
