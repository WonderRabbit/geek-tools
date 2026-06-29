#!/usr/bin/env node
"use strict";

const { runPowerShellScript } = require("./wonder_estimate_spawn_node.js");

runPowerShellScript("qwen-preflight", {
  "--config": { ps: "-ConfigPath", value: true },
  "--endpoint": { ps: "-Endpoint", value: true },
  "--model": { ps: "-Model", value: true },
  "--skip-network": { ps: "-SkipNetwork", value: false },
  "--json": { ps: "-Json", value: false },
});

