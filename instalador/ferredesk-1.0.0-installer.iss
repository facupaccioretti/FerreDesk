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

[Icons]
Name: "{commondesktop}\FerreDesk"; Filename: "http://localhost:8000"; IconFilename: "{app}\FerreDesk.ico"

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
  SelectedInstallDir: string;
  PowerShellWorkerPid: Cardinal;
  PowerShellWorkerHandle: THandle;

// Windows API
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
function GetCurrentProcessId: Cardinal;
  external 'GetCurrentProcessId@kernel32.dll stdcall';

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
      Log('RegisterRunOnce: Registrado para auto-resume: ' + Command);
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

function ExecutePowerShellPhase: Integer;
var
  Params, ScriptPath, PowerShellPath: string;
  WorkerPid: Cardinal;
  RuntimeExitCode: Integer;
  ExitCode: Cardinal;
  Attempts: Integer;
  ParentPid: Cardinal;
  ResultCode: Integer;
begin
  Result := -1;
  
  Log('ExecutePowerShellPhase: Iniciando');
  
  // Limpiar archivos previos
  DeleteFile(ProgressFilePath);
  DeleteFile(StateFilePath);
  
  // Extraer script
  ExtractTemporaryFile('{#InstallerScript}');
  ScriptPath := ExpandConstant('{tmp}\{#InstallerScript}');
  
  ParentPid := GetCurrentProcessId;
  
  // Construir parámetros
  Params := '-NoProfile -ExecutionPolicy Bypass -File "' + ScriptPath + '" -Silent';
  Params := Params + ' -StateFile "' + StateFilePath + '"';
  Params := Params + ' -LogPath "' + LogFilePath + '"';
  Params := Params + ' -ProgressFile "' + ProgressFilePath + '"';
  Params := Params + ' -ParentPid ' + IntToStr(ParentPid);
  
  if SelectedInstallDir = '' then
    SelectedInstallDir := GetDefaultInstallDirectory;
  Params := Params + ' -InstallDirectory "' + SelectedInstallDir + '"';
  
  PowerShellPath := GetPowerShell64Path;
  
  Log('ExecutePowerShellPhase: PowerShell=' + PowerShellPath);
  Log('ExecutePowerShellPhase: Params=' + Params);
  
  // Activar barra de progreso marquee
  SetWindowLong(WizardForm.ProgressGauge.Handle, GWL_STYLE,
    GetWindowLong(WizardForm.ProgressGauge.Handle, GWL_STYLE) or PBS_MARQUEE);
  SendMessage(WizardForm.ProgressGauge.Handle, PBM_SETMARQUEE, 1, 0);
  
  WizardForm.FilenameLabel.Caption := 'Instalando FerreDesk... esto puede demorar varios minutos.';
  
  // Ejecutar PowerShell
  if not Exec(PowerShellPath, Params, '', SW_HIDE, ewNoWait, ResultCode) then
  begin
    Log('ExecutePowerShellPhase: ERROR - No se pudo ejecutar PowerShell');
    SendMessage(WizardForm.ProgressGauge.Handle, PBM_SETMARQUEE, 0, 0);
    Result := -1;
    Exit;
  end;
  
  // Esperar PID
  WorkerPid := 0;
  Attempts := 0;
  while (WorkerPid = 0) and (Attempts < 300) do
  begin
    if ReadRuntimePidAndExit(WorkerPid, RuntimeExitCode) and (WorkerPid <> 0) then
    begin
      Log('ExecutePowerShellPhase: PID obtenido: ' + IntToStr(WorkerPid));
      Break;
    end;
    Sleep(200);
    Inc(Attempts);
  end;
  
  if WorkerPid = 0 then
  begin
    Log('ExecutePowerShellPhase: ERROR - No se obtuvo PID');
    SendMessage(WizardForm.ProgressGauge.Handle, PBM_SETMARQUEE, 0, 0);
    Result := 1;
    Exit;
  end;
  
  // Abrir handle del proceso
  PowerShellWorkerHandle := OpenProcess(SYNCHRONIZE or PROCESS_QUERY_LIMITED_INFORMATION, False, WorkerPid);
  if PowerShellWorkerHandle = 0 then
  begin
    Log('ExecutePowerShellPhase: ERROR - No se pudo abrir handle');
    SendMessage(WizardForm.ProgressGauge.Handle, PBM_SETMARQUEE, 0, 0);
    Result := 1;
    Exit;
  end;
  
  PowerShellWorkerPid := WorkerPid;
  
  // Esperar a que termine
  Log('ExecutePowerShellPhase: Esperando a que termine el proceso...');
  while True do
  begin
    if not GetExitCodeProcess(PowerShellWorkerHandle, ExitCode) then
    begin
      Log('ExecutePowerShellPhase: No se pudo obtener código de salida');
      Break;
    end;
    
    if ExitCode <> STILL_ACTIVE then
    begin
      Log('ExecutePowerShellPhase: Proceso terminado con código: ' + IntToStr(ExitCode));
      Break;
    end;
    
    // Actualizar UI
    WizardForm.Update;
    Sleep(500);
  end;
  
  // Limpiar
  CloseHandle(PowerShellWorkerHandle);
  PowerShellWorkerHandle := 0;
  
  // Desactivar marquee
  SendMessage(WizardForm.ProgressGauge.Handle, PBM_SETMARQUEE, 0, 0);
  SetWindowLong(WizardForm.ProgressGauge.Handle, GWL_STYLE,
    GetWindowLong(WizardForm.ProgressGauge.Handle, GWL_STYLE) and (not PBS_MARQUEE));
  
  // Leer código de salida final del estado
  if ReadRuntimePidAndExit(WorkerPid, RuntimeExitCode) then
  begin
    Log('ExecutePowerShellPhase: RuntimeExitCode=' + IntToStr(RuntimeExitCode));
    Result := RuntimeExitCode;
  end
  else
  begin
    Result := Integer(ExitCode);
  end;
  
  Log('ExecutePowerShellPhase: Resultado final=' + IntToStr(Result));
