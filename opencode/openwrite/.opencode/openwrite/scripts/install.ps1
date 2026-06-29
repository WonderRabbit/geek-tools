[CmdletBinding(SupportsShouldProcess = $true)]
param(
  [string]$TargetRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "../../..")).ProviderPath,
  [switch]$Json,
  [switch]$Force
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Get-PackRoot {
  return (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "../../..")).ProviderPath
}

function Resolve-OrCreateTargetRoot {
  param([string]$Path)
  if (-not (Test-Path -LiteralPath $Path)) {
    if (-not $Force) {
      throw "TargetRoot does not exist: $Path. Re-run with -Force to create it."
    }
    New-Item -ItemType Directory -Path $Path -Force | Out-Null
  }
  return (Resolve-Path -LiteralPath $Path).ProviderPath
}

function Copy-AssetFile {
  param([string]$Source, [string]$Destination)
  if (-not (Test-Path -LiteralPath $Source)) {
    throw "Source asset file is missing: $Source"
  }
  $sourceFull = [System.IO.Path]::GetFullPath($Source)
  $destinationFull = [System.IO.Path]::GetFullPath($Destination)
  if ($sourceFull -eq $destinationFull) {
    return "skipped-self:$Destination"
  }
  if ((Test-Path -LiteralPath $Destination) -and -not $Force) {
    $sourceHash = (Get-FileHash -LiteralPath $Source -Algorithm SHA256).Hash
    $destinationHash = (Get-FileHash -LiteralPath $Destination -Algorithm SHA256).Hash
    if ($sourceHash -eq $destinationHash) {
      return "skipped-identical:$Destination"
    }
    throw "Destination file exists and differs: $Destination. Re-run with -Force to overwrite."
  }
  if ($PSCmdlet.ShouldProcess($Destination, "copy OpenWrite asset file")) {
    New-Item -ItemType Directory -Path (Split-Path -Parent $Destination) -Force | Out-Null
    Copy-Item -LiteralPath $Source -Destination $Destination -Force
  }
  return "copied:$Destination"
}

function Copy-AssetDirectory {
  param([string]$Source, [string]$Destination)
  $sourceFull = [System.IO.Path]::GetFullPath($Source)
  $copied = New-Object System.Collections.Generic.List[string]
  foreach ($sourceFile in Get-ChildItem -LiteralPath $Source -File -Recurse) {
    $relative = [System.IO.Path]::GetRelativePath($sourceFull, $sourceFile.FullName)
    $copied.Add((Copy-AssetFile -Source $sourceFile.FullName -Destination (Join-Path $Destination $relative)))
  }
  return "merged:$Destination files=$($copied.Count)"
}

$packRoot = Get-PackRoot
$targetRootResolved = Resolve-OrCreateTargetRoot -Path $TargetRoot
$targetOpenCode = Join-Path $targetRootResolved ".opencode"
New-Item -ItemType Directory -Path $targetOpenCode -Force | Out-Null

$results = @()
foreach ($name in @("tools", "commands", "agents", "openwrite")) {
  $results += Copy-AssetDirectory -Source (Join-Path $packRoot ".opencode/$name") -Destination (Join-Path $targetOpenCode $name)
}
$results += Copy-AssetFile -Source (Join-Path $packRoot "README.md") -Destination (Join-Path $targetRootResolved "OPENWRITE.md")
$results += Copy-AssetFile -Source (Join-Path $packRoot "MANIFEST.json") -Destination (Join-Path $targetOpenCode "openwrite/MANIFEST.json")

$payload = [ordered]@{
  status = "ok"
  packRoot = $packRoot
  targetRoot = $targetRootResolved
  installed = $results
}

if ($Json) {
  $payload | ConvertTo-Json -Depth 6
} else {
  "INSTALL_OK"
  $results
}
