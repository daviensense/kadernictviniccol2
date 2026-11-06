# update-gallery.ps1
# Run this script after adding or removing photos from the ./gallery folder:
#   .\tools\update-gallery.ps1
#
# Scans ./gallery, preserves saved order, and writes ./data/gallery.json.
# The website reads that JSON file to build the photo gallery automatically.

param(
    [AllowEmptyCollection()]
    [string[]]$DisplayOrder
)

$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent
$galleryDir = Join-Path $root "gallery"
$outputFile = Join-Path $root "data\gallery.json"
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

$files = @($allFiles |
    Where-Object {
        $ext = $_.Extension.ToLower()
        if ($ext -in @(".jpg", ".jpeg", ".png")) {
            -not $webpBases.ContainsKey($_.BaseName.ToLower())
        }
        else {
            $true
        }
    } |
    Select-Object -ExpandProperty Name)

$available = @{}
foreach ($file in $files) { $available[$file] = $file }
$ordered = New-Object 'System.Collections.Generic.List[string]'
$seen = @{}

if ($PSBoundParameters.ContainsKey("DisplayOrder")) {
    foreach ($file in $DisplayOrder) {
        if (-not $available.ContainsKey($file) -or $seen.ContainsKey($file)) {
            throw "Invalid or duplicate gallery entry: $file"
        }
        $seen[$file] = $true
        $ordered.Add($available[$file])
    }
    if ($ordered.Count -ne $files.Count) {
        throw "The display order must include every gallery image."
    }
    # The website displays the stored list in reverse (newest first).
    $ordered.Reverse()
}
else {
    if (Test-Path -LiteralPath $outputFile) {
        $saved = Get-Content -LiteralPath $outputFile -Raw | ConvertFrom-Json
        foreach ($file in $saved) {
            if ($file -isnot [string] -or [System.IO.Path]::GetFileName($file) -ne $file) {
                throw "Invalid filename in data/gallery.json."
            }
            $preferred = [System.IO.Path]::ChangeExtension($file, ".webp")
            if ([System.IO.Path]::GetExtension($file) -in @(".jpg", ".jpeg", ".png") -and $available.ContainsKey($preferred)) {
                $file = $preferred
            }
            if ($available.ContainsKey($file) -and -not $seen.ContainsKey($file)) {
                $ordered.Add($available[$file])
                $seen[$file] = $true
            }
        }
    }
    foreach ($file in $files) {
        if (-not $seen.ContainsKey($file)) {
            $ordered.Add($file)
            $seen[$file] = $true
        }
    }
}

$json = ConvertTo-Json -InputObject @($ordered.ToArray()) -Depth 1
if ($ordered.Count -eq 0) { $json = "[]" }
Set-Content -Path $outputFile -Value $json -Encoding UTF8

Write-Host "Gallery updated - $($ordered.Count) image(s) found:"
$ordered | ForEach-Object { Write-Host "  $_" }
Write-Host ""
Write-Host "Written: data/gallery.json"
