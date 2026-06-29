#!/usr/bin/env node
"use strict";

const { runPowerShellScript } = require("./wonder_estimate_spawn_node.js");

runPowerShellScript("verify-offline-bundle", {
  "--bundle": { ps: "-Bundle", value: true },
  "--json": { ps: "-Json", value: false },
});

