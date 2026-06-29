import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptMap = Object.freeze({
  install: "install.ps1",
  doctor: "doctor.ps1",
  smoke: "smoke.ps1",
  "make-offline-bundle": "make-offline-bundle.ps1",
  "verify-offline-bundle": "verify-offline-bundle.ps1",
  "prepare-tools": "prepare-tools.ps1",
});

export function runPowerShellScript(scriptKey, optionMap) {
  try {
    const scriptName = scriptMap[scriptKey];
    if (!scriptName) {
      throw new Error(`Unsupported script key: ${scriptKey}`);
    }
    const psArgs = parseArgs(process.argv.slice(2), optionMap);
    const pwsh = resolvePowerShell();
    const scriptsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "scripts");
    const scriptPath = path.join(scriptsDir, scriptName);
    const child = spawn(pwsh, ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", scriptPath, ...psArgs], {
      shell: false,
      stdio: "inherit",
      windowsHide: true,
    });
    child.on("error", (error) => {
      console.error(`openwrite failed to start PowerShell (${pwsh}): ${error.message}`);
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
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

function parseArgs(argv, optionMap) {
  const psArgs = [];
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const spec = optionMap[token];
    if (!spec) {
      throw new Error(`Unsupported option: ${token}`);
    }
    assertPowerShellFlag(spec.ps);
    psArgs.push(spec.ps);
    if (spec.value) {
      const value = argv[index + 1];
      if (value === undefined) {
        throw new Error(`Missing value for ${token}.`);
      }
      assertSafeValue(value);
      psArgs.push(value);
      index += 1;
    }
  }
  return psArgs;
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
  if (process.env.OPENWRITE_PWSH) {
    return process.env.OPENWRITE_PWSH;
  }
  return process.platform === "win32" ? "pwsh.exe" : "pwsh";
}
