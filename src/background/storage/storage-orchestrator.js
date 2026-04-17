import { validateStorageSyncAdapterRuntime } from "./storage-interface.js";

const DEFAULT_ACTIVE_SYNC_PROVIDER = "google-drive";

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
		try {
			if (!browserRef?.storage?.local?.get) {
				return defaultProvider;
			}
			const stored = await browserRef.storage.local.get("activeSync");
			const requestedProvider = stored?.activeSync || defaultProvider;
			if (registry.has(requestedProvider)) {
				return requestedProvider;
			}
			return defaultProvider;
		} catch (_error) {
			return defaultProvider;
		}
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

	async function uploadBackup(backupBlob, options = {}) {
		const { providerId, adapter } = await getActiveSyncAdapter();
		const result = await adapter.uploadBackup(backupBlob, options);
		return { providerId, ...result };
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
