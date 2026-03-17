#!/usr/bin/env node

const { main } = require("../packages/commit-history-cli/lib/core.js");

main(process.argv.slice(2));
