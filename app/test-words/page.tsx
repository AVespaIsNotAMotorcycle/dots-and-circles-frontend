import type { Metadata } from 'next';

import TestWords from '../components/TestWords';

export const metadata: Metadata = {
	title: 'Test words',
	description: 'Every test word, real and synthetic, with the model\'s reading of it.',
};

export default function TestWordsPage() {
	return (
		<main>
			<h1>Test words</h1>
			<TestWords />
		</main>
	);
}
