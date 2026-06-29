import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { formatCliError, EstimateError } from "./errors.mjs";
import { readJsonBounded, writeJsonFile, writeTextFile } from "./json-io.mjs";
import { resolveRoot, resolveSafePath } from "./path-safety.mjs";
import {
  calibrate,
  classify,
  estimate,
  flowAlign,
  intake,
  packet,
  referenceClass,
  render,
  review,
  split,
} from "./workflow.mjs";

const COMMANDS = {
  doctor: { input: false, run: runDoctor },
  intake: { input: true, run: intake },
  split: { input: true, run: split },
  packet: { input: true, run: packet },
  "flow-align": { input: true, run: flowAlign },
  classify: { input: true, run: classify },
  "reference-class": { input: true, run: referenceClass },
  estimate: { input: true, run: estimate },
  render: { input: true, run: render },
  review: { input: true, run: review },
  calibrate: { input: true, run: calibrate },
};

const HELP = `opencode-estimate <command> [options]

Dependency-free Node ESM estimator workflow for OpenCode Qwen planning.

Commands:
  doctor            Print runtime and package checks
  intake            Normalize legacy request JSON
  split             Split intake into ordered implementation tasks
  packet            Build agent-ready packets from split tasks
  flow-align        Align packets to discover/implement/verify/report phases
  classify          Classify size and risk
  reference-class   Select the estimator reference class
  estimate          Produce p50/p80 hour estimate
  render            Render estimate as Markdown
  review            Review estimate structure and residual issues
  calibrate         Compare estimate with --actual-hours

Options:
  --input, -i <file>         JSON input under --root
  --out, -o <file>           Output path under --root
  --root <dir>               Path-safety root (default: cwd)
  --fixture <name>           Load bundled fixture input: legacy-sample, failure-empty-evidence
  --actual-hours <number>    Used by calibrate
  --pretty                   Pretty-print JSON (default)
  --help, -h                 Show help
`;

function parseArgs(argv) {
  const options = { pretty: true };
  let command = undefined;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      options.help = true;
    } else if (arg === "--input" || arg === "-i") {
      options.input = requireValue(argv, ++index, arg);
    } else if (arg === "--out" || arg === "-o") {
      options.out = requireValue(argv, ++index, arg);
    } else if (arg === "--root") {
      options.root = requireValue(argv, ++index, arg);
    } else if (arg === "--fixture") {
      options.fixture = requireValue(argv, ++index, arg);
    } else if (arg === "--actual-hours") {
      options.actualHours = Number(requireValue(argv, ++index, arg));
      if (!Number.isFinite(options.actualHours) || options.actualHours < 0) {
        throw new EstimateError("E_ARG_VALUE", "--actual-hours must be a non-negative number");
      }
    } else if (arg === "--pretty") {
      options.pretty = true;
    } else if (arg.startsWith("-")) {
      throw new EstimateError("E_ARG_UNKNOWN", `Unknown option: ${arg}`);
    } else if (!command) {
      command = arg;
    } else {
      throw new EstimateError("E_ARG_EXTRA", `Unexpected argument: ${arg}`);
    }
  }
  return { command, options };
}

function requireValue(argv, index, name) {
  const value = argv[index];
  if (!value || value.startsWith("-")) {
    throw new EstimateError("E_ARG_VALUE", `Missing value for ${name}`);
  }
  return value;
}

function fixturePath(name) {
  if (name === "legacy-sample") {
    const here = path.dirname(fileURLToPath(import.meta.url));
    return path.resolve(here, "../fixtures/legacy-sample/request.json");
  }
  if (name === "failure-empty-evidence") {
    const here = path.dirname(fileURLToPath(import.meta.url));
    return path.resolve(here, "../fixtures/failure-empty-evidence/estimate.json");
  }
  throw new EstimateError("E_FIXTURE_UNKNOWN", `Unknown fixture: ${name}`);
}

function readInput(root, options, commandSpec) {
  if (!commandSpec.input) {
    return undefined;
  }
  if (options.fixture) {
    return readJsonBounded(fixturePath(options.fixture));
  }
  if (!options.input) {
    throw new EstimateError("E_INPUT_MISSING", "Command requires --input or --fixture");
  }
  return readJsonBounded(resolveSafePath(root, options.input, "input"));
}

function runDoctor(_input, options, context) {
  const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const fixture = path.resolve(packageRoot, "fixtures/legacy-sample/request.json");
  return {
    kind: "estimate.doctor",
    ok: true,
    node: process.version,
    esm: true,
    dependencyFree: true,
    cwd: context.cwd,
    root: context.root,
    fixturePresent: fs.existsSync(fixture),
    commands: Object.keys(COMMANDS),
  };
}

function serialize(command, result, pretty) {
  if (command === "render") {
    return result.endsWith("\n") ? result : `${result}\n`;
  }
  return `${JSON.stringify(result, null, pretty ? 2 : 0)}\n`;
}

export async function runCli(argv, streams) {
  try {
    const { command, options } = parseArgs(argv);
    if (options.help || !command) {
      streams.stdout.write(HELP);
      return 0;
    }

    const commandSpec = COMMANDS[command];
    if (!commandSpec) {
      throw new EstimateError("E_COMMAND_UNKNOWN", `Unknown command: ${command}`);
    }

    const root = resolveRoot(options.root ?? streams.cwd);
    const input = readInput(root, options, commandSpec);
    const result = commandSpec.run(input, options, { cwd: streams.cwd, root });
    const output = serialize(command, result, options.pretty);

    if (options.out) {
      const outPath = resolveSafePath(root, options.out, "out");
      if (command === "render") {
        writeTextFile(outPath, output);
      } else {
        writeJsonFile(outPath, result, options.pretty);
      }
    }

    streams.stdout.write(output);
    if (command === "review" && result?.ok === false) {
      return 2;
    }
    return 0;
  } catch (error) {
    streams.stderr.write(`${formatCliError(error)}\n`);
    return 1;
  }
}
