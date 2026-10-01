[CmdletBinding(SupportsShouldProcess = $true)]
param(
    [string]$TaskName = 'PersonalWorkStation Codex Issue Worker',
    [switch]$RemoveLocalState
)

$ErrorActionPreference = 'Stop'
if (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue) {
    if ($PSCmdlet.ShouldProcess($TaskName, '移除 Scheduled Task')) {
        Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
    }
}

if ($RemoveLocalState) {
    $stateRoot = Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'PersonalWorkStation\codex-issue-worker'
    if (Test-Path -LiteralPath $stateRoot) {
        if ($PSCmdlet.ShouldProcess($stateRoot, '移除 Worker 本機設定、狀態與 log')) {
            Remove-Item -LiteralPath $stateRoot -Recurse -Force
        }
    }
}
