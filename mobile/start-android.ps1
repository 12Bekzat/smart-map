[CmdletBinding()]
param(
  [switch]$OpenAndroid
)

$sdk = 'C:\Program Files (x86)\Android\android-sdk'
$env:ANDROID_HOME = $sdk
$env:ANDROID_SDK_ROOT = $sdk
$platformTools = Join-Path $sdk 'platform-tools'
$adb = Join-Path $platformTools 'adb.exe'

if (($env:Path -split ';') -notcontains $platformTools) {
  $env:Path = "$env:Path;$platformTools"
}

$env:EXPO_PUBLIC_API_URL = 'http://127.0.0.1:4000'

function Invoke-Adb {
  param(
    [string[]]$Arguments,
    [int]$TimeoutSeconds = 8
  )

  if (!(Test-Path $adb)) {
    return [pscustomobject]@{ Ok = $false; TimedOut = $false; Output = ''; Error = "adb.exe not found at $adb" }
  }

  $psi = [System.Diagnostics.ProcessStartInfo]::new()
  $psi.FileName = $adb
  $psi.Arguments = ($Arguments | ForEach-Object { '"' + ($_ -replace '"', '\"') + '"' }) -join ' '
  $psi.RedirectStandardOutput = $true
  $psi.RedirectStandardError = $true
  $psi.UseShellExecute = $false
  $psi.CreateNoWindow = $true

  $process = [System.Diagnostics.Process]::Start($psi)
  if (!$process.WaitForExit($TimeoutSeconds * 1000)) {
    try {
      $process.Kill($true)
    } catch {
      $process.Kill()
    }
    return [pscustomobject]@{ Ok = $false; TimedOut = $true; Output = ''; Error = "adb $($Arguments -join ' ') timed out" }
  }

  $output = $process.StandardOutput.ReadToEnd()
  $errorText = $process.StandardError.ReadToEnd()
  return [pscustomobject]@{
    Ok = $process.ExitCode -eq 0
    TimedOut = $false
    Output = $output
    Error = $errorText
  }
}

Write-Host "ANDROID_HOME=$env:ANDROID_HOME"
Write-Host "EXPO_PUBLIC_API_URL=$env:EXPO_PUBLIC_API_URL"

$deviceResult = Invoke-Adb -Arguments @('devices', '-l') -TimeoutSeconds 6
if ($deviceResult.TimedOut) {
  Write-Host "adb is stuck. Restarting adb server..."
  Get-Process adb -ErrorAction SilentlyContinue | Stop-Process -Force
  Start-Sleep -Seconds 1
  [void](Invoke-Adb -Arguments @('start-server') -TimeoutSeconds 8)
  $deviceResult = Invoke-Adb -Arguments @('devices', '-l') -TimeoutSeconds 8
}

if ($deviceResult.Output) {
  Write-Host $deviceResult.Output.TrimEnd()
}
if (!$deviceResult.Ok -and $deviceResult.Error) {
  Write-Host $deviceResult.Error.TrimEnd()
}

$hasDevice = $deviceResult.Output -match "`tdevice"
if ($hasDevice) {
  [void](Invoke-Adb -Arguments @('reverse', 'tcp:8081', 'tcp:8081') -TimeoutSeconds 6)
  [void](Invoke-Adb -Arguments @('reverse', 'tcp:4000', 'tcp:4000') -TimeoutSeconds 6)
  $reverseList = Invoke-Adb -Arguments @('reverse', '--list') -TimeoutSeconds 6
  if ($reverseList.Output) {
    Write-Host $reverseList.Output.TrimEnd()
  }

  $reverseJob = Start-Job -ArgumentList $adb -ScriptBlock {
    param($adbPath)
    while ($true) {
      try {
        & $adbPath reverse tcp:4000 tcp:4000 | Out-Null
      } catch {}
      Start-Sleep -Seconds 3
    }
  }
} else {
  Write-Host "No Android device is connected through adb. Expo will still start."
}

$expoArgs = @('expo', 'start', '--host', 'localhost', '--clear')
if ($OpenAndroid) {
  $expoArgs += '--android'
}

try {
  npx @expoArgs
} finally {
  if ($reverseJob) {
    Stop-Job $reverseJob -ErrorAction SilentlyContinue
    Remove-Job $reverseJob -Force -ErrorAction SilentlyContinue
  }
}
