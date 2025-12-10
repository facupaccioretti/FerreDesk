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
AppPublisher=FerreDesk
AppPublisherURL=https://github.com/facupaccioretti/FerreDesk
DefaultGroupName=FerreDesk
Uninstallable=yes

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
  UninstallKey = 'SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\{5F73B7B0-FA6E-4E9B-8AB8-899E1E25F5D2}';
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
  UninstallRemoveCode: Boolean;
  UninstallRemoveLogs: Boolean;

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

// Función para leer el directorio de instalación siguiendo EXACTAMENTE la misma lógica que PowerShell
// PRIORIDAD 1: InstallDirectory del registro (nombre principal que usa PowerShell)
// PRIORIDAD 2: InstallDir del registro (compatibilidad)
// PRIORIDAD 3: installer-state.json en ProgramData (mismo método que PowerShell)
// PRIORIDAD 4: Buscar en ubicaciones comunes (delegado a FindInstallDirectory)
function GetInstallDirFromRegistry: string;
var
  StateFilePath: string;
  StateFileContent: TArrayOfString;
  StateFileContentStr: string;
  LineIndex: Integer;
  Line: string;
  InstallDirKey: string;
  InstallDirValue: string;
  ColonPos: Integer;
begin
  Result := '';
  Log('GetInstallDirFromRegistry: Iniciando búsqueda del directorio de instalación.');
  
  // PRIORIDAD 0: Leer InstallLocation de la clave de desinstalación estándar de Windows
  // Esta es la ubicación estándar y persistente donde Inno Setup guarda información de desinstalación
  Log('GetInstallDirFromRegistry: PRIORIDAD 0 - Intentando leer InstallLocation de clave de desinstalación estándar...');
  if ReadRegStrSafe(HKLM, UninstallKey, 'InstallLocation', Result) then
  begin
    if Result <> '' then
    begin
      Log('GetInstallDirFromRegistry: InstallLocation encontrado en clave de desinstalación: ' + Result);
      // Validar que no sea un directorio temporal
      if not IsTemporaryDirectory(Result) then
      begin
        Exit; // Encontrado y válido
      end
      else
      begin
        Log('GetInstallDirFromRegistry: InstallLocation es temporal, ignorándolo: ' + Result);
        Result := '';
      end;
    end
    else
    begin
      Log('GetInstallDirFromRegistry: InstallLocation en clave de desinstalación está vacío.');
      Result := '';
    end;
  end
  else
  begin
    Log('GetInstallDirFromRegistry: InstallLocation no encontrado en clave de desinstalación.');
    Result := '';
  end;
  
  // PRIORIDAD 1: Intentar leer InstallDirectory del registro (nombre principal usado por PowerShell)
  if Result = '' then
  begin
    Log('GetInstallDirFromRegistry: PRIORIDAD 1 - Intentando leer InstallDirectory del registro...');
    if ReadRegStrSafe(HKLM, RegistryBase, 'InstallDirectory', Result) then
  begin
    if Result <> '' then
    begin
      Log('GetInstallDirFromRegistry: InstallDirectory encontrado en registro: ' + Result);
      // Validar que no sea un directorio temporal
      if not IsTemporaryDirectory(Result) then
      begin
        Exit; // Encontrado y válido
      end
      else
      begin
        Log('GetInstallDirFromRegistry: InstallDirectory del registro es temporal, ignorándolo: ' + Result);
        Result := '';
      end;
    end
    else
    begin
      Log('GetInstallDirFromRegistry: InstallDirectory en registro está vacío.');
      Result := '';
    end;
  end
  else
  begin
    Log('GetInstallDirFromRegistry: InstallDirectory no encontrado en registro.');
    Result := '';
    end;
  end;
  
  // PRIORIDAD 2: Si no se encontró, intentar InstallDir (compatibilidad)
  if Result = '' then
  begin
    Log('GetInstallDirFromRegistry: PRIORIDAD 2 - Intentando leer InstallDir del registro (compatibilidad)...');
    if ReadRegStrSafe(HKLM, RegistryBase, 'InstallDir', Result) then
    begin
      if Result <> '' then
      begin
        Log('GetInstallDirFromRegistry: InstallDir encontrado en registro: ' + Result);
        // Validar que no sea un directorio temporal
        if not IsTemporaryDirectory(Result) then
        begin
          Exit; // Encontrado y válido
        end
        else
        begin
          Log('GetInstallDirFromRegistry: InstallDir del registro es temporal, ignorándolo: ' + Result);
          Result := '';
        end;
      end
      else
      begin
        Log('GetInstallDirFromRegistry: InstallDir en registro está vacío.');
        Result := '';
      end;
    end
    else
    begin
      Log('GetInstallDirFromRegistry: InstallDir no encontrado en registro.');
      Result := '';
    end;
  end;
  
  // PRIORIDAD 3: Si no se encontró en registro, leer desde installer-state.json (mismo método que PowerShell)
  if Result = '' then
  begin
    Log('GetInstallDirFromRegistry: PRIORIDAD 3 - Intentando leer desde installer-state.json...');
    StateFilePath := ExpandConstant('{commonappdata}\FerreDesk\installer-state.json');
    Log('GetInstallDirFromRegistry: Ruta del archivo de estado: ' + StateFilePath);
    
    if FileExists(StateFilePath) then
    begin
      Log('GetInstallDirFromRegistry: Archivo installer-state.json encontrado, leyendo...');
      try
        // Leer el archivo completo
        if LoadStringsFromFile(StateFilePath, StateFileContent) then
        begin
          // Buscar la línea que contiene "InstallDirectory"
          InstallDirKey := '"InstallDirectory"';
          for LineIndex := 0 to GetArrayLength(StateFileContent) - 1 do
          begin
            Line := StateFileContent[LineIndex];
            // Buscar la línea con "InstallDirectory"
            if Pos(InstallDirKey, Line) > 0 then
            begin
              Log('GetInstallDirFromRegistry: Línea encontrada: ' + Line);
              // Extraer el valor (formato JSON: "InstallDirectory": "C:\path")
              ColonPos := Pos(':', Line);
              if ColonPos > 0 then
              begin
                InstallDirValue := Copy(Line, ColonPos + 1, Length(Line) - ColonPos);
                // Limpiar comillas y espacios
                InstallDirValue := Trim(InstallDirValue);
                // Eliminar comillas al inicio y final
                if (Length(InstallDirValue) >= 2) and 
                   (Copy(InstallDirValue, 1, 1) = '"') and 
                   (Copy(InstallDirValue, Length(InstallDirValue), 1) = '"') then
                begin
                  InstallDirValue := Copy(InstallDirValue, 2, Length(InstallDirValue) - 2);
                end;
                // Eliminar comas finales
                if (Length(InstallDirValue) > 0) and (Copy(InstallDirValue, Length(InstallDirValue), 1) = ',') then
                begin
                  InstallDirValue := Copy(InstallDirValue, 1, Length(InstallDirValue) - 1);
                end;
                InstallDirValue := Trim(InstallDirValue);
                
                // Rechazar valores "null" del JSON (sin comillas)
                if (InstallDirValue <> '') and (Lowercase(InstallDirValue) <> 'null') then
                begin
                  Log('GetInstallDirFromRegistry: InstallDirectory extraído del JSON: ' + InstallDirValue);
                  // Validar que no sea un directorio temporal
                  if not IsTemporaryDirectory(InstallDirValue) then
                  begin
                    Result := InstallDirValue;
                    Log('GetInstallDirFromRegistry: Directorio válido encontrado en JSON: ' + Result);
                    Exit; // Encontrado y válido
                  end
                  else
                  begin
                    Log('GetInstallDirFromRegistry: InstallDirectory del JSON es temporal, ignorándolo: ' + InstallDirValue);
                  end;
                end
                else if Lowercase(InstallDirValue) = 'null' then
                begin
                  Log('GetInstallDirFromRegistry: InstallDirectory en JSON es null, ignorándolo.');
                end;
              end;
              Break; // Ya encontramos la línea, no necesitamos seguir buscando
            end;
          end;
          if Result = '' then
          begin
            Log('GetInstallDirFromRegistry: No se encontró InstallDirectory en el archivo JSON.');
          end;
        end
        else
        begin
          Log('GetInstallDirFromRegistry: No se pudo leer el archivo installer-state.json.');
        end;
      except
        Log('GetInstallDirFromRegistry: EXCEPCIÓN al leer installer-state.json: ' + GetExceptionMessage);
        Result := '';
      end;
    end
    else
    begin
      Log('GetInstallDirFromRegistry: Archivo installer-state.json no existe.');
    end;
  end;
  
  // Si todavía no encontramos nada, log para indicar que se usará FindInstallDirectory
  if Result = '' then
  begin
    Log('GetInstallDirFromRegistry: No se encontró directorio en registro ni en JSON. Se usará búsqueda en ubicaciones comunes.');
  end;
