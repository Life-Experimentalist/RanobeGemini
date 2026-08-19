/**
 * A `browser.storage.sync` stand-in that enforces the same limits the browser
 * does, so quota bugs surface in tests instead of on a user's machine.
 *
 * Byte accounting matches Chrome's: key length plus the JSON stringification of
 * the value.
 */

export const QUOTA_BYTES = 102_400;
export const QUOTA_BYTES_PER_ITEM = 8_192;
export const MAX_ITEMS = 512;

function itemBytes(key, value) {
	return key.length + JSON.stringify(value).length;
}

/**
 * @param {object} [initial] - Seed contents.
 * @returns {{sync: object, dump: () => object, writes: () => number}}
 */
export function createFakeSyncStorage(initial = {}) {
	const store = new Map(Object.entries(initial));
	let writes = 0;

	const totalBytes = () => {
		let total = 0;
		for (const [key, value] of store) total += itemBytes(key, value);
		return total;
	};

	const sync = {
		async get(keys) {
			if (keys === null || keys === undefined) {
				return Object.fromEntries(store);
			}
			const list = Array.isArray(keys) ? keys : [keys];
			const out = {};
			for (const key of list) {
				if (store.has(key)) out[key] = store.get(key);
			}
			return out;
		},

		async getBytesInUse(keys) {
			if (keys === null || keys === undefined) return totalBytes();
			const list = Array.isArray(keys) ? keys : [keys];
			let total = 0;
			for (const key of list) {
				if (store.has(key)) total += itemBytes(key, store.get(key));
			}
			return total;
		},

		async set(items) {
			writes++;
			// Validate the whole batch before mutating: a rejected set writes
			// nothing, same as the real API.
			const next = new Map(store);
			for (const [key, value] of Object.entries(items)) {
				const bytes = itemBytes(key, value);
				if (bytes > QUOTA_BYTES_PER_ITEM) {
					throw new Error(
						`QUOTA_BYTES_PER_ITEM quota exceeded for "${key}" (${bytes} bytes)`,
					);
				}
				next.set(key, value);
			}
			let total = 0;
			for (const [key, value] of next) total += itemBytes(key, value);
			if (total > QUOTA_BYTES) {
				throw new Error("QUOTA_BYTES quota exceeded");
			}
			if (next.size > MAX_ITEMS) {
				throw new Error("MAX_ITEMS quota exceeded");
			}
			for (const [key, value] of next) store.set(key, value);
		},

		async remove(keys) {
			writes++;
			const list = Array.isArray(keys) ? keys : [keys];
			for (const key of list) store.delete(key);
		},

		async clear() {
			writes++;
			store.clear();
		},
	};

	return {
		sync,
		dump: () => Object.fromEntries(store),
		writes: () => writes,
	};
}

/**
 * Install a fake `browser` global for the duration of a test.
 *
 * @param {object} [initial]
 * @returns {{dump: () => object, writes: () => number, restore: () => void}}
 */
export function installFakeBrowser(initial = {}) {
	const previous = globalThis.browser;
	const fake = createFakeSyncStorage(initial);
	globalThis.browser = { storage: { sync: fake.sync } };
	return {
		dump: fake.dump,
		writes: fake.writes,
		restore: () => {
			globalThis.browser = previous;
		},
	};
}
