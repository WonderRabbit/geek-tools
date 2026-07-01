param(
  [string]$TargetRoot = (Get-Location).Path,
  [string]$OutFile = 'codegraph-mcp-offline-bundle.zip',
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

$targetRootPath = (Resolve-Path -LiteralPath $TargetRoot).Path
$codegraphRoot = Join-Path $targetRootPath '.opencode\codegraph'
$runtime = Join-Path $codegraphRoot 'runtime\current'
$installRecord = Join-Path $codegraphRoot 'mcp-install.json'

if (-not (Test-Path -LiteralPath $runtime)) {
  throw "CodeGraph runtime is missing. Run install-codegraph-mcp.ps1 first."
}

$outPath = if ([IO.Path]::IsPathRooted($OutFile)) { $OutFile } else { Join-Path $targetRootPath $OutFile }
if (Test-Path -LiteralPath $outPath) { Remove-Item -LiteralPath $outPath -Force }

Compress-Archive -Path (Join-Path $runtime '*') -DestinationPath $outPath -Force

Write-Result ([ordered]@{
  status = 'ok'
  bundle = $outPath
  sha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $outPath).Hash.ToLowerInvariant()
})