end;

// Función para encontrar el directorio de instalación en ubicaciones comunes
// Esta función se llama SOLO si GetInstallDirFromRegistry no encontró nada (PRIORIDAD 4)
function FindInstallDirectory: string;
var
  PossiblePaths: TArrayOfString;
  PathIndex: Integer;
  TestPath: string;
  UserProfile: string;
begin
  Result := '';
  
  // Primero intentar con GetInstallDirFromRegistry (que ya incluye registro, JSON y validaciones)
  Result := GetInstallDirFromRegistry;
  if (Result <> '') and DirExists(Result) then
  begin
    Log('FindInstallDirectory: Directorio encontrado por GetInstallDirFromRegistry: ' + Result);
    Exit;
  end;
  
  // Si GetInstallDirFromRegistry no encontró nada válido, buscar en ubicaciones comunes (PRIORIDAD 4)
  Log('FindInstallDirectory: PRIORIDAD 4 - No se encontró en registro ni JSON, buscando en ubicaciones comunes...');
  
  // Obtener el perfil del usuario
  UserProfile := ExpandConstant('{userprofile}');
  
  // Lista de ubicaciones comunes donde puede estar instalado
  SetArrayLength(PossiblePaths, 3);
  PossiblePaths[0] := UserProfile + '\AppData\Local\Programs\FerreDesk';
  PossiblePaths[1] := ExpandConstant('{autopf}\FerreDesk');
  PossiblePaths[2] := UserProfile + '\FerreDesk';
  
  // Buscar en cada ubicación
  for PathIndex := 0 to GetArrayLength(PossiblePaths) - 1 do
  begin
    TestPath := PossiblePaths[PathIndex];
    Log('FindInstallDirectory: Verificando: ' + TestPath);
    
    // Verificar que el directorio existe y contiene ferredesk_v0
    if DirExists(TestPath) and DirExists(TestPath + '\ferredesk_v0') then
    begin
      Log('FindInstallDirectory: Directorio encontrado en: ' + TestPath);
      Result := TestPath;
      Exit;
    end;
  end;
  
  Log('FindInstallDirectory: No se encontró el directorio de instalación en ninguna ubicación común.');
end;

// Función para limpiar recursos Docker (contenedores, volúmenes, imágenes)
function CleanDockerResources(const ProjectDir: string): Boolean;
var
  ComposeDir: string;
  ResultCode: Integer;
  DockerComposePath: string;
