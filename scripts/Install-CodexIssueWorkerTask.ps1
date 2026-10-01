[CmdletBinding(SupportsShouldProcess = $true)]
param(
    [string]$RepositoryRoot,
    [string]$TaskName = 'PersonalWorkStation Codex Issue Worker',
    [string]$WorkerName = "$env:COMPUTERNAME-personal-workstation",
    [string]$BaseBranch = 'feat/v1-specs-m1',
    [ValidateRange(5, 60)]
    [int]$IntervalMinutes = 5,
    [switch]$SkipGitHubSetup,
    [switch]$ValidateOnly
)

$ErrorActionPreference = 'Stop'
if ($ValidateOnly) {
    Write-Output 'Installer validation succeeded.'
    return
}
if (-not $RepositoryRoot) {
    $RepositoryRoot = Split-Path $PSScriptRoot -Parent
}
$root = (Resolve-Path -LiteralPath $RepositoryRoot).Path
foreach ($command in 'node', 'git', 'gh', 'codex') {
    Get-Command $command -ErrorAction Stop | Out-Null
}
foreach ($required in 'AGENTS.md', 'docs\product\00_PRD_INDEX.md', 'docs\product\08-EXECUTION-RULES.md') {
    if (-not (Test-Path -LiteralPath (Join-Path $root $required))) {
        throw "Repository 缺少必要檔案：$required"
    }
}

$existingTask = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if ($existingTask -and $existingTask.State -eq 'Running') {
    throw "Scheduled Task 正在執行，為避免覆寫使用中的 runtime，請等待本輪完成後再更新：$TaskName"
}

$stateRoot = Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'PersonalWorkStation\codex-issue-worker'
$runtimeRoot = Join-Path $stateRoot 'runtime'
$configPath = Join-Path $stateRoot 'config.json'
$config = [ordered]@{
    workerName = $WorkerName
    maxAttempts = 2
    staleAfterMinutes = 180
    stateRoot = $stateRoot
    repositories = @(
        [ordered]@{
            nameWithOwner = 'chevalier1216/PersonalWorkStation'
            repositoryRoot = $root
            baseBranch = $BaseBranch
        }
    )
}

if (-not $PSCmdlet.ShouldProcess($configPath, '寫入 Codex Issue Worker 本機設定')) {
    return
}
New-Item -ItemType Directory -Path $stateRoot -Force | Out-Null
$config | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $configPath -Encoding utf8

# Scheduled runs must not depend on whichever Git branch is currently checked
# out in the managed repository. Keep an immutable local runtime copy so the
# worker can safely switch that checkout to codex/issue-* branches.
New-Item -ItemType Directory -Path $runtimeRoot -Force | Out-Null
foreach ($runtimeFile in @(
    'Run-CodexIssueWorkerHidden.vbs',
    'Run-CodexIssueWorker.ps1',
    'github-issue-worker.mjs',
    'github-issue-worker-lib.mjs',
    'github-issue-worker-output.schema.json'
)) {
    $source = Join-Path $PSScriptRoot $runtimeFile
    if (-not (Test-Path -LiteralPath $source)) {
        throw "Worker runtime 缺少必要檔案：$runtimeFile"
    }
    Copy-Item -LiteralPath $source -Destination (Join-Path $runtimeRoot $runtimeFile) -Force
}

$node = (Get-Command node.exe -ErrorAction Stop).Source
$git = (Get-Command git.exe -ErrorAction Stop).Source
$gh = (Get-Command gh.exe -ErrorAction Stop).Source
$codexCommand = Get-Command codex.exe -CommandType Application -ErrorAction SilentlyContinue
if (-not $codexCommand) {
    $codexCommand = Get-Command codex -CommandType Application, ExternalScript -ErrorAction Stop
}
$codex = $codexCommand.Source
$toolPathPrefix = @($node, $git, $gh, $codex) |
    ForEach-Object { Split-Path -Parent $_ } |
    Select-Object -Unique
$toolPathPrefix = $toolPathPrefix -join [IO.Path]::PathSeparator
$worker = Join-Path $runtimeRoot 'github-issue-worker.mjs'
if (-not $SkipGitHubSetup) {
    & $node $worker --config $configPath --setup
    if ($LASTEXITCODE -ne 0) {
        throw 'GitHub label setup 失敗；Scheduled Task 尚未建立。'
    }
}

$runner = Join-Path $runtimeRoot 'Run-CodexIssueWorker.ps1'
$launcher = Join-Path $runtimeRoot 'Run-CodexIssueWorkerHidden.vbs'
$powershell = (Get-Command powershell.exe -ErrorAction Stop).Source
$wscript = (Get-Command wscript.exe -ErrorAction Stop).Source
$arguments = "//B //NoLogo `"$launcher`" `"$powershell`" `"$runner`" `"$configPath`" `"$toolPathPrefix`""
$action = New-ScheduledTaskAction -Execute $wscript -Argument $arguments -WorkingDirectory $root
$logonTrigger = New-ScheduledTaskTrigger -AtLogOn -User "$env:USERDOMAIN\$env:USERNAME"
$repeatTrigger = New-ScheduledTaskTrigger `
    -Once `
    -At (Get-Date).AddMinutes(1) `
    -RepetitionInterval (New-TimeSpan -Minutes $IntervalMinutes) `
    -RepetitionDuration (New-TimeSpan -Days 3650)
$settings = New-ScheduledTaskSettingsSet `
    -Hidden `
    -MultipleInstances IgnoreNew `
    -StartWhenAvailable `
    -ExecutionTimeLimit (New-TimeSpan -Hours 6)

Register-ScheduledTask `
    -TaskName $TaskName `
    -Action $action `
    -Trigger @($logonTrigger, $repeatTrigger) `
    -Settings $settings `
    -Description '每五分鐘將 codex:ready GitHub Issue 交付本機 Codex CLI；同一 repository 一次只執行一件。' `
    -User "$env:USERDOMAIN\$env:USERNAME" `
    -Force | Out-Null

Write-Output "Installed task: $TaskName"
Write-Output "Config: $configPath"
Write-Output "Repository: $root"
