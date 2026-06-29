#!/usr/bin/env node
"use strict";

const { runPowerShellScript } = require("./wonder_estimate_spawn_node.js");

runPowerShellScript("smoke", {
  "--target-root": { ps: "-TargetRoot", value: true },
  "--json": { ps: "-Json", value: false },
});

