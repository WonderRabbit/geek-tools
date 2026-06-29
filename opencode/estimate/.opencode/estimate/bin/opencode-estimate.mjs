#!/usr/bin/env node
import { runCli } from "../lib/cli.mjs";

runCli(process.argv.slice(2), {
  cwd: process.cwd(),
  stdout: process.stdout,
  stderr: process.stderr,
}).then((code) => {
  process.exitCode = code;
});
