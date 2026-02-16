// Debug panel for RanobeGemini extension

/**
 * Creates a debug panel element for displaying trace and debugging information
 *
 * @returns {HTMLElement} The debug panel DOM element
 */
export function createDebugPanel() {
	// Check if panel already exists
	if (document.getElementById("gemini-debug-panel")) {
		return document.getElementById("gemini-debug-panel");
	}

	// Create the debug panel container
	const panel = document.createElement("div");
	panel.id = "gemini-debug-panel";
	panel.className = "gemini-debug-panel";
	panel.style.cssText = `
        position: fixed;
        bottom: 10px;
        right: 10px;
        width: 40px;
        height: 40px;
        background-color: #233438;
        color: #bab9a0;
        border: 1px solid #5e8ca7;
        border-radius: 50%;
        z-index: 10000;
        box-shadow: 0 2px 10px rgba(0,0,0,0.3);
        overflow: hidden;
        transition: all 0.3s ease;
        cursor: pointer;
        display: flex;
        justify-content: center;
        align-items: center;
    `;

	// Create toggle button
	const toggleButton = document.createElement("div");
	toggleButton.className = "debug-panel-toggle";
	toggleButton.innerHTML = "🔍";
	toggleButton.style.cssText = `
        font-size: 20px;
        display: flex;
        justify-content: center;
        align-items: center;
    `;

	// Create panel content container (initially hidden)
	const contentContainer = document.createElement("div");
	contentContainer.className = "debug-panel-content";
	contentContainer.style.cssText = `
        display: none;
        padding: 15px;
        height: calc(100% - 30px);
        overflow-y: auto;
    `;

	// Create header with controls
	const header = document.createElement("div");
	header.className = "debug-panel-header";
	header.style.cssText = `
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 10px;
        border-bottom: 1px solid #5e8ca7;
        padding-bottom: 5px;
    `;

	const title = document.createElement("h3");
	title.textContent = "Gemini Debug";
	title.style.cssText = `
        margin: 0;
        font-size: 16px;
        color: #bab9a0;
    `;

	const closeButton = document.createElement("button");
	closeButton.textContent = "×";
	closeButton.style.cssText = `
        background: none;
        border: none;
        color: #bab9a0;
        font-size: 20px;
        cursor: pointer;
        padding: 0 5px;
    `;

	// Create tab buttons
	const tabContainer = document.createElement("div");
	tabContainer.className = "debug-panel-tabs";
	tabContainer.style.cssText = `
        display: flex;
        border-bottom: 1px solid #5e8ca7;
        margin-bottom: 10px;
    `;

	const traceTab = document.createElement("button");
	traceTab.textContent = "Trace";
	traceTab.className = "debug-tab active";
	traceTab.dataset.tab = "trace";

	const stateTab = document.createElement("button");
	stateTab.textContent = "State";
	stateTab.className = "debug-tab";
	stateTab.dataset.tab = "state";

	const helpTab = document.createElement("button");
	helpTab.textContent = "Help";
	helpTab.className = "debug-tab";
	helpTab.dataset.tab = "help";

	// Style the tabs
	[traceTab, stateTab, helpTab].forEach((tab) => {
		tab.style.cssText = `
            background: none;
            border: none;
            padding: 5px 10px;
            cursor: pointer;
            color: #bab9a0;
            flex: 1;
            text-align: center;
        `;
	});

	// Add active tab styling
	traceTab.style.borderBottom = "2px solid #5e8ca7";

	// Create tab content containers
	const traceContent = document.createElement("div");
	traceContent.className = "tab-content";
	traceContent.dataset.tab = "trace";
	traceContent.style.cssText = `
        display: block;
        height: calc(100% - 80px);
        overflow-y: auto;
    `;

	const stateContent = document.createElement("div");
	stateContent.className = "tab-content";
	stateContent.dataset.tab = "state";
	stateContent.style.display = "none";

	const helpContent = document.createElement("div");
	helpContent.className = "tab-content";
	helpContent.dataset.tab = "help";
	helpContent.style.display = "none";
	helpContent.innerHTML = `
        <h4>Debug Panel Help</h4>
        <p>This panel shows tracing information during chapter processing.</p>
        <ul>
            <li><strong>Trace:</strong> Shows step-by-step processing with timing</li>
            <li><strong>State:</strong> Shows current processing state and settings</li>
        </ul>
        <p>Click the 🔍 button to toggle this panel.</p>
    `;

	// Add initial trace content
	traceContent.innerHTML = `<p>No trace data available yet. Process a chapter to see tracing information.</p>`;

	// Add initial state content
	stateContent.innerHTML = `<p>No state information available yet.</p>`;

	// Assemble the header
	header.appendChild(title);
	header.appendChild(closeButton);

	// Assemble the tabs
	tabContainer.appendChild(traceTab);
	tabContainer.appendChild(stateTab);
	tabContainer.appendChild(helpTab);

	// Assemble the content
	contentContainer.appendChild(header);
	contentContainer.appendChild(tabContainer);
	contentContainer.appendChild(traceContent);
	contentContainer.appendChild(stateContent);
	contentContainer.appendChild(helpContent);

	// Add elements to panel
	panel.appendChild(toggleButton);
	panel.appendChild(contentContainer);

	// Add event listeners for panel functionality
	let isExpanded = false;

	toggleButton.addEventListener("click", () => {
		isExpanded = !isExpanded;

		if (isExpanded) {
			panel.style.width = "400px";
			panel.style.height = "500px";
			panel.style.borderRadius = "6px";
			contentContainer.style.display = "block";
			toggleButton.style.display = "none";
		}
	});

	closeButton.addEventListener("click", () => {
		isExpanded = false;
		panel.style.width = "40px";
		panel.style.height = "40px";
		panel.style.borderRadius = "50%";
		contentContainer.style.display = "none";
		toggleButton.style.display = "flex";
	});

	// Tab switching
	[traceTab, stateTab, helpTab].forEach((tab) => {
		tab.addEventListener("click", (e) => {
			// Update active tab styling
			[traceTab, stateTab, helpTab].forEach((t) => {
				t.style.borderBottom = "none";
			});
			e.target.style.borderBottom = "2px solid #5e8ca7";

			// Hide all content
			const tabContents = document.querySelectorAll(".tab-content");
			tabContents.forEach((content) => {
				content.style.display = "none";
			});

			// Show current tab content
			const tabName = e.target.dataset.tab;
			const activeContent = document.querySelector(
				`.tab-content[data-tab="${tabName}"]`,
			);
			if (activeContent) {
				activeContent.style.display = "block";
			}
		});
	});

	// Add the panel to the document
	document.body.appendChild(panel);

	return panel;
}

