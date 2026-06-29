[CmdletBinding()]
param(
  [string]$OutputDir = (Join-Path (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "../../..")).ProviderPath "release"),
  [string]$BundleName = "openwrite-opencode-assets.zip",
  [switch]$Json,
  [switch]$Force
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.IO.Compression.FileSystem

$packRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "../../..")).ProviderPath
New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null
$outputDirResolved = (Resolve-Path -LiteralPath $OutputDir).ProviderPath
$bundlePath = Join-Path $outputDirResolved $BundleName
$hashPath = Join-Path $outputDirResolved "SHA256SUMS"

if ((Test-Path -LiteralPath $bundlePath) -and -not $Force) {
  throw "Bundle already exists: $bundlePath. Re-run with -Force to overwrite."
}
if (Test-Path -LiteralPath $bundlePath) {
  Remove-Item -LiteralPath $bundlePath -Force
}

$tempDir = Join-Path ([System.IO.Path]::GetTempPath()) ("openwrite-bundle-" + [System.Guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Path $tempDir -Force | Out-Null
try {
  $staging = Join-Path $tempDir "openwrite"
  New-Item -ItemType Directory -Path $staging -Force | Out-Null
  foreach ($relative in @(".opencode", "README.md", "MANIFEST.json")) {
    $source = Join-Path $packRoot $relative
    if (-not (Test-Path -LiteralPath $source)) {
      throw "Missing bundle input: $source"
    }
    $destination = Join-Path $staging $relative
    New-Item -ItemType Directory -Path (Split-Path -Parent $destination) -Force | Out-Null
    Copy-Item -LiteralPath $source -Destination $destination -Recurse -Force
  }
  [System.IO.Compression.ZipFile]::CreateFromDirectory($staging, $bundlePath)
} finally {
  if (Test-Path -LiteralPath $tempDir) {
    Remove-Item -LiteralPath $tempDir -Recurse -Force
  }
}

$hash = Get-FileHash -LiteralPath $bundlePath -Algorithm SHA256
"$($hash.Hash.ToLowerInvariant())  $BundleName" | Set-Content -LiteralPath $hashPath -Encoding utf8

$payload = [ordered]@{
  status = "ok"
  bundle = $bundlePath
  sha256 = $hash.Hash.ToLowerInvariant()
  sha256Sums = $hashPath
}

if ($Json) {
  $payload | ConvertTo-Json -Depth 4
} else {
  "BUNDLE_OK"
  "bundle: $bundlePath"
  "sha256: $($hash.Hash.ToLowerInvariant())"
}
