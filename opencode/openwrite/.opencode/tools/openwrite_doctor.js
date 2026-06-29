#!/usr/bin/env node
import { runPowerShellScript } from "../openwrite/lib/pwsh-runner.mjs";

runPowerShellScript("doctor", {
  "--target-root": { ps: "-TargetRoot", value: true },
  "--json": { ps: "-Json", value: false },
  "--strict": { ps: "-Strict", value: false },
});
