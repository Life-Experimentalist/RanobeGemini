/**
 * Domain Constants
 * Dynamically collects supported domains from all website handlers
 * This file acts as a centralized registry that automatically updates
 * when new handlers are added or domains are modified.
 */

import { RanobesHandler } from "./website-handlers/ranobes-handler.js";
import { FanfictionHandler } from "./website-handlers/fanfiction-handler.js";
import { AO3Handler } from "./website-handlers/ao3-handler.js";
import { WebNovelHandler } from "./website-handlers/webnovel-handler.js";

/**
 * Registry of all handler classes
 * Add new handler classes here when creating new website handlers
 */
const HANDLER_CLASSES = [
	RanobesHandler,
	FanfictionHandler,
	AO3Handler,
	WebNovelHandler,
];

/**
 * Dynamically collected domains from all handlers
 * This object is built automatically from handler SUPPORTED_DOMAINS
 */
export const DOMAIN_REGISTRY = {};

/**
 * All supported domains flattened into a single array
 */
export const ALL_SUPPORTED_DOMAINS = [];

/**
 * Site-specific default prompts collected from handlers
 */
export const SITE_PROMPTS = {};

// Build the registry automatically
HANDLER_CLASSES.forEach((HandlerClass) => {
	const handlerName = HandlerClass.name.replace("Handler", "").toUpperCase();
	const domains = HandlerClass.SUPPORTED_DOMAINS || [];
	const prompt = HandlerClass.DEFAULT_SITE_PROMPT || "";

	// Store domains by handler name
	DOMAIN_REGISTRY[handlerName] = domains;

	// Add to flattened array
	ALL_SUPPORTED_DOMAINS.push(...domains);

	// Store site-specific prompts for each domain
	domains.forEach(domain => {
		SITE_PROMPTS[domain] = prompt;
	});
});

/**
 * Helper: Matches hostname against pattern (supports wildcards like *.domain.com)
 * @param {string} hostname - The hostname to check (e.g., "www.fanfiction.net")
 * @param {string} pattern - The pattern to match (e.g., "*.fanfiction.net" or "archiveofourown.org")
 * @returns {boolean} - True if hostname matches pattern
 */
function matchesDomainPattern(hostname, pattern) {
	const normalizedHostname = hostname.toLowerCase();
	const normalizedPattern = pattern.toLowerCase();

	// Handle wildcard patterns (*.domain.com)
	if (normalizedPattern.startsWith("*.")) {
		const baseDomain = normalizedPattern.substring(2); // Remove "*."
		// Match bare domain (domain.com)
		if (normalizedHostname === baseDomain) return true;
		// Match any subdomain (www.domain.com, m.domain.com, etc.)
		if (normalizedHostname.endsWith(`.${baseDomain}`)) return true;
		return false;
	}

	// Exact domain match
	return normalizedHostname === normalizedPattern;
}

/**
 * Helper: Expands wildcard patterns for backward compatibility
 * Converts "*.domain.com" to ["domain.com", "www.domain.com", "m.domain.com"]
 * @param {Array<string>} domains - Array of domain patterns
 * @returns {Array<string>} - Expanded array with common subdomains
 */
function expandWildcards(domains) {
	const expanded = [];
	domains.forEach(domain => {
		if (domain.startsWith("*.")) {
			const base = domain.substring(2);
			expanded.push(base, `www.${base}`, `m.${base}`);
		} else {
			expanded.push(domain);
		}
	});
	return expanded;
}

/**
 * Legacy exports for backward compatibility
 * Wildcards are expanded to common subdomains
 */
export const RANOBES_DOMAINS = expandWildcards(DOMAIN_REGISTRY.RANOBES || []);
export const FANFICTION_DOMAINS = expandWildcards(DOMAIN_REGISTRY.FANFICTION || []);
export const AO3_DOMAINS = expandWildcards(DOMAIN_REGISTRY.AO3 || []);
export const WEBNOVEL_DOMAINS = expandWildcards(DOMAIN_REGISTRY.WEBNOVEL || []);

