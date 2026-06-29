#!/usr/bin/env bash
set -euo pipefail

MODE="${1:-all}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PATCH="$ROOT/patches/opencode-write-json-repair.patch"
EVIDENCE_DIR="$ROOT/.omo/ulw-loop/opencode-write-json-repair-impl/evidence"
TARGET="${OPENCODE_VERIFY_TARGET:-/private/tmp/opencode-ultraresearch}"

mkdir -p "$EVIDENCE_DIR"

require_text() {
  local file="$1"
  local pattern="$2"
  if ! grep -Eq "$pattern" "$file"; then
    echo "missing pattern '$pattern' in $file" >&2
    exit 1
  fi
}

verify_installer_static() {
  require_text "$ROOT/install-opencode-write-json-repair.ps1" 'CmdletBinding\(SupportsShouldProcess'
  require_text "$ROOT/install-opencode-write-json-repair.ps1" 'Apply-UnifiedPatch'
  require_text "$ROOT/install-opencode-write-json-repair.ps1" 'New-Backup'
  require_text "$ROOT/install-opencode-write-json-repair.ps1" 'Restore-LatestBackup'
  require_text "$ROOT/install-opencode-write-json-repair.ps1" 'delete`t'
  require_text "$ROOT/install-opencode-write-json-repair.ps1" 'Remove-Item -LiteralPath'
  require_text "$ROOT/install-opencode-write-json-repair.ps1" 'Assert-WindowsTarget'
  require_text "$ROOT/install-opencode-write-json-repair.ps1" 'ForceUnsupportedOS'
  require_text "$ROOT/install-opencode-write-json-repair.ps1" 'bun.+typecheck|typecheck'
  echo "INSTALLER_STATIC_OK"
}

verify_docs_static() {
  require_text "$ROOT/INSTALLATION.md" 'Windows 10'
  require_text "$ROOT/INSTALLATION.md" 'PowerShell 7\.6'
  require_text "$ROOT/INSTALLATION.md" 'install-opencode-write-json-repair\.ps1'
  require_text "$ROOT/INSTALLATION.md" 'Rollback|롤백'
  require_text "$ROOT/INSTALLATION.md" 'bun run --cwd packages/opencode typecheck'
  echo "DOCS_STATIC_OK"
}

verify_patch_static() {
  require_text "$PATCH" 'truncated_json'
  require_text "$PATCH" 'InvalidToolInputError'
  require_text "$PATCH" 'summarizeToolCallInput'
  require_text "$PATCH" 'stripToolExecution'
  require_text "$PATCH" 'execute: _execute'
  require_text "$PATCH" 'filePath'
  require_text "$PATCH" 'content'
  if grep -Fq 'tools: { write: input.tool }' "$PATCH"; then
    echo "repair passes executable write tool to generateText" >&2
    exit 1
  fi
  if grep -Eq 'path.*alias|fileContent.*alias|Qwen-only|DeepSeek-only' "$PATCH"; then
    echo "forbidden alias/provider-specific wording found in patch" >&2
    exit 1
  fi
  echo "PATCH_STATIC_OK"
}

verify_patch_apply() {
  if [[ ! -e "$TARGET/.git" ]] || ! git -C "$TARGET" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    echo "SKIP_PATCH_APPLY target missing or not a git worktree: $TARGET"
    return 0
  fi
  local tmp
  tmp="$(mktemp -d "${TMPDIR:-/tmp}/opencode-repair-verify.XXXXXX")"
  local worktree="$tmp/worktree"
  cleanup_patch_worktree() {
    git -C "$TARGET" worktree remove --force "$worktree" >/dev/null 2>&1 || true
    rm -rf "$tmp"
  }
  trap cleanup_patch_worktree EXIT
  git -C "$TARGET" worktree add --detach "$worktree" HEAD >/dev/null
  git -C "$worktree" apply --check "$PATCH"
  git -C "$worktree" apply "$PATCH"
  grep -q 'truncated_json' "$worktree/packages/opencode/src/session/tool-call-diagnostics.ts"
  grep -q 'summarizeToolCallInput' "$worktree/packages/opencode/src/session/llm.ts"
  grep -q 'diagnostic' "$worktree/packages/opencode/src/tool/invalid.ts"
  first_write_key="$(grep -nE 'filePath: Schema.String|content: Schema.String' "$worktree/packages/opencode/src/tool/write.ts" | head -n 1)"
  case "$first_write_key" in
    *filePath*) ;;
    *)
      echo "write schema does not declare filePath before content" >&2
      exit 1
      ;;
  esac
  echo "PATCH_APPLY_OK cleanup: removed $worktree and $tmp"
  cleanup_patch_worktree
  trap - EXIT
}

case "$MODE" in
  installer-fallback)
    verify_installer_static
    ;;
  patch)
    verify_patch_static
    verify_patch_apply
    ;;
  docs)
    verify_docs_static
    ;;
  all)
    verify_installer_static
    verify_patch_static
    verify_docs_static
    verify_patch_apply
    echo "PACKAGE_VERIFY_OK"
    ;;
  *)
    echo "unknown mode: $MODE" >&2
    exit 2
    ;;
esac
