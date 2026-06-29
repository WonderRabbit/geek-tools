[CmdletBinding()]
param(
  [string]$TargetRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "../../..")).ProviderPath,
  [string]$ConfigPath = "",
  [switch]$Json,
  [switch]$Strict
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$checks = New-Object System.Collections.Generic.List[object]

function Add-Check {
  param(
    [string]$Name,
    [string]$Status,
    [string]$Detail
  )
  $script:checks.Add([ordered]@{
    name = $Name
    status = $Status
    detail = $Detail
  })
}

function Test-PathCheck {
  param(
    [string]$Name,
    [string]$Path
  )
  if (Test-Path -LiteralPath $Path) {
    Add-Check -Name $Name -Status "ok" -Detail $Path
  } else {
    Add-Check -Name $Name -Status "fail" -Detail "missing: $Path"
  }
}

function Get-IsWindows {
  $variable = Get-Variable -Name IsWindows -ErrorAction SilentlyContinue
  if ($null -eq $variable) {
    return $false
  }
  return [bool]$variable.Value
}

$targetRootResolved = (Resolve-Path -LiteralPath $TargetRoot).ProviderPath
$opencodeRoot = Join-Path $targetRootResolved ".opencode"

if ((Get-IsWindows)) {
  Add-Check -Name "host.windows" -Status "ok" -Detail "Windows host detected."
} else {
  Add-Check -Name "host.windows" -Status "warn" -Detail "Current host is not Windows. Package is Windows-targeted, but static checks can still run."
}

if ($PSVersionTable.PSVersion -ge [version]"7.6") {
  Add-Check -Name "powershell.version" -Status "ok" -Detail $PSVersionTable.PSVersion.ToString()
} else {
  Add-Check -Name "powershell.version" -Status "warn" -Detail "Recommended PowerShell is 7.6 or newer. Current: $($PSVersionTable.PSVersion)"
}

$nodeCommand = Get-Command node -ErrorAction SilentlyContinue
if ($null -eq $nodeCommand) {
  Add-Check -Name "node.available" -Status "fail" -Detail "node executable was not found in PATH."
} else {
  Add-Check -Name "node.available" -Status "ok" -Detail $nodeCommand.Source
}

$recommendedTools = @(
  @{ name = "opencode"; reason = "OpenCode command execution surface" },
  @{ name = "rg"; reason = "source and flow text filtering" },
  @{ name = "fd"; reason = "fast file inventory" },
  @{ name = "sg"; reason = "ast-grep structural search" },
  @{ name = "jq"; reason = "JSON evidence shaping" },
  @{ name = "yq"; reason = "YAML config evidence shaping" },
  @{ name = "mdq"; reason = "Markdown flow/research extraction" }
)
foreach ($tool in $recommendedTools) {
  $command = Get-Command $tool.name -ErrorAction SilentlyContinue
  if ($null -eq $command) {
    Add-Check -Name "tool.$($tool.name)" -Status "warn" -Detail "$($tool.reason): not found in PATH."
  } else {
    Add-Check -Name "tool.$($tool.name)" -Status "ok" -Detail "$($tool.reason): $($command.Source)"
  }
}

