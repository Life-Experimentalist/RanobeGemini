# install_extensions.ps1

$extensionsFile = "extensions.txt"
$freezeColor = "Cyan"
$installColor = "Green"

function Write-ColorfulChoice {
    param (
        [string]$Text,
        [string]$Color
    )
    Write-Host -ForegroundColor $Color $Text
}

# Check if extensions.txt exists
if (-Not (Test-Path $extensionsFile)) {
    # Ask the user what they want to do
    Write-Host "extensions.txt not found."
    Write-ColorfulChoice "(1) Freeze extensions to a file" $freezeColor
    Write-ColorfulChoice "(2) Install from a different file" $installColor
    $choice = Read-Host "Enter your choice (1/2)"

    if ($choice -eq "1") {
        # Freeze extensions to a file
        code --list-extensions | Out-File -FilePath $extensionsFile -Encoding UTF8
        Write-Host "Extensions list frozen to > $extensionsFile"
        exit 0  # Exit after freezing
    } elseif ($choice -eq "2") {
        # List available .txt files
        Write-Host "Available .txt files in the current directory:"
        Get-ChildItem -Path "." -Filter "*.txt" | ForEach-Object {
            Write-Host $_.Name
        }

        # Install from a different file
        $extensionsFile = Read-Host "Enter the name of the extensions file (including extension):"
        if (-Not (Test-Path $extensionsFile)) {
            Write-Host "File not found!"
            exit 1
        }
    } else {
        Write-Host "Invalid choice."
        exit 1
    }
}

# Read extensions.txt and install each extension
Get-Content $extensionsFile | ForEach-Object {
    try {
        code --install-extension $_
    }
    catch {
        Write-Warning "Failed to install extension: $_"
    }
}

Write-Host "Extension installation completed."
