/**
 * Canvas-based background animation engine for Ranobe Gemini library pages.
 *
 * Self-registers by watching `data-bg-animation` on <body> via MutationObserver.
 * Just import this module (side-effect import) and animations will activate
 * automatically when setThemeVariables() sets the attribute.
 *
 * Canvas animations: "particles" | "falling-leaves" | "snow" | "rain" | "fireflies"
 * CSS animations (handled by bg-animations.css): "waves" | "leaves" | "shimmer"
 */

let canvas = null;
let ctx = null;
let animId = null;
let activeType = "none";
let particles = [];
let resizeTimer = null;

// ── Color helpers ──────────────────────────────────────────────────────────────

function getPrimaryColor() {
	return (
		getComputedStyle(document.documentElement)
			.getPropertyValue("--primary-color")
			.trim() || "#bb86fc"
	);
}

function hexToRgb(hex) {
	const c = hex.trim().replace(/^#/, "");
	const full =
		c.length === 3
			? c
					.split("")
					.map((x) => x + x)
					.join("")
			: c;
	const n = parseInt(full, 16);
	return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function rgbStr(rgb, alpha = 1) {
	return `rgba(${rgb.r},${rgb.g},${rgb.b},${alpha})`;
}

// ── Canvas lifecycle ───────────────────────────────────────────────────────────

function getOrCreateCanvas() {
	if (!canvas) {
		canvas = document.createElement("canvas");
		canvas.id = "rg-bg-canvas";
		canvas.setAttribute("aria-hidden", "true");
		canvas.style.cssText = `
			position: fixed;
			inset: 0;
			width: 100%;
			height: 100%;
			z-index: 1;
			pointer-events: none;
			display: block;
		`;
		document.body.prepend(canvas);
	}
	canvas.width = window.innerWidth;
	canvas.height = window.innerHeight;
	canvas.style.display = "block";
	ctx = canvas.getContext("2d");
	return ctx;
}

function hideCanvas() {
	if (animId) {
		cancelAnimationFrame(animId);
		animId = null;
	}
	if (canvas) {
		canvas.style.display = "none";
		try {
			ctx?.clearRect(0, 0, canvas.width, canvas.height);
		} catch (_) {
			/* ignore */
		}
	}
	particles = [];
}

// ── Particle factories ─────────────────────────────────────────────────────────

function makeParticle(w, h, rgb) {
	return {
		x: Math.random() * w,
		y: Math.random() * h,
		r: Math.random() * 1.8 + 0.6,
		r2: Math.random() * 1.8 + 0.6,
		vx: (Math.random() - 0.5) * 0.45,
		vy: (Math.random() - 0.5) * 0.45,
		alpha: Math.random() * 0.55 + 0.2,
		phase: Math.random() * Math.PI * 2,
		phaseSpd: 0.018 + Math.random() * 0.022,
		rgb,
	};
}

function makeLeaf(w, h, rgb) {
	return {
		x: Math.random() * w,
		y: Math.random() * h - h,
		size: Math.random() * 9 + 5,
		vx: (Math.random() - 0.5) * 0.7,
		vy: Math.random() * 1.3 + 0.5,
		rot: Math.random() * Math.PI * 2,
		rotSpd: (Math.random() - 0.5) * 0.04,
		alpha: Math.random() * 0.45 + 0.2,
		sway: Math.random() * Math.PI * 2,
		swaySpd: 0.018 + Math.random() * 0.02,
		rgb,
	};
}

function makeSnow(w, h) {
	return {
		x: Math.random() * w,
		y: Math.random() * h - h,
		r: Math.random() * 2.2 + 0.5,
		vx: (Math.random() - 0.5) * 0.3,
		vy: Math.random() * 0.9 + 0.35,
		alpha: Math.random() * 0.55 + 0.25,
		sway: Math.random() * Math.PI * 2,
		swaySpd: 0.01 + Math.random() * 0.015,
	};
}

function makeRain(w, h) {
	return {
		x: Math.random() * (w + 300) - 150,
		y: Math.random() * h - h,
		len: Math.random() * 14 + 7,
		vx: -2.8,
		vy: Math.random() * 7 + 9,
		alpha: Math.random() * 0.22 + 0.08,
	};
}

function makeFirefly(w, h, rgb) {
	const sx = Math.random() * w;
	const sy = Math.random() * h;
	return {
		sx,
		sy,
		x: sx,
		y: sy,
		r: Math.random() * 2.2 + 1,
		vx: (Math.random() - 0.5) * 0.35,
		vy: (Math.random() - 0.5) * 0.35,
		phase: Math.random() * Math.PI * 2,
		phaseSpd: 0.018 + Math.random() * 0.025,
		pathPhase: Math.random() * Math.PI * 2,
		pathSpd: 0.006 + Math.random() * 0.009,
		pathR: 28 + Math.random() * 55,
		baseAlpha: Math.random() * 0.45 + 0.12,
		rgb,
	};
}

// ── Animation draw functions ───────────────────────────────────────────────────

function drawLeafShape(lctx, leaf) {
	lctx.save();
	lctx.translate(leaf.x, leaf.y);
	lctx.rotate(leaf.rot);
	lctx.fillStyle = rgbStr(leaf.rgb, leaf.alpha);
	lctx.beginPath();
	lctx.moveTo(0, -leaf.size);
	lctx.quadraticCurveTo(leaf.size * 0.85, -leaf.size * 0.3, 0, leaf.size);
	lctx.quadraticCurveTo(-leaf.size * 0.85, -leaf.size * 0.3, 0, -leaf.size);
	lctx.fill();
	lctx.restore();
}

// ── Animation loops ────────────────────────────────────────────────────────────

function loopParticles(color) {
	const c = canvas;
	const rgb = hexToRgb(color);
	const count = Math.min(Math.floor((c.width * c.height) / 7500), 200);
	for (let i = 0; i < count; i++)
		particles.push(makeParticle(c.width, c.height, rgb));

	function frame() {
		ctx.clearRect(0, 0, c.width, c.height);
		for (const p of particles) {
			p.x += p.vx;
			p.y += p.vy;
			p.phase += p.phaseSpd;
			const a = p.alpha * (0.65 + 0.35 * Math.sin(p.phase));
			const r = p.r + (p.r2 - p.r) * (0.5 + 0.5 * Math.sin(p.phase));
			if (p.x < -4) p.x = c.width + 4;
			if (p.x > c.width + 4) p.x = -4;
			if (p.y < -4) p.y = c.height + 4;
			if (p.y > c.height + 4) p.y = -4;
			ctx.beginPath();
			ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
			ctx.fillStyle = rgbStr(p.rgb, a);
			ctx.fill();
		}
		animId = requestAnimationFrame(frame);
	}
	animId = requestAnimationFrame(frame);
}

function loopFallingLeaves(color) {
	const c = canvas;
	const rgb = hexToRgb(color);
	const count = Math.min(Math.floor(c.width / 11), 85);
	for (let i = 0; i < count; i++)
		particles.push(makeLeaf(c.width, c.height, rgb));

	function frame() {
		ctx.clearRect(0, 0, c.width, c.height);
		for (const p of particles) {
			p.sway += p.swaySpd;
			p.x += p.vx + Math.sin(p.sway) * 0.55;
			p.y += p.vy;
			p.rot += p.rotSpd;
			if (p.y > c.height + p.size * 2) {
				p.y = -p.size * 2;
				p.x = Math.random() * c.width;
			}
			if (p.x < -p.size * 2) p.x = c.width + p.size;
			if (p.x > c.width + p.size * 2) p.x = -p.size;
			drawLeafShape(ctx, p);
		}
		animId = requestAnimationFrame(frame);
	}
	animId = requestAnimationFrame(frame);
}

function loopSnow() {
	const c = canvas;
	const count = Math.min(Math.floor((c.width * c.height) / 5500), 220);
	for (let i = 0; i < count; i++) particles.push(makeSnow(c.width, c.height));

	function frame() {
		ctx.clearRect(0, 0, c.width, c.height);
		ctx.fillStyle = "#ddeeff"; // set once, reused below
		for (const p of particles) {
			p.sway += p.swaySpd;
			p.x += p.vx + Math.sin(p.sway) * 0.35;
			p.y += p.vy;
			if (p.y > c.height + p.r) {
				p.y = -p.r;
				p.x = Math.random() * c.width;
			}
			if (p.x < -p.r) p.x = c.width + p.r;
			if (p.x > c.width + p.r) p.x = -p.r;
			ctx.beginPath();
			ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
			ctx.fillStyle = `rgba(210,235,255,${p.alpha})`;
			ctx.fill();
		}
		animId = requestAnimationFrame(frame);
	}
	animId = requestAnimationFrame(frame);
}

function loopRain(color) {
	const c = canvas;
	const rgb = hexToRgb(color);
	const count = Math.min(Math.floor((c.width * c.height) / 2200), 400);
	for (let i = 0; i < count; i++) particles.push(makeRain(c.width, c.height));

	function frame() {
		ctx.clearRect(0, 0, c.width, c.height);
		ctx.lineWidth = 0.5;
		for (const p of particles) {
			p.x += p.vx;
			p.y += p.vy;
			if (p.y > c.height + p.len) {
				p.y = -p.len;
				p.x = Math.random() * (c.width + 300) - 150;
			}
			const scale = p.len / p.vy;
			ctx.beginPath();
			ctx.moveTo(p.x, p.y);
			ctx.lineTo(p.x - p.vx * scale, p.y - p.len);
			ctx.strokeStyle = rgbStr(rgb, p.alpha);
			ctx.stroke();
		}
		animId = requestAnimationFrame(frame);
	}
	animId = requestAnimationFrame(frame);
}

function loopFireflies(color) {
	const c = canvas;
	const rgb = hexToRgb(color);
	const count = Math.min(Math.floor(c.width / 22), 65);
	for (let i = 0; i < count; i++)
		particles.push(makeFirefly(c.width, c.height, rgb));

	function frame() {
		ctx.clearRect(0, 0, c.width, c.height);
		for (const p of particles) {
			p.phase += p.phaseSpd;
			p.pathPhase += p.pathSpd;
			p.sx += p.vx * 0.28;
			p.sy += p.vy * 0.28;

			// Wrap drift center
			if (p.sx < -12) {
				p.sx = c.width + 12;
				p.x = p.sx;
			}
			if (p.sx > c.width + 12) {
				p.sx = -12;
				p.x = p.sx;
			}
			if (p.sy < -12) {
				p.sy = c.height + 12;
				p.y = p.sy;
			}
			if (p.sy > c.height + 12) {
				p.sy = -12;
				p.y = p.sy;
			}

			p.x = p.sx + Math.cos(p.pathPhase) * p.pathR * 0.38;
			p.y = p.sy + Math.sin(p.pathPhase * 1.27) * p.pathR * 0.28;

			const pulse = 0.28 + 0.72 * (0.5 + 0.5 * Math.sin(p.phase));
			const alpha = p.baseAlpha * pulse;
			const glowR = p.r * (1.1 + pulse * 0.9);

			// Glow halo
			const grad = ctx.createRadialGradient(
				p.x,
				p.y,
				0,
				p.x,
				p.y,
				glowR * 4.5,
			);
			grad.addColorStop(0, rgbStr(rgb, alpha));
			grad.addColorStop(0.45, rgbStr(rgb, alpha * 0.28));
			grad.addColorStop(1, rgbStr(rgb, 0));
			ctx.beginPath();
			ctx.arc(p.x, p.y, glowR * 4.5, 0, Math.PI * 2);
			ctx.fillStyle = grad;
			ctx.fill();

			// Bright core
			ctx.beginPath();
			ctx.arc(p.x, p.y, glowR * 0.45, 0, Math.PI * 2);
			ctx.fillStyle = `rgba(255,252,220,${Math.min(alpha * 2.2, 0.92)})`;
			ctx.fill();
		}
		animId = requestAnimationFrame(frame);
	}
	animId = requestAnimationFrame(frame);
}

// ── Controller ─────────────────────────────────────────────────────────────────

/** Canvas-handled types. CSS-only types are left to bg-animations.css */
const CANVAS_TYPES = new Set([
	"particles",
	"falling-leaves",
	"snow",
	"rain",
	"fireflies",
]);

function startAnimation(type, color) {
	hideCanvas();
	activeType = type;

	if (!CANVAS_TYPES.has(type)) {
		// CSS handles it (or "none") — nothing to do here
		return;
	}

	if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
		return;
	}

	getOrCreateCanvas();

	switch (type) {
		case "particles":
			loopParticles(color);
			break;
		case "falling-leaves":
			loopFallingLeaves(color);
			break;
		case "snow":
			loopSnow();
			break;
		case "rain":
			loopRain(color);
			break;
		case "fireflies":
			loopFireflies(color);
			break;
		default:
			hideCanvas();
	}
}

// ── Self-initialization ────────────────────────────────────────────────────────

function handleBodyAttributeChange() {
	const type = document.body?.getAttribute("data-bg-animation") || "none";
	if (type === activeType) return;
	startAnimation(type, getPrimaryColor());
}

function init() {
	// Apply current animation state
	handleBodyAttributeChange();

	// Watch future changes to data-bg-animation (set by setThemeVariables)
	const observer = new MutationObserver((mutations) => {
		for (const m of mutations) {
			if (m.attributeName === "data-bg-animation") {
				handleBodyAttributeChange();
			}
		}
	});

	if (document.body) {
		observer.observe(document.body, { attributes: true });
	}

	// Resize: recreate canvas dimensions and restart animation
	window.addEventListener("resize", () => {
		clearTimeout(resizeTimer);
		resizeTimer = setTimeout(() => {
			if (CANVAS_TYPES.has(activeType) && canvas) {
				canvas.width = window.innerWidth;
				canvas.height = window.innerHeight;
				// Restart the current animation cleanly
				startAnimation(activeType, getPrimaryColor());
			}
		}, 280);
	});

	// Also listen for theme storage changes so color updates restart animation
	if (typeof browser !== "undefined" && browser.storage?.onChanged) {
		browser.storage.onChanged.addListener((changes, area) => {
			if (area !== "local" || !changes.themeSettings) return;
			const newTheme = changes.themeSettings.newValue;
			if (!newTheme) return;
			const newType = newTheme.bgAnimation || "none";
			// setThemeVariables will update the attribute; observer will fire.
			// But also restart canvas animation with updated color
			if (CANVAS_TYPES.has(newType)) {
				setTimeout(() => {
					startAnimation(newType, getPrimaryColor());
				}, 50); // small delay for CSS vars to update
			}
		});
	}
}

if (document.readyState === "loading") {
	document.addEventListener("DOMContentLoaded", init);
} else {
	init();
}
