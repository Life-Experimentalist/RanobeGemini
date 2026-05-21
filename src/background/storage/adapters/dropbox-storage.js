import {
	ensureDropboxAccessToken,
	revokeDropboxTokens,
	uploadDropboxBackup,
	listDropboxBackups,
	downloadDropboxBackup,
	getContinuousDropboxBackup,
	getLatestDropboxBackup,
} from "../../../utils/dropbox.js";

export function createDropboxStorageAdapter() {
	return {
		async uploadBackup(backupBlob, options = {}) {
			return uploadDropboxBackup(backupBlob, options);
		},
		async listBackups(options = {}) {
			return listDropboxBackups(options);
		},
		async downloadBackup(fileId) {
			return downloadDropboxBackup(fileId);
		},
		async getLatestBackup(options = {}) {
			return getLatestDropboxBackup(options);
		},
		async getContinuousBackup(options = {}) {
			return getContinuousDropboxBackup(options);
		},
		async ensureAuth({ interactive = true } = {}) {
			return ensureDropboxAccessToken({ interactive });
		},
		async resetAuth() {
			return revokeDropboxTokens();
		},
	};
}
