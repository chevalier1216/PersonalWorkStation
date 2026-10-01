Option Explicit

If WScript.Arguments.Count <> 4 Then
    WScript.Quit 64
End If

Dim shell, command, exitCode
Set shell = CreateObject("WScript.Shell")

command = QuoteArgument(WScript.Arguments(0)) _
    & " -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass" _
    & " -File " & QuoteArgument(WScript.Arguments(1)) _
    & " -ConfigPath " & QuoteArgument(WScript.Arguments(2)) _
    & " -ToolPathPrefix " & QuoteArgument(WScript.Arguments(3))

' wscript.exe is a Windows GUI-subsystem host. Window style 0 starts the
' PowerShell child hidden before it can display a console, and True preserves
' the runner's exit code for Task Scheduler.
exitCode = shell.Run(command, 0, True)
WScript.Quit exitCode

Function QuoteArgument(ByVal value)
    If InStr(value, Chr(34)) > 0 Then
        WScript.Quit 64
    End If
    QuoteArgument = Chr(34) & value & Chr(34)
End Function
