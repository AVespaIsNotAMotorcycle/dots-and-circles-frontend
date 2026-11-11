import axios from 'axios';
import { useState, useEffect } from 'react';

const BACKEND = process.env.NEXT_PUBLIC_BACKEND;

// False until the backend answers GET /awake. Its dyno sleeps, so the first
// request after a while can take some seconds.
export default function useBackendAwake() {
	const [awake, setAwake] = useState(false);

	useEffect(() => {
		axios.get(`${BACKEND}/awake`)
			.then(() => { setAwake(true); });
	}, []);

	return awake;
}
