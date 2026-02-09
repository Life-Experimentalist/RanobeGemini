/**
 * Shared helper functions for shelf pages across all website handlers
 * Reduces code duplication in individual shelf-page.js files
 */

/**
 * Open a novel from query parameters
 * @param {Array} allNovels - Array of all novels to search
 * @param {Function} onOpenNovel - Callback function to open the novel (e.g., showNovelModal or openNovelDetails)
 * @param {Function} showToast - Toast notification function
 */
export function openNovelFromQuery(
	allNovels,
	onOpenNovel,
	showToast = () => {},
) {
	try {
		const params = new URLSearchParams(window.location.search);
		const novelId = params.get("novel");
		if (!novelId) return;

		const novel = allNovels.find((n) => n && n.id === novelId);
		if (novel) {
			onOpenNovel(novel);
		} else {
			showToast("Novel not found in this shelf", "info");
		}
	} catch (_err) {
		// ignore
	}
}

/**
 * Ensure a random select button exists in the filter area
 * Creates the button if it doesn't exist and attaches event listener
 * @param {Function} onRandomPicked - Callback when random novel is selected
 * @param {Array} filteredNovels - Currently filtered novels
 * @param {Array} allNovels - All available novels
 * @param {Function} showToast - Toast notification function
 */
export function ensureRandomSelectButton(
	onRandomPicked,
	filteredNovels,
	allNovels,
	showToast = () => {},
) {
	// Find the search input element - works for both generic and site-specific pages
	const searchInput =
		document.getElementById("search-input") ||
		document.getElementById("shelf-search");

	if (!searchInput) return;

	// Check if button already exists
	if (document.getElementById("random-select-btn")) return;

	const container = searchInput.parentElement;
	if (!container) return;

	const button = document.createElement("button");
	button.type = "button";
	button.id = "random-select-btn";
	button.className = "btn btn-secondary random-select-btn";
	button.textContent = "🎲 Random";
	button.title = "Pick a random novel from current filters";

	button.addEventListener("click", () => {
		const pool =
			filteredNovels && filteredNovels.length > 0
				? filteredNovels
				: allNovels;
		if (!pool.length) {
			showToast("No novels available for random pick", "info");
			return;
		}
		const pick = pool[Math.floor(Math.random() * pool.length)];
		onRandomPicked(pick);
	});

	container.appendChild(button);
}
