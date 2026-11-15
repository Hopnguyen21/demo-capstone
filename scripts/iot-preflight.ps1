[CmdletBinding()]
param(
    [string]$BackendUrl = 'http://localhost:5144',
    [int]$MqttPort = 1883,
    [string]$SerialPort = 'COM11',
    [string]$PostgresHost = 'localhost',
    [int]$PostgresPort = 5432,
    [string]$Database = 'smartfarmdb01',
    [string]$PostgresUser = 'postgres'
)

$ErrorActionPreference = 'Stop'
$checks = [System.Collections.Generic.List[object]]::new()

function Add-Check([string]$Name, [bool]$Passed, [string]$Details) {
    $checks.Add([pscustomobject]@{ Name = $Name; Passed = $Passed; Details = $Details })
}

try {
    $health = Invoke-WebRequest -Uri "$BackendUrl/health" -UseBasicParsing -TimeoutSec 5
    Add-Check 'Backend /health' ($health.StatusCode -eq 200) "HTTP $($health.StatusCode)"
} catch {
    $status = $_.Exception.Response.StatusCode.value__
    if ($status -eq 401) {
        Add-Check 'Backend /health' $true 'HTTP 401; Backend is reachable but health endpoint requires authentication'
    } else {
        Add-Check 'Backend /health' $false $_.Exception.Message
    }
}

try {
    $mqtt = Test-NetConnection -ComputerName 'localhost' -Port $MqttPort -WarningAction SilentlyContinue
    Add-Check "MQTT TCP $MqttPort" ([bool]$mqtt.TcpTestSucceeded) $(if ($mqtt.TcpTestSucceeded) { 'Listening' } else { 'Not listening' })
} catch {
    Add-Check "MQTT TCP $MqttPort" $false $_.Exception.Message
}

try {
    $pg = Test-NetConnection -ComputerName $PostgresHost -Port $PostgresPort -WarningAction SilentlyContinue
    Add-Check "PostgreSQL TCP $PostgresPort" ([bool]$pg.TcpTestSucceeded) $(if ($pg.TcpTestSucceeded) { 'Listening' } else { 'Not listening' })
} catch {
    Add-Check "PostgreSQL TCP $PostgresPort" $false $_.Exception.Message
}

$portPresent = [bool](Get-CimInstance Win32_SerialPort -ErrorAction SilentlyContinue | Where-Object DeviceID -eq $SerialPort)
Add-Check "ESP serial $SerialPort" $portPresent $(if ($portPresent) { 'Detected; close Serial Monitor before esptool access' } else { 'Not detected' })

$psql = Get-Command psql -ErrorAction SilentlyContinue
if (-not $psql -and (Test-Path 'C:\Program Files\PostgreSQL\18\bin\psql.exe')) {
    $psql = Get-Item 'C:\Program Files\PostgreSQL\18\bin\psql.exe'
}
if ($psql) {
    $env:PGPASSWORD = if ($env:PGPASSWORD) { $env:PGPASSWORD } else { '12345' }
    $psqlPath = if ($psql.PSObject.Properties.Name -contains 'Source') { $psql.Source } else { $psql.FullName }
    $gateway = & $psqlPath -h $PostgresHost -p $PostgresPort -U $PostgresUser -d $Database -t -A -F '|' -c "select gateway_serial,status,firmware_version,coalesce(last_seen_at_utc::text,'') from gateways order by created_at_utc desc limit 1" 2>$null
    if ($LASTEXITCODE -eq 0 -and $gateway) {
        $parts = $gateway.Trim() -split '\|', 4
        $hasHeartbeat = $parts.Count -ge 4 -and [bool]$parts[3]
        Add-Check 'Gateway DB record' $true "serial=$($parts[0]); status=$($parts[1]); firmware=$($parts[2])"
        Add-Check 'Gateway MQTT heartbeat' $hasHeartbeat $(if ($hasHeartbeat) { "last_seen=$($parts[3])" } else { 'No heartbeat; ESP runtime is not confirmed' })
    } else {
        Add-Check 'Gateway DB record' $false 'Unable to query gateways table'
    }
} else {
    Add-Check 'Gateway DB record' $false 'psql not found in PATH'
}

$checks | Format-Table -AutoSize
$failed = @($checks | Where-Object { -not $_.Passed }).Count
Write-Host "`nPreflight: $(@($checks | Where-Object Passed).Count)/$($checks.Count) checks passed."
if ($failed -gt 0) { exit 1 }
