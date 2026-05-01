[CmdletBinding()]
param()

function Get-LocalApiUrl {
  $envFile = Join-Path $PSScriptRoot '.env'
  if (Test-Path $envFile) {
    $configuredUrl = Get-Content $envFile |
      Where-Object { $_ -match '^EXPO_PUBLIC_API_URL=' } |
      Select-Object -First 1

    if ($configuredUrl) {
      $url = ($configuredUrl -replace '^EXPO_PUBLIC_API_URL=', '').Trim()
      if ($url -and $url -notmatch '127\.0\.0\.1|localhost') {
        return $url
      }
    }
  }

  $activeIp = Get-NetIPConfiguration |
    Where-Object { $_.IPv4DefaultGateway -ne $null -and $_.NetAdapter.Status -eq 'Up' } |
    Select-Object -ExpandProperty IPv4Address |
    Select-Object -ExpandProperty IPAddress -First 1

  if ($activeIp) {
    return "http://$activeIp:4000"
  }

  return 'http://localhost:4000'
}

$env:EXPO_PUBLIC_API_URL = Get-LocalApiUrl

Write-Host "EXPO_PUBLIC_API_URL=$env:EXPO_PUBLIC_API_URL"
Write-Host "Starting Expo in LAN mode for iPhone. QR should use your computer LAN IP, not 127.0.0.1."

npx expo start --host lan --clear
