/* Blockbench Plugin: Keyframe Range Select
 * - Two-click range selection for timeline keyframes
 *
 * Author: Cazfps
 */

(function() {
	'use strict';

	const PLUGIN_ID = 'keyframe_range_select_cazfps';
	const ACTION_ID = 'krs_select_keyframes_range';
	const GLOBAL_CLEANUP_KEY = '__krs_keyframe_range_select_cleanup';

	// Hot-reload safety: ensure previous instance cleans up.
	try {
		const prev = window[GLOBAL_CLEANUP_KEY];
		if (typeof prev === 'function') prev();
	} catch (e) {}
	window[GLOBAL_CLEANUP_KEY] = () => {};

	let range_anchor_time = null;
	let action = null;

	function getCurrentTime() {
		try {
			if (typeof Timeline !== 'undefined' && Timeline && typeof Timeline.time === 'number') return Timeline.time;
		} catch (e) {}
		return 0;
	}

	function isAnimateMode() {
		try { return !!Modes?.animate; } catch (e) {}
		return false;
	}

	function purgeFromTimelineUI() {
		try {
			// Remove from toolbar
			try {
				Toolbars?.timeline?.remove?.(ACTION_ID, true);
			} catch (e) {}

			// Remove from timeline menu (best effort)
			try {
				const menu = Timeline?.menu;
				if (menu) {
					try { menu.removeAction?.(ACTION_ID); } catch (e) {}
					// Deep purge: remove lingering instances by id
					const id = ACTION_ID;
					function purgeArray(arr) {
						if (!Array.isArray(arr)) return;
						for (let i = arr.length - 1; i >= 0; i--) {
							const item = arr[i];
							if (typeof item === 'string' && item === id) {
								arr.splice(i, 1);
								continue;
							}
							if (item && typeof item === 'object') {
								if (typeof item.id === 'string' && item.id === id) {
									arr.splice(i, 1);
									continue;
								}
								if (Array.isArray(item.children)) purgeArray(item.children);
							}
						}
					}
					purgeArray(menu.structure);
				}
			} catch (e) {}
		} catch (e) {}
	}

	function selectKeyframesInRange() {
		if (!isAnimateMode()) {
			Blockbench.showQuickMessage('Switch to Animate mode first', 2500);
			return;
		}
		if (typeof Timeline === 'undefined' || !Timeline) {
			Blockbench.showQuickMessage('Timeline not available', 2500);
			return;
		}
		const t = getCurrentTime();

		// Two-click anchor behavior
		if (typeof range_anchor_time !== 'number') {
			range_anchor_time = t;
			try { Blockbench.showQuickMessage('Range start set at ' + Math.roundTo(t, 4), 1800); } catch (e) {
				Blockbench.showQuickMessage('Range start set', 1500);
			}
			return;
		}

		const a = range_anchor_time;
		range_anchor_time = null;
		const start = Math.min(a, t);
		const end = Math.max(a, t);

		// Only bones opened in the timeline
		let open_animators = [];
		try {
			if (Timeline.animators && typeof BoneAnimator !== 'undefined') {
				open_animators = Timeline.animators.filter(an => an && an instanceof BoneAnimator && an.expanded);
			}
		} catch (e) {}
		if (!open_animators.length) {
			Blockbench.showQuickMessage('Open one or more bones in the timeline first', 2500);
			return;
		}

		try {
			// Clear previous selection
			try { Timeline.unselect?.(); } catch (e) {}
			try { Timeline.selected?.empty?.(); } catch (e) {}

			const channels_filter = Timeline?.vue?.channels || null;
			let found = 0;

			for (const animator of open_animators) {
				for (const kf of animator.keyframes) {
					if (!kf) continue;
					if (channels_filter && channels_filter[kf.channel] === false) continue;
					if (kf.time >= start - 1e-5 && kf.time <= end + 1e-5) {
						Timeline.selected.push(kf);
						kf.selected = true;
						found++;
					}
				}
			}

			try { if (typeof updateKeyframeSelection === 'function') updateKeyframeSelection(); } catch (e) {}
			Blockbench.showQuickMessage(
				'Selected ' + found + ' keyframes (' + Math.roundTo(start, 3) + ' → ' + Math.roundTo(end, 3) + ')',
				2200
			);
		} catch (e) {
			console.error(e);
			Blockbench.showQuickMessage('Keyframe range selection failed (see console)', 5000);
		}
	}

	function installAction() {
		// Delete previous BarItem with same id if it exists
		try {
			const existing = BarItems?.[ACTION_ID];
			if (existing && typeof existing.delete === 'function') existing.delete();
		} catch (e) {}

		purgeFromTimelineUI();

		action = new Action(ACTION_ID, {
			name: 'Select keyframes (range)',
			description: 'Click once to set a start anchor, move playhead, click again to select all keyframes in between for bones opened in the timeline.',
			icon: 'select_all',
			category: 'animation',
			condition: () => isAnimateMode() && !!Timeline,
			click() { selectKeyframesInRange(); }
		});

		// Add to timeline menu + toolbar
		try { Timeline?.menu?.addAction?.(action, '#preview'); } catch (e) {}
		try { Toolbars?.timeline?.add?.(action); } catch (e) {}
	}

	function cleanup() {
		try { range_anchor_time = null; } catch (e) {}
		try { purgeFromTimelineUI(); } catch (e) {}
		try { if (action && typeof action.delete === 'function') action.delete(); } catch (e) {}
		action = null;
	}

	Plugin.register(PLUGIN_ID, {
		title: 'Keyframe Range Select',
		author: 'Cazfps',
		description: 'This plugin adds a tool to easily select all the keyframes in the timeline within a specific range.',
		icon: 'select_all',
		version: '0.0.1',
		variant: 'both',
		onload() {
			installAction();
			try { window[GLOBAL_CLEANUP_KEY] = cleanup; } catch (e) {}
			Blockbench.showQuickMessage('Keyframe Range Select loaded', 1500);
		},
		onunload() {
			cleanup();
			try { window[GLOBAL_CLEANUP_KEY] = () => {}; } catch (e) {}
		}
	});
})();
