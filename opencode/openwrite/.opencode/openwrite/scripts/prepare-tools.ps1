[CmdletBinding()]
param(
  [string]$CacheDir = (Join-Path (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "../../..")).ProviderPath "tools-cache"),
  [switch]$Json
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

New-Item -ItemType Directory -Path $CacheDir -Force | Out-Null
$cacheResolved = (Resolve-Path -LiteralPath $CacheDir).ProviderPath

$tools = @(
  [ordered]@{
    name = "PowerShell 7.6"
    command = "pwsh"
    required = $true
    github = "https://github.com/PowerShell/PowerShell/releases"
    expectedInstallHint = "다운로드한 PowerShell-7.6.x-win-x64.msi를 내부 승인 절차에 따라 설치한 뒤 PATH를 다시 연다."
  },
  [ordered]@{
    name = "Git for Windows"
    command = "git"
    required = $true
    github = "https://github.com/git-for-windows/git/releases"
    expectedInstallHint = "Git-*-64-bit.exe를 tools-cache에 보관하고 설치 후 git --version을 확인한다."
  },
  [ordered]@{
    name = "Node.js"
    command = "node"
    required = $true
    github = "https://github.com/nodejs/node/releases"
    expectedInstallHint = "Windows 바이너리는 조직 내부 GitHub release/mirror에 올린 zip 또는 msi를 사용한다. public npm registry는 사용하지 않는다."
  },
  [ordered]@{
    name = "OpenCode"
    command = "opencode"
    required = $false
    github = "https://github.com/sst/opencode/releases"
    expectedInstallHint = "조직에서 승인한 OpenCode Windows 배포 파일을 사용한다. npm global install 경로는 폐쇄망 기본값에서 제외한다."
  }
)

$checks = foreach ($tool in $tools) {
  $command = Get-Command $tool.command -ErrorAction SilentlyContinue
  [ordered]@{
    name = $tool.name
    command = $tool.command
    status = $(if ($null -eq $command) { "missing" } else { "found" })
    path = $(if ($null -eq $command) { "" } else { $command.Source })
    github = $tool.github
    cacheDir = $cacheResolved
    installHint = $tool.expectedInstallHint
  }
}

$payload = [ordered]@{ status = "ok"; cacheDir = $cacheResolved; tools = @($checks) }
if ($Json) {
  $payload | ConvertTo-Json -Depth 6
} else {
  "TOOLS_CACHE $cacheResolved"
  foreach ($check in $checks) {
    "$($check.status)`t$($check.command)`t$($check.github)"
  }
}
