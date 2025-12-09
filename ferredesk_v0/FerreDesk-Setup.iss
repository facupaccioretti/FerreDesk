#define MyAppName "FerreDesk"
#define MyAppVersion "1.0.0"
#define InstallerScript "FerreDesk-Installer.ps1"

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
OutputBaseFilename=FerreDesk-Setup
Compression=lzma
SolidCompression=yes
WizardStyle=modern
WizardImageFile=FerreDeskIconBig.bmp
UninstallDisplayIcon={app}\FerreDesk.ico
ArchitecturesAllowed=x64
ArchitecturesInstallIn64BitMode=x64

[Files]
; El script de PowerShell se compila como support file y se extrae a {tmp} en tiempo de ejecucion.
Source: "{#InstallerScript}"; Flags: dontcopy
Source: "FerreDesk.ico"; DestDir: "{app}"; Flags: ignoreversion
; Logo para mostrar en el wizard
Source: "FerredeskIcon.bmp"; DestDir: "{tmp}"; Flags: dontcopy

[Icons]
Name: "{commondesktop}\FerreDesk"; Filename: "http://localhost:8000"; IconFilename: "{app}\FerreDesk.ico"

[Run]
; No usamos [Run] para la instalación principal; todo se hace via PowerShell en [Code].

[UninstallDelete]
Type: filesandordirs; Name: "{app}"

[Code]

const
  RegistryBase = 'SOFTWARE\FerreDesk\Installer';
  RunOnceKey = 'SOFTWARE\Microsoft\Windows\CurrentVersion\RunOnce';
  RunOnceValue = 'FerreDeskInstallerResume';
  ACTION_REPAIR = 0;
  ACTION_UPDATE = 1;
  ACTION_OPEN = 2;
  ACTION_REINSTALL = 3;
  ACTION_RESUME = 4;
  STILL_ACTIVE = 259;
  PROCESS_TERMINATE = $0001;
  PROCESS_QUERY_LIMITED_INFORMATION = $1000;
  SYNCHRONIZE = $00100000;
  GWL_STYLE = -16;
  PBS_MARQUEE = $08;
  PBM_SETMARQUEE = $040A;
  // MODO PRUEBA: Cambiar a True para ver solo la página final sin completar la instalación
  MODO_PRUEBA_PAGINA_FINAL = False;

type
  TPhaseArray = array of string;

var
  ProgressTimerID: Integer;
  ProgressFilePath: string;
  StateFilePath: string;
  LogFilePath: string;
  DetectedPhase: string;
  DetectedInstallDir: string;
  DetectedRequiresRestart: Boolean;
  HasPendingPhases: Boolean;
  ForceReinstall: Boolean;
  ExistingInstallPage: TInputOptionWizardPage;
  ExistingInstallChoice: Integer;
  ExistingInstallDetected: Boolean;
  ResumeFromCmd: Boolean;
  AutoResume: Boolean;
  ViewLogButton: TNewButton;
  UninstallRemoveData: Boolean;
  RemoveDataCheckBox: TNewCheckBox;
  InstallDirPage: TInputDirWizardPage;
  SelectedInstallDir: string;
  UserCancelled: Boolean;
  LastInstallResultCode: Integer;
  LogoHandle: THandle;
  FinishedLogoHandle: THandle;

{ Esta función ya no se usa - el botón Cancelar ahora funciona como cerrar la ventana }

procedure ViewLogButtonClick(Sender: TObject);
var
  Dummy: Integer;
begin
  if not FileExists(LogFilePath) then
    MsgBox('No se encontró el archivo de log en ' + LogFilePath, mbInformation, MB_OK)
  else
    ShellExec('open', 'notepad.exe', '"' + LogFilePath + '"', '', SW_SHOWNORMAL, ewNoWait, Dummy);
end;

procedure RemoveDataCheckBoxClick(Sender: TObject);
begin
  UninstallRemoveData := RemoveDataCheckBox.Checked;
end;

function ExpandStatePath: string;
begin
  Result := ExpandConstant('{commonappdata}\FerreDesk\installer-state.json');
end;

function ExpandLogPath: string;
begin
  Result := ExpandConstant('{commonappdata}\FerreDesk\logs\FerreDesk-Installer.log');
end;

function ExpandInstallerPath: string;
begin
  Result := ExpandConstant('{commonappdata}\FerreDesk\FerreDesk-Setup-Resume.exe');
end;

function ReadRegStrSafe(const RootKey: Integer; const SubKey, ValueName: string; var Value: string): Boolean;
begin
  Result := RegQueryStringValue(RootKey, SubKey, ValueName, Value);
end;

function ReadRegBoolSafe(const RootKey: Integer; const SubKey, ValueName: string; var Value: Boolean): Boolean;
var
  S: string;
begin
  Result := False;
  if RegQueryStringValue(RootKey, SubKey, ValueName, S) then
  begin
    if S = '1' then
      Value := True
    else
      Value := False;
    Result := True;
  end;
end;

function WriteRegStrSafe(const RootKey: Integer; const SubKey, ValueName, Value: string): Boolean;
begin
  Result := RegWriteStringValue(RootKey, SubKey, ValueName, Value);
end;

function WriteRegBoolSafe(const RootKey: Integer; const SubKey, ValueName: string; const Value: Boolean): Boolean;
begin
  if Value then
    Result := RegWriteStringValue(RootKey, SubKey, ValueName, '1')
  else
    Result := RegWriteStringValue(RootKey, SubKey, ValueName, '0');
