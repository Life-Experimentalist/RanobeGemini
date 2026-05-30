/**
 * Background message handler for chapter queue operations.
 * Handles action: "queue" with subAction: add|pause|resume|cancel|status|start
 */

import {
	enqueueJob,
	pauseQueue,
	resumeQueue,
	cancelJob,
	getQueueStatus,
	startQueue,
} from "../loreweave/queue-manager.js";

export default {
	action: "queue",

	handler(message, sendResponse) {
		const { subAction } = message;

		const dispatch = () => {
			switch (subAction) {
				case "add":    return enqueueJob(message.job);
				case "pause":  return pauseQueue();
				case "resume": return resumeQueue();
				case "cancel": return cancelJob(message.jobId);
				case "status": return getQueueStatus();
				case "start":  return startQueue();
				default:       return Promise.resolve({ error: `Unknown subAction: ${subAction}` });
			}
		};

		dispatch()
			.then((result) => sendResponse({ success: true, result }))
			.catch((err) => sendResponse({ success: false, error: err.message }));

		return true;
	},
};
