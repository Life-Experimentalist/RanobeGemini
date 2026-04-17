import {
	ensureDriveAccessToken,
	revokeDriveTokens,
	uploadLibraryBackupToDrive,
	listDriveBackups,
	downloadDriveBackup,
	getContinuousDriveBackup,
	getLatestDriveBackup,
} from "../../../utils/drive.js";

export function createGoogleDriveStorageAdapter() {
	return {
		async uploadBackup(backupBlob, options = {}) {
			return uploadLibraryBackupToDrive(backupBlob, options);
		},
		async listBackups() {
			return listDriveBackups();
		},
		async downloadBackup(fileId) {
			return downloadDriveBackup(fileId);
		},
		async getLatestBackup() {
			return getLatestDriveBackup();
		},
		async getContinuousBackup() {
			return getContinuousDriveBackup();
		},
		async ensureAuth({ interactive = true } = {}) {
			return ensureDriveAccessToken({ interactive });
		},
		async resetAuth() {
			return revokeDriveTokens();
		},
	};
}
