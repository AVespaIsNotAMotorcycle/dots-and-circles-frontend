import { useRef, useState } from 'react';

import type { EditedBox, Page } from './types';
import styles from './boxeditor.module.css';
import useImageScale from './useImageScale';
import ZoomFrame from './ZoomFrame';

// The tallest a box can be drawn or resized to, as a multiple of its width
export const MAX_ASPECT = 8;
// The smallest box that can be drawn, in the image's pixels. A drag smaller
// than this is taken as a click.
const MIN_SIZE = 4;
// Handles' size and how far from a box's edge it can be grabbed, in screen
// pixels
const HANDLE = 10;
// The magnifier shown while a box is drawn or resized, in screen pixels:
// the most room the page takes in it, the least width (for its caption),
// its gap from the box, and the height of its caption and frame
const LOUPE_MAX = { w: 240, h: 320 };
const LOUPE_MIN_W = 120;
const LOUPE_GAP = 16;
const LOUPE_EXTRA_H = 32;
// How many screen pixels it shows a pixel of the page as, at most, so a
// tiny box isn't blown up into a blur
const LOUPE_MAX_ZOOM = 12;

// A box being edited: where it is, its kind, and the reading the server
// gave it, kept only while the user hasn't changed it
type Box = {
	x: number;
	y: number;
	w: number;
	h: number;
	kind: 'manchu' | 'other';
	reading?: { manchu: string; abkai: string | null; confidence: number };
	// How the reading compared with the expected text, as the page showed it,
	// for a Manchu box that keeps its reading
	status?: BoxStatus;
};

// A Manchu box's colour on the page: read right or wrong by the expected
// text, nothing to compare it with, or read with low confidence
export type BoxStatus = 'right' | 'wrong' | 'unchecked' | 'lowConfidence';

// The edges a drag moves: all four for a move, or one or two for a resize
type Edges = { left?: boolean; right?: boolean; top?: boolean; bottom?: boolean };
const MOVE: Edges = { left: true, right: true, top: true, bottom: true };

// The handles on a selected box, each moving the edges it's on
const HANDLES: { edges: Edges; cursor: string }[] = [
	{ edges: { left: true, top: true }, cursor: 'nwse-resize' },
	{ edges: { top: true }, cursor: 'ns-resize' },
	{ edges: { right: true, top: true }, cursor: 'nesw-resize' },
	{ edges: { right: true }, cursor: 'ew-resize' },
	{ edges: { right: true, bottom: true }, cursor: 'nwse-resize' },
	{ edges: { bottom: true }, cursor: 'ns-resize' },
	{ edges: { left: true, bottom: true }, cursor: 'nesw-resize' },
	{ edges: { left: true }, cursor: 'ew-resize' },
];

// Where a box's edges are: its corner or the middle of its side, if only
// one edge is dragged
const edgePoint = (box: { x: number; y: number; w: number; h: number }, edges: Edges) => ({
	x: edges.left ? box.x : edges.right ? box.x + box.w : box.x + box.w / 2,
	y: edges.top ? box.y : edges.bottom ? box.y + box.h : box.y + box.h / 2,
});

