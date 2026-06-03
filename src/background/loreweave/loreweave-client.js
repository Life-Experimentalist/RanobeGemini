/**
 * LoreWeave API client — sends graph deltas to the LoreWeave backend.
 */

const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * POST a graph delta to /lw_api/ingest.
 * @param {string} baseUrl  - e.g. "https://loreweave.vkrishna04.me"
 * @param {Object} delta    - IngestDelta (domain_id, extracted_entities, state_forms, temporal_edges)
 * @param {string} [token]  - Optional bearer token (LW_API_TOKEN on the server)
 * @param {string} [userId] - Client UUID for the shared instance (SponsorBlock-style)
 * @returns {Promise<{status: string, domain_id: string}>}
 */
export async function postIngestDelta(baseUrl, delta, token, userId) {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
	try {
		const headers = { "Content-Type": "application/json" };
		if (token) headers["Authorization"] = `Bearer ${token}`;
		if (userId) headers["X-LW-User-ID"] = userId;

		const res = await fetch(`${baseUrl}/lw_api/ingest`, {
			method: "POST",
			headers,
			body: JSON.stringify(delta),
			signal: controller.signal,
		});
		if (!res.ok) {
			const body = await res.text().catch(() => "");
			throw new Error(`LoreWeave ingest failed ${res.status}: ${body}`);
		}
		return await res.json();
	} finally {
		clearTimeout(timer);
	}
}

/**
 * Check that the LoreWeave backend is reachable.
 * @param {string} baseUrl
 * @returns {Promise<boolean>}
 */
export async function pingLoreWeave(baseUrl) {
	try {
		const res = await fetch(`${baseUrl}/health`, {
			method: "GET",
			signal: AbortSignal.timeout(5_000),
		});
		return res.ok;
	} catch {
		return false;
	}
}
