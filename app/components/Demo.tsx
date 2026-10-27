'use client'

import axios from 'axios';
import { useState } from 'react';

const BACKEND = process.env.NEXT_PUBLIC_BACKEND

function PredictionPanel({
	name = "NAME MISSING",
	model = "MODEL DETAILS MISSING",
	abkai = "ABKAI MISSING",
	manchu = "MANCHU MISSING",
	ctc = [],
	probs = [],
	score = 0,
}) {
	const scoreColorBrackets = [
		[1, 'green'],
		[0.9, 'yellow'],
		[0.7, 'orange'],
		[0, 'red'],
	];
	const scorePercentString = score
		.toLocaleString(undefined,{style: 'percent', minimumFractionDigits:2});
	const scoreColor = scoreColorBrackets.find(([threshold, color]) => {
		if (score >= threshold) return true;
		return false;
	})[1];

	const formatProb = (prob) => prob
		.toLocaleString(undefined, {
			minimumFractionDigits: 2,
			maximumFractionDigits: 2,
		});

	return (
		<section className="card">
			<details>
				<summary>
					<h4>{name}</h4>
				</summary>
				<p className="model">{model}</p>
			</details>
			<div>
				<div className="left">
					<p className="manchu">{manchu}</p>
					<p className="abkai">{abkai}</p>
					<div className={`score ${scoreColor}`}>
						<p>{`Score: ${scorePercentString}`}</p>
					</div>
				</div>
				<table className="ctc">
					<tbody>
						{ctc.map((token, index) => (
							<tr key={index}>
								<td className="token">{token}</td>
								<td className="prob">
									{formatProb(probs[index])}
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</section>
	);
}

export default function Demo({ backendAwake = false }) {
	const [lexigraph, setLexigraph] = useState();
	const [label, setLabel] = useState();
	const [results, setResults] = useState([]);

	const load = () => {
		axios.get(`${BACKEND}/random`)
			.then(({ data }) => {
				console.log(data);
				setLexigraph(data.image);
				setLabel(data.label);
				setResults(data.results);
			});
	};

	return (
		<section className="demo">
			<h2>Demo</h2>
			<div>
				<button
					disabled={!backendAwake}
					onClick={load}
				>
					Load Random Word
				</button>
				<section>
					<h3>Lexigraph</h3>
					<figure>
						<img className="lexigraph" src={lexigraph} />
						<figcaption>{label}</figcaption>
					</figure>
				</section>
			</div>
			<section>
				<h3>Model Predictions</h3>
				<div className="predictionCards">
					{results.map((result) => (
						<PredictionPanel
							key={result.model}
							name={result.name}
							model={result.model}
							abkai={result['prediction-abkai']}
							manchu={result['prediction-manchu']}
							ctc={result.ctc}
							probs={result.probs}
							score={result.score}
						/>
					))}
				</div>
			</section>
		</section>
	);
}