// An enlarged view of the whole box being drawn or resized, with a margin
// of the page around it, beside the box on the side away from the edge
// being dragged (so it doesn't hide where the edge is going), or below or
// above it if there's no room. It shows the other boxes faintly, the edges
// being dragged thicker, and the box's size.
function Loupe({ image, size, boxes, box, edges, scale }: {
	image: string;
	size: { w: number; h: number };
	boxes: Box[];
	// The box being drawn or resized, and the edges being dragged
	box: Box;
	edges: Edges;
	// The image's pixels per screen pixel
	scale: number;
}) {
	// The part of the page shown, in its pixels: the box and a margin
	const margin = Math.max(6, 0.15 * Math.max(box.w, box.h));
	const cx = box.x + box.w / 2;
	const cy = box.y + box.h / 2;
	// Screen pixels per pixel of the page, to fit that in the room there is
	const zoom = Math.min(LOUPE_MAX.w / (box.w + 2 * margin),
		LOUPE_MAX.h / (box.h + 2 * margin), LOUPE_MAX_ZOOM);
	const width = Math.max((box.w + 2 * margin) * zoom, LOUPE_MIN_W);
	const height = (box.h + 2 * margin) * zoom;
	// Widened for the caption, it shows more of the page either side
	const view = { x: cx - width / zoom / 2, y: cy - height / zoom / 2,
		w: width / zoom, h: height / zoom };

	// Where it goes, in screen pixels from the page's top left corner
	const shown = { w: size.w / scale, h: size.h / scale };
	const outer = { w: width + 12, h: height + LOUPE_EXTRA_H };
	const boxLeft = box.x / scale;
	const boxRight = (box.x + box.w) / scale;
	const toLeft = boxLeft - LOUPE_GAP - outer.w;
	const toRight = boxRight + LOUPE_GAP;
	const sides = edges.right ? [toLeft, toRight] : [toRight, toLeft];
	const side = sides.find((left) => left >= 0 && left + outer.w <= shown.w);
	const clamp = (value: number, max: number) => Math.max(0, Math.min(value, max));
	let left: number;
	let top: number;
	if (side !== undefined) {
		left = side;
		top = clamp(cy / scale - outer.h / 2, shown.h - outer.h);
	} else {
		left = clamp(cx / scale - outer.w / 2, shown.w - outer.w);
		const below = (box.y + box.h) / scale + LOUPE_GAP;
		const above = box.y / scale - LOUPE_GAP - outer.h;
		// Below, unless that's where the bottom edge is being dragged
		top = (edges.bottom || below + outer.h > shown.h) && above >= 0 ? above : below;
	}

	// The edges being dragged, as lines in the page's pixels
	const lines = [
		edges.left && [box.x, box.y, box.x, box.y + box.h],
		edges.right && [box.x + box.w, box.y, box.x + box.w, box.y + box.h],
		edges.top && [box.x, box.y, box.x + box.w, box.y],
		edges.bottom && [box.x, box.y + box.h, box.x + box.w, box.y + box.h],
	].filter((line): line is number[] => Boolean(line));

	return (
		<div className={styles.loupe} style={{ left, top }} aria-hidden="true">
			<svg
				width={width}
				height={height}
				viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
			>
				<rect
					className={styles.loupeOutside}
					x={view.x}
					y={view.y}
					width={view.w}
					height={view.h}
				/>
				<image href={image} width={size.w} height={size.h} />
				{boxes.filter((other) => other !== box).map((other, key) => (
					<rect
						key={key}
						className={styles.loupeOther}
						x={other.x}
						y={other.y}
						width={other.w}
						height={other.h}
					/>
				))}
				<rect className={styles.loupeBox} x={box.x} y={box.y} width={box.w} height={box.h} />
				{lines.map(([x1, y1, x2, y2], key) => (
					<line key={key} className={styles.loupeEdge} x1={x1} y1={y1} x2={x2} y2={y2} />
				))}
			</svg>
			<span>{`${Math.round(box.w)} × ${Math.round(box.h)} px`}</span>
		</div>
	);
}

const fromPage = (page: Page, statuses: BoxStatus[], labels: (string | undefined)[]):
	Box[] => page.boxes.map((box, index) => ({
	x: box.x,
	y: box.y,
	w: box.w,
	h: box.h,
	kind: box.kind,
	reading: box['prediction-manchu'] !== null && box.confidence !== null
		? {
			manchu: box['prediction-manchu'],
			// Shown on it: the user's word, if they corrected it
			abkai: labels[index] ?? box['prediction-abkai'],
			confidence: box.confidence,
		}
		: undefined,
	status: statuses[index],
}));

