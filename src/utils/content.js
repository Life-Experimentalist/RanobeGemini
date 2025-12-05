/**
 * Content utility functions for RanobeGemini
 */

import { debugLog, debugError } from "./logger.js";

/**
 * Strips HTML tags from a string
 * @param {string} html - HTML string to strip tags from
 * @returns {string} Text with HTML tags removed
 */
export function stripHtmlTags(html) {
	if (!html) return "";

	// First pass: Use DOMParser for proper HTML parsing
	const parser = new DOMParser();
	try {
		const doc = parser.parseFromString(html, "text/html");
		// Return text content which automatically strips tags
		return doc.body.textContent || "";
	} catch (e) {
		// Fallback to regex if DOMParser fails
		return (
			html
				// Replace angle brackets encoded as HTML entities
				.replace(/&lt;/g, "<")
				.replace(/&gt;/g, ">")
				// Replace all tags with a space to maintain readability
				.replace(/<[^>]*>/g, " ")
				// Remove extra whitespace
				.replace(/\s+/g, " ")
				.trim()
		);
	}
}

/**
 * Gets content from all paragraphs inside a container
 * @param {Element} container - Container element to get paragraphs from
 * @returns {string} Combined text from paragraphs with proper spacing
 */
export function getTextFromParagraphs(container) {
	const paragraphs = container.querySelectorAll("p");
	let text = "";

	paragraphs.forEach((p) => {
		text += p.textContent.trim() + "\n\n";
	});

	return text.trim();
}

/**
 * Formats a text string for better readability
 * @param {string} text - Text to format
 * @returns {string} Formatted text
 */
export function formatText(text) {
	return text
		.replace(/\n{3,}/g, "\n\n") // Replace multiple newlines with double newlines
		.trim();
}

/**
 * Creates HTML for displaying summary in tooltip
 * @param {string} summary - Summary text
 * @returns {string} HTML string
 */
export function createSummaryHTML(summary) {
	// Ensure the summary is clean of any HTML tags
	const cleanSummary = stripHtmlTags(summary);

	// Format the summary with paragraph tags for better reading
	const paragraphs = cleanSummary
		.split("\n\n")
		.map((p) => `<p>${p.trim()}</p>`)
		.join("");

	return `<div class="gemini-summary-content">${paragraphs}</div>`;
}

export default {
	stripHtmlTags,
	getTextFromParagraphs,
	formatText,
	createSummaryHTML,
};
