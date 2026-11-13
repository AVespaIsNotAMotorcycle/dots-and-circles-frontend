import type { Metadata } from 'next';

import styles from './about.module.css';

export const metadata: Metadata = {
	title: 'About',
	description: 'Who made Dots and Circles, how to send feedback, and the data, dictionaries and fonts it uses.',
	alternates: { canonical: '/about' },
};

const EMAIL = 'sasha.m.ebersole@gmail.com';
const GITHUB = 'https://github.com/AVespaIsNotAMotorcycle/dots-and-circles';

// Who made the site, how to get in touch, and what it's built on: the
// backend README's Resources Used, with what each is used for
export default function AboutPage() {
	return (
		<main className={styles.about}>
			<h1>About</h1>
			<p>
				{'Dots and Circles is a personal project by '}
				<a href="https://sasha-m-ebersole.com/">Sasha Madden Ebersole</a>
				{' for automatically transcribing scans of Manchu documents. Its reading model is a sequence of 12 transformers with linear layers at each end, trained on rendered fonts and photographed words of print. The code, and how the model scores on test sets, are '}
				<a href={GITHUB}>on GitHub</a>
				.
				{'Nothing you upload or input is saved anywhere but in your browser.'}
			</p>

			<section aria-labelledby="feedback">
				<h2 id="feedback">Feedback</h2>
				<p>
					Feedback is welcome, and wanted, especially for missing features
					for this site. I am aware of the model's poor performance on
					handwritten text, and am working on a platform for crowdsourcing
					a publicly available dataset of labelled handwritten words.
					For anything else that would improve this tool, please write to
					{' '}
					<a href={`mailto:${EMAIL}`}>{EMAIL}</a>
					.
				</p>
			</section>

			<section aria-labelledby="resources">
				<h2 id="resources">Resources used</h2>

				<h3>Training data</h3>
				<p className={styles.note}>
					Also the dictionaries the closest words to a reading are taken from.
				</p>
				<ul>
					<li>
						<a href="https://kaikki.org/dictionary/Manchu/index.html">
							Tatu Ylonen: Wiktextract: Wiktionary as Machine-Readable Structured
							Data, Proceedings of the 13th Conference on Language Resources and
							Evaluation (LREC), pp. 1317-1325, Marseille, 20-25 June 2022.
						</a>
						{' Wiktionary\'s content is available under the '}
						<a href="https://creativecommons.org/licenses/by-sa/4.0/">
							Creative Commons Attribution-ShareAlike licence
						</a>
						.
					</li>
					<li>
						<a href="https://github.com/purobaburi/manchu-resources/blob/main/Dictionaries/Jerry_Norman_Dict.txt">
							The Jerry Norman dictionary
						</a>
					</li>
					<li>
						<a href="https://www.scidb.cn/en/detail?dataSetId=b45491b63d694534a9323acf14846586">
							Haipeng SUN, Wenhao TAO, Xiaojun BI. A dataset of Manchu ancient book
							words for OCR[J]. China Scientific Data, 2026, 11(1): 1-11. DOI:
							10.11922/11-6035.csd.2025.0069.zh.
						</a>
					</li>
				</ul>

				<h3>Fonts</h3>
				<p className={styles.note}>
					Used to render training words, and to show Manchu on this site.
				</p>
				<ul>
					<li>
						<a href="https://www.manchustudiesgroup.org/typing-manchu/">
							A set of 11 from Manchu Studies Group
						</a>
					</li>
					<li>
						<a href="https://abkai.net/zh/manchu/manchu-fonts/">
							Abkai Xanyan from abkai.net
						</a>
					</li>
				</ul>

				<h3>Sample pages</h3>
				<p>Each sample page is credited, with a link to its source, where it&apos;s shown.</p>
			</section>
		</main>
	);
}