// What POST /upload/multiple/boxes is sent for a box: an unchanged one keeps
// its reading, so it isn't read again
const toSend = ({ x, y, w, h, kind, reading }: Box): EditedBox => ({
	x: Math.round(x),
	y: Math.round(y),
	w: Math.round(w),
	h: Math.round(h),
	kind,
	...(reading && {
		'prediction-manchu': reading.manchu,
		confidence: reading.confidence,
	}),
});

// The box from two corners, kept inside the image and no taller than
// MAX_ASPECT times its width. Its height is cut from the side away from
// fixedY, the edge that isn't being dragged.
function fit(x1: number, y1: number, x2: number, y2: number,
	size: { w: number; h: number }, fixedY: 'top' | 'bottom') {
	const clamp = (value: number, max: number) => Math.min(Math.max(value, 0), max);
	const left = clamp(Math.min(x1, x2), size.w);
	const right = clamp(Math.max(x1, x2), size.w);
	let top = clamp(Math.min(y1, y2), size.h);
	let bottom = clamp(Math.max(y1, y2), size.h);
	const w = right - left;
	if (bottom - top > MAX_ASPECT * w) {
		if (fixedY === 'top') bottom = top + MAX_ASPECT * w;
		else top = bottom - MAX_ASPECT * w;
	}
	return { x: left, y: top, w, h: bottom - top };
}

// A drag in progress: drawing a new box, or moving or resizing box index.
// start is where it began, in the image's pixels, and original the box then.
type Drag =
	// edges are those of box at the pointer
	| { type: 'draw'; start: { x: number; y: number }; box?: Box; edges?: Edges }
	| { type: 'edit'; index: number; edges: Edges; start: { x: number; y: number };
		original: Box };

