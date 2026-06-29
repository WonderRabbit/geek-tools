[CmdletBinding()]
param(
  [string]$TargetRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "../../..")).ProviderPath,
  [string]$Out = ".estimate/evidence-adapters.json",
  [int]$Limit = 120,
  [switch]$Json
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Resolve-InRoot {
  param([string]$Root, [string]$RelativePath)
  $rootResolved = (Resolve-Path -LiteralPath $Root).ProviderPath
  $combined = Join-Path $rootResolved $RelativePath
  $parent = Split-Path -Parent $combined
  if (-not (Test-Path -LiteralPath $parent)) {
    New-Item -ItemType Directory -Path $parent -Force | Out-Null
  }
  $parentResolved = (Resolve-Path -LiteralPath $parent).ProviderPath
  if (-not $parentResolved.StartsWith($rootResolved, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Output path escapes target root: $RelativePath"
  }
  return $combined
}

function Get-ToolInfo {
  param([string]$Name)
  $command = Get-Command $Name -ErrorAction SilentlyContinue
  if ($null -eq $command) {
    return [ordered]@{ name = $Name; available = $false; path = ""; version = ""; status = "warn" }
  }
  $versionOutput = @()
  try {
    $versionOutput = & $command.Source --version 2>&1 | Select-Object -First 1
  } catch {
    $versionOutput = @($_.Exception.Message)
  }
  return [ordered]@{
    name = $Name
    available = $true
    path = $command.Source
    version = (($versionOutput | ForEach-Object { [string]$_ }) -join " ")
    status = "ok"
  }
}

function Invoke-ToolLines {
  param(
    [string]$Name,
    [string[]]$Arguments,
    [int]$Take = 80
  )
  $command = Get-Command $Name -ErrorAction SilentlyContinue
  if ($null -eq $command) {
    return [ordered]@{ tool = $Name; status = "warn"; exitCode = 127; lines = @(); detail = "$Name not found" }
  }
  try {
    $output = & $command.Source @Arguments 2>&1
    $exitCode = $LASTEXITCODE
    $lines = @($output | Select-Object -First $Take | ForEach-Object { [string]$_ })
    $status = "ok"
    if ($exitCode -ne 0 -and $lines.Count -eq 0) {
      $status = "warn"
    }
    return [ordered]@{ tool = $Name; status = $status; exitCode = $exitCode; lines = $lines; detail = "" }
  } catch {
    return [ordered]@{ tool = $Name; status = "warn"; exitCode = 1; lines = @(); detail = $_.Exception.Message }
  }
}

$rootResolved = (Resolve-Path -LiteralPath $TargetRoot).ProviderPath
$outPath = Resolve-InRoot -Root $rootResolved -RelativePath $Out
$tools = @("rg", "fd", "sg", "jq", "yq", "mdq") | ForEach-Object { Get-ToolInfo -Name $_ }

$fileInventory = Invoke-ToolLines -Name "fd" -Arguments @(".", $rootResolved, "--type", "f", "--hidden", "--exclude", ".git") -Take $Limit
if ($fileInventory.exitCode -eq 127) {
  $fileInventory = Invoke-ToolLines -Name "rg" -Arguments @("--files", $rootResolved) -Take $Limit
}

$sourceSignals = Invoke-ToolLines -Name "rg" -Arguments @("-n", "--glob", "!**/.git/**", "--glob", "!**/node_modules/**", "class |function |export |controller|service|repository|handler", $rootResolved) -Take $Limit
$flowSignals = Invoke-ToolLines -Name "rg" -Arguments @("-n", "--glob", "!**/.git/**", "--glob", "!**/node_modules/**", "data flow|business flow|transaction|permission|state|retry|idempot|external|domain", $rootResolved) -Take $Limit
$astSignals = Invoke-ToolLines -Name "sg" -Arguments @("--lang", "typescript", "--pattern", "function `$NAME(`$`$`$ARGS) { `$`$`$BODY }", $rootResolved) -Take ([Math]::Min($Limit, 40))

$jsonFiles = Get-ChildItem -LiteralPath $rootResolved -Recurse -File -Filter "*.json" -ErrorAction SilentlyContinue |
  Where-Object { $_.FullName -notmatch "\\.git\\" -and $_.FullName -notmatch "node_modules" } |
  Select-Object -First 5
$jsonSamples = New-Object System.Collections.Generic.List[object]
foreach ($file in $jsonFiles) {
  $relative = [System.IO.Path]::GetRelativePath($rootResolved, $file.FullName)
  $probe = Invoke-ToolLines -Name "jq" -Arguments @("-r", "paths | join(`".`")", $file.FullName) -Take 20
  $jsonSamples.Add([ordered]@{ path = $relative; jq = $probe })
}

$yamlFiles = Get-ChildItem -LiteralPath $rootResolved -Recurse -File -Include "*.yml", "*.yaml" -ErrorAction SilentlyContinue |
  Where-Object { $_.FullName -notmatch "\\.git\\" -and $_.FullName -notmatch "node_modules" } |
  Select-Object -First 5
$yamlSamples = New-Object System.Collections.Generic.List[object]
foreach ($file in $yamlFiles) {
  $relative = [System.IO.Path]::GetRelativePath($rootResolved, $file.FullName)
  $probe = Invoke-ToolLines -Name "yq" -Arguments @("eval", "keys", $file.FullName) -Take 20
  $yamlSamples.Add([ordered]@{ path = $relative; yq = $probe })
}

$markdownFiles = Get-ChildItem -LiteralPath $rootResolved -Recurse -File -Filter "*.md" -ErrorAction SilentlyContinue |
  Where-Object { $_.FullName -notmatch "\\.git\\" -and $_.FullName -notmatch "node_modules" } |
  Select-Object -First 5
$markdownSamples = New-Object System.Collections.Generic.List[object]
foreach ($file in $markdownFiles) {
  $relative = [System.IO.Path]::GetRelativePath($rootResolved, $file.FullName)
  $probe = Invoke-ToolLines -Name "mdq" -Arguments @($file.FullName) -Take 20
  $markdownSamples.Add([ordered]@{ path = $relative; mdq = $probe })
}

$payload = [ordered]@{
  kind = "estimate.evidence-adapters"
  version = 1
  targetRoot = $rootResolved
  generatedAt = (Get-Date).ToUniversalTime().ToString("o")
  tools = $tools
  adapters = [ordered]@{
    fileInventory = $fileInventory
    sourceSignals = $sourceSignals
    flowSignals = $flowSignals
    astSignals = $astSignals
    jsonSamples = $jsonSamples
    yamlSamples = $yamlSamples
    markdownSamples = $markdownSamples
  }
  evidenceHints = [ordered]@{
    sourceEvidencePrefix = "file:"
    flowEvidencePrefix = "flow:"
    requirementEvidencePrefix = "requirement:"
  }
}

$payload | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath $outPath -Encoding utf8

if ($Json) {
  $payload | ConvertTo-Json -Depth 12
} else {
  "COLLECT_EVIDENCE_OK"
  "out: $outPath"
}

