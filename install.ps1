# Harita installer for Windows (PowerShell, no admin required).
# Downloads the public source ZIP and installs it into a per-user folder.
# Review the script first if you prefer not to run code you haven't read:
#   https://github.com/hayoloo642-cloud/harita-project/blob/master/install.ps1
[CmdletBinding()]
param(
  [string]$InstallDir = (Join-Path $env:LOCALAPPDATA 'Programs\Harita'),
  [switch]$SkipShortcut,
  [switch]$SkipLaunch,
  [switch]$InstallPython,
  [switch]$Force
)

$ErrorActionPreference = 'Stop'
$RepoZip = 'https://github.com/hayoloo642-cloud/harita-project/archive/refs/heads/master.zip'

function Get-PythonCommand {
  foreach ($candidate in @(
      @{ Exe = 'py'; Prefix = @('-3') },
      @{ Exe = 'python'; Prefix = @() },
      @{ Exe = 'python3'; Prefix = @() }
    )) {
    try {
      & $candidate.Exe @($candidate.Prefix + @('-c', 'import sys')) > $null 2>&1
      if ($LASTEXITCODE -eq 0) { return $candidate }
    } catch { }
  }
  return $null
}

function Ensure-Python {
  $python = Get-PythonCommand
  if ($python) { return $python }

  if ($InstallPython -and (Get-Command winget -ErrorAction SilentlyContinue)) {
    Write-Host 'Python belum ditemukan — mencoba install Python 3.12 lewat winget...'
    winget install --id Python.Python.3.12 -e --source winget
    $python = Get-PythonCommand
    if ($python) { return $python }
  }

  throw @"
Python 3.10+ tidak ditemukan.
Install dari https://www.python.org/downloads/ dan centang 'Add python.exe to PATH',
lalu jalankan installer ini lagi.
"@
}

function New-DesktopShortcut([string]$TargetDir) {
  $desktop = [Environment]::GetFolderPath('Desktop')
  $shortcutPath = Join-Path $desktop 'Harita.lnk'
  $shell = New-Object -ComObject WScript.Shell
  $shortcut = $shell.CreateShortcut($shortcutPath)
  $shortcut.TargetPath = Join-Path $TargetDir 'run.bat'
  $shortcut.WorkingDirectory = $TargetDir
  $shortcut.IconLocation = Join-Path $TargetDir 'static\icon.png'
  $shortcut.Description = 'Harita — dashboard harian lokal'
  $shortcut.Save()
  return $shortcutPath
}

Write-Host 'Harita installer'
Write-Host "Install target: $InstallDir"
$python = Ensure-Python
Write-Host "Python: $($python.Exe) $($python.Prefix -join ' ')"

$tmp = Join-Path ([IO.Path]::GetTempPath()) ('harita-' + [Guid]::NewGuid().ToString('N'))
try {
  New-Item -ItemType Directory -Path $tmp -Force | Out-Null
  $zip = Join-Path $tmp 'harita-source.zip'
  $expanded = Join-Path $tmp 'expanded'

  Write-Host 'Downloading source...'
  Invoke-WebRequest -UseBasicParsing -Uri $RepoZip -OutFile $zip
  Expand-Archive -Force -Path $zip -DestinationPath $expanded

  $source = Get-ChildItem -Path $expanded -Directory | Select-Object -First 1
  if (-not $source -or -not (Test-Path (Join-Path $source.FullName 'server.py'))) {
    throw 'Paket source tidak valid: server.py tidak ditemukan.'
  }

  if (Test-Path $InstallDir) {
    $existingServer = Join-Path $InstallDir 'server.py'
    if (Test-Path $existingServer) {
      Write-Host 'Instalasi Harita yang ada ditemukan — memperbarui file kode, folder data/ dipertahankan.'
    } elseif ($Force) {
      Write-Host 'Folder target sudah ada dan bukan instalasi Harita — karena -Force, file digabungkan.'
    } else {
      throw "Folder target sudah ada dan bukan instalasi Harita: $InstallDir. Gunakan folder lain atau -Force."
    }
  }

  New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
  Get-ChildItem -Path $source.FullName -Force | ForEach-Object {
    Copy-Item -Path $_.FullName -Destination $InstallDir -Recurse -Force
  }

  $runBat = Join-Path $InstallDir 'run.bat'
  if (-not (Test-Path $runBat)) { throw 'run.bat tidak ditemukan setelah instalasi.' }

  if (-not $SkipShortcut) {
    $shortcut = New-DesktopShortcut $InstallDir
    Write-Host "Shortcut dibuat: $shortcut"
  }

  Write-Host ''
  Write-Host 'Harita berhasil diinstall.'
  Write-Host "Folder: $InstallDir"
  Write-Host 'Jalankan dari desktop shortcut atau:'
  Write-Host "  cd `"$InstallDir`""
  Write-Host '  .\run.bat'

  if (-not $SkipLaunch) {
    Start-Process -FilePath $runBat -WorkingDirectory $InstallDir
  }
} finally {
  if (Test-Path $tmp) { Remove-Item -LiteralPath $tmp -Recurse -Force -ErrorAction SilentlyContinue }
}