// The page's boxes, to delete, move, resize, draw or change the kind of,
// then send back with onSubmit to be read again
export default function BoxEditor({
	page, statuses, labels, size, busy, onSubmit, onCancel,
}: {
	page: Page;
	// The colour of each of page.boxes, kept while a box keeps its reading
	statuses: BoxStatus[];
	// The word to show on each of page.boxes in place of its reading, if any
	labels: (string | undefined)[];
	// The page image's size in pixels
	size: { w: number; h: number };
	// True while the edited boxes are being read
	busy: boolean;
	onSubmit: (boxes: EditedBox[]) => void;
	onCancel: () => void;
}) {
	const [boxes, setBoxes] = useState<Box[]>(() => fromPage(page, statuses, labels));
	const [selected, setSelected] = useState<number>();
	const [drag, setDrag] = useState<Drag>();
	const svg = useRef<SVGSVGElement>(null);
	// The image's pixels per screen pixel, for handles that stay one size
	const scale = useImageScale(svg, size.w);

	// Where a pointer event is, in the image's pixels
	const point = (event: React.PointerEvent) => {
		const matrix = svg.current?.getScreenCTM()?.inverse();
		if (!matrix) return { x: 0, y: 0 };
		const p = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix);
		return { x: p.x, y: p.y };
	};

	const change = (index: number, update: (box: Box) => Box) => {
		setBoxes((previous) => previous.map((box, i) => (i === index ? update(box) : box)));
	};

	const remove = (index: number) => {
		setBoxes((previous) => previous.filter((_, i) => i !== index));
		setSelected(undefined);
	};

	const setKind = (index: number, kind: Box['kind']) => {
		// A box made the other kind is read again
		change(index, (box) => (box.kind === kind ? box : { ...box, kind, reading: undefined }));
	};

	const startEdit = (event: React.PointerEvent, index: number, edges: Edges) => {
		if (busy || event.button !== 0) return;
		event.stopPropagation();
		svg.current?.setPointerCapture(event.pointerId);
		setSelected(index);
		setDrag({ type: 'edit', index, edges, start: point(event), original: boxes[index] });
	};

	const onPointerDown = (event: React.PointerEvent) => {
		if (busy || event.button !== 0) return;
		svg.current?.setPointerCapture(event.pointerId);
		setDrag({ type: 'draw', start: point(event) });
	};

	const onPointerMove = (event: React.PointerEvent) => {
		if (!drag) return;
		const { x, y } = point(event);
		if (drag.type === 'draw') {
			setDrag({
				...drag,
				box: { ...fit(drag.start.x, drag.start.y, x, y, size,
					y >= drag.start.y ? 'top' : 'bottom'), kind: 'manchu' },
				edges: x >= drag.start.x
					? { right: true, ...(y >= drag.start.y ? { bottom: true } : { top: true }) }
					: { left: true, ...(y >= drag.start.y ? { bottom: true } : { top: true }) },
			});
			return;
		}
		const { original: o, edges, start } = drag;
		const dx = x - start.x;
		const dy = y - start.y;
		let box: Box;
		if (edges === MOVE) {
			box = {
				...o,
				x: Math.min(Math.max(o.x + dx, 0), size.w - o.w),
				y: Math.min(Math.max(o.y + dy, 0), size.h - o.h),
			};
		} else {
			// The dragged edges follow the pointer, and the others stay put
			const left = o.x + (edges.left ? dx : 0);
			const right = o.x + o.w + (edges.right ? dx : 0);
			const top = o.y + (edges.top ? dy : 0);
			const bottom = o.y + o.h + (edges.bottom ? dy : 0);
			box = { ...o, ...fit(left, top, right, bottom, size,
				edges.top ? 'bottom' : 'top') };
			if (box.w < MIN_SIZE || box.h < MIN_SIZE) return;
		}
		// Once moved or resized, the box is read again
		box.reading = undefined;
		change(drag.index, () => box);
	};

	const onPointerUp = () => {
		if (!drag) return;
		if (drag.type === 'draw') {
			const { box } = drag;
			if (box && box.w >= MIN_SIZE && box.h >= MIN_SIZE) {
				setBoxes((previous) => [...previous, box]);
				setSelected(boxes.length);
			} else {
				// A click on the page, away from any box
				setSelected(undefined);
			}
		}
		setDrag(undefined);
	};

	const onKeyDown = (event: React.KeyboardEvent) => {
		if (selected === undefined || busy) return;
		if (event.key === 'Delete' || event.key === 'Backspace') {
			event.preventDefault();
			remove(selected);
		} else if (event.key === 'Escape') {
			setSelected(undefined);
		} else if (event.key.startsWith('Arrow')) {
			event.preventDefault();
			const step = event.shiftKey ? 10 : 1;
			const dx = event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0;
			const dy = event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0;
			change(selected, (box) => ({
				...box,
				x: Math.min(Math.max(box.x + dx, 0), size.w - box.w),
				y: Math.min(Math.max(box.y + dy, 0), size.h - box.h),
				reading: undefined,
			}));
		}
	};

	const current = selected !== undefined ? boxes[selected] : undefined;
	const handle = HANDLE * scale;
	// The box being drawn or resized, for the magnifier
	const magnified = drag?.type === 'edit' && drag.edges !== MOVE
		? { box: boxes[drag.index], edges: drag.edges }
		: drag?.type === 'draw' && drag.box && drag.edges
			? { box: drag.box, edges: drag.edges }
			: undefined;
	// Drawn last, so it's on top of any box it overlaps
	const order = boxes.map((_, index) => index)
		.sort((a, b) => Number(a === selected) - Number(b === selected));

	return (
		<div className={styles.editor}>
			<div className={styles.toolbar} role="toolbar" aria-label="Edit the boxes">
				<p className={styles.hint}>
					{`Drag on the page to draw a box, or drag a box to move it. Select a box to resize it by its handles, change its kind, or delete it (or press Delete). Boxes can be at most ${MAX_ASPECT} times as tall as they are wide.`}
				</p>
				<div className={styles.controls}>
					<fieldset className={styles.kind} disabled={!current || busy}>
						<legend className={styles.visuallyHidden}>The selected box is</legend>
						{(['manchu', 'other'] as const).map((kind) => (
							<label key={kind}>
								<input
									type="radio"
									name="box-kind"
									checked={current?.kind === kind}
									onChange={() => { if (selected !== undefined) setKind(selected, kind); }}
								/>
								{kind === 'manchu' ? 'Manchu' : 'Not Manchu'}
							</label>
						))}
					</fieldset>
					<button
						type="button"
						disabled={!current || busy}
						onClick={() => { if (selected !== undefined) remove(selected); }}
					>
						Delete box
					</button>
					<button
						type="button"
						disabled={busy}
						onClick={() => {
							setBoxes(fromPage(page, statuses, labels));
							setSelected(undefined);
						}}
					>
						Undo all changes
					</button>
				</div>
			</div>
			<ZoomFrame width={size.w}>
			{(zoomStyle) => (
			<div className={styles.canvasWrap} style={zoomStyle}>
			<svg
				ref={svg}
				className={[styles.canvas, busy && styles.busy].filter(Boolean).join(' ')}
				width={size.w}
				height={size.h}
				viewBox={`0 0 ${size.w} ${size.h}`}
				role="application"
				aria-label="The page's boxes. Drag to draw a box. With a box selected, arrow keys move it and Delete removes it."
				tabIndex={0}
				onPointerDown={onPointerDown}
				onPointerMove={onPointerMove}
				onPointerUp={onPointerUp}
				onPointerCancel={onPointerUp}
				onKeyDown={onKeyDown}
			>
				<image href={page.image} width={size.w} height={size.h} />
				{order.map((index) => {
					const box = boxes[index];
					const isSelected = index === selected;
					const reading = box.reading?.abkai ?? '';
					const fontSize = Math.min(box.w * 0.6,
						(box.h * 0.9) / Math.max(reading.length * 0.6, 1));
					return (
						<g
							key={index}
							className={[
								box.kind === 'manchu' ? styles.manchu : styles.other,
								box.kind === 'manchu' && (box.reading
									? box.status && styles[box.status]
									: styles.changed),
								isSelected && styles.selected,
							].filter(Boolean).join(' ')}
						>
							<rect
								x={box.x}
								y={box.y}
								width={box.w}
								height={box.h}
								onPointerDown={(event) => { startEdit(event, index, MOVE); }}
							/>
							{box.kind === 'manchu' && reading && (
								<text x={box.x + box.w / 2} y={box.y + box.h / 2} fontSize={fontSize}>
									{reading}
								</text>
							)}
							{isSelected && !busy && HANDLES.map(({ edges, cursor }, key) => {
								const { x: cx, y: cy } = edgePoint(box, edges);
								return (
									<rect
										key={key}
										className={styles.handle}
										x={cx - handle / 2}
										y={cy - handle / 2}
										width={handle}
										height={handle}
										style={{ cursor }}
										onPointerDown={(event) => { startEdit(event, index, edges); }}
									/>
								);
							})}
						</g>
					);
				})}
				{drag?.type === 'draw' && drag.box && (
					<rect
						className={styles.drawing}
						x={drag.box.x}
						y={drag.box.y}
						width={drag.box.w}
						height={drag.box.h}
					/>
				)}
			</svg>
			{magnified && (
				<Loupe image={page.image} size={size} boxes={boxes} scale={scale} {...magnified} />
			)}
			</div>
			)}
			</ZoomFrame>
			<div className={styles.actions}>
				<button type="button" disabled={busy} onClick={() => { onSubmit(boxes.map(toSend)); }}>
					{busy ? 'Reading…' : 'Read These Boxes'}
				</button>
				<button type="button" disabled={busy} onClick={onCancel}>
					Cancel
				</button>
			</div>
		</div>
	);
}
