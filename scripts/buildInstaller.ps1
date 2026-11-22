param()

$baseDir = Split-Path -Parent $PSScriptRoot
Set-Location $baseDir

$desktopDir = Join-Path $baseDir "dist\desktop"
$zipPath = Join-Path $baseDir "installer\payload.zip"
$icoPath = Join-Path $baseDir "installer\icon.ico"
$csPath = Join-Path $baseDir "installer\StandaloneInstaller.cs"
$exePath = Join-Path $baseDir "DimcordInstaller.exe"
$netDir = "C:\Windows\Microsoft.NET\Framework64\v4.0.30319"

# 1. Build desktop if missing
if (-not (Test-Path (Join-Path $desktopDir "patcher.js"))) {
    Write-Host "Building Dimcord desktop..."
    node --require=./scripts/suppressExperimentalWarnings.js scripts/build/build.mjs
}

# 2. Package payload.zip & dist\desktop.zip (excluding map files)
Write-Host "Packaging payload..."
if (Test-Path $zipPath) { Remove-Item $zipPath -Force }
$desktopZip = Join-Path $baseDir "dist\desktop.zip"
if (Test-Path $desktopZip) { Remove-Item $desktopZip -Force }

Add-Type -AssemblyName System.IO.Compression.FileSystem
$tempPayload = Join-Path $env:TEMP "dimcord_payload_build"
if (Test-Path $tempPayload) { Remove-Item $tempPayload -Recurse -Force }
New-Item -ItemType Directory -Path $tempPayload | Out-Null

Get-ChildItem -Path $desktopDir -Exclude "*.map" | Copy-Item -Destination $tempPayload -Recurse -Force
[System.IO.Compression.ZipFile]::CreateFromDirectory($tempPayload, $zipPath, [System.IO.Compression.CompressionLevel]::Optimal, $false)
Copy-Item $zipPath $desktopZip -Force
Remove-Item $tempPayload -Recurse -Force

# 3. Ensure icon.ico exists
if (-not (Test-Path $icoPath)) {
    powershell -ExecutionPolicy Bypass -File scripts/generateIco.ps1
}

# 4. Compile DimcordInstaller.exe
Write-Host "Compiling standalone DimcordInstaller.exe..."
& "$netDir\csc.exe" /target:winexe /optimize+ `
    /win32icon:"$icoPath" `
    /resource:"$zipPath,payload.zip" `
    /resource:"$icoPath,icon.ico" `
    /r:"$netDir\WPF\PresentationFramework.dll" `
    /r:"$netDir\WPF\PresentationCore.dll" `
    /r:"$netDir\WPF\WindowsBase.dll" `
    /r:"$netDir\System.Xaml.dll" `
    /r:"$netDir\System.Windows.Forms.dll" `
    /r:"$netDir\System.IO.Compression.dll" `
    /r:"$netDir\System.IO.Compression.FileSystem.dll" `
    /r:"$netDir\System.dll" `
    /r:"$netDir\System.Core.dll" `
    /out:"$exePath" "$csPath"

if ($LASTEXITCODE -eq 0) {
    $size = [math]::Round((Get-Item $exePath).Length / 1MB, 2)
    Write-Host "Successfully built standalone DimcordInstaller.exe ($size MB)"
} else {
    Write-Error "Failed to compile DimcordInstaller.exe"
}
