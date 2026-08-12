/**
 * Queue Manager — processes chapter ranges in the background.
 *
 * Storage key: rg_queue
 * Job schema:
 * {
 *   id, novelId, novelTitle, firstChapterUrl,
 *   startChapter, endChapter, status, progress,
 *   options: { sendToLoreWeave, writingStyle, loreWeaveUrl, domainId },
 *   createdAt, completedAt, error
 * }
 */

import { graphifyChapter } from "./graphify-service.js";
import { saveChapterRecord } from "./chronicle-storage.js";
import { runDomJob } from "../dom-host.js";
import { isLoreWeaveEnabled } from "../../utils/loreweave-gate.js";
import { DEFAULT_MODEL_ENDPOINT } from "../../utils/constants.js";

const QUEUE_KEY = "rg_queue";
const SHORT_CHAPTER_THRESHOLD_WORDS = 1600;
const CHAPTER_FETCH_RETRY = 2;
const CHAPTER_FETCH_BACKOFF_MS = 2000;
const MIN_CHAPTER_WORDS = 100;

let _processing = false;

// ─── Storage helpers ──────────────────────────────────────────────────────────

async function loadQueue() {
	const stored = await browser.storage.local.get(QUEUE_KEY);
	return stored[QUEUE_KEY] || { jobs: [], activeJobId: null };
}

async function saveQueue(queue) {
	await browser.storage.local.set({ [QUEUE_KEY]: queue });
}

