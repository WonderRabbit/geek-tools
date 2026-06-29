#!/usr/bin/env node
import { runPowerShellScript } from "../openwrite/lib/pwsh-runner.mjs";

runPowerShellScript("install", {
  "--target-root": { ps: "-TargetRoot", value: true },
  "--json": { ps: "-Json", value: false },
  "--force": { ps: "-Force", value: false },
  "--what-if": { ps: "-WhatIf", value: false },
});
