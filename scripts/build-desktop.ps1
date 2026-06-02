param(
    [switch]$CreateZip
)

$ErrorActionPreference = 'Stop'

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Push-Location $projectRoot

try {
    Add-Type -AssemblyName System.IO.Compression.FileSystem

    $pythonExe = Join-Path $projectRoot '.venv\Scripts\python.exe'
    if (-not (Test-Path $pythonExe)) {
        throw 'Python venv fehlt. Bitte zuerst die virtuelle Umgebung unter .venv erstellen.'
    }

    Write-Host 'Installiere Python-Build-Abhaengigkeiten...'
    & $pythonExe -m pip install -e '.[build]'

    Write-Host 'Baue Frontend (Vite)...'
    npm run build

    Write-Host 'Erstelle Windows-Icon aus logo.png...'
    & $pythonExe .\scripts\make_icon.py

    Write-Host 'Erstelle Desktop-Bundle (PyInstaller)...'
    $pyInstallerExe = Join-Path $projectRoot '.venv\Scripts\pyinstaller.exe'
    if (Test-Path $pyInstallerExe) {
        & $pyInstallerExe --noconfirm --clean --name SynkNote --windowed --icon .\build-assets\synknote.ico --collect-all webview --collect-all llama_cpp --add-data 'dist;dist' --paths src src/dupkollabnotes/desktop.py
    }
    else {
        & $pythonExe -m PyInstaller --noconfirm --clean --name SynkNote --windowed --icon .\build-assets\synknote.ico --collect-all webview --collect-all llama_cpp --add-data 'dist;dist' --paths src src/dupkollabnotes/desktop.py
    }

    $releaseRoot = Join-Path $projectRoot 'release'
    $portableDir = Join-Path $releaseRoot 'SynkNote-win64'

    if (Test-Path $portableDir) {
        Remove-Item $portableDir -Recurse -Force
    }

    New-Item -ItemType Directory -Path $portableDir -Force | Out-Null
    Copy-Item (Join-Path $projectRoot 'dist\SynkNote\*') -Destination $portableDir -Recurse -Force

    Copy-Item (Join-Path $projectRoot 'README.md') -Destination (Join-Path $portableDir 'README.md') -Force
    if (Test-Path (Join-Path $projectRoot 'docs\kurzstart.md')) {
        Copy-Item (Join-Path $projectRoot 'docs\kurzstart.md') -Destination (Join-Path $portableDir 'KURZSTART.md') -Force
    }

    # Fuer Windows-Distribution unnoetig und gelegentlich beim Archivieren gesperrt.
    $androidJar = Join-Path $portableDir '_internal\webview\lib\pywebview-android.jar'
    if (Test-Path $androidJar) {
        Remove-Item $androidJar -Force -ErrorAction SilentlyContinue
    }

    if ($CreateZip) {
        if (-not (Test-Path $releaseRoot)) {
            New-Item -ItemType Directory -Path $releaseRoot -Force | Out-Null
        }

        $zipPath = Join-Path $releaseRoot 'SynkNote-win64.zip'
        if (Test-Path $zipPath) {
            Remove-Item $zipPath -Force
        }

        $zipCreated = $false
        for ($attempt = 1; $attempt -le 3 -and -not $zipCreated; $attempt++) {
            try {
                Compress-Archive -Path (Join-Path $portableDir '*') -DestinationPath $zipPath -Force
                $zipCreated = $true
            }
            catch {
                if (Test-Path $zipPath) {
                    Remove-Item $zipPath -Force -ErrorAction SilentlyContinue
                }

                if ($attempt -eq 3) {
                    throw
                }

                [System.Threading.Thread]::Sleep(800)
            }
        }
        Write-Host "ZIP erstellt: $zipPath"
    }

    Write-Host "Portable Build erstellt: $portableDir"
}
finally {
    Pop-Location
}
