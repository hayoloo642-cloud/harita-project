# Harita uninstaller (PowerShell). Default: hapus shortcut, data tetap aman.
[CmdletBinding()]
param(
  [string]$InstallDir = (Join-Path $env:LOCALAPPDATA 'Programs\Harita'),
  [switch]$RemoveData,
  [switch]$Force
)

$ErrorActionPreference = 'Stop'

$desktop = [Environment]::GetFolderPath('Desktop')
$startMenu = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs'
foreach ($dir in @($desktop, $startMenu)) {
  foreach ($name in @('Harita.lnk', 'MyAct.lnk')) {
    $path = Join-Path $dir $name
    if (Test-Path $path) { Remove-Item -LiteralPath $path -Force; Write-Host "Shortcut dihapus: $path" }
  }
}
$startup = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs\Startup'
foreach ($name in @('Harita.lnk', 'MyAct.lnk')) {
  $path = Join-Path $startup $name
  if (Test-Path $path) { Remove-Item -LiteralPath $path -Force; Write-Host "Startup dihapus: $path" }
}

if ($RemoveData) {
  $expected = Join-Path $env:LOCALAPPDATA 'Programs\Harita'
  $fullInstall = [IO.Path]::GetFullPath($InstallDir)
  $fullExpected = [IO.Path]::GetFullPath($expected)
  if ($fullInstall -ne $fullExpected -and -not $Force) {
    throw "Demi keamanan, -RemoveData hanya menghapus $fullExpected. Gunakan -Force bila yakin."
  }
  if (Test-Path $fullInstall) {
    Remove-Item -LiteralPath $fullInstall -Recurse -Force
    Write-Host "Folder dan data dihapus: $fullInstall"
  }
} else {
  Write-Host "Data tetap tersimpan di: $InstallDir\data"
  Write-Host "Untuk menghapus data juga, jalankan: .\uninstall.ps1 -RemoveData"
}
