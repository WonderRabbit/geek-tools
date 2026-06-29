[CmdletBinding()]
param(
  [string]$TargetRoot = "",
  [switch]$Json,
  [switch]$KeepTemp
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Invoke-NodeOpenWrite {
  param([string[]]$Arguments, [int[]]$ExpectedExitCodes = @(0))
  $node = Get-Command node -ErrorAction SilentlyContinue
  if ($null -eq $node) {
    return [ordered]@{ ok = $false; exitCode = 127; output = @("node executable was not found") }
  }
  $cli = Join-Path (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")).ProviderPath "bin/openwrite.mjs"
  $output = & $node.Source $cli @Arguments 2>&1
  $exitCode = $LASTEXITCODE
  return [ordered]@{
    ok = ($ExpectedExitCodes -contains $exitCode)
    exitCode = $exitCode
    output = @($output | ForEach-Object { [string]$_ })
  }
}

$createdTemp = $false
if ([string]::IsNullOrWhiteSpace($TargetRoot)) {
  $TargetRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("openwrite-smoke-" + [System.Guid]::NewGuid().ToString("N"))
  New-Item -ItemType Directory -Path $TargetRoot -Force | Out-Null
  $createdTemp = $true
}
$targetRootResolved = (Resolve-Path -LiteralPath $TargetRoot).ProviderPath

$contentFile = Join-Path $targetRootResolved "content.txt"
$largeContent = (1..900 | ForEach-Object { "line $_ openwrite smoke" }) -join "`n"
Set-Content -LiteralPath $contentFile -Value $largeContent -Encoding utf8

$patchFile = Join-Path $targetRootResolved "change.patch"
Set-Content -LiteralPath (Join-Path $targetRootResolved "patch-target.txt") -Value "before`n" -Encoding utf8
Set-Content -LiteralPath $patchFile -Value @"
diff --git a/patch-target.txt b/patch-target.txt
--- a/patch-target.txt
+++ b/patch-target.txt
@@ -1 +1 @@
-before
+after
"@ -Encoding utf8

$badPatchFile = Join-Path $targetRootResolved "bad.patch"
Set-Content -LiteralPath $badPatchFile -Value @"
diff --git a/missing.txt b/missing.txt
--- a/missing.txt
+++ b/missing.txt
@@ -1 +1 @@
-nope
+nope2
"@ -Encoding utf8

$fastWrite = Invoke-NodeOpenWrite -Arguments @("fast-write", "--root", $targetRootResolved, "--path", "docs/large.md", "--content-file", $contentFile, "--mode", "create")
$hashMismatch = Invoke-NodeOpenWrite -Arguments @("fast-write", "--root", $targetRootResolved, "--path", "docs/large.md", "--content-file", $contentFile, "--expected-hash", "0000") -ExpectedExitCodes @(2)
$rootEscape = Invoke-NodeOpenWrite -Arguments @("fast-write", "--root", $targetRootResolved, "--path", "../escape.txt", "--content-file", $contentFile) -ExpectedExitCodes @(2)
$fastApply = Invoke-NodeOpenWrite -Arguments @("fast-apply", "--root", $targetRootResolved, "--patch-file", $patchFile)
$badApply = Invoke-NodeOpenWrite -Arguments @("fast-apply", "--root", $targetRootResolved, "--patch-file", $badPatchFile) -ExpectedExitCodes @(2)

$targetText = Get-Content -LiteralPath (Join-Path $targetRootResolved "patch-target.txt") -Raw
$status = "ok"
if (-not $fastWrite.ok -or -not $hashMismatch.ok -or -not $rootEscape.ok -or -not $fastApply.ok -or -not $badApply.ok -or $targetText -notmatch "after") {
  $status = "fail"
}

$payload = [ordered]@{
  status = $status
  targetRoot = $targetRootResolved
  fastWrite = $fastWrite
  hashMismatch = $hashMismatch
  rootEscape = $rootEscape
  fastApply = $fastApply
  badApply = $badApply
  cleanup = "pending"
}

if ($createdTemp -and -not $KeepTemp) {
  Remove-Item -LiteralPath $targetRootResolved -Recurse -Force
  $payload.cleanup = "removed:$targetRootResolved"
} elseif ($createdTemp) {
  $payload.cleanup = "kept:$targetRootResolved"
} else {
  $payload.cleanup = "external-target-not-removed:$targetRootResolved"
}

if ($Json) {
  $payload | ConvertTo-Json -Depth 10
} else {
  "SMOKE_$($status.ToUpperInvariant())"
  "cleanup: $($payload.cleanup)"
}

if ($status -eq "fail") {
  exit 1
}
exit 0
