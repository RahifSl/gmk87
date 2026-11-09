param(
  [switch]$NoAutoStart,
  [switch]$Remove
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$iconPath = Join-Path $projectRoot 'electron\icons\icon.ico'
$runRegPath = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run'
$runValueName = 'GMK87MasterControlCenter'

$desktopDir = [Environment]::GetFolderPath('Desktop')
$startMenuDir = Join-Path ([Environment]::GetFolderPath('Programs')) 'GMK87 Master Control Center'
$desktopShortcut = Join-Path $desktopDir 'GMK87 Master Control Center.lnk'
$startShortcut = Join-Path $startMenuDir 'GMK87 Master Control Center.lnk'

if ($Remove) {
  if (Test-Path $desktopShortcut) { Remove-Item $desktopShortcut -Force }
  if (Test-Path $startMenuDir) { Remove-Item $startMenuDir -Recurse -Force }
  if (Get-ItemProperty -Path $runRegPath -Name $runValueName -ErrorAction SilentlyContinue) {
    Remove-ItemProperty -Path $runRegPath -Name $runValueName -Force
  }
  Write-Output 'Removed GMK87 Desktop/Start Menu shortcuts and Windows auto-start.'
  exit 0
}

$packagedExe = Join-Path $projectRoot 'release\win-unpacked\GMK87 Master Control Center.exe'
$devElectronExe = Join-Path $projectRoot 'node_modules\electron\dist\electron.exe'

if (Test-Path $packagedExe) {
  $targetExe = $packagedExe
  $guiArgs = ''
  $autoStartCmd = "`"$packagedExe`" --hidden"
  $workDir = Split-Path -Parent $packagedExe
} elseif (Test-Path $devElectronExe) {
  $targetExe = $devElectronExe
  $guiArgs = "`"$projectRoot`""
  $autoStartCmd = "`"$devElectronExe`" `"$projectRoot`" --hidden"
  $workDir = $projectRoot
} else {
  throw 'Neither packaged GMK87 Master Control Center.exe nor node_modules\electron\dist\electron.exe was found. Run npm run build:electron / package:win first.'
}

$wsh = New-Object -ComObject WScript.Shell

function New-AppShortcut([string]$lnkPath, [string]$target, [string]$args, [string]$wd, [string]$icon) {
  $sc = $wsh.CreateShortcut($lnkPath)
  $sc.TargetPath = $target
  if ($args) { $sc.Arguments = $args }
  $sc.WorkingDirectory = $wd
  $sc.Description = 'Zuoya GMK87 Master Control Center (USB Bridge + System Tray)'
  if (Test-Path $icon) { $sc.IconLocation = "$icon,0" }
  $sc.Save()
}

New-AppShortcut -lnkPath $desktopShortcut -target $targetExe -args $guiArgs -wd $workDir -icon $iconPath
New-Item -ItemType Directory -Force -Path $startMenuDir | Out-Null
New-AppShortcut -lnkPath $startShortcut -target $targetExe -args $guiArgs -wd $workDir -icon $iconPath

if (-not $NoAutoStart) {
  New-Item -Path $runRegPath -Force | Out-Null
  Set-ItemProperty -Path $runRegPath -Name $runValueName -Value $autoStartCmd
}

Write-Output "TARGET_EXE=$targetExe"
Write-Output "DESKTOP_SHORTCUT=$desktopShortcut"
Write-Output "STARTMENU_SHORTCUT=$startShortcut"
if (-not $NoAutoStart) {
  Write-Output "AUTOSTART_CMD=$autoStartCmd"
}
