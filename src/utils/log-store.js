// Persistent log storage with write queue to avoid race conditions

const DB_NAME = "rg_logs_v1";
const STORE_NAME = "logs";
const INDEX_TS = "ts";
let initPromise = null;
let writeQueue = [];
let flushing = false;
let flushScheduled = false;
let maxEntries = 5000;
const scheduleMicrotask =
	typeof queueMicrotask === "function"
		? queueMicrotask
		: (fn) => Promise.resolve().then(fn);

function openDb() {
	if (initPromise) return initPromise;
	initPromise = new Promise((resolve, reject) => {
		const req = indexedDB.open(DB_NAME, 1);
		req.onupgradeneeded = () => {
			const db = req.result;
			if (!db.objectStoreNames.contains(STORE_NAME)) {
				const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
				store.createIndex(INDEX_TS, INDEX_TS, { unique: false });
			}
		};
		req.onsuccess = () => resolve(req.result);
		req.onerror = () => reject(req.error);
	});
	return initPromise;
}

export function setMaxEntries(limit) {
	if (typeof limit === "number" && limit > 100) {
		maxEntries = Math.min(limit, 50000);
	}
}

export function appendLog(entry) {
	writeQueue.push(entry);
	scheduleFlush();
}

function scheduleFlush() {
	if (flushScheduled) return;
	flushScheduled = true;
	scheduleMicrotask(() => {
		flushScheduled = false;
		void flushQueue();
	});
}

async function flushQueue() {
	if (flushing) return;
	flushing = true;
	try {
		const db = await openDb();
		while (writeQueue.length > 0) {
			const batch = writeQueue.splice(0, 50);
			await new Promise((resolve, reject) => {
				const tx = db.transaction(STORE_NAME, "readwrite");
				const store = tx.objectStore(STORE_NAME);
				batch.forEach((item) => store.put(item));
				tx.oncomplete = resolve;
				tx.onerror = () => reject(tx.error);
			});
		}
		await trimIfNeeded(db);
	} catch (err) {
		console?.warn?.("log-store flush failed", err);
	} finally {
		flushing = false;
		if (writeQueue.length > 0) scheduleFlush();
	}
}

async function trimIfNeeded(db) {
	return new Promise((resolve) => {
		try {
			const tx = db.transaction(STORE_NAME, "readwrite");
			const store = tx.objectStore(STORE_NAME);
			const index = store.index(INDEX_TS);
			const countReq = index.count();
			countReq.onsuccess = () => {
				const total = countReq.result || 0;
				if (total <= maxEntries) {
					resolve();
					return;
				}
				let toDelete = total - maxEntries;
				const cursorReq = index.openCursor();
				cursorReq.onsuccess = (ev) => {
					const cursor = ev.target.result;
					if (cursor && toDelete > 0) {
						cursor.delete();
						toDelete -= 1;
						cursor.continue();
					} else {
						resolve();
					}
				};
				cursorReq.onerror = () => resolve();
			};
			countReq.onerror = () => resolve();
		} catch (_err) {
			resolve();
		}
	});
}

export async function getLogs(limit = 1000) {
	const db = await openDb();
	return new Promise((resolve, reject) => {
		try {
			const tx = db.transaction(STORE_NAME, "readonly");
			const store = tx.objectStore(STORE_NAME);
			const index = store.index(INDEX_TS);
			const results = [];
			index.openCursor(null, "prev").onsuccess = (ev) => {
				const cursor = ev.target.result;
				if (cursor && results.length < limit) {
					results.push(cursor.value);
					cursor.continue();
				} else {
					resolve(results);
				}
			};
			tx.onerror = () => reject(tx.error);
		} catch (err) {
			reject(err);
		}
	});
}

export async function clearLogs() {
	const db = await openDb();
	return new Promise((resolve, reject) => {
		try {
			const tx = db.transaction(STORE_NAME, "readwrite");
			tx.objectStore(STORE_NAME).clear();
			tx.oncomplete = () => resolve();
			tx.onerror = () => reject(tx.error);
		} catch (err) {
			reject(err);
		}
	});
}

export async function exportLogsBlob({ limit = 5000 } = {}) {
	const logs = await getLogs(limit);
	const blob = new Blob([JSON.stringify(logs, null, 2)], {
		type: "application/json",
	});
	return { blob, count: logs.length };
}

export async function downloadLogs({ limit = 5000, filename = "ranobe-logs.json" } = {}) {
	const { blob, count } = await exportLogsBlob({ limit });
	if (typeof document === "undefined") return { blob, count };
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = filename;
	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
	URL.revokeObjectURL(url);
	return { count };
}

// Optional helper for external upload targets (e.g., Google Drive). Caller passes an async uploader.
export async function uploadWithAdapter(adapter, options = {}) {
	if (typeof adapter !== "function") throw new Error("adapter must be a function");
	const { blob, count } = await exportLogsBlob(options);
	await adapter(blob, { count, filename: options.filename || "ranobe-logs.json" });
	return { count };
}
