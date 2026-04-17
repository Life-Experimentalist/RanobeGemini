/**
 * Storage sync adapter contract helpers.
 */

export const REQUIRED_STORAGE_SYNC_METHODS = [
	"uploadBackup",
	"listBackups",
	"downloadBackup",
	"getLatestBackup",
	"getContinuousBackup",
];

export const OPTIONAL_STORAGE_SYNC_METHODS = ["ensureAuth", "resetAuth"];

export function validateStorageSyncAdapterRuntime(
	adapter,
	providerId = "unknown",
) {
	if (!adapter || typeof adapter !== "object") {
		throw new Error(
			`Storage sync adapter '${providerId}' is missing or invalid.`,
		);
	}

	for (const methodName of REQUIRED_STORAGE_SYNC_METHODS) {
		if (typeof adapter[methodName] !== "function") {
			throw new Error(
				`Storage sync adapter '${providerId}' is missing required method '${methodName}'.`,
			);
		}
	}

	return true;
}
