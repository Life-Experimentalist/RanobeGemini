/**
 * Enhancement display helper functions extracted from content.js.
 */

export function showProcessingErrorRuntime({
	errorMessage,
	documentRef = document,
	findContentArea,
	insertNodeAtContentTop,
	debugError = () => {},
}) {
	debugError("Processing error:", errorMessage);

	const contentArea =
		typeof findContentArea === "function" ? findContentArea() : null;
	if (!contentArea) return;

	const errorBox = documentRef.createElement("div");
	errorBox.className = "gemini-error-box";
	errorBox.style.cssText = `
        background-color: #fff3cd;
        border: 1px solid #ffeeba;
        color: #856404;
        padding: 15px;
        margin: 15px 0;
        border-radius: 5px;
    `;

	errorBox.innerHTML = `
        <strong>Error processing content with Gemini:</strong>
        <p>${errorMessage}</p>
        <p>Please try again or check your API key and settings.</p>
    `;

	if (typeof insertNodeAtContentTop === "function") {
		insertNodeAtContentTop(contentArea, errorBox);
	}
}

export function removeOriginalWordCountRuntime({ documentRef = document }) {
	const existingWordCount = documentRef.querySelector(".gemini-word-count");
	if (existingWordCount) {
		existingWordCount.remove();
	}
}

export function addWordCountDisplayRuntime({
	contentArea,
	originalCount,
	newCount,
	documentRef = document,
	insertAfterControlsOrTop,
}) {
	const existingWordCount = documentRef.querySelector(".gemini-word-count");
	if (existingWordCount) {
		const percentChange = (((newCount - originalCount) / originalCount) * 100).toFixed(1);
		const changeText =
			percentChange >= 0
				? `+${percentChange}% increase`
				: `${percentChange}% decrease`;

		existingWordCount.innerHTML = `
			<strong>  Word Count:</strong> ${originalCount} → ${newCount} (${changeText})
		`;
		return;
	}

	const wordCountContainer = documentRef.createElement("div");
	wordCountContainer.className = "gemini-word-count";
	wordCountContainer.style.cssText = `
		margin: 10px 0 15px 0;
		color: #bab9a0;
		font-size: 14px;
		text-align: left;
	`;

	const percentChange = (((newCount - originalCount) / originalCount) * 100).toFixed(1);
	const changeText =
		percentChange >= 0
			? `+${percentChange}% increase`
			: `${percentChange}% decrease`;

	wordCountContainer.innerHTML = `
		<strong>  Word Count:</strong> ${originalCount} → ${newCount} (${changeText})
	`;

	if (typeof insertAfterControlsOrTop === "function") {
		insertAfterControlsOrTop(contentArea, wordCountContainer);
	}
}

export function applyDefaultFormattingRuntime({
	contentArea,
	formattingOptions,
}) {
	if (!contentArea) return;

	if (formattingOptions?.centerSceneHeadings) {
		const headingSelectors =
			"h2, h3, h4, .section-divider, hr.section-divider";
		contentArea.querySelectorAll(headingSelectors).forEach((el) => {
			if (el.tagName === "HR") {
				el.style.marginLeft = "auto";
				el.style.marginRight = "auto";
				el.style.width = "60%";
				return;
			}
			el.style.textAlign = "center";
			el.style.marginLeft = "auto";
			el.style.marginRight = "auto";
		});
	}
}

export default {
	showProcessingErrorRuntime,
	removeOriginalWordCountRuntime,
	addWordCountDisplayRuntime,
	applyDefaultFormattingRuntime,
};
