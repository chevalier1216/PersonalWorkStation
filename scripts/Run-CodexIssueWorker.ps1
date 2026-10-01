[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$ConfigPath,
    [string]$ToolPathPrefix = ''
)

$ErrorActionPreference = 'Stop'
$utf8 = New-Object System.Text.UTF8Encoding($false)
[Console]::OutputEncoding = $utf8
$OutputEncoding = $utf8
$logRoot = Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'PersonalWorkStation\codex-issue-worker\logs'
New-Item -ItemType Directory -Path $logRoot -Force | Out-Null
$logPath = Join-Path $logRoot ("worker-{0}.log" -f (Get-Date -Format 'yyyy-MM-dd'))
$startedAt = Get-Date -Format 'o'
$exitCode = 1

try {
    if (-not [string]::IsNullOrWhiteSpace($ToolPathPrefix)) {
        $validToolDirectories = $ToolPathPrefix -split [IO.Path]::PathSeparator |
            Where-Object { -not [string]::IsNullOrWhiteSpace($_) -and (Test-Path -LiteralPath $_ -PathType Container) }
        if ($validToolDirectories.Count -eq 0) {
            throw 'Scheduled Task did not receive a valid tool PATH prefix.'
        }
        $env:PATH = (($validToolDirectories + ($env:PATH -split [IO.Path]::PathSeparator)) |
            Select-Object -Unique) -join [IO.Path]::PathSeparator
    }

    $resolvedConfig = (Resolve-Path -LiteralPath $ConfigPath).Path
    $node = (Get-Command node.exe -ErrorAction Stop).Source
    $worker = Join-Path $PSScriptRoot 'github-issue-worker.mjs'
    $output = & $node $worker --config $resolvedConfig 2>&1 | Out-String
    $exitCode = $LASTEXITCODE
    Add-Content -LiteralPath $logPath -Encoding utf8 -Value ("[{0}] exit={1}`n{2}" -f $startedAt, $exitCode, $output.Trim())
}
catch {
    $message = $_.Exception.Message -replace '[\r\n]+', ' '
    Add-Content -LiteralPath $logPath -Encoding utf8 -Value ("[{0}] bootstrap-exit=1`n{1}" -f $startedAt, $message)
    $exitCode = 1
}
finally {
    Get-ChildItem -LiteralPath $logRoot -Filter 'worker-*.log' -File |
        Where-Object LastWriteTime -lt (Get-Date).AddDays(-30) |
        Remove-Item -Force
}

exit $exitCode
