param(
  [Parameter(Mandatory = $true)]
  [string]$TargetRoot,
  [string]$CodeGraphArchive,
  [string]$CodeGraphBin,
  [string]$CodeGraphVersion,
  [switch]$OnlineGitHub,
  [switch]$Force,
  [switch]$Json
)

$ErrorActionPreference = 'Stop'

function Write-Result($Result) {
  if ($Json) {
    $Result | ConvertTo-Json -Depth 8
  } else {
    $Result.GetEnumerator() | ForEach-Object { Write-Host "$($_.Key): $($_.Value)" }
  }
}

if ($PSVersionTable.PSVersion -lt [version]'7.6') {
  throw "PowerShell 7.6 or newer is required. Current: $($PSVersionTable.PSVersion)"
}

$sourceRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$targetRootPath = if (Test-Path -LiteralPath $TargetRoot) {
  (Resolve-Path -LiteralPath $TargetRoot).Path
} else {
  New-Item -ItemType Directory -Force -Path $TargetRoot | Out-Null
  (Resolve-Path -LiteralPath $TargetRoot).Path
}

$targetOpenCode = Join-Path $targetRootPath '.opencode'
$targetConfig = Join-Path $targetRootPath 'opencode.json'

if ((Test-Path -LiteralPath $targetOpenCode) -and -not $Force) {
  throw "Target already has .opencode. Re-run with -Force to merge/overwrite this pack's files."
}

if ((Test-Path -LiteralPath $targetConfig) -and -not $Force) {
  throw "Target already has opencode.json. Re-run with -Force after reviewing merge impact."
}

if (-not (Test-Path -LiteralPath $targetOpenCode)) {
  New-Item -ItemType Directory -Force -Path $targetOpenCode | Out-Null
}

Copy-Item -Path (Join-Path $sourceRoot '.opencode\*') -Destination $targetOpenCode -Recurse -Force
if ((Test-Path -LiteralPath $targetConfig) -and $Force) {
  $backup = Join-Path $targetRootPath ("opencode.json.codegraph-backup-" + (Get-Date -Format 'yyyyMMddHHmmss'))
  Copy-Item -LiteralPath $targetConfig -Destination $backup -Force
}
Copy-Item -LiteralPath (Join-Path $sourceRoot 'opencode.json') -Destination $targetConfig -Force

$installer = Join-Path $targetOpenCode 'codegraph\scripts\install-codegraph-mcp.ps1'
$verify = Join-Path $targetOpenCode 'codegraph\scripts\verify-codegraph-mcp.ps1'

$installArgs = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $installer, '-TargetRoot', $targetRootPath)
if ($CodeGraphArchive) { $installArgs += @('-CodeGraphArchive', $CodeGraphArchive) }
if ($CodeGraphBin) { $installArgs += @('-CodeGraphBin', $CodeGraphBin) }
if ($CodeGraphVersion) { $installArgs += @('-CodeGraphVersion', $CodeGraphVersion) }
if ($OnlineGitHub) { $installArgs += '-OnlineGitHub' }
if ($Json) { $installArgs += '-Json' }

& pwsh @installArgs
if ($LASTEXITCODE -ne 0) { throw "install-codegraph-mcp.ps1 failed with exit code $LASTEXITCODE" }

$verifyArgs = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $verify, '-TargetRoot', $targetRootPath)
if ($Json) { $verifyArgs += '-Json' }
& pwsh @verifyArgs
if ($LASTEXITCODE -ne 0) { throw "verify-codegraph-mcp.ps1 failed with exit code $LASTEXITCODE" }

Write-Result ([ordered]@{
  status = 'ok'
  targetRoot = $targetRootPath
  opencode = $targetOpenCode
  config = $targetConfig
})
