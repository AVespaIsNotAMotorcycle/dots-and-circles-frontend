import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';

import styles from './zoomframe.module.css';

// The zoom levels the buttons step through; Ctrl or ⌘ and the scroll wheel
// (or a trackpad's pinch) goes anywhere between the first and last
const LEVELS = [1, 1.5, 2, 3, 4, 6];
const MIN = LEVELS[0];
const MAX = LEVELS[LEVELS.length - 1];
const clamp = (zoom: number) => Math.min(Math.max(zoom, MIN), MAX);

// A page image that can be zoomed in, then panned by scrolling within a
// frame. children gets the style for the element to zoom: as wide as the
// image (width pixels) or the frame, whichever is less, times the zoom.
// Zooming keeps the point under the pointer (or the middle of the frame,
// for the buttons) where it was.
export default function ZoomFrame({ width, children }: {
	width: number;
	children: (style: CSSProperties) => ReactNode;
}) {
	const [zoom, setZoom] = useState(1);
	// The zoom asked for last, which wheel events quicker than a render
	// build on
	const latest = useRef(1);
	const frame = useRef<HTMLDivElement>(null);
	// The point to keep still through a zoom: where it is in the frame, and
	// how far across and down the zoomed element it was
	const anchor = useRef<{ x: number; y: number; across: number; down: number }>(undefined);

	const zoomTo = (next: number, at?: { x: number; y: number }) => {
		const element = frame.current;
		const content = element?.firstElementChild;
		const target = clamp(next);
		if (!element || !content || target === latest.current) return;
		// Only the first of several zooms before a render sets the point,
		// while the content is still the size it's measured at
		if (!anchor.current) {
			const box = element.getBoundingClientRect();
			const size = content.getBoundingClientRect();
			const x = at ? at.x - box.left : element.clientWidth / 2;
			const y = at ? at.y - box.top : element.clientHeight / 2;
			anchor.current = {
				x,
				y,
				across: (element.scrollLeft + x) / size.width,
				down: (element.scrollTop + y) / size.height,
			};
		}
		latest.current = target;
		setZoom(target);
	};

	useLayoutEffect(() => {
		const element = frame.current;
		const content = element?.firstElementChild;
		if (!element || !content || !anchor.current) return;
		const { x, y, across, down } = anchor.current;
		const size = content.getBoundingClientRect();
		element.scrollLeft = across * size.width - x;
		element.scrollTop = down * size.height - y;
		anchor.current = undefined;
	}, [zoom]);

	// Ctrl or ⌘ and the wheel zooms, rather than the browser zooming the
	// whole page. A listener that isn't passive, so it can stop that.
	const wheel = useRef<(event: WheelEvent) => void>(undefined);
	useEffect(() => {
		wheel.current = (event) => {
			if (!event.ctrlKey && !event.metaKey) return;
			event.preventDefault();
			zoomTo(latest.current * Math.exp(-event.deltaY * 0.0025),
				{ x: event.clientX, y: event.clientY });
		};
	});
	useEffect(() => {
		const element = frame.current;
		if (!element) return;
		const onWheel = (event: WheelEvent) => { wheel.current?.(event); };
		element.addEventListener('wheel', onWheel, { passive: false });
		return () => { element.removeEventListener('wheel', onWheel); };
	}, []);

	const step = (direction: 1 | -1) => {
		const now = latest.current;
		const next = direction > 0
			? LEVELS.find((level) => level > now + 0.01) ?? MAX
			: [...LEVELS].reverse().find((level) => level < now - 0.01) ?? MIN;
		zoomTo(next);
	};

	return (
		<div className={styles.zoom}>
			<div className={styles.controls} role="group" aria-label="Zoom">
				<button type="button" aria-label="Zoom out" disabled={zoom <= MIN} onClick={() => { step(-1); }}>
					−
				</button>
				<button
					type="button"
					className={styles.level}
					aria-label={zoom > MIN ? `Zoomed to ${Math.round(zoom * 100)}%: fit to the frame` : 'Fitted to the frame'}
					disabled={zoom <= MIN}
					onClick={() => { zoomTo(MIN); }}
				>
					{zoom > MIN ? `${Math.round(zoom * 100)}%` : 'Fit'}
				</button>
				<button type="button" aria-label="Zoom in" disabled={zoom >= MAX} onClick={() => { step(1); }}>
					+
				</button>
				<span className={styles.hint}>Ctrl + scroll to zoom</span>
			</div>
			<div
				ref={frame}
				className={[styles.frame, zoom > MIN && styles.zoomed].filter(Boolean).join(' ')}
			>
				{children({
					width: `calc(min(${width}px, 100%) * ${zoom})`,
					maxWidth: 'none',
				})}
			</div>
		</div>
	);
}
