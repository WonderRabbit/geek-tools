[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$Bundle,
  [switch]$Json
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.IO.Compression.FileSystem

$bundleResolved = (Resolve-Path -LiteralPath $Bundle).ProviderPath
$bundleDir = Split-Path -Parent $bundleResolved
$shaFile = Join-Path $bundleDir "SHA256SUMS"
$checks = New-Object System.Collections.Generic.List[object]

function Add-Check {
  param([string]$Name, [string]$Status, [string]$Detail)
  $script:checks.Add([ordered]@{ name = $Name; status = $Status; detail = $Detail })
}

if (Test-Path -LiteralPath $shaFile) {
  $expectedLine = Get-Content -LiteralPath $shaFile | Where-Object { $_ -match [regex]::Escape((Split-Path -Leaf $bundleResolved)) } | Select-Object -First 1
  if ($null -eq $expectedLine) {
    Add-Check -Name "sha256.entry" -Status "fail" -Detail "No entry for bundle in SHA256SUMS."
  } else {
    $expected = ($expectedLine -split "\s+")[0].ToLowerInvariant()
    $actual = (Get-FileHash -LiteralPath $bundleResolved -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($expected -eq $actual) {
      Add-Check -Name "sha256.match" -Status "ok" -Detail $actual
    } else {
      Add-Check -Name "sha256.match" -Status "fail" -Detail "expected $expected actual $actual"
    }
  }
} else {
  Add-Check -Name "sha256.file" -Status "warn" -Detail "SHA256SUMS not found next to bundle."
}

$tempDir = Join-Path ([System.IO.Path]::GetTempPath()) ("openwrite-verify-" + [System.Guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Path $tempDir -Force | Out-Null
try {
  [System.IO.Compression.ZipFile]::ExtractToDirectory($bundleResolved, $tempDir)
  $extractRoot = Join-Path $tempDir "openwrite"
  $doctor = Join-Path $extractRoot ".opencode/openwrite/scripts/doctor.ps1"
  if (-not (Test-Path -LiteralPath $doctor)) {
    Add-Check -Name "bundle.doctor" -Status "fail" -Detail "doctor.ps1 missing after extract."
  } else {
    $pwshPath = (Get-Process -Id $PID).Path
    $output = & $pwshPath -NoProfile -ExecutionPolicy Bypass -File $doctor -TargetRoot $extractRoot -Json 2>&1
    if ($LASTEXITCODE -eq 0) {
      Add-Check -Name "bundle.doctor" -Status "ok" -Detail (($output | ForEach-Object { [string]$_ }) -join " ")
    } else {
      Add-Check -Name "bundle.doctor" -Status "fail" -Detail (($output | ForEach-Object { [string]$_ }) -join " ")
    }
  }
} finally {
  if (Test-Path -LiteralPath $tempDir) {
    Remove-Item -LiteralPath $tempDir -Recurse -Force
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

$payload = [ordered]@{ status = $status; bundle = $bundleResolved; checks = $checks }
if ($Json) {
  $payload | ConvertTo-Json -Depth 8
} else {
  "VERIFY_BUNDLE_$($status.ToUpperInvariant())"
  foreach ($check in $checks) {
    "$($check.status)`t$($check.name)`t$($check.detail)"
  }
}

if ($hasFail) {
  exit 1
}
exit 0
