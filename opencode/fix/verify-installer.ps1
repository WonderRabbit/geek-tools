[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$installer = Join-Path $PSScriptRoot "install-opencode-write-json-repair.ps1"
$tokens = $null
$errors = $null
$null = [System.Management.Automation.Language.Parser]::ParseFile($installer, [ref]$tokens, [ref]$errors)
if ($errors.Count -gt 0) {
  $errors | ForEach-Object { Write-Error $_.Message }
  exit 1
}

$text = Get-Content -LiteralPath $installer -Raw
$required = @(
  "[CmdletBinding(SupportsShouldProcess = `$true)]",
  "Apply-UnifiedPatch",
  "New-Backup",
  "Restore-LatestBackup",
  "delete`t",
  "Remove-Item -LiteralPath",
  "Assert-WindowsTarget",
  "ForceUnsupportedOS",
  "bun",
  "typecheck"
)
foreach ($needle in $required) {
  if (-not $text.Contains($needle)) {
    throw "Installer missing required token: $needle"
  }
}

Write-Output "PS_PARSE_OK"
