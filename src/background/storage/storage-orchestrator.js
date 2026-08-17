import { validateStorageSyncAdapterRuntime } from "./storage-interface.js";

const DEFAULT_ACTIVE_SYNC_PROVIDER = "google-drive";

/**
 * Read the ordered list of active sync destinations from storage.
 * Returns an array of { providerId, customPath? } objects.
 * Falls back to legacy `activeSync` string for backward compatibility.
 *
 * @param {Object} browserRef
 * @param {string} defaultProvider
 * @returns {Promise<Array<{providerId: string, customPath?: string}>>}
 */
async function readSyncDestinations(browserRef, defaultProvider) {
	try {
		if (!browserRef?.storage?.local?.get)
			return [{ providerId: defaultProvider }];
		const stored = await browserRef.storage.local.get([
			"syncDestinations",
			"activeSync",
		]);

		// New multi-sync format
		if (
			Array.isArray(stored?.syncDestinations) &&
			stored.syncDestinations.length
		) {
			return stored.syncDestinations
				.filter(
					(d) =>
						d && typeof d.providerId === "string" && d.providerId,
				)
				.map((d) => ({ ...d }));
		}

		// Legacy single-provider format
		const legacy = stored?.activeSync || defaultProvider;
		return [{ providerId: legacy }];
	} catch (_err) {
		return [{ providerId: defaultProvider }];
	}
}

export function createStorageSyncOrchestrator({
	browserRef,
	adapters = {},
	defaultProvider = DEFAULT_ACTIVE_SYNC_PROVIDER,
} = {}) {
	const registry = new Map();

	Object.entries(adapters).forEach(([providerId, adapter]) => {
		validateStorageSyncAdapterRuntime(adapter, providerId);
		registry.set(providerId, adapter);
	});

	function getRegisteredProviders() {
		return Array.from(registry.keys());
	}

	async function getActiveSyncProviderId() {
		const destinations = await readSyncDestinations(
			browserRef,
			defaultProvider,
		);
		const primary = destinations[0]?.providerId || defaultProvider;
		return registry.has(primary) ? primary : defaultProvider;
	}

	async function getActiveSyncAdapter() {
		const activeProviderId = await getActiveSyncProviderId();
		const activeAdapter = registry.get(activeProviderId);
		if (!activeAdapter) {
			throw new Error(
				`No storage sync adapter registered for provider '${activeProviderId}'.`,
			);
		}
		return {
			providerId: activeProviderId,
			adapter: activeAdapter,
		};
	}

	/**
	 * Upload backup to ALL configured sync destinations in parallel.
	 * Returns results from each destination.
	 */
	async function uploadBackup(backupBlob, options = {}) {
		const destinations = await readSyncDestinations(
			browserRef,
			defaultProvider,
		);
		const validDestinations = destinations.filter((d) =>
			registry.has(d.providerId),
		);

		if (!validDestinations.length) {
			// Fall back to default provider
			const adapter = registry.get(defaultProvider);
			if (!adapter)
				throw new Error(
					`No adapter for default provider '${defaultProvider}'.`,
				);
			const result = await adapter.uploadBackup(backupBlob, options);
			return { providerId: defaultProvider, ...result };
		}

		// Fan out to all destinations; primary result is returned, others run in parallel
		const [primary, ...secondaries] = validDestinations;
		const primaryAdapter = registry.get(primary.providerId);
		const primaryOpts = { ...options, customPath: primary.customPath };

		// Fire secondary uploads without waiting (best-effort)
		for (const dest of secondaries) {
			const adapter = registry.get(dest.providerId);
			if (adapter) {
				adapter
					.uploadBackup(backupBlob, {
						...options,
						customPath: dest.customPath,
					})
					.catch(() => {});
			}
		}

		const result = await primaryAdapter.uploadBackup(
			backupBlob,
			primaryOpts,
		);
		return { providerId: primary.providerId, ...result };
	}

	async function listBackups(options = {}) {
		const { providerId, adapter } = await getActiveSyncAdapter();
		const backups = await adapter.listBackups(options);
		return { providerId, backups: Array.isArray(backups) ? backups : [] };
	}

	async function downloadBackup(fileId, options = {}) {
		const { providerId, adapter } = await getActiveSyncAdapter();
		const data = await adapter.downloadBackup(fileId, options);
		return { providerId, data };
	}

	async function getLatestBackup(options = {}) {
		const { providerId, adapter } = await getActiveSyncAdapter();
		const file = await adapter.getLatestBackup(options);
		return { providerId, file: file || null };
	}

	async function getContinuousBackup(options = {}) {
		const { providerId, adapter } = await getActiveSyncAdapter();
		const file = await adapter.getContinuousBackup(options);
		return { providerId, file: file || null };
	}

	async function ensureAuth(options = {}) {
		const { providerId, adapter } = await getActiveSyncAdapter();
		if (typeof adapter.ensureAuth !== "function") {
			throw new Error(
				`Storage sync adapter '${providerId}' does not implement ensureAuth().`,
			);
		}
		const result = await adapter.ensureAuth(options);
		return { providerId, result };
	}

	async function resetAuth(options = {}) {
		const { providerId, adapter } = await getActiveSyncAdapter();
		if (typeof adapter.resetAuth !== "function") {
			throw new Error(
				`Storage sync adapter '${providerId}' does not implement resetAuth().`,
			);
		}
		const result = await adapter.resetAuth(options);
		return { providerId, result };
	}

	return {
		getRegisteredProviders,
		getActiveSyncProviderId,
		getActiveSyncAdapter,
		uploadBackup,
		listBackups,
		downloadBackup,
		getLatestBackup,
		getContinuousBackup,
		ensureAuth,
		resetAuth,
	};
}
