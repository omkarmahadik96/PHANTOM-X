# PowerShell script to move Docker Program Files to D drive to free up space

$Source = "C:\Program Files\Docker"
$Target = "D:\DockerProgramFiles"

# 1. Stop all Docker processes
Write-Host "Stopping Docker Desktop processes..." -ForegroundColor Yellow
Stop-Process -Name *docker* -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

# 2. Check if Source exists and is a regular folder
if (Test-Path $Source) {
    $item = Get-Item $Source
    if ($item.Attributes -like "*ReparsePoint*") {
        Write-Host "Junction already exists at $Source." -ForegroundColor Green
    } else {
        Write-Host "Moving files from $Source to $Target..." -ForegroundColor Yellow
        # Create target folder
        New-Item -ItemType Directory -Force -Path $Target | Out-Null
        
        # Use robocopy to move files (preserves permissions, robust)
        robocopy $Source $Target /E /MOVE /COPYALL /R:3 /W:3
        
        # Remove source folder
        if (Test-Path $Source) {
            Remove-Item $Source -Recurse -Force -ErrorAction SilentlyContinue
        }
        
        # 3. Create Junction link
        Write-Host "Creating Junction link from $Source to $Target..." -ForegroundColor Yellow
        New-Item -ItemType Junction -Path $Source -Value $Target | Out-Null
        Write-Host "Successfully migrated and created junction link!" -ForegroundColor Green
    }
} else {
    # If it doesn't exist at all, we can just create the junction now
    New-Item -ItemType Directory -Force -Path $Target | Out-Null
    New-Item -ItemType Junction -Path $Source -Value $Target | Out-Null
    Write-Host "Created new Junction link at $Source pointing to $Target." -ForegroundColor Green
}

Write-Host "Press any key to exit..."
[void]$Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
