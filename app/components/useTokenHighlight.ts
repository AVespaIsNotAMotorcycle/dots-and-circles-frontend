import { useState } from 'react';

// Which CTC token is highlighted across every prediction card, and whether
// the cards show their full letter-color detail
export default function useTokenHighlight() {
	const [hovered, setHovered] = useState();
	// Where the mouse and keyboard focus are, each true while inside a card's
	// CTC or prediction. The full detail shows while either is.
	const [inside, setInside] = useState({ mouse: false, focus: false });
	// A click pins the detail on, and the clicked token, until the same token
	// (or the card outside any token) is clicked again
	const [pinned, setPinned] = useState(false);
	// The toggle keeps the full detail on all the time
	const [alwaysDetailed, setAlwaysDetailed] = useState(false);
	const detailed = alwaysDetailed || inside.mouse || inside.focus || pinned;

	const onInside = (kind, isInside) => {
		setInside((previous) => ({ ...previous, [kind]: isInside }));
		if (!isInside && !pinned) setHovered(undefined);
	};
	const onHover = (index) => {
		if (!pinned) setHovered(index);
	};
	const onSelect = (index) => {
		if (pinned && (index === undefined || index === hovered)) {
			setPinned(false);
			return;
		}
		setPinned(true);
		if (index !== undefined) setHovered(index);
	};
	// For a new word: nothing highlighted or pinned
	const reset = () => {
		setHovered(undefined);
		setPinned(false);
	};

	return {
		hovered,
		// Sets the token even while pinned, for the arrow keys
		onMove: setHovered,
		detailed,
		alwaysDetailed,
		setAlwaysDetailed,
		onInside,
		onHover,
		onSelect,
		reset,
	};
}
