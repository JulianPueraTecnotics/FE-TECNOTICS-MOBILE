# Redirige puertos del PC al teléfono (Android USB). Necesario para captcha + API local.
$adbCandidates = @(
  "adb",
  "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe",
  "$env:USERPROFILE\AppData\Local\Android\Sdk\platform-tools\adb.exe",
  "$env:ANDROID_HOME\platform-tools\adb.exe",
  "$env:ANDROID_SDK_ROOT\platform-tools\adb.exe"
)

$adb = $null
foreach ($c in $adbCandidates) {
  if ($c -eq "adb") {
    $cmd = Get-Command adb -ErrorAction SilentlyContinue
    if ($cmd) { $adb = $cmd.Source; break }
  } elseif (Test-Path $c) {
    $adb = $c
    break
  }
}

if (-not $adb) {
  Write-Host "[adb-reverse] No se encontró adb. Instala Android SDK platform-tools o abre Android Studio > SDK Manager."
  exit 1
}

Write-Host "[adb-reverse] Usando: $adb"
& $adb reverse tcp:8081 tcp:8081
& $adb reverse tcp:3001 tcp:3001
& $adb reverse --list
