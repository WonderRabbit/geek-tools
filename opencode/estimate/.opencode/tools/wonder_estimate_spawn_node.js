#!/usr/bin/env node
"use strict";

const { spawn } = require("node:child_process");
const path = require("node:path");

function runPowerShellScript(scriptKey, allowedFlags) {
  const file = process.execPath;
  const runner = path.join(__dirname, "wonder_estimate_runner.js");
  let translated;
  try {
    translated = translateArgs(process.argv.slice(2), allowedFlags);
  } catch (error) {
    console.error(`wonder_estimate option error: ${error.message}`);
    process.exitCode = 2;
    return;
  }
  const args = [runner, "--script-key", scriptKey, ...translated];
  const child = spawn(file, args, {
    shell: false,
    stdio: "inherit",
    windowsHide: true,
  });

  child.on("error", (error) => {
    console.error(`wonder_estimate failed to start Node: ${error.message}`);
    process.exitCode = 127;
  });

  child.on("exit", (code, signal) => {
    if (signal) {
      console.error(`wonder_estimate interrupted by signal: ${signal}`);
      process.exitCode = 128;
      return;
    }
    process.exitCode = code === null ? 1 : code;
  });
}

function translateArgs(argv, allowedFlags) {
  const translated = [];
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--help" || token === "-h") {
      translated.push("--help");
      continue;
    }
    const equalsIndex = token.indexOf("=");
    const flag = equalsIndex === -1 ? token : token.slice(0, equalsIndex);
    const spec = allowedFlags[flag];
    if (!spec) {
      throw new Error(`Unsupported option for this wrapper: ${flag}`);
    }
    translated.push("--ps-flag", spec.ps);
    if (!spec.value) {
      if (equalsIndex !== -1) {
        throw new Error(`Option does not accept a value: ${flag}`);
      }
      continue;
    }
    const value = equalsIndex === -1 ? argv[index + 1] : token.slice(equalsIndex + 1);
    if (value === undefined) {
      throw new Error(`Missing value for option: ${flag}`);
    }
    if (equalsIndex === -1) {
      index += 1;
    }
    assertSafeValue(value);
    translated.push("--ps-value", value);
  }
  return translated;
}

function assertSafeValue(value) {
  if (value.includes("\u0000") || value.includes("\n") || value.includes("\r")) {
    throw new Error("Option values must be single-line strings without NUL bytes.");
  }
}

module.exports = { runPowerShellScript };
