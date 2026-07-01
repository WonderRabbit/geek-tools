param(
  [string]$TargetRoot = (Get-Location).Path,
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

function Resolve-NodeRuntime([string]$Root) {
  $bundledNode = Join-Path $Root '.opencode\codegraph\runtime\current\node\node.exe'
  if (Test-Path -LiteralPath $bundledNode) { return $bundledNode }

  $pathNode = Get-Command node -ErrorAction SilentlyContinue
  if ($pathNode) { return $pathNode.Source }

  throw "Node runtime not found. Install a CodeGraph runtime archive with bundled node.exe or place node on PATH."
}

$targetRootPath = (Resolve-Path -LiteralPath $TargetRoot).Path
$resolver = Join-Path $targetRootPath '.opencode\codegraph\scripts\resolve-codegraph.mjs'
if (-not (Test-Path -LiteralPath $resolver)) {
  throw "resolve-codegraph.mjs not found: $resolver"
}

$node = Resolve-NodeRuntime $targetRootPath

$jsonText = & $node $resolver
$resolved = $jsonText | ConvertFrom-Json
if (-not $resolved.ok) {
  Write-Result ([ordered]@{
    status = 'fail'
    reason = $resolved.message
    command = $resolved.command
  })
  exit 1
}

Write-Result ([ordered]@{
  status = 'ok'
  node = $node
  source = $resolved.source
  command = $resolved.command
  version = $resolved.version
})
