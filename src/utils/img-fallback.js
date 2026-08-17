/**
 * Declarative <img> error fallbacks.
 *
 * Extension pages run under the Manifest V3 default CSP
 * (`script-src 'self'; object-src 'self'`), which forbids `unsafe-inline`.
 * Inline `onerror="…"` attributes therefore never fire — every cover-image
 * fallback written that way was silently dead, leaving broken-image icons in
 * the popup and library. This module reimplements the same behaviours as
 * `data-` attributes handled by one delegated listener.
 *
 * `error` does not bubble, so the listener must be registered in the capture
 * phase on the document.
 *
 * Usage:
 *   <img src="…" data-img-fallback="hide">
 *   <img src="…" data-img-fallback="hide-parent">
 *   <img src="…" data-img-fallback="remove">
 *   <img src="…" data-img-fallback="remove-closest" data-fallback-target=".modal-cover">
 *   <img src="…" data-img-fallback="src" data-fallback-src="icons/logo-256.png">
 *   <img src="…" data-img-fallback="sibling">
 *   <img src="…" data-img-fallback="text" data-fallback-text="📖">
 *   <img src="…" data-img-fallback="placeholder" data-fallback-text="📖"
 *        data-fallback-class="novel-cover-placeholder">
 */

/**
 * Apply the fallback declared on a failed element.
 * @param {HTMLElement} el
 */
function applyFallback(el) {
	const mode = el.dataset.imgFallback;
	if (!mode) return;

	// Guard against a fallback image that also fails, which would otherwise
	// retrigger this handler forever.
	if (el.dataset.imgFallbackDone === "1") {
		el.remove();
		return;
	}
	el.dataset.imgFallbackDone = "1";

	switch (mode) {
		case "hide":
			el.style.display = "none";
			break;

		case "hide-parent":
			if (el.parentElement) el.parentElement.style.display = "none";
			break;

		case "remove":
			el.remove();
			break;

		case "remove-closest": {
			const target = el.dataset.fallbackTarget;
			const node = target ? el.closest(target) : el.parentElement;
			(node || el).remove();
			break;
		}

		case "src": {
			const next = el.dataset.fallbackSrc;
			if (next) el.src = next;
			else el.remove();
			break;
		}

		case "sibling":
			el.style.display = "none";
			if (el.nextElementSibling) {
				el.nextElementSibling.style.display = "inline";
			}
			break;

		case "text": {
			// textContent, never innerHTML — the text can come from novel metadata.
			const span = document.createElement("span");
			span.textContent = el.dataset.fallbackText || "";
			el.replaceWith(span);
			break;
		}

		case "placeholder": {
			const div = document.createElement("div");
			if (el.dataset.fallbackClass)
				div.className = el.dataset.fallbackClass;
			div.textContent = el.dataset.fallbackText || "";
			el.replaceWith(div);
			break;
		}

		default:
			el.style.display = "none";
			break;
	}
}

let installed = false;

/**
 * Install the delegated handler. Safe to call more than once.
 * @param {Document|ShadowRoot} [root=document]
 */
export function installImageFallbacks(root = document) {
	if (root === document) {
		if (installed) return;
		installed = true;
	}

	root.addEventListener(
		"error",
		(event) => {
			const el = event.target;
			if (!(el instanceof HTMLImageElement)) return;
			if (!el.dataset || !el.dataset.imgFallback) return;
			applyFallback(el);
		},
		true,
	);
}

export default { installImageFallbacks };