begin
  Result := True;
  
  Log('CleanDockerResources: Iniciando limpieza de recursos Docker.');
  Log('CleanDockerResources: ProjectDir: ' + ProjectDir);
  
  // Construir ruta al directorio docker-compose.yml
  ComposeDir := ProjectDir + '\ferredesk_v0';
  
  Log('CleanDockerResources: Verificando directorio: ' + ComposeDir);
  
  // Verificar que existe el directorio y docker-compose.yml
  if not DirExists(ComposeDir) then
  begin
    Log('CleanDockerResources: El directorio no existe, no hay nada que limpiar: ' + ComposeDir);
    Exit;
  end;
  
  if not FileExists(ComposeDir + '\docker-compose.yml') then
  begin
    Log('CleanDockerResources: docker-compose.yml no existe, no hay nada que limpiar: ' + ComposeDir);
    Exit;
  end;
  
  Log('CleanDockerResources: Verificando que Docker esté disponible...');
  
  // Verificar que Docker esté disponible
  // Intentar ejecutar docker --version para verificar
  if not Exec('docker', '--version', '', SW_HIDE, ewWaitUntilTerminated, ResultCode) then
  begin
    Log('CleanDockerResources: Docker no está disponible o no está en PATH.');
    Exit;
  end;
  
  Log('CleanDockerResources: Docker está disponible. Verificando que esté ejecutándose...');
  
  // Verificar que docker esté ejecutándose
  if not Exec('docker', 'info', '', SW_HIDE, ewWaitUntilTerminated, ResultCode) then
  begin
    Log('CleanDockerResources: No se pudo ejecutar docker info. Docker puede no estar ejecutándose.');
    Exit;
  end;
  
  if ResultCode <> 0 then
  begin
    Log('CleanDockerResources: docker info falló con código: ' + IntToStr(ResultCode) + '. Docker puede no estar ejecutándose.');
    Exit;
  end;
  
  Log('CleanDockerResources: Docker está ejecutándose correctamente. Procediendo a limpiar recursos...');
  
  // Buscar docker-compose.exe o usar docker compose (nueva sintaxis)
  // Primero intentar con docker compose (sintaxis nueva integrada)
  if Exec('docker', 'compose --version', '', SW_HIDE, ewWaitUntilTerminated, ResultCode) then
  begin
    Log('CleanDockerResources: Usando sintaxis nueva: docker compose');
    // Usar sintaxis nueva: docker compose
    UninstallProgressForm.StatusLabel.Caption := 'Deteniendo contenedores Docker de FerreDesk...';
    UninstallProgressForm.Update;
    
    Log('CleanDockerResources: Ejecutando docker compose down -v desde: ' + ComposeDir);
    // Ejecutar docker compose down -v desde el directorio del proyecto
    if Exec('docker', 'compose down -v', ComposeDir, SW_HIDE, ewWaitUntilTerminated, ResultCode) then
    begin
      Log('CleanDockerResources: docker compose down -v ejecutado. Código de salida: ' + IntToStr(ResultCode));
    end
    else
    begin
      Log('CleanDockerResources: No se pudo ejecutar docker compose down -v.');
    end;
    
    // Intentar borrar imágenes específicas del proyecto
    UninstallProgressForm.StatusLabel.Caption := 'Eliminando imágenes Docker de FerreDesk...';
    UninstallProgressForm.Update;
    
    Log('CleanDockerResources: Intentando borrar imagen: ferredesk_v0-ferredesk');
    // Borrar imagen de la aplicación (puede fallar si no existe)
    if Exec('docker', 'rmi ferredesk_v0-ferredesk', '', SW_HIDE, ewWaitUntilTerminated, ResultCode) then
    begin
      Log('CleanDockerResources: docker rmi ejecutado. Código de salida: ' + IntToStr(ResultCode));
    end
    else
    begin
      Log('CleanDockerResources: No se pudo ejecutar docker rmi.');
    end;
  end
  else
  begin
    Log('CleanDockerResources: Sintaxis nueva no disponible, intentando con docker-compose.exe');
    // Intentar con docker-compose.exe (sintaxis antigua)
    DockerComposePath := 'docker-compose.exe';
    if not FileExists(ExpandConstant('{pf}\Docker\Docker\resources\bin\docker-compose.exe')) then
    begin
      // Buscar en otras ubicaciones comunes
      DockerComposePath := 'docker-compose';
      Log('CleanDockerResources: docker-compose.exe no encontrado, usando: ' + DockerComposePath);
    end;
    
    UninstallProgressForm.StatusLabel.Caption := 'Deteniendo contenedores Docker de FerreDesk...';
    UninstallProgressForm.Update;
    
    Log('CleanDockerResources: Ejecutando ' + DockerComposePath + ' down -v desde: ' + ComposeDir);
    // Ejecutar docker-compose down -v desde el directorio del proyecto
    if Exec(DockerComposePath, 'down -v', ComposeDir, SW_HIDE, ewWaitUntilTerminated, ResultCode) then
    begin
      Log('CleanDockerResources: ' + DockerComposePath + ' down -v ejecutado. Código de salida: ' + IntToStr(ResultCode));
    end
    else
    begin
      Log('CleanDockerResources: No se pudo ejecutar ' + DockerComposePath + ' down -v.');
    end;
    
    // Intentar borrar imágenes específicas del proyecto
    UninstallProgressForm.StatusLabel.Caption := 'Eliminando imágenes Docker de FerreDesk...';
    UninstallProgressForm.Update;
    
    Log('CleanDockerResources: Intentando borrar imagen: ferredesk_v0-ferredesk');
    // Borrar imagen de la aplicación
    if Exec('docker', 'rmi ferredesk_v0-ferredesk', '', SW_HIDE, ewWaitUntilTerminated, ResultCode) then
    begin
      Log('CleanDockerResources: docker rmi ejecutado. Código de salida: ' + IntToStr(ResultCode));
    end
    else
    begin
      Log('CleanDockerResources: No se pudo ejecutar docker rmi.');
    end;
  end;
  
  Log('CleanDockerResources: Limpieza de recursos Docker completada.');
  Result := True;
