#!/usr/bin/env node
import { runPowerShellScript } from "../openwrite/lib/pwsh-runner.mjs";

runPowerShellScript("smoke", {
  "--target-root": { ps: "-TargetRoot", value: true },
  "--json": { ps: "-Json", value: false },
  "--keep-temp": { ps: "-KeepTemp", value: false },
});
