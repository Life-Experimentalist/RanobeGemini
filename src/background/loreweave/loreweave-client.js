/**
 * LoreWeave API client — sends graph deltas to the LoreWeave backend.
 *
 * This is the single place where traffic leaves the browser for LoreWeave, so
 * it re-checks the experimental gate itself. Callers check it too; this is the
 * backstop that makes "off means no network" true regardless of call path.
 */

import {
	isLoreWeaveEnabled,
	LOREWEAVE_DISABLED_MESSAGE,
} from "../../utils/loreweave-gate.js";

const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * POST a graph delta to /lw_api/ingest.
 * @param {string} baseUrl      - e.g. "https://loreweave.vkrishna04.me"
 * @param {Object} delta        - IngestDelta (domain_id, extracted_entities, state_forms, temporal_edges)
 * @param {string} [accountKey] - Secret account key (identity + auth in one, SponsorBlock-style)
 * @returns {Promise<{status: string, domain_id: string}>}
 */
export async function postIngestDelta(baseUrl, delta, accountKey) {
	if (!(await isLoreWeaveEnabled())) {
		throw new Error(LOREWEAVE_DISABLED_MESSAGE);
	}

	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
	try {
		const headers = { "Content-Type": "application/json" };
		if (accountKey) headers["Authorization"] = `Bearer ${accountKey}`;

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
	if (!(await isLoreWeaveEnabled())) return false;
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
