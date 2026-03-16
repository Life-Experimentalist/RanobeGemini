// Hamburger navigation toggle — shared across all landing pages
(function () {
	var toggle = document.querySelector(".nav-toggle");
	var nav = document.querySelector(".nav");
	if (!toggle || !nav) return;

	function openMenu() {
		nav.classList.add("open");
		toggle.setAttribute("aria-expanded", "true");
		toggle.textContent = "✕";
	}

	function closeMenu() {
		nav.classList.remove("open");
		toggle.setAttribute("aria-expanded", "false");
		toggle.textContent = "☰";
	}

	toggle.addEventListener("click", function () {
		if (nav.classList.contains("open")) closeMenu();
		else openMenu();
	});

	// Close when clicking a nav link (handles anchor + page links)
	nav.addEventListener("click", function (e) {
		if (e.target.tagName === "A") closeMenu();
	});

	// Close when clicking anywhere outside the header
	document.addEventListener("click", function (e) {
		var header = document.querySelector(".topbar");
		if (
			header &&
			!header.contains(e.target) &&
			nav.classList.contains("open")
		) {
			closeMenu();
		}
	});

	// Close on Escape key
	document.addEventListener("keydown", function (e) {
		if (e.key === "Escape" && nav.classList.contains("open")) closeMenu();
	});
})();
