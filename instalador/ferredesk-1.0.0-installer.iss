#define MyAppName "FerreDesk"
#define MyAppVersion "1.0.0"
#define InstallerScript "ferredesk-1.0.0.ps1"

[Languages]
Name: "spanish"; MessagesFile: "compiler:Languages\Spanish.isl"

[Setup]
AppId={{5F73B7B0-FA6E-4E9B-8AB8-899E1E25F5D2}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
DefaultDirName={autopf}\FerreDesk
DisableDirPage=yes
DisableProgramGroupPage=yes
PrivilegesRequired=admin
OutputBaseFilename=FerreDesk-1.0.0-Setup
Compression=lzma
SolidCompression=yes
WizardStyle=modern
WizardImageFile=FerreDeskIconBig.bmp
WizardSmallImageFile=FerredeskIcon.bmp
UninstallDisplayIcon={app}\FerreDesk.ico
ArchitecturesAllowed=x64
ArchitecturesInstallIn64BitMode=x64
AppPublisher=FerreDesk
AppPublisherURL=https://github.com/facupaccioretti/FerreDesk
DefaultGroupName=FerreDesk
Uninstallable=yes
SetupLogging=yes

[Files]
Source: "{#InstallerScript}"; Flags: dontcopy
Source: "FerreDesk.ico"; DestDir: "{app}"; Flags: ignoreversion
Source: "FerredeskIcon.bmp"; DestDir: "{tmp}"; Flags: dontcopy
Source: "ferredesk_launcher.exe"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{commondesktop}\FerreDesk"; Filename: "{app}\ferredesk_launcher.exe"; IconFilename: "{app}\FerreDesk.ico"

[UninstallDelete]
Type: filesandordirs; Name: "{app}"

[Code]
const
  RegistryBase = 'SOFTWARE\FerreDesk\Installer';
  UninstallKey = 'SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\{5F73B7B0-FA6E-4E9B-8AB8-899E1E25F5D2}';
  RunOnceKey = 'SOFTWARE\Microsoft\Windows\CurrentVersion\RunOnce';
  RunOnceValue = 'FerreDeskInstallerResume';
  STILL_ACTIVE = 259;
  PROCESS_QUERY_LIMITED_INFORMATION = $1000;
  SYNCHRONIZE = $00100000;
  GWL_STYLE = -16;
  PBS_MARQUEE = $08;
  PBM_SETMARQUEE = $040A;

var
  ProgressFilePath: string;
  StateFilePath: string;
  LogFilePath: string;
  LastInstallResultCode: Integer;
  SelectedInstallDir: string;
  PowerShellWorkerPid: Cardinal;
  PowerShellWorkerHandle: THandle;

// Windows API for Job Objects and UI Responsiveness
function CreateJobObject(lpJobAttributes: LongInt; lpName: string): THandle;
  external 'CreateJobObjectW@kernel32.dll stdcall';
function AssignProcessToJobObject(hJob, hProcess: THandle): Boolean;
  external 'AssignProcessToJobObject@kernel32.dll stdcall';
function TerminateJobObject(hJob: THandle; uExitCode: Cardinal): Boolean;
  external 'TerminateJobObject@kernel32.dll stdcall';
function GetLastError: Cardinal;
  external 'GetLastError@kernel32.dll stdcall';
function GetCurrentProcessId: Cardinal;
  external 'GetCurrentProcessId@kernel32.dll stdcall';
function OpenProcess(dwDesiredAccess: LongInt; bInheritHandle: LongBool; dwProcessId: LongInt): THandle;
  external 'OpenProcess@kernel32.dll stdcall';
function GetExitCodeProcess(hProcess: THandle; var lpExitCode: Cardinal): Boolean;
  external 'GetExitCodeProcess@kernel32.dll stdcall';
function CloseHandle(hObject: THandle): Boolean;
  external 'CloseHandle@kernel32.dll stdcall';
procedure Sleep(dwMilliseconds: Cardinal);
  external 'Sleep@kernel32.dll stdcall';
function SendMessage(hWnd: THandle; Msg: Cardinal; wParam: LongInt; lParam: LongInt): LongInt;
  external 'SendMessageW@user32.dll stdcall';
function GetWindowLong(hWnd: THandle; nIndex: Integer): LongInt;
  external 'GetWindowLongW@user32.dll stdcall';
function SetWindowLong(hWnd: THandle; nIndex: Integer; dwNewLong: LongInt): LongInt;
  external 'SetWindowLongW@user32.dll stdcall';

// Message Pump for UI Responsiveness
type
  TMsg = record
    hwnd: HWND;
    message: Cardinal;
    wParam: LongInt;
    lParam: LongInt;
    time: Cardinal;
    pt: TPoint;
  end;

const
  PM_REMOVE = 1;

function PeekMessage(var lpMsg: TMsg; hWnd: HWND; wMsgFilterMin, wMsgFilterMax, wRemoveMsg: Cardinal): Boolean;
  external 'PeekMessageW@user32.dll stdcall';
function TranslateMessage(const lpMsg: TMsg): Boolean;
  external 'TranslateMessage@user32.dll stdcall';
function DispatchMessage(const lpMsg: TMsg): LongInt;
  external 'DispatchMessageW@user32.dll stdcall';

procedure AppProcessMessage;
var
  Msg: TMsg;
begin
  while PeekMessage(Msg, WizardForm.Handle, 0, 0, PM_REMOVE) do
  begin
    TranslateMessage(Msg);
    DispatchMessage(Msg);
  end;
end;

// Custom Logging
function ExpandInnoLogPath: string;
begin
  Result := ExpandConstant('{commonappdata}\FerreDesk\logs\FerreDesk-Setup.log');
end;

procedure WriteInnoLog(const Mensaje: string);
var
  LogFile: string;
  Timestamp: string;
  LogLine: string;
  LogDir: string;
begin
  try
    LogFile := ExpandInnoLogPath;
    LogDir := ExtractFileDir(LogFile);
    if not DirExists(LogDir) then ForceDirectories(LogDir);
    
    Timestamp := GetDateTimeString('yyyy-mm-dd hh:nn:ss', '-', ':');
    LogLine := '[' + Timestamp + '] [INNO] ' + Mensaje;
    SaveStringToFile(LogFile, LogLine + #13#10, True);
  except
    Log('WriteInnoLog ERROR: ' + GetExceptionMessage);
  end;
end;

function ExpandStatePath: string;
begin
  Result := ExpandConstant('{commonappdata}\FerreDesk\installer-state.json');
end;

function ExpandLogPath: string;
begin
  Result := ExpandConstant('{commonappdata}\FerreDesk\logs\FerreDesk-Installer.log');
end;

function ExpandProgressPath: string;
begin
  Result := ExpandConstant('{commonappdata}\FerreDesk\progress.txt');
end;

function GetDefaultInstallDirectory: string;
begin
  Result := ExpandConstant('{localappdata}\Programs\FerreDesk');
end;

function GetPowerShell64Path: string;
begin
  if IsWin64 then
    Result := ExpandConstant('{sys}\WindowsPowerShell\v1.0\powershell.exe')
  else
    Result := 'powershell.exe';
end;

procedure RegisterRunOnce;
var
  Command: string;
  InstallerPath: string;
  ResultCode: Integer;
begin
  InstallerPath := ExpandConstant('{commonappdata}\FerreDesk\FerreDesk-Setup-Resume.exe');
  ForceDirectories(ExtractFileDir(InstallerPath));
  
  if Exec(ExpandConstant('{cmd}'), 
          Format('/C copy /Y "%s" "%s"', [ExpandConstant('{srcexe}'), InstallerPath]),
          '', SW_HIDE, ewWaitUntilTerminated, ResultCode) then
  begin
    if ResultCode = 0 then
    begin
      Command := '"' + InstallerPath + '" /RESUME';
      if WizardSilent then
        Command := Command + ' /VERYSILENT';
      RegWriteStringValue(HKLM, RunOnceKey, RunOnceValue, Command);
      WriteInnoLog('RegisterRunOnce: Registrado para auto-resume: ' + Command);
    end;
  end;
end;

procedure UnregisterRunOnce;
var
  InstallerPath: string;
begin
  RegDeleteValue(HKLM, RunOnceKey, RunOnceValue);
  InstallerPath := ExpandConstant('{commonappdata}\FerreDesk\FerreDesk-Setup-Resume.exe');
  if FileExists(InstallerPath) then
    DeleteFile(InstallerPath);
end;

function ExtractJsonIntField(const Json, Key: string; var Value: Integer): Boolean;
var
  KeyPos, ColonPos, I: Integer;
  NumStr: string;
begin
  Result := False;
  Value := -1;
  NumStr := '';
  
  KeyPos := Pos('"' + Key + '"', Json);
  if KeyPos = 0 then Exit;
  
  ColonPos := Pos(':', Copy(Json, KeyPos, Length(Json)));
  if ColonPos = 0 then Exit;
  ColonPos := KeyPos + ColonPos;
  
  I := ColonPos;
  while (I <= Length(Json)) and (Json[I] in [#9, #10, #13, ' ', ':']) do
    Inc(I);
  
  if Json[I] = '"' then
  begin
    Inc(I);
    while (I <= Length(Json)) and (Json[I] <> '"') do
    begin
      NumStr := NumStr + Json[I];
      Inc(I);
    end;
  end
  else
  begin
    while (I <= Length(Json)) and (((Json[I] >= '0') and (Json[I] <= '9')) or (Json[I] = '-')) do
    begin
      NumStr := NumStr + Json[I];
      Inc(I);
    end;
  end;
  
  if NumStr = '' then Exit;
  Value := StrToIntDef(NumStr, -1);
  Result := True;
end;

function ReadRuntimePidAndExit(var RuntimePid: Cardinal; var RuntimeExitCode: Integer): Boolean;
var
  Json: AnsiString;
  PidInt, ExitInt: Integer;
begin
  Result := False;
  RuntimePid := 0;
  RuntimeExitCode := -1;
  
  if not FileExists(StateFilePath) then Exit;
  if not LoadStringFromFile(StateFilePath, Json) then Exit;
  
  ExtractJsonIntField(Json, 'Pid', PidInt);
  RuntimePid := Cardinal(PidInt);
  ExtractJsonIntField(Json, 'ExitCode', ExitInt);
  RuntimeExitCode := ExitInt;
  
  Result := (RuntimePid <> 0);
end;

function InitializeSetup: Boolean;
begin
  Result := True;
  SelectedInstallDir := GetDefaultInstallDirectory;
  // Initialize log
  WriteInnoLog('========================================');
  WriteInnoLog('Inno Setup - Inicio del instalador versión ' + '{#MyAppVersion}');
end;

procedure InitializeWizard;
begin
  // Set Small Icon explicitly if standard directive fails (though WizardSmallImageFile should handle it)
  // Also ensures the big wizard image is loaded correctly
  // Note: WizardSmallImageFile in [Setup] is the primary way, but we can double check resources here if needed.
end;

// Enhanced ExecutePowerShellPhase with Job Objects and UI Pump
function ExecutePowerShellPhase: Integer;
var
  Params, ScriptPath, PowerShellPath: string;
  WorkerPid: Cardinal;
  RuntimeExitCode: Integer;
  ExitCode: Cardinal;
  Attempts: Integer;
  ParentPid: Cardinal;
  ResultCode: Integer;
  PowerShellJobObject: THandle;
begin
  Result := -1;
  WriteInnoLog('ExecutePowerShellPhase: Iniciando');
  
  DeleteFile(ProgressFilePath);
  DeleteFile(StateFilePath);
  
  ExtractTemporaryFile('{#InstallerScript}');
  ScriptPath := ExpandConstant('{tmp}\{#InstallerScript}');
  
  ParentPid := GetCurrentProcessId;
  
  // Params including ParentPid
  Params := '-NoProfile -ExecutionPolicy Bypass -File "' + ScriptPath + '" -Silent';
  Params := Params + ' -StateFile "' + StateFilePath + '"';
  Params := Params + ' -LogPath "' + LogFilePath + '"';
  Params := Params + ' -ProgressFile "' + ProgressFilePath + '"';
  Params := Params + ' -ParentPid ' + IntToStr(ParentPid);
  
  if SelectedInstallDir = '' then
    SelectedInstallDir := GetDefaultInstallDirectory;
  Params := Params + ' -InstallDirectory "' + SelectedInstallDir + '"';
  
  PowerShellPath := GetPowerShell64Path;
  WriteInnoLog('ExecutePowerShellPhase: PowerShell=' + PowerShellPath);
  WriteInnoLog('ExecutePowerShellPhase: Params=' + Params);
  
  // Job Object Creation
  PowerShellJobObject := CreateJobObject(0, '');
  if PowerShellJobObject = 0 then
    WriteInnoLog('WARNING: No se pudo crear Job Object. Error: ' + IntToStr(GetLastError))
  else
    WriteInnoLog('Job Object creado exitosamente.');
  
  SetWindowLong(WizardForm.ProgressGauge.Handle, GWL_STYLE,
    GetWindowLong(WizardForm.ProgressGauge.Handle, GWL_STYLE) or PBS_MARQUEE);
  SendMessage(WizardForm.ProgressGauge.Handle, PBM_SETMARQUEE, 1, 0);
  
  WizardForm.FilenameLabel.Caption := 'Instalando FerreDesk... esto puede demorar varios minutos.';
  
  // Exec PowerShell
  if not Exec(PowerShellPath, Params, '', SW_HIDE, ewNoWait, ResultCode) then
  begin
    WriteInnoLog('ERROR: No se pudo ejecutar PowerShell');
    SendMessage(WizardForm.ProgressGauge.Handle, PBM_SETMARQUEE, 0, 0);
    Result := -1;
    Exit;
  end;
  
  WriteInnoLog('PowerShell ejecutado. Esperando PID...');
  
  // Wait for PID loop with UI Pump
  WorkerPid := 0;
  Attempts := 0;
  while (WorkerPid = 0) and (Attempts < 300) do
  begin
    if ReadRuntimePidAndExit(WorkerPid, RuntimeExitCode) and (WorkerPid <> 0) then
    begin
      WriteInnoLog('PID obtenido: ' + IntToStr(WorkerPid));
      Break;
    end;
    AppProcessMessage; // Keep UI alive
    Sleep(50);         // Faster checks
    Inc(Attempts);
  end;
  
  if WorkerPid = 0 then
  begin
    WriteInnoLog('ERROR: Timeout esperando PID');
    SendMessage(WizardForm.ProgressGauge.Handle, PBM_SETMARQUEE, 0, 0);
    Result := 1;
    Exit;
  end;
  
  // Assign to Job Object
  PowerShellWorkerHandle := OpenProcess(SYNCHRONIZE or PROCESS_QUERY_LIMITED_INFORMATION or $0001 {TERMINATE} or $0100 {SET_QUOTA}, False, WorkerPid);
  if PowerShellWorkerHandle = 0 then
  begin
    WriteInnoLog('ERROR: No se pudo abrir handle del proceso');
    SendMessage(WizardForm.ProgressGauge.Handle, PBM_SETMARQUEE, 0, 0);
    Result := 1;
    Exit;
  end;
  
  if (PowerShellJobObject <> 0) then
  begin
    if not AssignProcessToJobObject(PowerShellJobObject, PowerShellWorkerHandle) then
      WriteInnoLog('WARNING: No se pudo asignar proceso al Job Object. Error: ' + IntToStr(GetLastError));
  end;

  PowerShellWorkerPid := WorkerPid;
  
  WriteInnoLog('Esperando terminación del proceso...');
  
  // Main Wait Loop with UI Pump
  while True do
  begin
    if not GetExitCodeProcess(PowerShellWorkerHandle, ExitCode) then
    begin
      WriteInnoLog('ERROR: Falló GetExitCodeProcess');
      Break;
    end;
    
    if ExitCode <> STILL_ACTIVE then
    begin
      WriteInnoLog('Proceso terminado. Código nativo: ' + IntToStr(ExitCode));
      Break;
    end;
    
    AppProcessMessage; // Vital for "not frozen" feel
    Sleep(50);
  end;
  
  CloseHandle(PowerShellWorkerHandle);
  if PowerShellJobObject <> 0 then CloseHandle(PowerShellJobObject);
  PowerShellWorkerHandle := 0;
  
  SendMessage(WizardForm.ProgressGauge.Handle, PBM_SETMARQUEE, 0, 0);
  SetWindowLong(WizardForm.ProgressGauge.Handle, GWL_STYLE,
    GetWindowLong(WizardForm.ProgressGauge.Handle, GWL_STYLE) and (not PBS_MARQUEE));
  
  if ReadRuntimePidAndExit(WorkerPid, RuntimeExitCode) and (RuntimeExitCode >= 0) then
  begin
    WriteInnoLog('ExitCode final (desde estado JSON): ' + IntToStr(RuntimeExitCode));
    Result := RuntimeExitCode;
  end
  else
  begin
    WriteInnoLog('Usando ExitCode del proceso nativo: ' + IntToStr(ExitCode));
    Result := Integer(ExitCode);
  end;
end;

procedure CurStepChanged(CurStep: TSetupStep);
var
  ResultCode: Integer;
begin
  if CurStep = ssInstall then
  begin
    WriteInnoLog('CurStepChanged: ssInstall - Iniciando');
    
    StateFilePath := ExpandStatePath;
    LogFilePath := ExpandLogPath;
    ProgressFilePath := ExpandProgressPath;
    
    ForceDirectories(ExtractFileDir(LogFilePath));
    
    ResultCode := ExecutePowerShellPhase;
    
    WriteInnoLog('Fase PowerShell terminada. Resultado: ' + IntToStr(ResultCode));
    
    // Guardar resultado para uso en CurPageChanged
    LastInstallResultCode := ResultCode;
    
    if ResultCode = 3010 then
    begin
      WriteInnoLog('Requiere reinicio (3010)');
      RegisterRunOnce;
      // NO mostrar MsgBox aquí - el mensaje se mostrará en la página wpFinished
      // a través de CurPageChanged, igual que el instalador legacy
    end
    else if ResultCode <> 0 then
    begin
      WriteInnoLog('Error en instalación. Código: ' + IntToStr(ResultCode));
      MsgBox('Ocurrió un error durante la instalación de FerreDesk.' + #13#10 + #13#10 +
             'Código de error: ' + IntToStr(ResultCode) + #13#10 +
             'Revise los logs en:' + #13#10 +
             'C:\ProgramData\FerreDesk\logs\FerreDesk-Installer.log',
             mbError, MB_OK);
      // CRÍTICO: Abortar la instalación para que NO llegue a Finish
      Abort;
    end
    else
    begin
      WriteInnoLog('Instalación exitosa');
      UnregisterRunOnce;
    end;
  end;
end;

procedure DeinitializeSetup;
begin
  // Cleanup Job Object if still active (redundant if process finished, but safe)
  if (PowerShellWorkerHandle <> 0) and (PowerShellWorkerPid <> 0) then
  begin
     WriteInnoLog('DeinitializeSetup: Terminando proceso huérfano ' + IntToStr(PowerShellWorkerPid));
     // TerminateProcess(PowerShellWorkerHandle, 1); // Optional, JobObject handles this usually
  end;
end;

procedure CurPageChanged(CurPageID: Integer);
begin
  if CurPageID = wpFinished then
  begin
    case LastInstallResultCode of
      0: begin
        WizardForm.FinishedLabel.Caption := 
          'FerreDesk se ha instalado correctamente en tu sistema.' + #13#10 + #13#10 +
          'Puedes acceder a la aplicación en: http://localhost:8000';
      end;
      3010: begin
        WizardForm.FinishedHeadingLabel.Caption := 'Reinicio del sistema requerido';
        WizardForm.FinishedLabel.Caption := 
          'La instalación de FerreDesk necesita reiniciar el sistema para completarse.' + #13#10 + #13#10 +
          'Después del reinicio, la instalación continuará automáticamente.' + #13#10 + #13#10 +
          'Por favor, guarda tu trabajo y reinicia tu computadora.';
      end;
    end;
  end;
end;

procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
var
  ResultCode: Integer;
  AppDir: string;
begin
  if CurUninstallStep = usUninstall then
  begin
    AppDir := ExpandConstant('{app}\ferredesk_v0');
    if DirExists(AppDir) then
      Exec('cmd.exe', '/c docker-compose down', AppDir, SW_HIDE, ewWaitUntilTerminated, ResultCode);
  end;

  if CurUninstallStep = usPostUninstall then
  begin
    RegDeleteKeyIncludingSubkeys(HKLM, 'SOFTWARE\FerreDesk');
    DelTree(ExpandConstant('{commonappdata}\FerreDesk'), True, True, True);
  end;
end;
