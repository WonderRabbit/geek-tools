#!/usr/bin/env node
import { runPowerShellScript } from "../openwrite/lib/pwsh-runner.mjs";

runPowerShellScript("make-offline-bundle", {
  "--output-dir": { ps: "-OutputDir", value: true },
  "--bundle-name": { ps: "-BundleName", value: true },
  "--json": { ps: "-Json", value: false },
  "--force": { ps: "-Force", value: false },
});
