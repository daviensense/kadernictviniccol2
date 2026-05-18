Dim ps
ps = Left(WScript.ScriptFullName, InStrRev(WScript.ScriptFullName, "\")) & "deploy-gui.ps1"
CreateObject("WScript.Shell").Run "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File """ & ps & """", 0, False
