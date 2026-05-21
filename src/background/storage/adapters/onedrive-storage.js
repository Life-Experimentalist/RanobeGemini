import {
	ensureOnedriveAccessToken,
	revokeOnedriveTokens,
	uploadOnedriveBackup,
	listOnedriveBackups,
	downloadOnedriveBackup,
	getContinuousOnedriveBackup,
	getLatestOnedriveBackup,
} from "../../../utils/onedrive.js";

export function createOnedriveStorageAdapter() {
	return {
		async uploadBackup(backupBlob, options = {}) {
			return uploadOnedriveBackup(backupBlob, options);
		},
		async listBackups(options = {}) {
			return listOnedriveBackups(options);
		},
		async downloadBackup(fileId) {
			return downloadOnedriveBackup(fileId);
		},
		async getLatestBackup(options = {}) {
			return getLatestOnedriveBackup(options);
		},
		async getContinuousBackup(options = {}) {
			return getContinuousOnedriveBackup(options);
		},
		async ensureAuth({ interactive = true } = {}) {
			return ensureOnedriveAccessToken({ interactive });
		},
		async resetAuth() {
			return revokeOnedriveTokens();
		},
	};
}
