#!/usr/bin/env node
import { spawn } from "node:child_process"
import { resolveCodeGraph } from "./resolve-codegraph.mjs"

const resolved = resolveCodeGraph(process.cwd())

if (!resolved.ok || !resolved.command) {
  console.error(resolved.message || "CodeGraph binary is not available.")
  process.exit(1)
}

const isWindowsCommand = process.platform === "win32" && /\.(cmd|bat)$/i.test(resolved.command)
const command = isWindowsCommand ? "cmd.exe" : resolved.command
const args = isWindowsCommand ? ["/d", "/s", "/c", `"${resolved.command}"`, "mcp"] : ["mcp"]

const child = spawn(command, args, {
  cwd: process.cwd(),
  stdio: "inherit",
  shell: false,
})

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal)
    return
  }
  process.exit(code ?? 1)
})

child.on("error", (error) => {
  console.error(error.message)
  process.exit(1)
})
