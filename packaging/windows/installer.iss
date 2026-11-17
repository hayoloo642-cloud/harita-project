#ifndef MyAppVersion
#define MyAppVersion "1.6.0"
#endif

[Setup]
AppId={{A0D92E13-7F5A-48B4-8AC7-0E4A6F87936A}}
AppName=Harita
AppVersion={#MyAppVersion}
AppVerName=Harita {#MyAppVersion}
AppPublisher=Harita contributors
AppPublisherURL=https://github.com/hayoloo642-cloud/harita-project
AppSupportURL=https://github.com/hayoloo642-cloud/harita-project/issues
DefaultDirName={localappdata}\Programs\Harita
DefaultGroupName=Harita
PrivilegesRequired=lowest
OutputDir=..\..\dist
OutputBaseFilename=Harita-Setup-{#MyAppVersion}
SetupIconFile=..\..\static\icon.ico
UninstallDisplayIcon={app}\Harita.exe
WizardStyle=modern
Compression=lzma2
SolidCompression=yes
DisableProgramGroupPage=yes

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "Create a Desktop shortcut"; GroupDescription: "Additional icons:"; Flags: checkedonce

[Files]
Source: "..\..\dist\Harita.exe"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\..\README.md"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\..\LICENSE"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\..\CHANGELOG.md"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\..\static\icon.ico"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{group}\Harita"; Filename: "{app}\Harita.exe"; IconFilename: "{app}\icon.ico"
Name: "{group}\Uninstall Harita"; Filename: "{uninstallexe}"
Name: "{autodesktop}\Harita"; Filename: "{app}\Harita.exe"; Tasks: desktopicon; IconFilename: "{app}\icon.ico"

[Run]
Filename: "{app}\Harita.exe"; Description: "Launch Harita"; Flags: nowait postinstall skipifsilent
