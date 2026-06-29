#!/usr/bin/env node
"use strict";

const { spawn } = require("node:child_process");
const path = require("node:path");

const scriptMap = Object.freeze({
  install: "install.ps1",
  doctor: "doctor.ps1",
  "qwen-preflight": "qwen-preflight.ps1",
  smoke: "smoke.ps1",
  "collect-evidence": "collect-evidence.ps1",
  "make-offline-bundle": "make-offline-bundle.ps1",
  "verify-offline-bundle": "verify-offline-bundle.ps1",
});

main();

function main() {
  const parsed = parseRunnerArgs(process.argv.slice(2));
  if (parsed.help) {
    printHelp();
    return;
  }
  const scriptName = scriptMap[parsed.scriptKey];
  if (!scriptName) {
    throw new Error(`Unsupported script key: ${parsed.scriptKey}`);
  }
  const pwsh = resolvePowerShell();
  const scriptsDir = path.resolve(__dirname, "..", "estimate", "scripts");
  const scriptPath = path.join(scriptsDir, scriptName);
  const psArgs = ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", scriptPath, ...parsed.psArgs];
  const child = spawn(pwsh, psArgs, {
    shell: false,
    stdio: "inherit",
    windowsHide: true,
  });

  child.on("error", (error) => {
    console.error(`wonder_estimate failed to start PowerShell (${pwsh}): ${error.message}`);
    process.exitCode = 127;
  });

  child.on("exit", (code, signal) => {
    if (signal) {
      console.error(`PowerShell wrapper interrupted by signal: ${signal}`);
      process.exitCode = 128;
      return;
    }
    process.exitCode = code === null ? 1 : code;
  });
}

function parseRunnerArgs(argv) {
  let scriptKey = "";
  const psArgs = [];
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--help") {
      return { help: true, scriptKey: "", psArgs: [] };
    }
    if (token === "--script-key") {
      scriptKey = requiredValue(argv, index, token);
      index += 1;
      continue;
    }
    if (token === "--ps-flag") {
      const flag = requiredValue(argv, index, token);
      assertPowerShellFlag(flag);
      psArgs.push(flag);
      index += 1;
      continue;
    }
    if (token === "--ps-value") {
      const value = requiredValue(argv, index, token);
      assertSafeValue(value);
      psArgs.push(value);
      index += 1;
      continue;
    }
    throw new Error(`Unsupported runner option: ${token}`);
  }
  if (!scriptKey) {
    throw new Error("Missing --script-key.");
  }
  return { help: false, scriptKey, psArgs };
}

function requiredValue(argv, index, flag) {
  const value = argv[index + 1];
  if (value === undefined) {
    throw new Error(`Missing value for ${flag}.`);
  }
  return value;
}

function assertPowerShellFlag(flag) {
  if (!/^-[A-Za-z][A-Za-z0-9]*$/.test(flag)) {
    throw new Error(`Unsafe PowerShell parameter name: ${flag}`);
  }
}

function assertSafeValue(value) {
  if (value.includes("\u0000") || value.includes("\n") || value.includes("\r")) {
    throw new Error("PowerShell parameter values must be single-line strings without NUL bytes.");
  }
}

function resolvePowerShell() {
  if (process.env.WONDER_ESTIMATE_PWSH) {
    return process.env.WONDER_ESTIMATE_PWSH;
  }
  return process.platform === "win32" ? "pwsh.exe" : "pwsh";
}

function printHelp() {
  console.log("wonder_estimate_runner executes fixed estimate PowerShell scripts with shell:false.");
}
