# PowerShell script to apply the diff to LoginPage.tsx
Write-Host "Restoring LoginPage.tsx from backup..."

# Copy the backup back
Copy-Item -Path "C:\Users\JoeRomano\Desktop\ghostnamee\Final-Ghostcode\src\pages\LoginPage.tsx.backup" -Destination "C:\Users\JoeRomano\Desktop\ghostnamee\Final-Ghostcode\src\pages\LoginPage.tsx"

Write-Host "LoginPage.tsx restored successfully"

# Now apply the manual changes
$content = Get-Content "C:\Users\JoeRomano\Desktop\ghostnamee\Final-Ghostcode\src\pages\LoginPage.tsx" -Raw

Write-Host "LoginPage.tsx content length: $($content.Length)"

# Verify the file has the expected content
if ($content -match "useEffect.*1.*e.*)") {
    Write-Host "LoginPage.tsx appears to be restored correctly"
} else {
    Write-Host "Warning: LoginPage.tsx may not be in expected state"
}