end;

function DeleteRegKeySafe(const RootKey: Integer; const SubKey: string): Boolean;
begin
  Result := RegDeleteKeyIncludingSubkeys(RootKey, SubKey);
end;

// Función para detectar si un directorio es temporal (directorios temporales de Inno Setup o del sistema)
function IsTemporaryDirectory(const Dir: string): Boolean;
var
  TempPath: string;
  LowerDir: string;
begin
  Result := False;
  if Dir = '' then
    Exit;
    
  LowerDir := LowerCase(Dir);
  TempPath := LowerCase(GetTempDir);
  
  // Detectar si está en carpeta temp del sistema
  if Pos(TempPath, LowerDir) > 0 then
  begin
    Result := True;
    Exit;
  end;
  
  // Detectar prefijo de directorios temporales de Inno Setup (is-XXXXXXXX.tmp)
  if Pos('\is-', LowerDir) > 0 then
  begin
    Result := True;
    Exit;
  end;
  
  // Detectar otras rutas temporales comunes
  if (Pos('\temp\', LowerDir) > 0) or (Pos('\tmp\', LowerDir) > 0) then
    Result := True;
end;

// Función para obtener directorio por defecto seguro para instalación
function GetDefaultInstallDirectory: string;
begin
  // Usar LocalAppData\Programs (estándar para instalaciones por usuario)
  Result := ExpandConstant('{localappdata}\Programs\FerreDesk');
end;

function CopySubStr(const S: string; StartPos, Count: Integer): string;
var
  I: Integer;
begin
  Result := '';
  if StartPos < 1 then
    StartPos := 1;
  for I := 0 to Count - 1 do begin
    if (StartPos + I) > Length(S) then
      Break;
    Result := Result + S[StartPos + I - 1];
  end;
end;

function LoadStringFromFileQuiet(const FileName: string; var Contents: AnsiString): Boolean;
begin
  Result := False;
  if FileExists(FileName) then
    Result := LoadStringFromFile(FileName, Contents);
end;

function PosEx(const SubStr, S: string; Offset: Integer): Integer;
var
  i, LSub, LS: Integer;
begin
  Result := 0;
  LSub := Length(SubStr);
  LS := Length(S);

  if (LSub = 0) or (Offset < 1) or (Offset > LS) then
    Exit;

  for i := Offset to LS - LSub + 1 do
  begin
    if Copy(S, i, LSub) = SubStr then
    begin
      Result := i;
      Exit;
    end;
  end;
end;


// Extrae un campo numerico (entero) de un JSON simple generado por PowerShell (ConvertTo-Json),
// tolerando espacios entre los dos puntos y el valor, y valores entrecomillados o sin comillas.
function ExtractJsonIntField(const Json, Key: string; var Value: Integer): Boolean;
var
  KeyPos, ColonPos, I: Integer;
  NumStr: string;
begin
  Result := False;
  Value := -1;
  NumStr := '';

  // Buscar el nombre de la clave, por ejemplo "Pid"
  KeyPos := Pos('"' + Key + '"', Json);
  if KeyPos = 0 then
    Exit;

  // Buscar el ':' siguiente a la clave
  ColonPos := PosEx(':', Json, KeyPos);
  if ColonPos = 0 then
    Exit;

  // Avanzar sobre espacios en blanco
  I := ColonPos + 1;
  while (I <= Length(Json)) and (Json[I] in [#9, #10, #13, ' ']) do
    Inc(I);
  if I > Length(Json) then
    Exit;

  // Si el valor empieza con comillas, leer hasta la siguiente comilla
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
    // Leer digitos (y signo) hasta encontrar un separador
    while (I <= Length(Json)) and (((Json[I] >= '0') and (Json[I] <= '9')) or (Json[I] = '-')) do
    begin
      NumStr := NumStr + Json[I];
      Inc(I);
    end;
  end;

  if NumStr = '' then
    Exit;

  Value := StrToIntDef(NumStr, -1);
  Result := True;
end;

// === Funciones de la API de Windows para controlar procesos externos ===
function OpenProcess(dwDesiredAccess: LongInt; bInheritHandle: LongBool; dwProcessId: LongInt): THandle;
  external 'OpenProcess@kernel32.dll stdcall';
function GetExitCodeProcess(hProcess: THandle; var lpExitCode: Cardinal): Boolean;
  external 'GetExitCodeProcess@kernel32.dll stdcall';
function TerminateProcess(hProcess: THandle; uExitCode: Cardinal): Boolean;
  external 'TerminateProcess@kernel32.dll stdcall';
function CloseHandle(hObject: THandle): Boolean;
  external 'CloseHandle@kernel32.dll stdcall';

// Funciones de la API de Windows para manipular la interfaz (barra de progreso)
procedure Sleep(dwMilliseconds: Cardinal);
  external 'Sleep@kernel32.dll stdcall';
function SendMessage(hWnd: THandle; Msg: Cardinal; wParam: LongInt; lParam: LongInt): LongInt;
  external 'SendMessageW@user32.dll stdcall';
function GetWindowLong(hWnd: THandle; nIndex: Integer): LongInt;
  external 'GetWindowLongW@user32.dll stdcall';
function SetWindowLong(hWnd: THandle; nIndex: Integer; dwNewLong: LongInt): LongInt;
  external 'SetWindowLongW@user32.dll stdcall';

// Funciones de la API de Windows para cargar y mostrar iconos
function LoadImage(hInst: THandle; lpsz: string; uType: Cardinal; cxDesired, cyDesired: Integer; fuLoad: Cardinal): THandle;
  external 'LoadImageW@user32.dll stdcall';
function DrawIconEx(hDC: THandle; xLeft, yTop: Integer; hIcon: THandle; cxWidth, cyWidth: Integer; istepIfAniCur: Integer; hbrFlickerFreeDraw: THandle; diFlags: Cardinal): Boolean;
  external 'DrawIconEx@user32.dll stdcall';
function DestroyIcon(hIcon: THandle): Boolean;
  external 'DestroyIcon@user32.dll stdcall';

const
  IMAGE_ICON = 1;
  LR_LOADFROMFILE = $0010;
  LR_DEFAULTSIZE = $0040;
  DI_NORMAL = $0003;

// === Bucle de mensajes para mantener la GUI de Inno responsiva ===
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


// Lee el PID y ExitCode del estado JSON generado por el script PowerShell.
// Ambos se guardan como cadenas; aqui se convierten a enteros.
function ReadRuntimePidAndExit(var RuntimePid: Cardinal; var RuntimeExitCode: Integer): Boolean;
var
  Json: AnsiString;
  PidInt: Integer;
  ExitInt: Integer;
begin
  Result := False;
  RuntimePid := 0;
  RuntimeExitCode := -1;

  if not FileExists(StateFilePath) then
    Exit;

  if not LoadStringFromFile(StateFilePath, Json) then
    Exit;

  PidInt := 0;
  ExitInt := -1;

  if ExtractJsonIntField(Json, 'Pid', PidInt) then
    RuntimePid := Cardinal(PidInt);

  if ExtractJsonIntField(Json, 'ExitCode', ExitInt) then
    RuntimeExitCode := ExitInt;

  Result := (RuntimePid <> 0);
end;

procedure DetectExistingInstall;
var
  InstallStatus, InstallDir: string;
begin
  ExistingInstallDetected := False;
  DetectedPhase := 'FASE_0';
  DetectedInstallDir := '';
  DetectedRequiresRestart := False;
  HasPendingPhases := False;

  InstallStatus := '';
  InstallDir := '';

  { Para detectar instalaciones existentes, solo leemos el flag simple InstallationStatus
    del registro. El script PowerShell mantiene este campo actualizado. Toda la lógica
    de fases y decisiones se maneja en PS1, no aquí. 
    
    IMPORTANTE: Solo detectamos instalación existente si:
    1. Hay InstallationStatus en el registro
    2. Y hay un directorio válido (no temporal, existe)
    Si el directorio es temporal o no existe, tratamos como instalación nueva. }
  if ReadRegStrSafe(HKLM, RegistryBase, 'InstallationStatus', InstallStatus) then
  begin
    { Leer directorio y validarlo ANTES de marcar como instalación existente }
    if ReadRegStrSafe(HKLM, RegistryBase, 'InstallDir', InstallDir) and (InstallDir <> '') then
    begin
      // VALIDAR: Solo detectar instalación si el directorio es válido
      if not IsTemporaryDirectory(InstallDir) and DirExists(InstallDir) then
      begin
        // Directorio válido - es una instalación real
        ExistingInstallDetected := True;
        DetectedInstallDir := InstallDir;
        SelectedInstallDir := InstallDir;
        
        { Determinar si hay trabajo pendiente basado solo en el status }
        if (InstallStatus = 'IN_PROGRESS') or (InstallStatus = 'FAILED') then
          HasPendingPhases := True;
      end
      else
      begin
        { Directorio inválido o temporal - limpiar registro y tratar como instalación nueva }
        WriteRegStrSafe(HKLM, RegistryBase, 'InstallationStatus', 'NONE');
        InstallDir := '';
      end;
    end
    else
    begin
      { No hay directorio en el registro - limpiar status y tratar como instalación nueva }
      WriteRegStrSafe(HKLM, RegistryBase, 'InstallationStatus', 'NONE');
    end;
  end
  else
  begin
    { Compatibilidad: si no encontramos InstallationStatus pero hay InstallDir,
      validar que sea una instalación real antes de detectarla }
    if ReadRegStrSafe(HKLM, RegistryBase, 'InstallDir', InstallDir) and (InstallDir <> '') then
    begin
      // Solo detectar si el directorio es válido (no temporal, existe)
      if not IsTemporaryDirectory(InstallDir) and DirExists(InstallDir) then
      begin
        ExistingInstallDetected := True;
        DetectedInstallDir := InstallDir;
        SelectedInstallDir := InstallDir;
      end
      else
      begin
        { Directorio inválido - limpiar y tratar como instalación nueva }
        WriteRegStrSafe(HKLM, RegistryBase, 'InstallDir', '');
      end;
    end;
  end;
end;

procedure RegisterRunOnce;
var
  Command: string;
  InstallerPath: string;
  ResultCode: Integer;
begin
  // Ruta persistente donde guardaremos el instalador
  InstallerPath := ExpandInstallerPath;
  
  // Asegurar que el directorio existe
  ForceDirectories(ExtractFileDir(InstallerPath));
  
  // Copiar el instalador actual a la ubicación persistente
  // Usamos cmd copy porque FileCopy no puede copiar el ejecutable en ejecución
  if Exec(ExpandConstant('{cmd}'), 
          Format('/C copy /Y "%s" "%s"', [ExpandConstant('{srcexe}'), InstallerPath]),
          '', SW_HIDE, ewWaitUntilTerminated, ResultCode) then
  begin
    if ResultCode = 0 then
    begin
      // Registrar RunOnce con la ruta persistente
      Command := '"' + InstallerPath + '" /RESUME';
  if WizardSilent then
    Command := Command + ' /VERYSILENT';

  RegWriteStringValue(HKLM, RunOnceKey, RunOnceValue, Command);
    end
    else
    begin
      // Si falla la copia, usar srcexe como fallback
      Command := '"' + ExpandConstant('{srcexe}') + '" /RESUME';
      if WizardSilent then
        Command := Command + ' /VERYSILENT';
      RegWriteStringValue(HKLM, RunOnceKey, RunOnceValue, Command);
    end;
  end
  else
  begin
    // Si falla la ejecución del comando, usar srcexe como fallback
    Command := '"' + ExpandConstant('{srcexe}') + '" /RESUME';
    if WizardSilent then
      Command := Command + ' /VERYSILENT';
    RegWriteStringValue(HKLM, RunOnceKey, RunOnceValue, Command);
  end;
end;

procedure UnregisterRunOnce;
var
  InstallerPath: string;
begin
  // Eliminar entrada del registro
  RegDeleteValue(HKLM, RunOnceKey, RunOnceValue);
  
  // Limpiar el instalador copiado si existe
  InstallerPath := ExpandInstallerPath;
  if FileExists(InstallerPath) then
    DeleteFile(InstallerPath);
end;

function RunShellExec(const Cmd, Params: string; out ResultCode: Integer): Boolean;
begin
  Result := ShellExec('', Cmd, Params, '', SW_SHOWNORMAL, ewWaitUntilTerminated, ResultCode);
end;

{ Obtener la ruta explícita de PowerShell de 64 bits.
  Aunque ArchitecturesInstallIn64BitMode=x64 debería manejarlo automáticamente,
  esta función asegura que usemos explícitamente PowerShell de 64 bits. }
function GetPowerShell64Path: string;
var
  PS64Path: string;
begin


  if IsWin64 then
    PS64Path := ExpandConstant('{sys}\WindowsPowerShell\v1.0\powershell.exe')
  else
    PS64Path := ExpandConstant('{sys}\WindowsPowerShell\v1.0\powershell.exe');
    
  if not FileExists(PS64Path) then
  begin
    { Fallback generico }
    PS64Path := 'powershell.exe';
  end;
  
  Result := PS64Path;
end;

function ExecutePowerShellPhase(const Phase: string; const ResumeFlag: Boolean; const ExtraArgs: string): Integer;
var
  Params: string;
  ScriptPath: string;
  PowerShellPath: string;
  StubHandle: THandle;
  WorkerHandle: THandle;
  ResultCode: Integer;
  WorkerPid: Cardinal;
  RuntimeExitCode: Integer;
  exitCode: Cardinal;
  Attempts: Integer;
begin
  Result := -1;
  DeleteFile(ProgressFilePath);
  { Eliminar archivo de estado previo para evitar leer PIDs/codigos de
    ejecuciones anteriores. El script volvera a crear estado y tambien
    replica la informacion necesaria en el registro para reanudaciones. }
  DeleteFile(StateFilePath);

  { Extraer el script de PowerShell compilado como support file al directorio temporal }
  ExtractTemporaryFile('{#InstallerScript}');
  ScriptPath := ExpandConstant('{tmp}\{#InstallerScript}');

  { Siempre ejecutamos el script en modo silencioso (-Silent) para que
    toda la salida detallada vaya al log y el usuario vea solo el wizard. }
  Params := '-NoProfile -ExecutionPolicy Bypass -File "' + ScriptPath + '" -Silent';
  if Phase <> '' then
    Params := Params + ' -Phase "' + Phase + '"';
  if ResumeFlag then
    Params := Params + ' -Resume';
  if ExtraArgs <> '' then
    Params := Params + ' ' + ExtraArgs;
  Params := Params + ' -StateFile "' + StateFilePath + '"';
  Params := Params + ' -LogPath "' + LogFilePath + '"';
  Params := Params + ' -ProgressFile "' + ProgressFilePath + '"';
  
  { GARANTIZAR: SelectedInstallDir siempre tiene un valor válido }
  if SelectedInstallDir = '' then
  begin
    SelectedInstallDir := GetDefaultInstallDirectory;
    // Guardarlo en registro
    WriteRegStrSafe(HKLM, RegistryBase, 'InstallDir', SelectedInstallDir);
  end;
  
  { Validar que no sea temporal antes de pasar a PowerShell }
  if IsTemporaryDirectory(SelectedInstallDir) then
  begin
    SelectedInstallDir := GetDefaultInstallDirectory;
    WriteRegStrSafe(HKLM, RegistryBase, 'InstallDir', SelectedInstallDir);
  end;
  
  { SIEMPRE pasar el directorio (nunca debe estar vacío ahora) }
  Params := Params + ' -InstallDirectory "' + SelectedInstallDir + '"';

  { Obtener la ruta explícita de PowerShell de 64 bits.
    Con ArchitecturesInstallIn64BitMode=x64, esto debería ser la versión de 64 bits,
    pero hacerlo explícito garantiza que usemos la versión correcta. }
  PowerShellPath := GetPowerShell64Path;
  { Activar barra de progreso indeterminada (estilo marquee) }
  SetWindowLong(WizardForm.ProgressGauge.Handle, GWL_STYLE,
    GetWindowLong(WizardForm.ProgressGauge.Handle, GWL_STYLE) or PBS_MARQUEE);
  SendMessage(WizardForm.ProgressGauge.Handle, PBM_SETMARQUEE, 1, 0);

  WizardForm.FilenameLabel.Caption :=
    'Instalando dependencias... esto puede demorar varios minutos.';

  { Lanzar el script PowerShell sin esperar (puede relanzarse internamente).
    Usaremos el PID publicado en installer-state.json para seguir al proceso real. }
  if not Exec(PowerShellPath, Params, '', SW_HIDE, ewNoWait, StubHandle) then
  begin
    SendMessage(WizardForm.ProgressGauge.Handle, PBM_SETMARQUEE, 0, 0);
    SetWindowLong(WizardForm.ProgressGauge.Handle, GWL_STYLE,
      GetWindowLong(WizardForm.ProgressGauge.Handle, GWL_STYLE) and (not PBS_MARQUEE));
    WizardForm.ProgressGauge.Position := 0;
    Result := -1;
    Exit;
  end;

  { Esperar a que el script publique su PID real en el archivo de estado }
  WorkerPid := 0;
  RuntimeExitCode := -1;
  Attempts := 0;
  while (WorkerPid = 0) and (Attempts < 50) do
  begin
    if ReadRuntimePidAndExit(WorkerPid, RuntimeExitCode) and (WorkerPid <> 0) then
      Break;
    Sleep(200);
    Inc(Attempts);
  end;

  if WorkerPid = 0 then
  begin
    { No se obtuvo PID: no podemos seguir al proceso real }
    SendMessage(WizardForm.ProgressGauge.Handle, PBM_SETMARQUEE, 0, 0);
    SetWindowLong(WizardForm.ProgressGauge.Handle, GWL_STYLE,
      GetWindowLong(WizardForm.ProgressGauge.Handle, GWL_STYLE) and (not PBS_MARQUEE));
    WizardForm.ProgressGauge.Position := 0;
    Result := 1;
    Exit;
  end;

  WorkerHandle := OpenProcess(SYNCHRONIZE or PROCESS_QUERY_LIMITED_INFORMATION or PROCESS_TERMINATE,
    False, WorkerPid);
  if WorkerHandle = 0 then
  begin
    SendMessage(WizardForm.ProgressGauge.Handle, PBM_SETMARQUEE, 0, 0);
    SetWindowLong(WizardForm.ProgressGauge.Handle, GWL_STYLE,
      GetWindowLong(WizardForm.ProgressGauge.Handle, GWL_STYLE) and (not PBS_MARQUEE));
    WizardForm.ProgressGauge.Position := 0;
    Result := 1;
    Exit;
  end;

  exitCode := STILL_ACTIVE;
  while True do
  begin
    AppProcessMessage;
    WizardForm.Refresh;

    if not GetExitCodeProcess(WorkerHandle, exitCode) then
    begin
      exitCode := 1;
      Break;
    end;

    if exitCode <> STILL_ACTIVE then
      Break;

    Sleep(200);
  end;

  CloseHandle(WorkerHandle);

  { Apagar marquee }
  SendMessage(WizardForm.ProgressGauge.Handle, PBM_SETMARQUEE, 0, 0);
  SetWindowLong(WizardForm.ProgressGauge.Handle, GWL_STYLE,
    GetWindowLong(WizardForm.ProgressGauge.Handle, GWL_STYLE) and (not PBS_MARQUEE));
  WizardForm.ProgressGauge.Position := 0;

  { Preferir el ExitCode que publico el script en el estado, si existe }
  if ReadRuntimePidAndExit(WorkerPid, RuntimeExitCode) and (RuntimeExitCode >= 0) then
    Result := RuntimeExitCode
  else
    Result := Integer(exitCode);
end;

function RunInstallationFlow: Integer;
var
  i: Integer;
begin
  { Si ya hay instalacion completa y el usuario elige solo abrir }
  if (ExistingInstallDetected) and (ExistingInstallChoice = ACTION_OPEN) then begin
    ShellExec('open', 'http://localhost:8000', '', '', SW_SHOWNORMAL, ewNoWait, i);
    Result := 0;
    Exit;
  end;

  { Modos especiales: Reparar / Actualizar / Reinstalar.
    En todos los casos delegamos completamente en el script PowerShell,
    que decide internamente que fases ejecutar segun el estado persistido. }
  if (ExistingInstallDetected) and (ExistingInstallChoice = ACTION_REPAIR) then begin
    Result := ExecutePowerShellPhase('', ResumeFromCmd, '-Repair');
    Exit;
  end;

  if (ExistingInstallDetected) and (ExistingInstallChoice = ACTION_UPDATE) then begin
    Result := ExecutePowerShellPhase('', ResumeFromCmd, '-Update');
    Exit;
  end;

  if ((ExistingInstallDetected) and (ExistingInstallChoice = ACTION_REINSTALL)) or ForceReinstall then begin
    Result := ExecutePowerShellPhase('', ResumeFromCmd, '-Reinstall');
    Exit;
  end;

  { Si el usuario eligio reanudar manualmente }
  if (ExistingInstallDetected) and (ExistingInstallChoice = ACTION_RESUME) then begin
    Result := ExecutePowerShellPhase('', True, '');
    Exit;
  end;

  { Flujo normal: instalar o reanudar sin acciones especiales.
    No pasamos Phase: el script leera installer-state.json/registro y
    decidira que fases (1,2,3) deben ejecutarse o reanudarse. }
  Result := ExecutePowerShellPhase('', ResumeFromCmd, '');
end;

function ShouldRemoveData: Boolean;
begin
  Result := UninstallRemoveData;
end;

procedure InitializeWizard;
var
  ParamIndex: Integer;
  Param: string;
  StateFileFromCmd, LogFileFromCmd: string;
begin
  ProgressFilePath := ExpandConstant('{tmp}\ferredesk-progress.txt');
  ExistingInstallChoice := -1;
  ExistingInstallPage := nil;
  // Inicializar SelectedInstallDir con valor por defecto seguro
  SelectedInstallDir := GetDefaultInstallDirectory;
  UserCancelled := False;
  AutoResume := False;
  LastInstallResultCode := 0;
  LogoHandle := 0;
  FinishedLogoHandle := 0;

  // Pagina para seleccionar el directorio real de instalacion de FerreDesk
  // (codigo fuente + proyecto Docker). No es el mismo que la carpeta interna {app}.
  // Usamos wpWelcome como pagina anterior para que aparezca justo despues del bienvenido.
  // Firma correcta de Inno Setup 6.x:
  // CreateInputDirPage(AfterID, Caption, Description, SubCaption, NewFolder, Value)
  InstallDirPage := CreateInputDirPage(
    wpWelcome,
    'Directorio de instalación de FerreDesk',
    '',
    'Evitá usar carpetas del sistema que requieran permisos de administrador.',
    False,
    '');

  InstallDirPage.Add('Carpeta de instalación de FerreDesk:');
  InstallDirPage.Values[0] := GetDefaultInstallDirectory;

  for ParamIndex := 1 to ParamCount do
  begin
    Param := UpperCase(ParamStr(ParamIndex));
    if Param = '/RESUME' then
      ResumeFromCmd := True;
  end;

  StateFilePath := ExpandStatePath;
  LogFilePath := ExpandLogPath;
  ForceDirectories(ExtractFileDir(StateFilePath));
  ForceDirectories(ExtractFileDir(LogFilePath));
  ExistingInstallDetected := False;
  ForceReinstall := False;
  DetectedPhase := 'FASE_0';
  DetectedInstallDir := '';
  DetectedRequiresRestart := False;
  HasPendingPhases := False;

  if not IsAdmin then begin
    MsgBox('Este instalador requiere permisos de administrador.', mbError, MB_OK);
    Exit;
  end;

  // Inicializar SelectedInstallDir con valor por defecto seguro
  SelectedInstallDir := GetDefaultInstallDirectory;

  DetectExistingInstall;  // Esto sobrescribirá SelectedInstallDir si hay instalación válida

  if ExistingInstallDetected and (not ResumeFromCmd) then
  begin
    ExistingInstallPage := CreateInputOptionPage(InstallDirPage.ID,
      'Instalación detectada',
      'FerreDesk ya se encuentra instalado o tiene una instalación pendiente.',
      'Selecciona la acción que deseas realizar:',
      True,
      False);

    { Si hay fases pendientes, la opcion por defecto debe ser Reanudar }
    if HasPendingPhases then
    begin
      ExistingInstallPage.Add('Reanudar instalación pendiente (no se borra la base de datos)');
      ExistingInstallPage.Add('Reinstalar desde cero (no se borra la base de datos)');
      ExistingInstallPage.Add('Reparar instalación (no se borra la base de datos)');
      ExistingInstallPage.SelectedValueIndex := 0;
      
      { Mapeo de indices a acciones:
        0: ACTION_RESUME
        1: ACTION_REINSTALL
        2: ACTION_REPAIR
        
        NOTA: Esto requiere ajustar la lectura en CurStepChanged para mapear correctamente
        el indice seleccionado a nuestras constantes ACTION_*.
      }
    end
    else
    begin
      ExistingInstallPage.Add('Reparar instalación (no se borra la base de datos)');
      ExistingInstallPage.Add('Actualizar código (no se borra la base de datos)');
      ExistingInstallPage.Add('Solo abrir FerreDesk en el navegador');
      ExistingInstallPage.Add('Reinstalar desde cero (no se borra la base de datos)');
      ExistingInstallPage.SelectedValueIndex := 0;
    end;
  end;

  { Activar modo de reanudacion automatica SOLO si:
    - El instalador fue lanzado con /RESUME (RunOnce tras reinicio). 
    
    YA NO activamos AutoResume solo por HasPendingPhases, porque eso causa
    que al abrir el instalador manualmente se salte el menu de opciones. }
  if ResumeFromCmd then
    AutoResume := True;

  ViewLogButton := TNewButton.Create(WizardForm);
  ViewLogButton.Parent := WizardForm;
  ViewLogButton.Left := WizardForm.NextButton.Left - ScaleX(120);
  ViewLogButton.Top := WizardForm.NextButton.Top;
  ViewLogButton.Width := ScaleX(110);
  ViewLogButton.Height := WizardForm.NextButton.Height;
  ViewLogButton.Caption := 'Ver log';
  ViewLogButton.Visible := False;
  ViewLogButton.OnClick := @ViewLogButtonClick;

  { Extraer el logo para usar en diferentes partes del wizard }
  ExtractTemporaryFile('FerredeskIcon.bmp');
  
  { Mostrar el logo en la esquina superior derecha (visible en todas las paginas) }
  try
    WizardForm.WizardSmallBitmapImage.Bitmap.LoadFromFile(ExpandConstant('{tmp}\FerredeskIcon.bmp'));
    { El logo pequeño en Inno Setup tiene un tamaño fijo de aproximadamente 55x55 píxeles }
    { Si el bitmap es cuadrado o tiene buenas proporciones, se verá bien }
  except
    { Si falla cargar el bitmap, continuar sin logo }
  end;
  
  { Cargar el logo grande para la pagina final (se mostrará cuando lleguemos a wpFinished) }
  try
    WizardForm.WizardBitmapImage.Bitmap.LoadFromFile(ExpandConstant('{tmp}\FerredeskIcon.bmp'));
    { El logo grande en Inno Setup tiene un tamaño fijo de aproximadamente 164x314 píxeles }
    { Si el bitmap original es cuadrado o tiene buenas proporciones, se verá bien }
  except
    { Si falla cargar el bitmap, continuar sin logo }
  end;

  { El botón Cancelar ahora funciona igual que cerrar la ventana (diálogo nativo de Inno Setup).
    Durante la instalación (ssInstall) el botón se deshabilita para evitar cancelaciones
    mientras el proceso está corriendo. }
end;

function ShouldSkipPage(PageID: Integer): Boolean;
begin
  // MODO PRUEBA: Saltar todas las páginas excepto la final
  if MODO_PRUEBA_PAGINA_FINAL then
  begin
    Result := not (PageID = wpFinished);
    Exit;
  end;
  
  // Código original:
  Result := False;
  
  { Saltar pagina de directorio si:
    1. Es una reanudacion automatica (AutoResume)
    2. Es una reanudacion manual desde linea de comandos (ResumeFromCmd)
    3. Se detecto una instalacion existente Y NO se eligio reinstalar desde cero
       (es decir, si es Resume, Repair, Update u Open, usamos el directorio existente)
  }
  if (PageID = InstallDirPage.ID) then
  begin
    if AutoResume or ResumeFromCmd then
    begin
      Result := True;
    end
    else if ExistingInstallDetected and (ExistingInstallChoice <> ACTION_REINSTALL) then
    begin
      Result := True;
    end;
  end;
end;


procedure CurPageChanged(CurPageID: Integer);
begin
  { Durante el modo de reanudacion automatica, avanzamos por las paginas
    iniciales sin pedir interaccion al usuario y llegamos directamente a
    la pagina de progreso (wpInstalling). }
  if AutoResume then
  begin
    if CurPageID = wpInstalling then
    begin
      { Ya estamos en la pagina de instalacion: ajustar textos para dejar
        claro que se trata de una reanudacion despues de reinicio. }
      WizardForm.FilenameLabel.Caption :=
        'Reanudando la instalación de FerreDesk... esto puede demorar varios minutos.';
      WizardForm.StatusLabel.Caption :=
        'Continuando la instalación. No cierres esta ventana.';
      AutoResume := False;
    end
    else if CurPageID <> wpFinished then
    begin
      { Avanzar automaticamente mientras no hayamos llegado a la pagina
        de progreso ni a la pagina final. Utilizamos Click para evitar
        problemas de tipos con el manejador OnClick. }
      WizardForm.NextButton.onClick;
    end;
  end;

  if CurPageID = wpReady then
  begin
    if InstallDirPage.Values[0] = '' then
      SelectedInstallDir := GetDefaultInstallDirectory
    else
      SelectedInstallDir := InstallDirPage.Values[0];
    
    // Guardar el directorio elegido en el registro inmediatamente
    if SelectedInstallDir <> '' then
    begin
      // Validar que no sea temporal antes de guardar
      if not IsTemporaryDirectory(SelectedInstallDir) then
      begin
        // Guardar en registro para persistencia
        WriteRegStrSafe(HKLM, RegistryBase, 'InstallDir', SelectedInstallDir);
      end
      else
      begin
        // Si es temporal, usar directorio por defecto y guardarlo
        SelectedInstallDir := GetDefaultInstallDirectory;
        WriteRegStrSafe(HKLM, RegistryBase, 'InstallDir', SelectedInstallDir);
      end;
    end;
  end;

  if CurPageID = wpFinished then
  begin
    ViewLogButton.Visible := True;
    
    { Asegurarse de que el logo grande esté cargado y visible en la pagina final }
    { Recargar el bitmap para asegurar que se muestre correctamente }
    try
      ExtractTemporaryFile('FerredeskIcon.bmp');
      if FileExists(ExpandConstant('{tmp}\FerredeskIcon.bmp')) then
      begin
        WizardForm.WizardBitmapImage.Bitmap.LoadFromFile(ExpandConstant('{tmp}\FerredeskIcon.bmp'));
        WizardForm.WizardBitmapImage.Visible := True;
        { Forzar actualización del componente }
        WizardForm.WizardBitmapImage.Refresh;
      end;
    except
      { Si falla, continuar sin logo - el error se ignora silenciosamente }
    end;
    
    { Si el resultado fue 3010 (reinicio requerido), asegurar que el texto sea claro }
    if LastInstallResultCode = 3010 then
    begin
      WizardForm.FinishedHeadingLabel.Caption :=
        'Reinicio requerido';
      WizardForm.FinishedLabel.Caption :=
        'Se instalaron componentes del sistema que requieren reinicio.'#13#10#13#10 +
        'Reiniciá tu computadora para continuar con la instalación. El instalador se reanudará automáticamente.';
    end;
  end;
end;

procedure CurStepChanged(CurStep: TSetupStep);
var
  ResultCode: Integer;
begin
  // MODO PRUEBA: Simular que la instalación terminó exitosamente
  if MODO_PRUEBA_PAGINA_FINAL and (CurStep = ssInstall) then
  begin
    LastInstallResultCode := 0; // Éxito
    Exit; // Salir sin ejecutar nada
  end;
  
  if CurStep = ssInstall then begin
    { Durante la fase de instalación principal deshabilitamos el botón Cancel
      para evitar que el usuario intente cancelar mientras el script externo
      está corriendo. Esto garantiza que no queden procesos huérfanos. }
    WizardForm.CancelButton.Enabled := False;

    { Solo leemos la opcion de la pagina de instalacion detectada cuando:
      - Realmente existe la pagina (ExistingInstallPage <> nil), y
      - No estamos en un flujo de reanudacion automatica (HasPendingPhases / ResumeFromCmd).
      En los escenarios de reanudacion, ExistingInstallDetected puede ser True
      pero la pagina de opciones no se crea, por lo que acceder a
      ExistingInstallPage.SelectedValueIndex provocaria un error en tiempo
      de ejecucion (Runtime error: Could not call proc). }
    if ExistingInstallDetected and (ExistingInstallPage <> nil) and
       (not ResumeFromCmd) then
    begin
      if HasPendingPhases then
      begin
        { Mapeo especial para cuando hay fases pendientes }
        case ExistingInstallPage.SelectedValueIndex of
          0: ExistingInstallChoice := ACTION_RESUME;
          1: ExistingInstallChoice := ACTION_REINSTALL;
          2: ExistingInstallChoice := ACTION_REPAIR;
        end;
      end
      else
      begin
        { Mapeo estandar (mismo orden que en InitializeWizard) }
        ExistingInstallChoice := ExistingInstallPage.SelectedValueIndex;
      end;
    end
    else
      ExistingInstallChoice := -1;
    ResultCode := RunInstallationFlow;
    { Guardar el código de resultado para usarlo en CurPageChanged }
    LastInstallResultCode := ResultCode;
    { Registrar en el mismo log del instalador el codigo devuelto por PowerShell
      para facilitar el diagnostico cuando se usa solo el wizard. }
    SaveStringToFile(LogFilePath,
      Format('[InnoSetup] Resultado instalacion externa: %d'#13#10, [ResultCode]), True);
    case ResultCode of
      0: begin
        UnregisterRunOnce;
      end;
      3010: begin
        { Éxito con reinicio requerido (estándar Windows Installer) }
        RegisterRunOnce;
        { El texto se establecerá en CurPageChanged cuando se muestre wpFinished }
        MsgBox(
          'Se instalaron o actualizaron componentes del sistema requeridos por FerreDesk.'#13#10#13#10 +
          'Se requiere reiniciar para completar la instalación.'#13#10 +
          'Después del reinicio, el instalador se reanudará automáticamente.',
          mbInformation, MB_OK);
      end;
    else begin
      { Cualquier otro código = error (código estándar es -1) }
      { Mostrar mensaje de error genérico }
      MsgBox(
        'Ocurrió un error durante la instalación de FerreDesk.',
        mbError, MB_OK);
    end;
    end; { Cierra el case ResultCode of }

    { Al finalizar la fase de instalación (con éxito, error o solicitud de reinicio),
      volvemos a habilitar el botón Cancel para el resto del wizard. }
    WizardForm.CancelButton.Enabled := True;
  end; { Cierra el if CurStep = ssInstall }
end; { Cierra el procedure CurStepChanged }

procedure InitializeUninstallProgressForm;
begin
  RemoveDataCheckBox := TNewCheckBox.Create(UninstallProgressForm);
  RemoveDataCheckBox.Parent := UninstallProgressForm;
  RemoveDataCheckBox.Left := UninstallProgressForm.StatusLabel.Left;
  RemoveDataCheckBox.Top := UninstallProgressForm.StatusLabel.Top + UninstallProgressForm.StatusLabel.Height + ScaleY(8);
  RemoveDataCheckBox.Width := UninstallProgressForm.StatusLabel.Width;
  RemoveDataCheckBox.Caption := 'Eliminar datos de FerreDesk (volúmenes Docker)';
  RemoveDataCheckBox.OnClick := @RemoveDataCheckBoxClick;
end;

procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
var
  Dummy: Integer;
begin
  if (CurUninstallStep = usUninstall) and ShouldRemoveData then
  begin
    ShellExec('', 'docker', 'compose down -v', '', SW_HIDE, ewWaitUntilTerminated, Dummy);
  end;

  if CurUninstallStep = usPostUninstall then
  begin
    { Limpiar claves de registro del instalador para evitar estados 'zombies'
      si el usuario vuelve a instalar en el futuro. }
    RegDeleteKeyIncludingSubkeys(HKLM, RegistryBase);
  end;
end;
