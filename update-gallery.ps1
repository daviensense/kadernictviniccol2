# update-gallery.ps1
# Run this script after adding or removing photos from the ./gallery folder:
#   .\update-gallery.ps1
#
# Scans ./gallery for image files and writes ./data/gallery.json.
# The website reads that JSON file to build the photo gallery automatically.

$galleryDir = Join-Path $PSScriptRoot "gallery"
$outputFile = Join-Path $PSScriptRoot "data\gallery.json"
$allowed    = @(".jpg", ".jpeg", ".png", ".gif", ".webp", ".avif")

New-Item -Path (Split-Path $outputFile -Parent) -ItemType Directory -Force | Out-Null

$allFiles = Get-ChildItem -Path $galleryDir -File |
    Where-Object { $allowed -contains $_.Extension.ToLower() } |
    Sort-Object Name

# Prefer .webp files; if both "photo.jpg" and "photo.webp" exist, only keep the WebP variant.
$webpBases = @{}
$allFiles |
    Where-Object { $_.Extension.ToLower() -eq ".webp" } |
    ForEach-Object {
        $webpBases[$_.BaseName.ToLower()] = $true
    }

$files = $allFiles |
    Where-Object {
        $ext = $_.Extension.ToLower()
        if ($ext -in @(".jpg", ".jpeg", ".png")) {
            -not $webpBases.ContainsKey($_.BaseName.ToLower())
        }
        else {
            $true
        }
    } |
    Select-Object -ExpandProperty Name

$json = $files | ConvertTo-Json -Depth 1

# ConvertTo-Json wraps a single item in a plain string — ensure it's always an array
if ($files.Count -le 1) {
    $json = "[$json]"
}

Set-Content -Path $outputFile -Value $json -Encoding UTF8

Write-Host "Gallery updated - $($files.Count) image(s) found:"
$files | ForEach-Object { Write-Host "  $_" }
Write-Host ""
Write-Host "Written: data/gallery.json"
