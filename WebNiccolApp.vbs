Dim ps
ps = Left(WScript.ScriptFullName, InStrRev(WScript.ScriptFullName, "\")) & "tools\deploy-github-gui.ps1"
CreateObject("WScript.Shell").Run "powershell.exe -NoProfile -STA -ExecutionPolicy Bypass -WindowStyle Hidden -File """ & ps & """", 0, False
