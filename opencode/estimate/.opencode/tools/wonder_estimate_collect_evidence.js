#!/usr/bin/env node
"use strict";

const { runPowerShellScript } = require("./wonder_estimate_spawn_node.js");

runPowerShellScript("collect-evidence", {
  "--target-root": { ps: "-TargetRoot", value: true },
  "--out": { ps: "-Out", value: true },
  "--limit": { ps: "-Limit", value: true },
  "--json": { ps: "-Json", value: false },
});

