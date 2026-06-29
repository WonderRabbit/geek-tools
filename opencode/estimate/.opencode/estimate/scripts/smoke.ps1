[CmdletBinding()]
param(
  [string]$TargetRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "../../..")).ProviderPath,
  [switch]$Json
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Invoke-ChildScript {
  param(
    [string]$ScriptPath,
    [string[]]$Arguments
  )
  $pwshPath = (Get-Process -Id $PID).Path
  $output = & $pwshPath -NoProfile -ExecutionPolicy Bypass -File $ScriptPath @Arguments 2>&1
  $exitCode = $LASTEXITCODE
  return [ordered]@{
    script = $ScriptPath
    exitCode = $exitCode
    output = @($output | ForEach-Object { [string]$_ })
  }
}

function Invoke-NodeCli {
  param(
    [string]$CliPath,
    [string[]]$Arguments,
    [int[]]$ExpectedExitCodes = @(0)
  )
  $nodeCommand = Get-Command node -ErrorAction SilentlyContinue
  if ($null -eq $nodeCommand) {
    return [ordered]@{
      command = "node"
      arguments = $Arguments
      exitCode = 127
      expected = $ExpectedExitCodes
      ok = $false
      output = @("node executable was not found")
    }
  }
  $nodePath = $nodeCommand.Source
  $output = & $nodePath $CliPath @Arguments 2>&1
  $exitCode = $LASTEXITCODE
  return [ordered]@{
    command = $CliPath
    arguments = $Arguments
    exitCode = $exitCode
    expected = $ExpectedExitCodes
    ok = ($ExpectedExitCodes -contains $exitCode)
    output = @($output | ForEach-Object { [string]$_ })
  }
}

$doctor = Invoke-ChildScript -ScriptPath (Join-Path $PSScriptRoot "doctor.ps1") -Arguments @("-TargetRoot", $TargetRoot, "-Json")
$preflight = Invoke-ChildScript -ScriptPath (Join-Path $PSScriptRoot "qwen-preflight.ps1") -Arguments @("-ConfigPath", (Join-Path $PSScriptRoot "../config/qwen3.6-35b.example.json"), "-SkipNetwork", "-Json")

$targetRootResolved = (Resolve-Path -LiteralPath $TargetRoot).ProviderPath
$cliPath = Join-Path $targetRootResolved ".opencode/estimate/bin/opencode-estimate.mjs"
$estimateDir = Join-Path $targetRootResolved ".estimate"
New-Item -ItemType Directory -Path $estimateDir -Force | Out-Null

$workflow = New-Object System.Collections.Generic.List[object]
$workflow.Add((Invoke-NodeCli -CliPath $cliPath -Arguments @("intake", "--root", $targetRootResolved, "--fixture", "legacy-sample", "--out", ".estimate/intake.json")))
$workflow.Add((Invoke-NodeCli -CliPath $cliPath -Arguments @("split", "--root", $targetRootResolved, "--input", ".estimate/intake.json", "--out", ".estimate/split.json")))
$workflow.Add((Invoke-NodeCli -CliPath $cliPath -Arguments @("packet", "--root", $targetRootResolved, "--input", ".estimate/split.json", "--out", ".estimate/packet.json")))
$workflow.Add((Invoke-NodeCli -CliPath $cliPath -Arguments @("flow-align", "--root", $targetRootResolved, "--input", ".estimate/packet.json", "--out", ".estimate/flow-align.json")))
$workflow.Add((Invoke-NodeCli -CliPath $cliPath -Arguments @("classify", "--root", $targetRootResolved, "--input", ".estimate/flow-align.json", "--out", ".estimate/classification.json")))
$workflow.Add((Invoke-NodeCli -CliPath $cliPath -Arguments @("reference-class", "--root", $targetRootResolved, "--input", ".estimate/classification.json", "--out", ".estimate/reference-class.json")))
$workflow.Add((Invoke-NodeCli -CliPath $cliPath -Arguments @("estimate", "--root", $targetRootResolved, "--input", ".estimate/reference-class.json", "--out", ".estimate/output.json")))
$workflow.Add((Invoke-NodeCli -CliPath $cliPath -Arguments @("render", "--root", $targetRootResolved, "--input", ".estimate/output.json", "--out", ".estimate/output.md")))
$workflow.Add((Invoke-NodeCli -CliPath $cliPath -Arguments @("review", "--root", $targetRootResolved, "--input", ".estimate/output.json", "--out", ".estimate/review.json")))

$failureReview = Invoke-NodeCli -CliPath $cliPath -Arguments @("review", "--root", $targetRootResolved, "--fixture", "failure-empty-evidence", "--out", ".estimate/smoke-bad-review.json") -ExpectedExitCodes @(2)

$status = "ok"
if ($doctor.exitCode -ne 0 -or $preflight.exitCode -ne 0 -or ($workflow | Where-Object { -not $_.ok }).Count -gt 0 -or -not $failureReview.ok) {
  $status = "fail"
} elseif (($doctor.output -join "`n") -match '"status"\s*:\s*"warn"' -or ($preflight.output -join "`n") -match '"status"\s*:\s*"warn"') {
  $status = "warn"
}

$payload = [ordered]@{
  status = $status
  targetRoot = $targetRootResolved
  doctor = $doctor
  qwenPreflight = $preflight
  workflow = $workflow
  failureReview = $failureReview
  artifacts = [ordered]@{
    outputJson = (Join-Path $estimateDir "output.json")
    outputMarkdown = (Join-Path $estimateDir "output.md")
    reviewJson = (Join-Path $estimateDir "review.json")
    failureReviewJson = (Join-Path $estimateDir "smoke-bad-review.json")
  }
}

if ($Json) {
  $payload | ConvertTo-Json -Depth 8
} else {
  "SMOKE_$($status.ToUpperInvariant())"
  "doctor exit: $($doctor.exitCode)"
  "qwen-preflight exit: $($preflight.exitCode)"
  foreach ($step in $workflow) {
    "$($step.exitCode)`t$($step.arguments[0])"
  }
  "failure review exit: $($failureReview.exitCode)"
}

if ($status -eq "fail") {
  exit 1
}
exit 0
