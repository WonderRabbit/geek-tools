#!/usr/bin/env node
"use strict";

const { runPowerShellScript } = require("./wonder_estimate_spawn_node.js");

runPowerShellScript("install", {
  "--target-root": { ps: "-TargetRoot", value: true },
  "--json": { ps: "-Json", value: false },
  "--force": { ps: "-Force", value: false },
  "--what-if": { ps: "-WhatIf", value: false },
});