end;

procedure CurStepChanged(CurStep: TSetupStep);
var
  ResultCode: Integer;
begin
  if CurStep = ssInstall then
  begin
    Log('CurStepChanged: ssInstall - Iniciando instalación');
    
    // Inicializar rutas
    StateFilePath := ExpandStatePath;
    LogFilePath := ExpandLogPath;
    ProgressFilePath := ExpandProgressPath;
    
    // Crear directorio de logs
    ForceDirectories(ExtractFileDir(LogFilePath));
    
    // Ejecutar PowerShell
    ResultCode := ExecutePowerShellPhase;
    
    Log('CurStepChanged: PowerShell terminó con código ' + IntToStr(ResultCode));
    
    if ResultCode = 3010 then
    begin
      // Requiere reinicio
      Log('CurStepChanged: Reinicio requerido (3010)');
      RegisterRunOnce;
      MsgBox('La instalación requiere reiniciar el sistema.' + #13#10 + #13#10 +
             'Después del reinicio, la instalación continuará automáticamente.' + #13#10 + #13#10 +
             'Si no continúa automáticamente, ejecuta el instalador .exe nuevamente.',
             mbInformation, MB_OK);
    end
    else if ResultCode <> 0 then
    begin
      // Error
      Log('CurStepChanged: Error en instalación');
      MsgBox('Ocurrió un error durante la instalación.' + #13#10 + #13#10 +
             'Si Windows SmartScreen o tu antivirus bloquearon el instalador, ' + 
             'intenta ejecutar el .exe nuevamente.' + #13#10 + #13#10 +
             'Consulta el archivo de log para más detalles:' + #13#10 +
             LogFilePath,
             mbError, MB_OK);
    end
    else
    begin
      // Éxito
      Log('CurStepChanged: Instalación completada exitosamente');
      UnregisterRunOnce;
    end;
  end;
end;

procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
var
  ResultCode: Integer;
  ProjectDir: string;
begin
  if CurUninstallStep = usUninstall then
  begin
    Log('CurUninstallStepChanged: Iniciando desinstalación');
    
    // Buscar directorio del proyecto
    ProjectDir := ExpandConstant('{localappdata}\Programs\FerreDesk\ferredesk');
    
    if DirExists(ProjectDir) then
    begin
      Log('CurUninstallStepChanged: Deteniendo contenedores en ' + ProjectDir);
      
      // Detener contenedores
      Exec('docker', 'compose down -v', ProjectDir, SW_HIDE, ewWaitUntilTerminated, ResultCode);
      
      // Eliminar directorio
      DelTree(ProjectDir, True, True, True);
    end;
    
    // Limpiar ProgramData
    DelTree(ExpandConstant('{commonappdata}\FerreDesk'), True, True, True);
    
    // Limpiar registro
    RegDeleteKeyIncludingSubkeys(HKLM, 'SOFTWARE\FerreDesk');
    
    Log('CurUninstallStepChanged: Desinstalación completada');
  end;
end;

function InitializeSetup: Boolean;
begin
  Result := True;
  SelectedInstallDir := GetDefaultInstallDirectory;
  Log('InitializeSetup: Directorio=' + SelectedInstallDir);
end;
