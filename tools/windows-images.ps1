Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName PresentationCore

function Get-WindowsImage {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path,
        [int]$Width = 640
    )

    $stream = [System.IO.File]::OpenRead($Path)
    $encoded = New-Object System.IO.MemoryStream
    $image = $null
    try {
        # WIC also supports WebP when the Windows WebP codec is installed.
        $bitmap = New-Object System.Windows.Media.Imaging.BitmapImage
        $bitmap.BeginInit()
        $bitmap.CacheOption = [System.Windows.Media.Imaging.BitmapCacheOption]::OnLoad
        $bitmap.DecodePixelWidth = $Width
        $bitmap.StreamSource = $stream
        $bitmap.EndInit()
        $encoder = New-Object System.Windows.Media.Imaging.PngBitmapEncoder
        $encoder.Frames.Add([System.Windows.Media.Imaging.BitmapFrame]::Create($bitmap))
        $encoder.Save($encoded)
        $encoded.Position = 0
        $image = [System.Drawing.Image]::FromStream($encoded)
        return [System.Drawing.Bitmap]::new($image)
    }
    finally {
        if ($image) { $image.Dispose() }
        $encoded.Dispose()
        $stream.Dispose()
    }
}