end;

// Función para limpiar recursos Docker usando nombres de contenedores conocidos
// (útil cuando no tenemos el directorio del proyecto)
function CleanDockerResourcesByContainerNames: Boolean;
var
  ResultCode: Integer;
  ContainerNames: TArrayOfString;
  ContainerIndex: Integer;
begin
  Result := True;
  
  Log('CleanDockerResourcesByContainerNames: Iniciando limpieza de Docker por nombres de contenedores.');
  
  // Verificar que Docker esté disponible
  if not Exec('docker', '--version', '', SW_HIDE, ewWaitUntilTerminated, ResultCode) then
  begin
    Log('CleanDockerResourcesByContainerNames: Docker no está disponible o no está en PATH.');
    Result := False;
    Exit;
  end;
  
  // Verificar que Docker esté ejecutándose
  if not Exec('docker', 'info', '', SW_HIDE, ewWaitUntilTerminated, ResultCode) then
  begin
    Log('CleanDockerResourcesByContainerNames: No se pudo ejecutar docker info. Docker puede no estar ejecutándose.');
    Result := False;
    Exit;
  end;
  
  if ResultCode <> 0 then
  begin
    Log('CleanDockerResourcesByContainerNames: docker info falló. Docker puede no estar ejecutándose.');
    Result := False;
    Exit;
  end;
  
  Log('CleanDockerResourcesByContainerNames: Docker está ejecutándose. Procediendo a limpiar contenedores...');
  
  // Nombres de contenedores conocidos de FerreDesk
  SetArrayLength(ContainerNames, 2);
  ContainerNames[0] := 'ferredesk_app';
  ContainerNames[1] := 'ferredesk_postgres';
  
  // Detener y eliminar contenedores
  UninstallProgressForm.StatusLabel.Caption := 'Deteniendo contenedores Docker de FerreDesk...';
  UninstallProgressForm.Update;
  
  for ContainerIndex := 0 to GetArrayLength(ContainerNames) - 1 do
  begin
    Log('CleanDockerResourcesByContainerNames: Intentando detener contenedor: ' + ContainerNames[ContainerIndex]);
    // Detener contenedor (ignorar si no existe)
    Exec('docker', 'stop ' + ContainerNames[ContainerIndex], '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
    Log('CleanDockerResourcesByContainerNames: stop ejecutado. Código: ' + IntToStr(ResultCode));
    
    Log('CleanDockerResourcesByContainerNames: Intentando eliminar contenedor: ' + ContainerNames[ContainerIndex]);
    // Eliminar contenedor (ignorar si no existe)
    Exec('docker', 'rm ' + ContainerNames[ContainerIndex], '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
    Log('CleanDockerResourcesByContainerNames: rm ejecutado. Código: ' + IntToStr(ResultCode));
  end;
  
  // Intentar eliminar volúmenes asociados
  UninstallProgressForm.StatusLabel.Caption := 'Eliminando volúmenes Docker de FerreDesk...';
  UninstallProgressForm.Update;
  
  Log('CleanDockerResourcesByContainerNames: Intentando eliminar volúmenes con prefijo ferredesk_v0...');
  Exec('docker', 'volume ls -q', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  // Nota: No podemos filtrar fácilmente en Inno Setup, pero intentamos eliminar los conocidos
  Exec('docker', 'volume rm ferredesk_v0_postgres_data', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  Log('CleanDockerResourcesByContainerNames: Eliminación de volúmenes intentada. Código: ' + IntToStr(ResultCode));
  
  // Intentar eliminar imágenes
  UninstallProgressForm.StatusLabel.Caption := 'Eliminando imágenes Docker de FerreDesk...';
  UninstallProgressForm.Update;
  
  Log('CleanDockerResourcesByContainerNames: Intentando eliminar imagen: ferredesk_v0-ferredesk');
  Exec('docker', 'rmi ferredesk_v0-ferredesk', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  Log('CleanDockerResourcesByContainerNames: rmi ejecutado. Código: ' + IntToStr(ResultCode));
  
  Log('CleanDockerResourcesByContainerNames: Limpieza de Docker por nombres completada.');
  Result := True;
end;

// Función para borrar el directorio de instalación completo
function DeleteInstallDirectory(const InstallDir: string): Boolean;
var
  DirExistedBefore: Boolean;
  DirExistsAfter: Boolean;
begin
  Result := True;
  
  Log('DeleteInstallDirectory: Iniciando borrado del directorio: ' + InstallDir);
  
  // Validar que el directorio no esté vacío
  if (InstallDir = '') then
  begin
    Log('DeleteInstallDirectory: InstallDir está vacío, no hay nada que borrar.');
    Exit;
  end;
  
  // Validar que no sea un directorio temporal (seguridad)
  if IsTemporaryDirectory(InstallDir) then
  begin
    Log('DeleteInstallDirectory: El directorio es temporal, no se borrará por seguridad: ' + InstallDir);
    Exit;
  end;
  
  // Validar que el directorio existe
  DirExistedBefore := DirExists(InstallDir);
  if not DirExistedBefore then
  begin
    Log('DeleteInstallDirectory: El directorio no existe, no hay nada que borrar: ' + InstallDir);
    Exit;
  end;
  
  // Validar que no sea un directorio del sistema crítico
  // No borrar directorios como C:\, C:\Windows, etc.
  if (Length(InstallDir) <= 3) or
     (LowerCase(InstallDir) = 'c:\') or
     (LowerCase(InstallDir) = 'c:\windows') or
     (Pos(':\windows', LowerCase(InstallDir)) > 0) then
  begin
    Log('DeleteInstallDirectory: El directorio es del sistema, no se borrará por seguridad: ' + InstallDir);
    Exit;
  end;
  
  Log('DeleteInstallDirectory: Validaciones pasadas. Intentando borrar directorio: ' + InstallDir);
  
  try
    UninstallProgressForm.StatusLabel.Caption := 'Eliminando directorio de instalación: ' + InstallDir;
    UninstallProgressForm.Update;
    
    Log('DeleteInstallDirectory: Ejecutando DelTree para borrar recursivamente el directorio.');
    // Borrar recursivamente todo el contenido del directorio
    if DelTree(InstallDir, True, True, True) then
    begin
      Log('DeleteInstallDirectory: DelTree reportó éxito.');
      // Verificar que el directorio realmente fue borrado
      Sleep(500);  // Dar tiempo al sistema para procesar el borrado
      DirExistsAfter := DirExists(InstallDir);
      if DirExistsAfter then
      begin
        Log('ERROR: DeleteInstallDirectory: El directorio todavía existe después de DelTree: ' + InstallDir);
        Log('DeleteInstallDirectory: Posibles causas: archivos bloqueados, permisos insuficientes, o proceso en uso.');
        Result := False;
      end
      else
      begin
        Log('DeleteInstallDirectory: Éxito - El directorio fue borrado correctamente: ' + InstallDir);
        Result := True;
      end;
    end
    else
    begin
      Log('ERROR: DeleteInstallDirectory: DelTree reportó fallo al borrar el directorio: ' + InstallDir);
      // Verificar si el directorio todavía existe
      DirExistsAfter := DirExists(InstallDir);
      if DirExistsAfter then
      begin
        Log('DeleteInstallDirectory: El directorio todavía existe después del fallo.');
        Log('DeleteInstallDirectory: Posibles causas: archivos bloqueados, permisos insuficientes, o proceso en uso.');
      end;
      Result := False;
    end;
  except
    Log('EXCEPCIÓN en DeleteInstallDirectory: ' + GetExceptionMessage);
    Log('DeleteInstallDirectory: Error al intentar borrar el directorio: ' + InstallDir);
    // Verificar si el directorio todavía existe
    if DirExists(InstallDir) then
    begin
      Log('DeleteInstallDirectory: El directorio todavía existe después de la excepción.');
    end;
    Result := False;
  end;
end;

// Función para borrar ProgramData completo
function DeleteProgramData: Boolean;
var
  ProgramDataDir: string;
  DirExistedBefore: Boolean;
  DirExistsAfter: Boolean;
begin
  Result := True;
  
  // Obtener ruta de ProgramData\FerreDesk
  ProgramDataDir := ExpandConstant('{commonappdata}\FerreDesk');
  
  Log('DeleteProgramData: Iniciando borrado del directorio: ' + ProgramDataDir);
  
  // Verificar que existe
  DirExistedBefore := DirExists(ProgramDataDir);
  if not DirExistedBefore then
  begin
    Log('DeleteProgramData: El directorio no existe, no hay nada que borrar: ' + ProgramDataDir);
    Exit;
  end;
  
  Log('DeleteProgramData: El directorio existe. Intentando borrar: ' + ProgramDataDir);
  
  try
    UninstallProgressForm.StatusLabel.Caption := 'Eliminando archivos de configuración...';
    UninstallProgressForm.Update;
    
    Log('DeleteProgramData: Ejecutando DelTree para borrar recursivamente el directorio.');
    // Borrar recursivamente todo el contenido
    if DelTree(ProgramDataDir, True, True, True) then
    begin
      Log('DeleteProgramData: DelTree reportó éxito.');
      // Verificar que el directorio realmente fue borrado
      Sleep(500);  // Dar tiempo al sistema para procesar el borrado
      DirExistsAfter := DirExists(ProgramDataDir);
      if DirExistsAfter then
      begin
        Log('ERROR: DeleteProgramData: El directorio todavía existe después de DelTree: ' + ProgramDataDir);
        Log('DeleteProgramData: Posibles causas: archivos bloqueados, permisos insuficientes, o proceso en uso.');
        Result := False;
      end
      else
      begin
        Log('DeleteProgramData: Éxito - El directorio fue borrado correctamente: ' + ProgramDataDir);
        Result := True;
      end;
    end
    else
    begin
      Log('ERROR: DeleteProgramData: DelTree reportó fallo al borrar el directorio: ' + ProgramDataDir);
      // Verificar si el directorio todavía existe
      DirExistsAfter := DirExists(ProgramDataDir);
      if DirExistsAfter then
      begin
        Log('DeleteProgramData: El directorio todavía existe después del fallo.');
        Log('DeleteProgramData: Posibles causas: archivos bloqueados, permisos insuficientes, o proceso en uso.');
      end;
      Result := False;
    end;
  except
    Log('EXCEPCIÓN en DeleteProgramData: ' + GetExceptionMessage);
    Log('DeleteProgramData: Error al intentar borrar el directorio: ' + ProgramDataDir);
    // Verificar si el directorio todavía existe
    if DirExists(ProgramDataDir) then
    begin
      Log('DeleteProgramData: El directorio todavía existe después de la excepción.');
    end;
    Result := False;
  end;
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

function ShouldRemoveCode: Boolean;
begin
  { Leer de las variables globales establecidas en la página de confirmación }
  Result := UninstallRemoveCode;
end;

function ShouldRemoveLogs: Boolean;
begin
  { Leer de las variables globales establecidas en la página de confirmación }
  Result := UninstallRemoveLogs;
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
        { Instalación exitosa }
        UnregisterRunOnce;
      end;
      3010: begin
        { Éxito con reinicio requerido (estándar Windows Installer) }
        RegisterRunOnce;
        { NO mostrar MsgBox aquí: el mensaje ya se mostrará en wpFinished a través de CurPageChanged.
          Mostrar un MsgBox dentro de ssInstall puede interferir con el flujo normal del wizard
          y causar que el instalador se cierre en lugar de continuar a la página final. }
      end;
    else begin
      { Cualquier otro código = error (código estándar es -1) }
      { Mostrar mensaje de error y abortar explícitamente la instalación }
      MsgBox(
        'Ocurrió un error durante la instalación de FerreDesk.'#13#10#13#10 +
        'Código de error: ' + IntToStr(ResultCode) + #13#10 +
        'Revise los logs en: C:\ProgramData\FerreDesk\logs\FerreDesk-Installer.log',
        mbError, MB_OK);
      { Abortar la instalación para que Inno Setup no intente continuar }
      Abort;
    end;
    end; { Cierra el case ResultCode of }

    { Al finalizar la fase de instalación (con éxito, error o solicitud de reinicio),
      volvemos a habilitar el botón Cancel para el resto del wizard. }
    WizardForm.CancelButton.Enabled := True;
  end; { Cierra el if CurStep = ssInstall }
  
  { Handler para ssPostInstall: Inno Setup registra automáticamente la aplicación
    después de ssInstall si hay archivos instalados. Sin embargo, cuando toda la
    instalación se hace vía código externo (PowerShell), puede ser necesario
    verificar o completar el registro manualmente. }
  if CurStep = ssPostInstall then begin
    { Solo verificar/registrar si la instalación fue exitosa }
    if LastInstallResultCode = 0 then begin
      { Inno Setup debería haber registrado automáticamente la aplicación.
        Sin embargo, verificamos que la clave exista y tenga los campos mínimos necesarios.
        Si falta, la agregamos manualmente. }
      { Inno Setup debería haber creado automáticamente la clave, pero verificamos y completamos si falta }
      if not RegKeyExists(HKLM, UninstallKey) then begin
        { La clave no existe, crear registro manual completo }
        RegWriteStringValue(HKLM, UninstallKey, 'DisplayName', '{#MyAppName}');
        RegWriteStringValue(HKLM, UninstallKey, 'DisplayVersion', '{#MyAppVersion}');
        RegWriteStringValue(HKLM, UninstallKey, 'Publisher', 'FerreDesk');
        RegWriteStringValue(HKLM, UninstallKey, 'UninstallString', '"' + ExpandConstant('{uninstallexe}') + '"');
        RegWriteStringValue(HKLM, UninstallKey, 'QuietUninstallString', '"' + ExpandConstant('{uninstallexe}') + '" /SILENT');
        RegWriteStringValue(HKLM, UninstallKey, 'DisplayIcon', ExpandConstant('{app}\FerreDesk.ico'));
        RegWriteDWordValue(HKLM, UninstallKey, 'NoModify', 1);
        RegWriteDWordValue(HKLM, UninstallKey, 'NoRepair', 1);
      end;
      
      { GUARDAR InstallLocation en la clave de desinstalación estándar (PRIORIDAD MÁXIMA) }
      { Esto garantiza que el desinstalador siempre pueda encontrar el directorio de instalación }
      { InstallLocation es un campo estándar de Windows para aplicaciones instaladas }
      if SelectedInstallDir <> '' then
      begin
        { Validar que no sea temporal antes de guardar }
        if not IsTemporaryDirectory(SelectedInstallDir) then
        begin
          Log('CurStepChanged(ssPostInstall): Guardando InstallLocation en clave de desinstalación estándar: ' + SelectedInstallDir);
          RegWriteStringValue(HKLM, UninstallKey, 'InstallLocation', SelectedInstallDir);
        end
        else
        begin
          Log('CurStepChanged(ssPostInstall): SelectedInstallDir es temporal, usando directorio por defecto para InstallLocation.');
          RegWriteStringValue(HKLM, UninstallKey, 'InstallLocation', GetDefaultInstallDirectory);
        end;
      end
      else
      begin
        { Si SelectedInstallDir está vacío, usar el directorio por defecto }
        Log('CurStepChanged(ssPostInstall): SelectedInstallDir está vacío, usando directorio por defecto para InstallLocation.');
        RegWriteStringValue(HKLM, UninstallKey, 'InstallLocation', GetDefaultInstallDirectory);
      end;
    end;
  end;
end; { Cierra el procedure CurStepChanged }

{ Función para mostrar diálogo de confirmación de desinstalación ANTES de que comience }
function InitializeUninstall(): Boolean;
var
  ConfirmationForm: TForm;
  OkButton, CancelButton: TButton;
  CodeCheckBox, DockerCheckBox, LogsCheckBox: TNewCheckBox;
  InfoLabel: TNewStaticText;
  InstallDir: string;
  InstallDirInfo: string;
  ModalResult: Integer;
begin
  Result := False;
  
  { Inicializar valores por defecto }
  UninstallRemoveCode := True;  // El código fuente SIEMPRE se elimina
  UninstallRemoveLogs := True;
  
  { Leer directorio de instalación }
  InstallDir := GetInstallDirFromRegistry;
  
  { Si no se encontró en registro/JSON, buscar en ubicaciones comunes }
  if (InstallDir = '') or (Lowercase(InstallDir) = 'null') then
  begin
    Log('InitializeUninstall: No se encontró directorio en registro/JSON, buscando en ubicaciones comunes...');
    InstallDir := FindInstallDirectory;
  end;
  
  { Solo mostrar el directorio si se encontró y no es null }
  if (InstallDir <> '') and (Lowercase(InstallDir) <> 'null') then
    InstallDirInfo := #13#10#13#10'Directorio de instalación: ' + InstallDir
  else
    InstallDirInfo := '';
  
  { Crear formulario modal personalizado usando TForm.Create }
  ConfirmationForm := TForm.Create(nil);
  try
    ConfirmationForm.Caption := 'Confirmar desinstalación de FerreDesk';
    ConfirmationForm.ClientWidth := ScaleX(500);
    ConfirmationForm.ClientHeight := ScaleY(220);
    ConfirmationForm.Position := poScreenCenter;
    ConfirmationForm.BorderStyle := bsDialog;
    ConfirmationForm.BorderIcons := [biSystemMenu];
    
    { Etiqueta informativa usando TNewStaticText }
    InfoLabel := TNewStaticText.Create(ConfirmationForm);
    InfoLabel.Parent := ConfirmationForm;
    InfoLabel.Left := ScaleX(16);
    InfoLabel.Top := ScaleY(16);
    InfoLabel.Width := ScaleX(468);
    InfoLabel.Height := ScaleY(60);
    InfoLabel.Caption := 'Se desinstalará FerreDesk del sistema.' + #13#10 + 
                         'Los contenedores de Docker deberan ser eliminados manualmente.' + InstallDirInfo;
    InfoLabel.WordWrap := True;
    
    { Checkbox para eliminar logs (opción única ahora) }
    LogsCheckBox := TNewCheckBox.Create(ConfirmationForm);
    LogsCheckBox.Parent := ConfirmationForm;
    LogsCheckBox.Left := ScaleX(16);
    LogsCheckBox.Top := ScaleY(90);
    LogsCheckBox.Width := ScaleX(468);
    LogsCheckBox.Caption := 'Eliminar logs y configuración';
    LogsCheckBox.Checked := True;
    
    { Botón Aceptar }
    OkButton := TButton.Create(ConfirmationForm);
    OkButton.Parent := ConfirmationForm;
    OkButton.Left := ScaleX(300);
    OkButton.Top := ScaleY(160);
    OkButton.Width := ScaleX(75);
    OkButton.Height := ScaleY(25);
    OkButton.Caption := 'Aceptar';
    OkButton.ModalResult := mrOk;
    OkButton.Default := True;
    
    { Botón Cancelar }
    CancelButton := TButton.Create(ConfirmationForm);
    CancelButton.Parent := ConfirmationForm;
    CancelButton.Left := ScaleX(385);
    CancelButton.Top := ScaleY(160);
    CancelButton.Width := ScaleX(75);
    CancelButton.Height := ScaleY(25);
    CancelButton.Caption := 'Cancelar';
    CancelButton.ModalResult := mrCancel;
    CancelButton.Cancel := True;
    
    { Mostrar formulario modal y obtener resultado }
    ModalResult := ConfirmationForm.ShowModal;
    
    if ModalResult = mrOk then
    begin
      { Usuario confirmó: guardar opciones seleccionadas }
      UninstallRemoveCode := True;  // SIEMPRE eliminar código
      UninstallRemoveLogs := LogsCheckBox.Checked;
      Result := True;
    end
    else
    begin
      { Usuario canceló }
      Result := False;
    end;
  finally
    ConfirmationForm.Free;
  end;
end;

procedure InitializeUninstallProgressForm;
begin
  { Esta función se ejecuta cuando el formulario de progreso se está mostrando.
    Ya no creamos checkboxes aquí porque usamos un diálogo modal previo.
    El diálogo se muestra en CurUninstallStepChanged con usAppMutexCheck. }
end;

procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
var
  InstallDir: string;
  ProjectDir: string;
  DeleteCodeSuccess: Boolean;
  DeleteLogsSuccess: Boolean;
  DockerCleanSuccess: Boolean;
begin
  { InitializeUninstall() se ejecuta automáticamente ANTES de este evento }
  { Ya se mostró el diálogo de confirmación y se capturaron las opciones }
  if CurUninstallStep = usAppMutexCheck then
  begin
    Log('CurUninstallStepChanged: Opciones de desinstalación seleccionadas:');
    Log('  - Eliminar código: Sí (siempre)');
    if UninstallRemoveLogs then
      Log('  - Eliminar logs: Sí')
    else
      Log('  - Eliminar logs: No');
  end;
  
  if CurUninstallStep = usUninstall then
  begin
    
    Log('========================================');
    Log('CurUninstallStepChanged: Iniciando desinstalación');
    Log('========================================');
    Log('Opciones seleccionadas:');
    Log('  - Eliminar código: Sí (siempre)');
    Log('  - Eliminar Docker: No (opción removida)');
    if ShouldRemoveLogs then
      Log('  - Eliminar logs: Sí')
    else
      Log('  - Eliminar logs: No');
    
    // PASO 1: Leer InstallDir del registro ANTES de borrarlo
    InstallDir := GetInstallDirFromRegistry;
    ProjectDir := InstallDir;
    
    Log('CurUninstallStepChanged: InstallDir leído: ' + InstallDir);
    
    // Si no hay InstallDir, buscar en ubicaciones comunes
    if (InstallDir = '') then
    begin
      Log('CurUninstallStepChanged: InstallDir vacío, buscando en ubicaciones comunes...');
      InstallDir := FindInstallDirectory;
      if InstallDir <> '' then
      begin
        Log('CurUninstallStepChanged: InstallDir encontrado en ubicaciones comunes: ' + InstallDir);
      end
      else
      begin
        Log('ADVERTENCIA: CurUninstallStepChanged: No se pudo determinar el directorio de instalación.');
        MsgBox(
          'ADVERTENCIA: No se pudo determinar el directorio de instalación.'#13#10#13#10 +
          'Puede que queden archivos de FerreDesk en el sistema. Revisa manualmente:'#13#10 +
          '  - C:\Users\[Usuario]\AppData\Local\Programs\FerreDesk'#13#10 +
          '  - C:\ProgramData\FerreDesk',
          mbInformation, MB_OK);
      end;
    end;
    
    // PASO 2: Borrar el directorio de instalación completo (SIEMPRE se ejecuta)
    DeleteCodeSuccess := False;
    if (InstallDir <> '') then
    begin
      Log('CurUninstallStepChanged: Borrando directorio de instalación (siempre se ejecuta).');
      try
        DeleteCodeSuccess := DeleteInstallDirectory(InstallDir);
        if DeleteCodeSuccess then
        begin
          Log('CurUninstallStepChanged: Directorio de instalación borrado exitosamente.');
        end
        else
        begin
          Log('ERROR: CurUninstallStepChanged: Falló el borrado del directorio de instalación.');
          // Verificar si todavía existe
          if DirExists(InstallDir) then
          begin
            MsgBox(
              'No se pudo borrar completamente el directorio de instalación:'#13#10 +
              InstallDir + #13#10#13#10 +
              'Algunos archivos pueden estar en uso.'#13#10 +
              'Cierra todas las aplicaciones que usen FerreDesk e intenta borrar manualmente.',
              mbError, MB_OK);
          end;
        end;
      except
        Log('EXCEPCIÓN en CurUninstallStepChanged al borrar directorio de instalación: ' + GetExceptionMessage);
        DeleteCodeSuccess := False;
        if (InstallDir <> '') and DirExists(InstallDir) then
        begin
          MsgBox(
            'Error al borrar el directorio de instalación:'#13#10 +
            InstallDir + #13#10#13#10 +
            'Error: ' + GetExceptionMessage + #13#10#13#10 +
            'Intenta borrarlo manualmente después de cerrar todas las aplicaciones.',
            mbError, MB_OK);
        end;
      end;
    end
    else
    begin
      Log('ADVERTENCIA: CurUninstallStepChanged: No se puede borrar código fuente porque InstallDir está vacío.');
      DeleteCodeSuccess := False;
    end;
    
    // PASO 3: Borrar ProgramData (solo si la opción está marcada)
    DeleteLogsSuccess := True;  // Por defecto éxito si no se intenta
    if ShouldRemoveLogs then
    begin
      Log('CurUninstallStepChanged: Borrando ProgramData (opción seleccionada).');
      try
        DeleteLogsSuccess := DeleteProgramData;
        if DeleteLogsSuccess then
        begin
          Log('CurUninstallStepChanged: ProgramData borrado exitosamente.');
        end
        else
        begin
          Log('ERROR: CurUninstallStepChanged: Falló el borrado de ProgramData.');
          // Verificar si todavía existe
          if DirExists(ExpandConstant('{commonappdata}\FerreDesk')) then
          begin
            Log('ADVERTENCIA: CurUninstallStepChanged: ProgramData todavía existe después del intento de borrado.');
          end;
        end;
      except
        Log('EXCEPCIÓN en CurUninstallStepChanged al borrar ProgramData: ' + GetExceptionMessage);
        DeleteLogsSuccess := False;
      end;
    end
    else
    begin
      Log('CurUninstallStepChanged: Borrado de ProgramData omitido (opción no seleccionada).');
    end;
    
    // PASO 4: Borrar entrada RunOnce (si existe)
    Log('CurUninstallStepChanged: Desregistrando entrada RunOnce.');
    try
      UnregisterRunOnce;
      Log('CurUninstallStepChanged: RunOnce desregistrado exitosamente.');
    except
      Log('EXCEPCIÓN en CurUninstallStepChanged al desregistrar RunOnce: ' + GetExceptionMessage);
    end;
    
    Log('CurUninstallStepChanged: Resumen de operaciones:');
    if DeleteCodeSuccess then
      Log('  - Código borrado: Sí')
    else
      Log('  - Código borrado: No (no se encontró directorio o falló)');
    if DeleteLogsSuccess then
      Log('  - Logs borrados: Sí')
    else
      Log('  - Logs borrados: No');
    Log('========================================');
  end;

  if CurUninstallStep = usPostUninstall then
  begin
    Log('CurUninstallStepChanged: usPostUninstall iniciado.');
    
    // PASO 6: Borrar clave de registro del instalador
    // Esto se hace al final para asegurar que se borre incluso si algo falló antes
    Log('CurUninstallStepChanged: Borrando clave de registro del instalador: ' + RegistryBase);
    try
      RegDeleteKeyIncludingSubkeys(HKLM, RegistryBase);
      Log('CurUninstallStepChanged: Clave de registro del instalador borrada exitosamente.');
    except
      Log('EXCEPCIÓN en CurUninstallStepChanged al borrar clave de registro: ' + GetExceptionMessage);
    end;
    
    // PASO 7: Verificar y borrar entrada RunOnce una vez más por si no se borró antes
    Log('CurUninstallStepChanged: Verificando entrada RunOnce una vez más.');
    try
      UnregisterRunOnce;
      Log('CurUninstallStepChanged: Verificación de RunOnce completada.');
    except
      Log('EXCEPCIÓN en CurUninstallStepChanged al verificar RunOnce: ' + GetExceptionMessage);
    end;
    
    Log('CurUninstallStepChanged: Desinstalación completada.');
  end;
end;
