Set WshShell = CreateObject("WScript.Shell")
strPath = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)
WshShell.Run "cmd /c cd /d """ & strPath & """ && npm run dev", 0, False
WScript.Sleep 2000
WshShell.Run "http://localhost:3000", 1, False 