/**
 * Update the trace content in the debug panel
 *
 * @param {string} traceContent - HTML content to display in the trace tab
 */
export function updateTraceContent(traceContent) {
	const panel = document.getElementById("gemini-debug-panel");
	if (!panel) return;

	const traceTab = panel.querySelector('.tab-content[data-tab="trace"]');
	if (traceTab) {
		traceTab.innerHTML = traceContent;
	}
}

/**
 * Update the state content in the debug panel
 *
 * @param {Object} state - State object to display
 */
export function updateStateContent(state) {
	const panel = document.getElementById("gemini-debug-panel");
	if (!panel) return;

	const stateTab = panel.querySelector('.tab-content[data-tab="state"]');
	if (stateTab) {
		let stateHtml = "<h4>Processing State</h4>";

		if (state) {
			stateHtml +=
				'<table style="width:100%; border-collapse: collapse;">';
			for (const [key, value] of Object.entries(state)) {
				let displayValue = value;

				// Format objects and arrays nicely
				if (typeof value === "object" && value !== null) {
					try {
						displayValue = JSON.stringify(value, null, 2);
						displayValue = `<pre style="margin: 0; max-height: 100px; overflow-y: auto;">${displayValue}</pre>`;
					} catch (e) {
						displayValue = "[Complex Object]";
					}
				}

				stateHtml += `
                    <tr style="border-bottom: 1px solid #455a64;">
                        <td style="padding: 5px; font-weight: bold;">${key}</td>
                        <td style="padding: 5px;">${displayValue}</td>
                    </tr>
                `;
			}
			stateHtml += "</table>";
		} else {
			stateHtml += "<p>No state information available.</p>";
		}

		stateTab.innerHTML = stateHtml;
	}
}

/**
 * Format trace data for HTML display
 *
 * @param {Array} traceSteps - Array of trace step objects
 * @returns {string} HTML formatted trace content
 */
export function formatTraceForDisplay(traceSteps) {
	if (!traceSteps || traceSteps.length === 0) {
		return "<p>No trace data available.</p>";
	}

	let html = `
        <h4>Processing Trace</h4>
        <div class="trace-timeline" style="margin-bottom: 15px; position: relative; height: 30px; background: #233438; border-radius: 4px;">
    `;

	// Get total time for scaling
	const totalTime = parseFloat(traceSteps[traceSteps.length - 1].time.total);

	// Add timeline markers
	traceSteps.forEach((step, index) => {
		const position = (parseFloat(step.time.total) / totalTime) * 100;
		html += `
            <div class="timeline-marker" style="position: absolute; top: 0; left: ${position}%; width: 2px; height: 100%; background: #5e8ca7;"
                title="Step ${index + 1}: ${step.step} (${step.time.total})">
            </div>
        `;
	});

	html += `</div><table style="width:100%; border-collapse: collapse;">
        <tr style="background-color: #233438;">
            <th style="padding: 5px; text-align: left;">#</th>
            <th style="padding: 5px; text-align: left;">Step</th>
            <th style="padding: 5px; text-align: left;">Total Time</th>
            <th style="padding: 5px; text-align: left;">Step Time</th>
        </tr>
    `;

	traceSteps.forEach((step, index) => {
		const rowStyle = index % 2 === 0 ? "" : "background-color: #2a3f45;";
		html += `
            <tr style="${rowStyle}">
                <td style="padding: 5px;">${index + 1}</td>
                <td style="padding: 5px;">${step.step}</td>
                <td style="padding: 5px;">${step.time.total}</td>
                <td style="padding: 5px;">${step.time.sinceLast}</td>
            </tr>
        `;

		// Add data row if available
		if (step.data) {
			let dataContent;
			try {
				if (typeof step.data === "object") {
					dataContent = JSON.stringify(step.data, null, 2);
				} else {
					dataContent = step.data.toString();
				}
			} catch (e) {
				dataContent = "[Cannot display data]";
			}

			html += `
                <tr style="${rowStyle}">
                    <td style="padding: 5px;"></td>
                    <td colspan="3" style="padding: 5px;">
                        <details>
                            <summary>Data</summary>
                            <pre style="margin: 5px 0; max-height: 100px; overflow-y: auto; background: #1a282d; padding: 5px; border-radius: 4px;">${dataContent}</pre>
                        </details>
                    </td>
                </tr>
            `;
		}
	});

	html += "</table>";
	return html;
}

export default {
	createDebugPanel,
	updateTraceContent,
	updateStateContent,
	formatTraceForDisplay,
};
