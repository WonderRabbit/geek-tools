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
$scriptsRoot = Join-Path $targetRootPath '.opencode\codegraph\scripts'
$exampleManifest = Join-Path $targetRootPath '.opencode\codegraph\examples\repo-link-manifest.json'
$wrapper = Join-Path $scriptsRoot 'wonder-codegraph.mjs'
$resolver = Join-Path $scriptsRoot 'resolve-codegraph.mjs'
$node = Resolve-NodeRuntime $targetRootPath

if (-not (Test-Path -LiteralPath $wrapper)) {
  throw "wonder-codegraph.mjs not found: $wrapper"
}
if (-not (Test-Path -LiteralPath $resolver)) {
  throw "resolve-codegraph.mjs not found: $resolver"
}

$doctor = & $node $wrapper doctor --manifest $exampleManifest --json
$repoMap = & $node $wrapper repo-map --manifest $exampleManifest
$impact = & $node $wrapper impact-packet --manifest $exampleManifest --target OrderPage

Write-Result ([ordered]@{
  status = 'ok'
  node = $node
  doctor = ($doctor | ConvertFrom-Json).codegraph.available
  repoMapContainsFrontend = $repoMap -like '*frontend-web*'
  impactContainsConfidence = $impact -like '*Confidence:*'
})