$requiredFiles = @(
  ".opencode/commands/estimate-feature-duration.md",
  ".opencode/commands/estimate.md",
  ".opencode/commands/estimate-doctor.md",
  ".opencode/commands/estimate-offline-bundle.md",
  ".opencode/agents/estimate-estimator.md",
  ".opencode/agents/estimate-worker.md",
  ".opencode/agents/estimate-reviewer.md",
  ".opencode/tools/wonder_estimate_intake.js",
  ".opencode/tools/wonder_estimate_split_features.js",
  ".opencode/tools/wonder_estimate_source_packet.js",
  ".opencode/tools/wonder_estimate_flow_align.js",
  ".opencode/tools/wonder_estimate_classify_work.js",
  ".opencode/tools/wonder_estimate_reference_class.js",
  ".opencode/tools/wonder_estimate_render_table.js",
  ".opencode/tools/wonder_estimate_review_gate.js",
  ".opencode/tools/wonder_estimate_spawn_node.js",
  ".opencode/tools/wonder_estimate_runner.js",
  ".opencode/tools/wonder_estimate_install.js",
  ".opencode/tools/wonder_estimate_doctor.js",
  ".opencode/tools/wonder_estimate_qwen_preflight.js",
  ".opencode/tools/wonder_estimate_smoke.js",
  ".opencode/tools/wonder_estimate_collect_evidence.js",
  ".opencode/tools/wonder_estimate_make_offline_bundle.js",
  ".opencode/tools/wonder_estimate_verify_offline_bundle.js",
  ".opencode/tools/package.json",
  ".opencode/estimate/scripts/install.ps1",
  ".opencode/estimate/scripts/doctor.ps1",
  ".opencode/estimate/scripts/qwen-preflight.ps1",
  ".opencode/estimate/scripts/smoke.ps1",
  ".opencode/estimate/scripts/collect-evidence.ps1",
  ".opencode/estimate/scripts/make-offline-bundle.ps1",
  ".opencode/estimate/scripts/verify-offline-bundle.ps1",
  ".opencode/estimate/config/qwen3.6-35b.example.json",
  ".opencode/estimate/bin/opencode-estimate.mjs",
  ".opencode/estimate/lib/cli.mjs",
  ".opencode/estimate/lib/workflow.mjs",
  ".opencode/estimate/fixtures/legacy-sample/request.json",
  ".opencode/estimate/fixtures/failure-empty-evidence/estimate.json",
  ".opencode/estimate/test/cli.test.mjs",
  ".opencode/estimate/test/helpers.mjs",
  ".opencode/estimate/test/review-flow.test.mjs",
  ".opencode/estimate/install.md",
  ".opencode/estimate/README.md",
  ".opencode/estimate/THIRD-PARTY-NOTICES.md",
  "README.md",
  "MANIFEST.json"
)

foreach ($relative in $requiredFiles) {
  Test-PathCheck -Name "file:$relative" -Path (Join-Path $targetRootResolved $relative)
}

$effectiveConfig = $ConfigPath
if ([string]::IsNullOrWhiteSpace($effectiveConfig)) {
  $effectiveConfig = Join-Path $opencodeRoot "estimate/config/qwen3.6-35b.example.json"
}
if (Test-Path -LiteralPath $effectiveConfig) {
  try {
    $config = Get-Content -LiteralPath $effectiveConfig -Raw | ConvertFrom-Json
    if ([string]::IsNullOrWhiteSpace([string]$config.model)) {
      Add-Check -Name "qwen.config.model" -Status "fail" -Detail "model is empty in $effectiveConfig"
    } else {
      Add-Check -Name "qwen.config.model" -Status "ok" -Detail $config.model
    }
    if ([string]::IsNullOrWhiteSpace([string]$config.endpoint)) {
      Add-Check -Name "qwen.config.endpoint" -Status "fail" -Detail "endpoint is empty in $effectiveConfig"
    } else {
      Add-Check -Name "qwen.config.endpoint" -Status "ok" -Detail $config.endpoint
    }
  } catch {
    Add-Check -Name "qwen.config.json" -Status "fail" -Detail $_.Exception.Message
  }
}

$toolFiles = Get-ChildItem -LiteralPath (Join-Path $opencodeRoot "tools") -Filter "wonder_estimate_*.js" -File -ErrorAction SilentlyContinue
foreach ($toolFile in $toolFiles) {
  $text = Get-Content -LiteralPath $toolFile.FullName -Raw
  if ($text -match "shell\s*:\s*true" -or $text -match "\bexec(File|Sync)?\s*\(" -or $text -match "spawnSync\s*\(") {
    Add-Check -Name "wrapper.safe-spawn:$($toolFile.Name)" -Status "fail" -Detail "wrapper uses an unsafe process execution pattern."
  } else {
    Add-Check -Name "wrapper.safe-spawn:$($toolFile.Name)" -Status "ok" -Detail "no unsafe process execution pattern found."
  }
}

$hasFail = $false
$hasWarn = $false
foreach ($check in $checks) {
  if ($check.status -eq "fail") { $hasFail = $true }
  if ($check.status -eq "warn") { $hasWarn = $true }
}

$overall = "ok"
if ($hasFail) {
  $overall = "fail"
} elseif ($hasWarn) {
  $overall = "warn"
}

$payload = [ordered]@{
  status = $overall
  targetRoot = $targetRootResolved
  checks = $checks
}

if ($Json) {
  $payload | ConvertTo-Json -Depth 8
} else {
  "DOCTOR_$($overall.ToUpperInvariant())"
  foreach ($check in $checks) {
    "$($check.status)`t$($check.name)`t$($check.detail)"
  }
}

if ($hasFail -or ($Strict -and $hasWarn)) {
  exit 1
}
exit 0