/**
 * Checks if a hostname matches any supported domain
 * Supports wildcard patterns (*.domain.com) and exact matches
 * @param {string} hostname - The hostname to check
 * @returns {boolean} - True if it's a supported domain
 */
export function isSupportedDomain(hostname) {
	return ALL_SUPPORTED_DOMAINS.some(pattern =>
		matchesDomainPattern(hostname, pattern)
	);
}

/**
 * Gets the site-specific prompt for a hostname
 * Supports wildcard patterns (*.domain.com)
 * @param {string} hostname - The hostname to get prompt for
 * @returns {string} - The site-specific prompt or empty string
 */
export function getSitePrompt(hostname) {
	// Check each pattern in SITE_PROMPTS
	for (const [pattern, prompt] of Object.entries(SITE_PROMPTS)) {
		if (matchesDomainPattern(hostname, pattern)) {
			return prompt;
		}
	}
	return "";
}

/**
 * Checks if a hostname is a Ranobes domain
 * Uses pattern matching for wildcard support
 * @param {string} hostname - The hostname to check
 * @returns {boolean} - True if it's a Ranobes domain
 */
export function isRanobesDomain(hostname) {
	const patterns = DOMAIN_REGISTRY.RANOBES || [];
	return patterns.some((pattern) => matchesDomainPattern(hostname, pattern));
}

/**
 * Checks if a hostname is a Fanfiction domain
 * Uses pattern matching for wildcard support
 * @param {string} hostname - The hostname to check
 * @returns {boolean} - True if it's a Fanfiction domain
 */
export function isFanfictionDomain(hostname) {
	const patterns = DOMAIN_REGISTRY.FANFICTION || [];
	return patterns.some((pattern) => matchesDomainPattern(hostname, pattern));
}

/**
 * Checks if a hostname is an AO3 domain
 * Uses pattern matching for wildcard support
 * @param {string} hostname - The hostname to check
 * @returns {boolean} - True if it's an AO3 domain
 */
export function isAO3Domain(hostname) {
	const patterns = DOMAIN_REGISTRY.AO3 || [];
	return patterns.some((pattern) => matchesDomainPattern(hostname, pattern));
}

/**
 * Checks if a hostname is a WebNovel domain
 * Uses pattern matching for wildcard support
 * @param {string} hostname - The hostname to check
 * @returns {boolean} - True if it's a WebNovel domain
 */
export function isWebNovelDomain(hostname) {
	const patterns = DOMAIN_REGISTRY.WEBNOVEL || [];
	return patterns.some((pattern) => matchesDomainPattern(hostname, pattern));
}

/**
 * Generates manifest.json content scripts matches array
 * Converts wildcard patterns (*.domain.com) to manifest format (*://*.domain.com/*)
 * @returns {Array<string>} - Array of match patterns for manifest.json
 */
export function generateManifestMatches() {
	return ALL_SUPPORTED_DOMAINS.map((pattern) => {
		// If pattern is already a wildcard (*.domain.com), convert to manifest format
		if (pattern.startsWith("*.")) {
			const baseDomain = pattern.substring(2);
			return `*://*.${baseDomain}/*`;
		}
		// For exact domains, add wildcard prefix for manifest
		return `*://*.${pattern}/*`;
	});
}

export default {
	DOMAIN_REGISTRY,
	ALL_SUPPORTED_DOMAINS,
	SITE_PROMPTS,
	RANOBES_DOMAINS,
	FANFICTION_DOMAINS,
	AO3_DOMAINS,
	WEBNOVEL_DOMAINS,
	isSupportedDomain,
	getSitePrompt,
	isRanobesDomain,
	isFanfictionDomain,
	isAO3Domain,
	isWebNovelDomain,
	generateManifestMatches,
};
