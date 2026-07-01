param(
  [string]$TargetRoot = (Get-Location).Path,
  [string]$CodeGraphArchive,
  [string]$CodeGraphBin,
  [string]$CodeGraphVersion,
  [switch]$OnlineGitHub,
  [switch]$Json
)

$ErrorActionPreference = 'Stop'

function New-Result([string]$Status, [hashtable]$Data) {
  $result = [ordered]@{ status = $Status }
  foreach ($key in $Data.Keys) { $result[$key] = $Data[$key] }
  return $result
}

function Write-Result($Result) {
  if ($Json) {
    $Result | ConvertTo-Json -Depth 8
  } else {
    $Result.GetEnumerator() | ForEach-Object { Write-Host "$($_.Key): $($_.Value)" }
  }
}

function Get-TargetName {
  $arch = if ([System.Runtime.InteropServices.RuntimeInformation]::OSArchitecture -eq 'Arm64') { 'arm64' } else { 'x64' }
  return "win32-$arch"
}

function Get-FileHashValue([string]$Path) {
  if (-not (Test-Path -LiteralPath $Path)) { return $null }
  return (Get-FileHash -Algorithm SHA256 -LiteralPath $Path).Hash.ToLowerInvariant()
}

function Expand-CodeGraphArchive([string]$ArchivePath, [string]$RuntimeRoot) {
  if (-not (Test-Path -LiteralPath $ArchivePath)) {
    throw "CodeGraph archive not found: $ArchivePath"
  }

  $current = Join-Path $RuntimeRoot 'current'
  $temp = Join-Path ([IO.Path]::GetTempPath()) ("codegraph-mcp-" + [guid]::NewGuid().ToString())
  New-Item -ItemType Directory -Force -Path $temp | Out-Null

  try {
    Expand-Archive -LiteralPath $ArchivePath -DestinationPath $temp -Force
    if (Test-Path -LiteralPath $current) { Remove-Item -LiteralPath $current -Recurse -Force }
    New-Item -ItemType Directory -Force -Path $current | Out-Null

    $children = @(Get-ChildItem -LiteralPath $temp -Force)
    if ($children.Count -eq 1 -and $children[0].PSIsContainer -and ($children[0].Name -like 'codegraph-*' -or $children[0].Name -eq 'current')) {
      Get-ChildItem -LiteralPath $children[0].FullName -Force | Move-Item -Destination $current -Force
    } else {
      Get-ChildItem -LiteralPath $temp -Force | Move-Item -Destination $current -Force
    }
  } finally {
    if (Test-Path -LiteralPath $temp) { Remove-Item -LiteralPath $temp -Recurse -Force }
  }

  $launcher = Join-Path $current 'bin\codegraph.cmd'
  if (-not (Test-Path -LiteralPath $launcher)) {
    throw "CodeGraph launcher was not found after extraction: $launcher"
  }
  $node = Join-Path $current 'node\node.exe'
  if (-not (Test-Path -LiteralPath $node)) {
    throw "Bundled Node runtime was not found after extraction: $node"
  }
  return $launcher
}

function Save-InstallRecord([string]$Root, [hashtable]$Record) {
  $recordPath = Join-Path $Root '.opencode\codegraph\mcp-install.json'
  $Record | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $recordPath -Encoding UTF8
  return $recordPath
}

$targetRootPath = (Resolve-Path -LiteralPath $TargetRoot).Path
$codegraphRoot = Join-Path $targetRootPath '.opencode\codegraph'
$runtimeRoot = Join-Path $codegraphRoot 'runtime'
$binRoot = Join-Path $codegraphRoot 'bin'
New-Item -ItemType Directory -Force -Path $runtimeRoot, $binRoot | Out-Null

if ($PSVersionTable.PSVersion -lt [version]'7.6') {
  throw "PowerShell 7.6 or newer is required. Current: $($PSVersionTable.PSVersion)"
}

$launcher = $null
$source = $null
$archiveHash = $null

if ($CodeGraphArchive) {
  $archivePath = (Resolve-Path -LiteralPath $CodeGraphArchive).Path
  $archiveHash = Get-FileHashValue $archivePath
  $launcher = Expand-CodeGraphArchive -ArchivePath $archivePath -RuntimeRoot $runtimeRoot
  $source = 'offline-archive'
} elseif ($OnlineGitHub) {
  $target = Get-TargetName
  $version = $CodeGraphVersion
  if (-not $version) {
    $version = (Invoke-RestMethod 'https://api.github.com/repos/colbymchenry/codegraph/releases/latest').tag_name
  }
  if (-not $version) { throw 'Could not resolve CodeGraph version. Set -CodeGraphVersion.' }
  if ($version -notlike 'v*') { $version = "v$version" }
  $url = "https://github.com/colbymchenry/codegraph/releases/download/$version/codegraph-$target.zip"
  $download = Join-Path ([IO.Path]::GetTempPath()) ("codegraph-$target-" + [guid]::NewGuid().ToString() + '.zip')
  try {
    Invoke-WebRequest -Uri $url -OutFile $download
    $archiveHash = Get-FileHashValue $download
    $launcher = Expand-CodeGraphArchive -ArchivePath $download -RuntimeRoot $runtimeRoot
  } finally {
    if (Test-Path -LiteralPath $download) { Remove-Item -LiteralPath $download -Force }
  }
  $source = 'github-release'
} elseif ($CodeGraphBin) {
  $binPath = (Resolve-Path -LiteralPath $CodeGraphBin).Path
  $leaf = Split-Path -Leaf $binPath
  $dest = Join-Path $binRoot $leaf
  Copy-Item -LiteralPath $binPath -Destination $dest -Force
  $launcher = $dest
  $source = 'explicit-binary'
} else {
  throw 'Provide -CodeGraphArchive, -OnlineGitHub, or -CodeGraphBin.'
}

$versionResult = & $launcher --version
$record = @{
  source = $source
  launcher = $launcher
  version = ($versionResult | Select-Object -First 1)
  archiveSha256 = $archiveHash
  installedAt = (Get-Date).ToString('o')
  targetRoot = $targetRootPath
}
$recordPath = Save-InstallRecord -Root $targetRootPath -Record $record

Write-Result (New-Result 'ok' @{
  source = $source
  launcher = $launcher
  version = $record.version
  record = $recordPath
})
