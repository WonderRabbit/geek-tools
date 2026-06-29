[CmdletBinding()]
param(
  [string]$ConfigPath = (Join-Path $PSScriptRoot "../config/qwen3.6-35b.example.json"),
  [string]$Endpoint = "",
  [string]$Model = "",
  [switch]$SkipNetwork,
  [switch]$Json
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$checks = New-Object System.Collections.Generic.List[object]

function Add-Check {
  param([string]$Name, [string]$Status, [string]$Detail)
  $script:checks.Add([ordered]@{ name = $Name; status = $Status; detail = $Detail })
}

if (-not (Test-Path -LiteralPath $ConfigPath)) {
  Add-Check -Name "config.exists" -Status "fail" -Detail "missing: $ConfigPath"
} else {
  Add-Check -Name "config.exists" -Status "ok" -Detail (Resolve-Path -LiteralPath $ConfigPath).ProviderPath
  try {
    $config = Get-Content -LiteralPath $ConfigPath -Raw | ConvertFrom-Json
    if ([string]::IsNullOrWhiteSpace($Endpoint)) { $Endpoint = [string]$config.endpoint }
    if ([string]::IsNullOrWhiteSpace($Model)) { $Model = [string]$config.model }
  } catch {
    Add-Check -Name "config.json" -Status "fail" -Detail $_.Exception.Message
  }
}

if ([string]::IsNullOrWhiteSpace($Endpoint)) {
  Add-Check -Name "endpoint.present" -Status "fail" -Detail "Endpoint is empty."
} elseif ($Endpoint -notmatch "^https?://") {
  Add-Check -Name "endpoint.scheme" -Status "fail" -Detail "Endpoint must start with http:// or https://"
} else {
  Add-Check -Name "endpoint.scheme" -Status "ok" -Detail $Endpoint
}

if ([string]::IsNullOrWhiteSpace($Model)) {
  Add-Check -Name "model.present" -Status "fail" -Detail "Model is empty."
} else {
  Add-Check -Name "model.present" -Status "ok" -Detail $Model
}

if ($SkipNetwork) {
  Add-Check -Name "network.models" -Status "warn" -Detail "Skipped by -SkipNetwork."
} elseif (-not [string]::IsNullOrWhiteSpace($Endpoint) -and $Endpoint -match "^https?://") {
  try {
    $base = $Endpoint.TrimEnd("/")
    $modelsUri = if ($base.EndsWith("/v1")) { "$base/models" } else { "$base/v1/models" }
    $headers = @{}
    if (-not [string]::IsNullOrWhiteSpace($env:OPENAI_API_KEY)) {
      $headers["Authorization"] = "Bearer $env:OPENAI_API_KEY"
    }
    $response = Invoke-WebRequest -Uri $modelsUri -Method Get -Headers $headers -TimeoutSec 15
    Add-Check -Name "network.models" -Status "ok" -Detail "HTTP $($response.StatusCode) $modelsUri"
  } catch {
    Add-Check -Name "network.models" -Status "fail" -Detail $_.Exception.Message
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
  endpoint = $Endpoint
  model = $Model
  checks = $checks
}

if ($Json) {
  $payload | ConvertTo-Json -Depth 6
} else {
  "QWEN_PREFLIGHT_$($overall.ToUpperInvariant())"
  foreach ($check in $checks) {
    "$($check.status)`t$($check.name)`t$($check.detail)"
  }
}

if ($hasFail) {
  exit 1
}
exit 0

