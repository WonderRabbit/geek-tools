#!/usr/bin/env node
"use strict";

const { runPowerShellScript } = require("./wonder_estimate_spawn_node.js");

runPowerShellScript("make-offline-bundle", {
  "--output-dir": { ps: "-OutputDir", value: true },
  "--bundle-name": { ps: "-BundleName", value: true },
  "--json": { ps: "-Json", value: false },
  "--force": { ps: "-Force", value: false },
});

