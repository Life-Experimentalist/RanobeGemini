const { spawnSync } = require("child_process");
const path = require("path");

const toolPath = path.join(__dirname, "emoji-tools.js");
const result = spawnSync(process.execPath, [toolPath, "repair"], {
	stdio: "inherit",
});

process.exit(result.status ?? 1);
