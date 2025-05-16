/**
 * Domain Constants
 * Centralized list of domains for consistent handling across the extension
 */

// List of known Ranobes domains - all share the same site structure
export const RANOBES_DOMAINS = [
	"ranobes.net",
	"ranobes.com",
	"ranobes.top",
	"ranobes.org",
	"ranobes.me",
	"ranobes.to",
	"ranobes.co",
	"ranobes.cc",
	"ranobes.ru",
	"ranobes.io",
];

// List of known Fanfiction domains - all share the same site structure
export const FANFICTION_DOMAINS = [
	"fanfiction.net",
	// Reserved for future fanfiction domains with identical structure
];

/**
 * Checks if a hostname is a Ranobes domain
 * @param {string} hostname - The hostname to check
 * @returns {boolean} - True if it's a Ranobes domain
 */
export function isRanobesDomain(hostname) {
	const normalizedHostname = hostname.toLowerCase();
	return RANOBES_DOMAINS.some(
		(domain) =>
			normalizedHostname === domain ||
			normalizedHostname === `www.${domain}`
	);
}

/**
 * Checks if a hostname is a Fanfiction domain
 * @param {string} hostname - The hostname to check
 * @returns {boolean} - True if it's a Fanfiction domain
 */
export function isFanfictionDomain(hostname) {
	const normalizedHostname = hostname.toLowerCase();
	return FANFICTION_DOMAINS.some(
		(domain) =>
			normalizedHostname.endsWith(`.${domain}`) ||
			normalizedHostname === domain
	);
}

export default {
	RANOBES_DOMAINS,
	FANFICTION_DOMAINS,
	isRanobesDomain,
	isFanfictionDomain,
};
