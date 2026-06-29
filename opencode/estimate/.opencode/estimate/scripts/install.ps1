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

function Copy-AssetDirectory {
  param(
    [string]$Source,
    [string]$Destination
  )
  if (-not (Test-Path -LiteralPath $Source)) {
    throw "Source asset directory is missing: $Source"
  }
  $sourceFull = [System.IO.Path]::GetFullPath($Source)
  $destinationFull = [System.IO.Path]::GetFullPath($Destination)
  if ($sourceFull -eq $destinationFull) {
    return "skipped-self:$Destination"
  }
  if ($PSCmdlet.ShouldProcess($Destination, "copy estimate OpenCode asset directory")) {
    $copied = New-Object System.Collections.Generic.List[string]
    $sourceFiles = Get-ChildItem -LiteralPath $Source -File -Recurse
    foreach ($sourceFile in $sourceFiles) {
      $relative = [System.IO.Path]::GetRelativePath($sourceFull, $sourceFile.FullName)
      $targetFile = Join-Path $destinationFull $relative
      $copied.Add((Copy-AssetFile -Source $sourceFile.FullName -Destination $targetFile))
    }
    return "merged:$Destination files=$($copied.Count)"
  }
  return "copied:$Destination"
}

function Copy-AssetFile {
  param(
    [string]$Source,
    [string]$Destination
  )
  if (-not (Test-Path -LiteralPath $Source)) {
    throw "Source asset file is missing: $Source"
  }
  $sourceFull = [System.IO.Path]::GetFullPath($Source)
  $destinationFull = [System.IO.Path]::GetFullPath($Destination)
  if ($sourceFull -eq $destinationFull) {
    return "skipped-self:$Destination"
  }
  if ($PSCmdlet.ShouldProcess($Destination, "copy estimate OpenCode asset file")) {
    if ((Test-Path -LiteralPath $Destination) -and -not $Force) {
      $sourceHash = (Get-FileHash -LiteralPath $Source -Algorithm SHA256).Hash
      $destinationHash = (Get-FileHash -LiteralPath $Destination -Algorithm SHA256).Hash
      if ($sourceHash -eq $destinationHash) {
        return "skipped-identical:$Destination"
      }
      throw "Destination file exists and differs: $Destination. Re-run with -Force to overwrite."
    }
    New-Item -ItemType Directory -Path (Split-Path -Parent $Destination) -Force | Out-Null
    Copy-Item -LiteralPath $Source -Destination $Destination -Force
  }
  return "copied:$Destination"
}

$packRoot = Get-PackRoot
$sourceOpenCode = Join-Path $packRoot ".opencode"
$targetRootResolved = Resolve-OrCreateTargetRoot -Path $TargetRoot
$targetOpenCode = Join-Path $targetRootResolved ".opencode"
New-Item -ItemType Directory -Path $targetOpenCode -Force | Out-Null

$results = @()
foreach ($name in @("commands", "agents", "tools")) {
  $results += Copy-AssetDirectory -Source (Join-Path $sourceOpenCode $name) -Destination (Join-Path $targetOpenCode $name)
}
$results += Copy-AssetDirectory -Source (Join-Path $sourceOpenCode "estimate") -Destination (Join-Path $targetOpenCode "estimate")

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
