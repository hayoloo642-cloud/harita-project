# Build Harita-Setup.exe from dist\Harita.exe using Inno Setup.
[CmdletBinding()]
param([string]$Version = "")
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
Set-Location $root

if (-not $Version) {
  $Version = (Select-String -Path server.py -Pattern '__version__ = "([^"]+)"').Matches[0].Groups[1].Value
}
if (-not (Test-Path dist\Harita.exe)) { throw 'dist\Harita.exe tidak ditemukan. Jalankan packaging\build-windows.bat dulu.' }

$iscc = Get-Command ISCC.exe -ErrorAction SilentlyContinue
if ($iscc) {
  $isccPath = $iscc.Source
} else {
  $candidate = Join-Path ${env:ProgramFiles(x86)} 'Inno Setup 6\ISCC.exe'
  if (Test-Path $candidate) { $isccPath = $candidate } else { throw 'Inno Setup tidak ditemukan. Install dengan: choco install innosetup --no-progress -y' }
}

& $isccPath "/DMyAppVersion=$Version" packaging\windows\installer.iss
Write-Host "OK - installer: dist\Harita-Setup-$Version.exe"
