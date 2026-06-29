[CmdletBinding()]
param(
  [string]$TargetRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "../../..")).ProviderPath,
  [switch]$Json,
  [switch]$Strict
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$checks = New-Object System.Collections.Generic.List[object]

function Add-Check {
  param([string]$Name, [string]$Status, [string]$Detail)
  $script:checks.Add([ordered]@{ name = $Name; status = $Status; detail = $Detail })
}

function Test-RequiredFile {
  param([string]$Relative)
  $path = Join-Path $script:targetRootResolved $Relative
  if (Test-Path -LiteralPath $path) {
    Add-Check -Name "file:$Relative" -Status "ok" -Detail $path
  } else {
    Add-Check -Name "file:$Relative" -Status "fail" -Detail "missing: $path"
  }
}

function Test-AnyRequiredFile {
  param(
    [string]$Name,
    [string[]]$Relatives
  )
  foreach ($relative in $Relatives) {
    $path = Join-Path $script:targetRootResolved $relative
    if (Test-Path -LiteralPath $path) {
      Add-Check -Name $Name -Status "ok" -Detail $relative
      return
    }
  }
  Add-Check -Name $Name -Status "fail" -Detail "missing one of: $($Relatives -join ', ')"
}

function Get-IsWindowsHost {
  $variable = Get-Variable -Name IsWindows -ErrorAction SilentlyContinue
  return ($null -ne $variable -and [bool]$variable.Value)
}

$script:targetRootResolved = (Resolve-Path -LiteralPath $TargetRoot).ProviderPath

if (Get-IsWindowsHost) {
  Add-Check -Name "host.windows" -Status "ok" -Detail "Windows host detected."
} else {
  Add-Check -Name "host.windows" -Status "warn" -Detail "Current host is not Windows. Static checks can run, but final operation target is Windows 10."
}

if ($PSVersionTable.PSVersion -ge [version]"7.6") {
  Add-Check -Name "powershell.version" -Status "ok" -Detail $PSVersionTable.PSVersion.ToString()
} else {
  Add-Check -Name "powershell.version" -Status "warn" -Detail "PowerShell 7.6 or newer is required for the target PC. Current: $($PSVersionTable.PSVersion)"
}

foreach ($tool in @(
  @{ name = "node"; required = $true; reason = "runs OpenWrite core and smoke tests" },
  @{ name = "git"; required = $true; reason = "runs git apply --check for fast_apply" },
  @{ name = "opencode"; required = $false; reason = "loads .opencode/tools in the target project" }
)) {
  $command = Get-Command $tool.name -ErrorAction SilentlyContinue
  if ($null -eq $command) {
    Add-Check -Name "tool.$($tool.name)" -Status ($(if ($tool.required) { "fail" } else { "warn" })) -Detail "$($tool.reason): not found in PATH."
  } else {
    Add-Check -Name "tool.$($tool.name)" -Status "ok" -Detail "$($tool.reason): $($command.Source)"
  }
}

foreach ($relative in @(
  ".opencode/tools/package.json",
  ".opencode/tools/fast_write.js",
  ".opencode/tools/fast_apply.js",
  ".opencode/tools/openwrite_doctor.js",
  ".opencode/tools/openwrite_install.js",
  ".opencode/tools/openwrite_smoke.js",
  ".opencode/tools/openwrite_make_offline_bundle.js",
  ".opencode/tools/openwrite_verify_offline_bundle.js",
  ".opencode/commands/openwrite.md",
  ".opencode/commands/openwrite-doctor.md",
  ".opencode/commands/openwrite-smoke.md",
  ".opencode/commands/openwrite-offline-bundle.md",
  ".opencode/agents/openwrite-operator.md",
  ".opencode/agents/openwrite-reviewer.md",
  ".opencode/openwrite/bin/openwrite.mjs",
  ".opencode/openwrite/lib/openwrite-core.mjs",
  ".opencode/openwrite/lib/workspace-safety.mjs",
  ".opencode/openwrite/lib/hash-io.mjs",
  ".opencode/openwrite/lib/git-helpers.mjs",
  ".opencode/openwrite/lib/pwsh-runner.mjs",
  ".opencode/openwrite/scripts/install.ps1",
  ".opencode/openwrite/scripts/doctor.ps1",
  ".opencode/openwrite/scripts/smoke.ps1",
  ".opencode/openwrite/scripts/prepare-tools.ps1",
  ".opencode/openwrite/scripts/make-offline-bundle.ps1",
  ".opencode/openwrite/scripts/verify-offline-bundle.ps1",
)) {
  Test-RequiredFile -Relative $relative
}

Test-AnyRequiredFile -Name "doc:readme" -Relatives @("OPENWRITE.md", "README.md")
Test-AnyRequiredFile -Name "doc:manifest" -Relatives @(".opencode/openwrite/MANIFEST.json", "MANIFEST.json")

$wrapperFiles = Get-ChildItem -LiteralPath (Join-Path $targetRootResolved ".opencode/tools") -Filter "*.js" -File -ErrorAction SilentlyContinue
foreach ($file in $wrapperFiles) {
  $text = Get-Content -LiteralPath $file.FullName -Raw
  if ($text -match "shell\s*:\s*true" -or $text -match "\bexec(File|Sync)?\s*\(" -or $text -match "spawnSync\s*\(") {
    Add-Check -Name "wrapper.safe-spawn:$($file.Name)" -Status "fail" -Detail "unsafe process execution pattern found."
  } else {
    Add-Check -Name "wrapper.safe-spawn:$($file.Name)" -Status "ok" -Detail "no unsafe process execution pattern found."
  }
}

$hasFail = $false
$hasWarn = $false
foreach ($check in $checks) {
  if ($check.status -eq "fail") { $hasFail = $true }
  if ($check.status -eq "warn") { $hasWarn = $true }
}
$status = "ok"
if ($hasFail) {
  $status = "fail"
} elseif ($hasWarn) {
  $status = "warn"
}

$payload = [ordered]@{
  status = $status
  targetRoot = $targetRootResolved
  checks = $checks
}

if ($Json) {
  $payload | ConvertTo-Json -Depth 8
} else {
  "DOCTOR_$($status.ToUpperInvariant())"
  foreach ($check in $checks) {
    "$($check.status)`t$($check.name)`t$($check.detail)"
  }
}

if ($hasFail -or ($Strict -and $hasWarn)) {
  exit 1
}
exit 0
