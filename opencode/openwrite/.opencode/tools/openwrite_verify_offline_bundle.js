#!/usr/bin/env node
import { runPowerShellScript } from "../openwrite/lib/pwsh-runner.mjs";

runPowerShellScript("verify-offline-bundle", {
  "--bundle": { ps: "-Bundle", value: true },
  "--json": { ps: "-Json", value: false },
});
