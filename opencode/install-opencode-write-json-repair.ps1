[CmdletBinding(SupportsShouldProcess = $true)]
param(
  [Parameter(Mandatory = $true)]
  [string]$OpenCodeRoot,

  [switch]$SkipVerify,
  [switch]$Rollback,
  [switch]$Force,
  [switch]$ForceUnsupportedOS
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$PatchFile = Join-Path $PSScriptRoot "patches/opencode-write-json-repair.patch"
$BackupRootName = ".opencode-write-json-repair-backup"
$TouchedFiles = @(
  "packages/opencode/src/session/llm.ts",
  "packages/opencode/src/session/tool-call-diagnostics.ts",
  "packages/opencode/src/tool/invalid.ts",
  "packages/opencode/src/tool/write.ts",
  "packages/opencode/test/session/tool-call-diagnostics.test.ts",
  "packages/opencode/test/tool/parameters.test.ts"
)

function Assert-PowerShellVersion {
  if ($PSVersionTable.PSVersion -lt [version]"7.6") {
    throw "PowerShell 7.6 or newer is required. Current version: $($PSVersionTable.PSVersion)"
  }
}

function Assert-WindowsTarget {
  if (-not $IsWindows -and -not $ForceUnsupportedOS) {
    throw "This installer targets Windows 10 with PowerShell 7.6. Use -ForceUnsupportedOS only for non-production syntax/package verification."
  }
}

function Resolve-OpenCodeRoot {
  param([string]$Path)
  $resolved = Resolve-Path -LiteralPath $Path -ErrorAction Stop
  return $resolved.ProviderPath
}

function Assert-OpenCodeRepo {
  param([string]$Root)
  $required = @(
    "package.json",
    "packages/opencode/package.json",
    "packages/opencode/src/session/llm.ts",
    "packages/opencode/src/tool/invalid.ts",
    "packages/opencode/src/tool/write.ts",
    ".git"
  )
  foreach ($relative in $required) {
    $path = Join-Path $Root $relative
    if (-not (Test-Path -LiteralPath $path)) {
      throw "Not an OpenCode source checkout or unsupported layout. Missing: $relative"
    }
  }
}

function Invoke-Checked {
  param(
    [string]$FilePath,
    [string[]]$ArgumentList,
    [string]$WorkingDirectory
  )
  Write-Host "> $FilePath $($ArgumentList -join ' ')"
  Push-Location -LiteralPath $WorkingDirectory
  try {
    & $FilePath @ArgumentList
    if ($LASTEXITCODE -ne 0) {
      throw "Command failed with exit code $LASTEXITCODE`: $FilePath $($ArgumentList -join ' ')"
    }
  } finally {
    Pop-Location
  }
}

function Test-AlreadyApplied {
  param([string]$Root)
  $diagnostics = Join-Path $Root "packages/opencode/src/session/tool-call-diagnostics.ts"
  $llm = Join-Path $Root "packages/opencode/src/session/llm.ts"
  if (-not (Test-Path -LiteralPath $diagnostics)) {
    return $false
  }
  $llmText = Get-Content -LiteralPath $llm -Raw
  return $llmText.Contains("summarizeToolCallInput") -and $llmText.Contains("WRITE_TOOL_EXPECTED_KEYS")
}

function New-Backup {
  param([string]$Root)
  $stamp = Get-Date -Format "yyyyMMdd-HHmmss"
  $backupRoot = Join-Path $Root $BackupRootName
  $backupDir = Join-Path $backupRoot $stamp
  New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
  $manifest = Join-Path $backupDir "manifest.txt"
  foreach ($relative in $TouchedFiles) {
    $source = Join-Path $Root $relative
    if (-not (Test-Path -LiteralPath $source)) {
      Add-Content -LiteralPath $manifest -Value "delete`t$relative"
      continue
    }
    $target = Join-Path $backupDir $relative
    New-Item -ItemType Directory -Path (Split-Path -Parent $target) -Force | Out-Null
    Copy-Item -LiteralPath $source -Destination $target -Force
    Add-Content -LiteralPath $manifest -Value "restore`t$relative"
  }
  Write-Host "Backup created: $backupDir"
}

function Restore-LatestBackup {
  param([string]$Root)
  $backupRoot = Join-Path $Root $BackupRootName
  if (-not (Test-Path -LiteralPath $backupRoot)) {
    throw "No backup directory found: $backupRoot"
  }
  $latest = Get-ChildItem -LiteralPath $backupRoot -Directory | Sort-Object Name -Descending | Select-Object -First 1
  if ($null -eq $latest) {
    throw "No backup snapshots found under: $backupRoot"
  }
  $manifest = Join-Path $latest.FullName "manifest.txt"
  if (-not (Test-Path -LiteralPath $manifest)) {
    throw "Backup manifest is missing: $manifest"
  }
  foreach ($entry in Get-Content -LiteralPath $manifest) {
    $parts = $entry -split "`t", 2
    if ($parts.Count -ne 2) {
      throw "Invalid backup manifest entry: $entry"
    }
    $action = $parts[0]
    $relative = $parts[1]
    $source = Join-Path $latest.FullName $relative
    $target = Join-Path $Root $relative
    switch ($action) {
      "restore" {
        New-Item -ItemType Directory -Path (Split-Path -Parent $target) -Force | Out-Null
        Copy-Item -LiteralPath $source -Destination $target -Force
      }
      "delete" {
        if (Test-Path -LiteralPath $target) {
          Remove-Item -LiteralPath $target -Force
        }
      }
      default {
        throw "Unknown backup manifest action: $action"
      }
    }
  }
  Write-Host "Rollback restored: $($latest.FullName)"
}

function Apply-UnifiedPatch {
  param([string]$Root)
  if (-not (Test-Path -LiteralPath $PatchFile)) {
    throw "Patch file not found: $PatchFile"
  }
  if ((Test-AlreadyApplied -Root $Root) -and -not $Force) {
    Write-Host "Patch already appears to be applied. Use -Force to re-run git apply checks."
    return
  }
  Invoke-Checked -FilePath "git" -ArgumentList @("apply", "--check", $PatchFile) -WorkingDirectory $Root
  if ($PSCmdlet.ShouldProcess($Root, "apply OpenCode write JSON repair patch")) {
    New-Backup -Root $Root
    Invoke-Checked -FilePath "git" -ArgumentList @("apply", $PatchFile) -WorkingDirectory $Root
  }
}

function Invoke-Verification {
  param([string]$Root)
  if ($SkipVerify) {
    Write-Host "Verification skipped by -SkipVerify."
    return
  }
  if (-not (Get-Command bun -ErrorAction SilentlyContinue)) {
    throw "bun is required for verification. Install Bun 1.3.14+ or re-run with -SkipVerify after manual review."
  }
  Invoke-Checked -FilePath "bun" -ArgumentList @("install", "--frozen-lockfile") -WorkingDirectory $Root
  Invoke-Checked -FilePath "bun" -ArgumentList @("test", "packages/opencode/test/session/tool-call-diagnostics.test.ts") -WorkingDirectory $Root
  Invoke-Checked -FilePath "bun" -ArgumentList @("test", "packages/opencode/test/tool/parameters.test.ts", "--test-name-pattern", "invalid|write|diagnostic|filePath") -WorkingDirectory $Root
  Invoke-Checked -FilePath "bun" -ArgumentList @("run", "--cwd", "packages/opencode", "typecheck") -WorkingDirectory $Root
}

Assert-PowerShellVersion
Assert-WindowsTarget
$root = Resolve-OpenCodeRoot -Path $OpenCodeRoot
Assert-OpenCodeRepo -Root $root

if ($Rollback) {
  Restore-LatestBackup -Root $root
  Write-Host "ROLLBACK_OK"
  exit 0
}

Apply-UnifiedPatch -Root $root
Invoke-Verification -Root $root
Write-Host "INSTALL_OK"
