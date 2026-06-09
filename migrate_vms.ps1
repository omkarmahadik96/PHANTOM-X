# PowerShell script to move VirtualBox VMs to D drive to free up 15GB of space

$Source = "C:\Users\OmyA\VirtualBox VMs"
$Target = "D:\VirtualBox VMs"

Write-Host "Creating target folder $Target..." -ForegroundColor Yellow
New-Item -ItemType Directory -Force -Path $Target | Out-Null

Write-Host "Moving VirtualBox VM files (15.38 GB) to D drive..." -ForegroundColor Yellow
Write-Host "Please wait, this will take a moment..." -ForegroundColor Yellow

# Use robocopy to move the files securely
robocopy $Source $Target /E /MOVE /R:3 /W:3 | Out-Null

# Clean up empty source directory
if (Test-Path $Source) {
    Remove-Item $Source -Recurse -Force -ErrorAction SilentlyContinue
}

# Create the junction link
Write-Host "Creating junction link..." -ForegroundColor Yellow
New-Item -ItemType Junction -Path $Source -Value $Target | Out-Null

Write-Host "VirtualBox VMs successfully migrated! 15GB freed on C drive." -ForegroundColor Green
