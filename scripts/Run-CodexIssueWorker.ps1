[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$ConfigPath
)

$ErrorActionPreference = 'Stop'
$resolvedConfig = (Resolve-Path -LiteralPath $ConfigPath).Path
$node = (Get-Command node -ErrorAction Stop).Source
$worker = Join-Path $PSScriptRoot 'github-issue-worker.mjs'
$logRoot = Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'PersonalWorkStation\codex-issue-worker\logs'
New-Item -ItemType Directory -Path $logRoot -Force | Out-Null

$logPath = Join-Path $logRoot ("worker-{0}.log" -f (Get-Date -Format 'yyyy-MM-dd'))
$startedAt = Get-Date -Format 'o'
$output = & $node $worker --config $resolvedConfig 2>&1 | Out-String
$exitCode = $LASTEXITCODE

Add-Content -LiteralPath $logPath -Encoding utf8 -Value ("[{0}] exit={1}`n{2}" -f $startedAt, $exitCode, $output.Trim())
Get-ChildItem -LiteralPath $logRoot -Filter 'worker-*.log' -File |
    Where-Object LastWriteTime -lt (Get-Date).AddDays(-30) |
    Remove-Item -Force

exit $exitCode
