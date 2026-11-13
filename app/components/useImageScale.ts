import { useEffect, useState } from 'react';
import type { RefObject } from 'react';

// The image's pixels per screen pixel in an svg drawn in them, width pixels
// wide but shrunk to fit the page, for marks that stay one size on screen.
// 1 until the svg is shown.
export default function useImageScale(svg: RefObject<SVGSVGElement | null>,
	width: number | undefined) {
	const [scale, setScale] = useState(1);
	useEffect(() => {
		const element = svg.current;
		if (!element || !width) return;
		const observer = new ResizeObserver(() => {
			const shown = element.getBoundingClientRect().width;
			if (shown) setScale(width / shown);
		});
		observer.observe(element);
		return () => { observer.disconnect(); };
	}, [svg, width]);
	return scale;
}
