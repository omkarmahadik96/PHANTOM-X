# PowerShell script to cleanly uninstall old Docker, redirect installation to D: drive, and install latest version

Start-Transcript -Path "D:\install_docker.log" -Force

$Uninstaller = "C:\Program Files\Docker\Docker\Docker Desktop Installer.exe"
$Source = "C:\Program Files\Docker"
$Target = "D:\DockerProgramFiles"
$DownloadUrl = "https://desktop.docker.com/win/main/amd64/Docker%20Desktop%20Installer.exe"
$InstallerPath = "D:\DockerDesktopInstaller.exe"

# 1. Stop all Docker processes and services
Write-Host "Stopping Docker services and processes..." -ForegroundColor Yellow
Stop-Service com.docker.service -Force -ErrorAction SilentlyContinue
Stop-Process -Name *docker* -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

# 2. Silent uninstall of the old Docker Desktop
if (Test-Path $Uninstaller) {
    Write-Host "Running Docker Desktop uninstaller..." -ForegroundColor Yellow
    $Process = Start-Process -FilePath $Uninstaller -ArgumentList "uninstall --quiet" -Wait -PassThru
    if ($Process.ExitCode -eq 0) {
        Write-Host "Docker uninstalled successfully." -ForegroundColor Green
    } else {
        Write-Host "Uninstaller exited with code: $($Process.ExitCode)" -ForegroundColor Yellow
    }
}

# 3. Clean up leftover folders
Write-Host "Cleaning up C:\Program Files\Docker..." -ForegroundColor Yellow
if (Test-Path $Source) {
    Remove-Item $Source -Recurse -Force -ErrorAction SilentlyContinue
}

# 4. Create Target folder and Junction Link
Write-Host "Creating target folder on D drive and junction link..." -ForegroundColor Yellow
New-Item -ItemType Directory -Force -Path $Target | Out-Null
if (-not (Test-Path $Source)) {
    New-Item -ItemType Junction -Path $Source -Value $Target | Out-Null
    Write-Host "Junction link created from $Source to $Target." -ForegroundColor Green
} else {
    Write-Host "Junction link creation skipped, source still exists." -ForegroundColor Red
}

# 5. Download the latest Docker Desktop installer to D drive (60GB free)
Write-Host "Downloading latest Docker Desktop installer (approx. 600MB)..." -ForegroundColor Yellow
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
Invoke-WebRequest -Uri $DownloadUrl -OutFile $InstallerPath -UseBasicParsing
Write-Host "Download complete: $InstallerPath" -ForegroundColor Green

# 6. Silent installation of the latest Docker Desktop
Write-Host "Installing latest Docker Desktop silently (this may take a few minutes)..." -ForegroundColor Yellow
$InstallProcess = Start-Process -FilePath $InstallerPath -ArgumentList "install --quiet --accept-license" -Wait -PassThru
if ($InstallProcess.ExitCode -eq 0) {
    Write-Host "Docker Desktop installed successfully!" -ForegroundColor Green
} else {
    Write-Host "Docker installation failed with exit code: $($InstallProcess.ExitCode)" -ForegroundColor Red
}

# 7. Clean up installer file
Write-Host "Cleaning up installer..." -ForegroundColor Yellow
if (Test-Path $InstallerPath) {
    Remove-Item $InstallerPath -Force -ErrorAction SilentlyContinue
}

# 8. Start Docker Desktop Service
Write-Host "Starting Docker Desktop service..." -ForegroundColor Yellow
Start-Service com.docker.service -ErrorAction SilentlyContinue

Write-Host "Process complete! You can now open Docker Desktop." -ForegroundColor Green

Stop-Transcript

Write-Host "Press any key to exit..."
[void]$Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