async function updateJobProgress(jobId, progressPatch) {
	const queue = await loadQueue();
	const job = queue.jobs.find((j) => j.id === jobId);
	if (!job) return;
	Object.assign(job.progress, progressPatch);
	await saveQueue(queue);
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function enqueueJob(jobConfig) {
	const id = `rg_job_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
	const job = {
		id,
		novelId: jobConfig.novelId || `queue_novel_${Date.now()}`,
		novelTitle: jobConfig.novelTitle || "Novel",
		firstChapterUrl: jobConfig.firstChapterUrl,
		startChapter: jobConfig.startChapter || 1,
		endChapter: jobConfig.endChapter || 1,
		status: "pending",
		progress: {
			current: 0,
			total: Math.max(
				1,
				(jobConfig.endChapter || 1) - (jobConfig.startChapter || 1) + 1,
			),
			processedChapters: [],
			failedChapters: [],
			skippedChapters: [],
		},
		options: {
			sendToLoreWeave: jobConfig.sendToLoreWeave !== false,
			writingStyle: jobConfig.writingStyle || "other",
			loreWeaveUrl: jobConfig.loreWeaveUrl || "",
			domainId: jobConfig.domainId || "",
		},
		createdAt: Date.now(),
		novelLastRead: jobConfig.novelLastRead || 0,
		completedAt: null,
		error: null,
	};

	const queue = await loadQueue();
	queue.jobs.push(job);
	await saveQueue(queue);

	if (!_processing) {
		startQueue().catch(console.error);
	}
	return id;
}

export async function startQueue() {
	if (_processing) return;
	_processing = true;
	try {
		await _processLoop();
	} finally {
		_processing = false;
	}
}

export async function pauseQueue() {
	const queue = await loadQueue();
	const active = queue.jobs.find(
		(j) => j.id === queue.activeJobId || j.status === "running",
	);
	if (active) {
		active.status = "paused";
		await saveQueue(queue);
	}
	_processing = false;
}

export async function resumeQueue() {
	// Re-activate the first paused job so _processLoop picks it up.
	const queue = await loadQueue();
	const paused = queue.jobs.find((j) => j.status === "paused");
	if (paused) {
		paused.status = "pending";
		await saveQueue(queue);
	}
	if (!_processing) startQueue().catch(console.error);
}

export async function cancelJob(jobId) {
	const queue = await loadQueue();
	const idx = queue.jobs.findIndex((j) => j.id === jobId);
	if (idx !== -1) queue.jobs.splice(idx, 1);
	if (queue.activeJobId === jobId) queue.activeJobId = null;
	await saveQueue(queue);
}

export async function getQueueStatus() {
	return loadQueue();
}

// ─── Processing loop ─────────────────────────────────────────────────────────

async function _processLoop() {
	while (true) {
		const queue = await loadQueue();
		// Priority: sort pending jobs by novelLastRead descending (most-recently-read first)
		const candidates = queue.jobs
			.filter((j) => j.status === "pending" || j.status === "running")
			.sort(
				(a, b) =>
					(b.novelLastRead || b.createdAt || 0) -
					(a.novelLastRead || a.createdAt || 0),
			);
		const nextJob = candidates[0] || null;
		if (!nextJob || nextJob.status === "paused") break;

		queue.activeJobId = nextJob.id;
		nextJob.status = "running";
		await saveQueue(queue);

		try {
			const config = await _loadConfig();
			await _processChapters(nextJob, config);
			const q2 = await loadQueue();
			const j2 = q2.jobs.find((j) => j.id === nextJob.id);
			if (j2 && j2.status === "running") {
				j2.status = "done";
				j2.completedAt = Date.now();
			}
			q2.activeJobId = null;
			await saveQueue(q2);
		} catch (err) {
			const q2 = await loadQueue();
			const j2 = q2.jobs.find((j) => j.id === nextJob.id);
			if (j2) {
				j2.status = "error";
				j2.error = err.message;
			}
			q2.activeJobId = null;
			await saveQueue(q2);
		}
	}
}

async function _processChapters(job, config) {
	let currentUrl = job.firstChapterUrl;
	let chapterNum = job.startChapter;
	const buffer = [];
	let bufferWords = 0;

	while (chapterNum <= job.endChapter && currentUrl) {
		// Check for pause/cancel signal
		const q = await loadQueue();
		const current = q.jobs.find((j) => j.id === job.id);
		if (!current || current.status === "paused") return;

		let fetchResult;
		try {
			fetchResult = await _fetchChapter(currentUrl, chapterNum);
		} catch (fetchErr) {
			console.warn(
				`[Queue] Fetch threw for ch ${chapterNum}:`,
				fetchErr?.message,
			);
			fetchResult = { content: "", nextUrl: null, words: 0 };
		}
		const { content, nextUrl, words } = fetchResult;

		if (!content || words < MIN_CHAPTER_WORDS) {
			// Chapter was empty or too short — count as skipped, not failed
			const skipped = [
				...(current.progress.skippedChapters || []),
				chapterNum,
			];
			await updateJobProgress(job.id, {
				skippedChapters: skipped,
				current: chapterNum,
			});
		} else if (words < SHORT_CHAPTER_THRESHOLD_WORDS) {
			buffer.push({ chapterNum, content, words });
			bufferWords += words;
			if (bufferWords >= 3200 || chapterNum === job.endChapter) {
				try {
					await _flushBuffer([...buffer], job, config);
					const processed = [
						...(current.progress.processedChapters || []),
						...buffer.map((b) => b.chapterNum),
					];
					await updateJobProgress(job.id, {
						processedChapters: processed,
						current: chapterNum,
					});
				} catch (flushErr) {
					const failed = [
						...(current.progress.failedChapters || []),
						...buffer.map((b) => b.chapterNum),
					];
					await updateJobProgress(job.id, {
						failedChapters: failed,
						current: chapterNum,
					});
					console.warn(
						`[Queue] Flush failed for batch ending at ch ${chapterNum}:`,
						flushErr?.message,
					);
				}
				buffer.length = 0;
				bufferWords = 0;
			}
		} else {
			if (buffer.length > 0) {
				try {
					await _flushBuffer([...buffer], job, config);
					const processed = [
						...(current.progress.processedChapters || []),
						...buffer.map((b) => b.chapterNum),
					];
					await updateJobProgress(job.id, {
						processedChapters: processed,
					});
				} catch (bufFlushErr) {
					const failed = [
						...(current.progress.failedChapters || []),
						...buffer.map((b) => b.chapterNum),
					];
					await updateJobProgress(job.id, { failedChapters: failed });
					console.warn(
						`[Queue] Flush failed for buffer:`,
						bufFlushErr?.message,
					);
				}
				buffer.length = 0;
				bufferWords = 0;
			}
			try {
				await _flushBuffer(
					[{ chapterNum, content, words }],
					job,
					config,
				);
				const processed = [
					...(current.progress.processedChapters || []),
					chapterNum,
				];
				await updateJobProgress(job.id, {
					processedChapters: processed,
					current: chapterNum,
				});
			} catch (singleFlushErr) {
				const failed = [
					...(current.progress.failedChapters || []),
					chapterNum,
				];
				await updateJobProgress(job.id, {
					failedChapters: failed,
					current: chapterNum,
				});
				console.warn(
					`[Queue] Flush failed for ch ${chapterNum}:`,
					singleFlushErr?.message,
				);
			}
		}

		currentUrl = nextUrl;
		chapterNum++;
	}

	// Flush remainder
	if (buffer.length > 0) {
		await _flushBuffer([...buffer], job, config);
	}
}

async function _flushBuffer(batch, job, config) {
	if (!batch.length) return;
	const combinedText = batch.map((b) => b.content).join("\n\n---\n\n");
	const firstChapter = batch[0].chapterNum;
	const lastChapter = batch[batch.length - 1].chapterNum;
	const epochLabel =
		batch.length === 1
			? `Chapter ${String(firstChapter).padStart(4, "0")}`
			: `Chapters ${firstChapter}-${lastChapter}`;

	let summary = "";
	try {
		summary = await _generateSummary(combinedText, config, epochLabel);
	} catch (err) {
		console.warn(`[Queue] Summary failed for ${epochLabel}:`, err.message);
	}

	// The queue itself is not a LoreWeave feature — only this step is, so it is
	// the only part the experimental gate switches off.
	const graphifyAllowed =
		job.options.sendToLoreWeave &&
		job.novelId &&
		(await isLoreWeaveEnabled());

	if (graphifyAllowed) {
		try {
			const graphifyConfig = {
				...config,
				loreWeaveUrl:
					job.options.loreWeaveUrl || config.loreWeaveUrl || "",
				loreWeaveDomainId:
					job.options.domainId || config.loreWeaveDomainId || "",
				loreWeaveWritingStyle: job.options.writingStyle,
				loreWeaveChronicleEnabled: true,
				loreWeaveNovelId: job.novelId,
			};
			if (
				graphifyConfig.loreWeaveUrl &&
				graphifyConfig.loreWeaveDomainId
			) {
				await graphifyChapter(
					combinedText,
					graphifyConfig,
					firstChapter,
					epochLabel,
				);
			}
		} catch (err) {
			console.warn(
				`[Queue] Graphify failed for ${epochLabel}:`,
				err.message,
			);
		}
	}

	for (const { chapterNum } of batch) {
		await saveChapterRecord(job.novelId, chapterNum, {
			chapterLabel: `Chapter ${String(chapterNum).padStart(4, "0")}`,
			summary:
				batch.length > 1 ? `[Batch ${epochLabel}] ${summary}` : summary,
			shortSummary: "",
			entities: [],
			edges: [],
			graphified: graphifyAllowed,
			domainId: job.options.domainId || config.loreWeaveDomainId || "",
		});
	}
}

// ─── Chapter fetching ─────────────────────────────────────────────────────────

async function _fetchChapter(url, chapterNum) {
	let lastErr;
	for (let attempt = 0; attempt <= CHAPTER_FETCH_RETRY; attempt++) {
		try {
			if (attempt > 0) {
				await new Promise((r) =>
					setTimeout(r, CHAPTER_FETCH_BACKOFF_MS),
				);
			}
			const res = await fetch(url, { credentials: "omit" });
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			const html = await res.text();
			// Parsing runs through the DOM host: this module executes in the
			// background, which on Chromium is a service worker with no DOMParser.
			return await runDomJob("parseLoreWeaveChapter", { html, url });
		} catch (err) {
			lastErr = err;
		}
	}
	console.warn(
		`[Queue] Failed to fetch chapter ${chapterNum}:`,
		lastErr?.message,
	);
	return { content: "", nextUrl: null, words: 0 };
}

// ─── AI summary ───────────────────────────────────────────────────────────────

async function _generateSummary(text, config, epochLabel) {
	const prompt = `Summarise the following novel chapter(s) in 2-4 paragraphs covering: main events, character actions, key reveals, and important world-building. Label: ${epochLabel}.\n\n${text.slice(0, 80_000)}`;
	const provider = String(config.aiProvider || "gemini").toLowerCase();

	try {
		if (provider === "openai-compatible") {
			return await _summarizeOpenAI(prompt, config);
		}
		if (provider === "ollama") {
			return await _summarizeOllama(prompt, config);
		}
		return await _summarizeGemini(prompt, config);
	} catch (err) {
		console.warn("[Queue] Summary error:", err.message);
		return "";
	}
}

async function _summarizeGemini(prompt, config) {
	const apiKey = config.apiKey;
	if (!apiKey) return "";
	const modelEndpoint = config.modelEndpoint || DEFAULT_MODEL_ENDPOINT;
	const res = await fetch(`${modelEndpoint}?key=${apiKey}`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			contents: [{ role: "user", parts: [{ text: prompt }] }],
			generationConfig: { temperature: 0.3, maxOutputTokens: 2048 },
		}),
	});
	if (!res.ok) return "";
	const data = await res.json();
	return data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
}

async function _summarizeOpenAI(prompt, config) {
	const apiKey = config.openAiApiKey || config.apiKey;
	if (!apiKey) return "";
	const endpoint =
		config.openAiEndpoint || "https://api.openai.com/v1/chat/completions";
	const res = await fetch(endpoint, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${apiKey}`,
		},
		body: JSON.stringify({
			model: config.openAiModel || "gpt-4o-mini",
			messages: [{ role: "user", content: prompt }],
			temperature: 0.3,
			max_tokens: 2048,
		}),
	});
	if (!res.ok) return "";
	const data = await res.json();
	return data?.choices?.[0]?.message?.content?.trim() || "";
}

async function _summarizeOllama(prompt, config) {
	const endpoint =
		config.ollamaEndpoint || "http://localhost:11434/api/generate";
	const model = config.ollamaModel || "llama3.1:8b";
	const res = await fetch(endpoint, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ model, prompt, stream: false }),
	});
	if (!res.ok) return "";
	const data = await res.json();
	return String(data?.response || "").trim();
}

async function _loadConfig() {
	const data = await browser.storage.local.get();
	return data || {};
}
