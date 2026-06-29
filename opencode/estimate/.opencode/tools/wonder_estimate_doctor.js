#!/usr/bin/env node
"use strict";

const { runPowerShellScript } = require("./wonder_estimate_spawn_node.js");

runPowerShellScript("doctor", {
  "--target-root": { ps: "-TargetRoot", value: true },
  "--config": { ps: "-ConfigPath", value: true },
  "--json": { ps: "-Json", value: false },
  "--strict": { ps: "-Strict", value: false },
});

