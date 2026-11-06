$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent
$fixture = Join-Path ([System.IO.Path]::GetTempPath()) ("niccol-gallery-test-" + [guid]::NewGuid().ToString("N"))
$form = $null

function Assert($Condition, [string]$Message) {
    if (-not $Condition) { throw "FAIL: $Message" }
}

function Read-Order {
    @(Get-Content -LiteralPath "$fixture\data\gallery.json" -Raw | ConvertFrom-Json)
}

try {
    [void](New-Item -ItemType Directory -Path "$fixture\gallery", "$fixture\data", "$fixture\imports", "$fixture\images", "$fixture\tools")
    Copy-Item -LiteralPath "$root\images\niccol.ico" -Destination "$fixture\images\niccol.ico"
    foreach ($name in @("deploy-github-gui.ps1", "update-gallery.ps1", "windows-images.ps1")) {
        Copy-Item -LiteralPath (Join-Path "$root\tools" $name) -Destination "$fixture\tools"
    }

    & "$fixture\tools\update-gallery.ps1"
    Assert ((Get-Content "$fixture\data\gallery.json" -Raw).Trim() -eq "[]") "Empty gallery is a JSON array"

    $sample = Get-ChildItem -LiteralPath "$root\gallery" -Filter "*.webp" -File | Select-Object -First 1
    Copy-Item -LiteralPath $sample.FullName -Destination "$fixture\gallery\a.webp"
    & "$fixture\tools\update-gallery.ps1"
    Assert ((Read-Order).Count -eq 1) "Single photo is a JSON array"
    Assert ((Get-Content "$fixture\data\gallery.json" -Raw).Trim().StartsWith("[")) "Single photo array shape"

    Copy-Item -LiteralPath $sample.FullName -Destination "$fixture\gallery\b.webp"
    Copy-Item -LiteralPath $sample.FullName -Destination "$fixture\gallery\a.jpg"
    & "$fixture\tools\update-gallery.ps1"
    Assert (((Read-Order) -join ",") -eq "a.webp,b.webp") "WebP twins are suppressed"
    & "$fixture\tools\update-gallery.ps1" -DisplayOrder @("a.webp", "b.webp")
    Assert (((Read-Order) -join ",") -eq "b.webp,a.webp") "Display order is stored reversed"
    & "$fixture\tools\update-gallery.ps1"
    Assert (((Read-Order) -join ",") -eq "b.webp,a.webp") "Regeneration preserves manual order"

    $before = Get-Content "$fixture\data\gallery.json" -Raw
    $rejected = $false
    try { & "$fixture\tools\update-gallery.ps1" -DisplayOrder @("a.webp", "a.webp") }
    catch { $rejected = $true }
    Assert $rejected "Duplicate order is rejected"
    Assert ((Get-Content "$fixture\data\gallery.json" -Raw) -eq $before) "Invalid order leaves manifest intact"

    . "$fixture\tools\deploy-github-gui.ps1" -NoShow
    Assert ($form.ShowIcon -and $form.Icon -eq $appIcon) "Window title bar uses the NICCOL icon"
    Assert (($btnDeploy.Left * 2 + $btnDeploy.Width) -eq $form.ClientSize.Width) "Upload button is horizontally centered"
    Assert ($btnDeploy.BackColor.ToArgb() -eq [System.Drawing.Color]::FromArgb(35, 130, 65).ToArgb()) "Upload button is green"
    foreach ($button in @($btnAdd, $btnRemove, $btnOpen)) {
        Assert ($button.BackColor.ToArgb() -eq [System.Drawing.Color]::FromArgb(75, 75, 75).ToArgb()) "Secondary buttons are gray"
    }
    Assert ($lblStatus.Top -ge $btnDeploy.Bottom -and $lblStatus.Bottom -le $txtOutput.Top) "Status does not overlap upload button or output"
    Assert (($listPhotos.Items -join ",") -eq "a.webp,b.webp") "GUI matches website order"
    Assert ($null -ne $preview.Image) "Existing WebP has an inline preview"
    Assert ($preview.Image.Width -gt 0) "Preview is a decoded image"

    $listPhotos.SelectedIndex = 0
    Assert ($listPhotos.SelectionMode -eq "MultiExtended") "Ctrl/Shift multi-selection is enabled"
    Assert $listPhotos.AllowDrop "List accepts drag and drop"
    Move-GalleryPhotos @("a.webp") 2
    Assert (($listPhotos.Items -join ",") -eq "b.webp,a.webp") "Move down updates list"
    Assert ($listPhotos.SelectedIndex -eq 1) "Moved photo stays selected"
    Move-GalleryPhotos @("a.webp") 0
    Assert (($listPhotos.Items -join ",") -eq "a.webp,b.webp") "Move up updates list"

    Copy-Item -LiteralPath $sample.FullName -Destination "$fixture\imports\a.jpg"
    Copy-Item -LiteralPath $sample.FullName -Destination "$fixture\imports\new #1.webp"
    Add-GalleryPhotos @("$fixture\imports\a.jpg", "$fixture\imports\new #1.webp")
    Assert ($listPhotos.Items.Count -eq 4) "Multi-import preserves same-basename photos"
    Assert ((Test-Path -LiteralPath "$fixture\imports\a.jpg")) "Import preserves source"
    Assert (@(Get-ChildItem "$fixture\gallery" -Filter "a-*.jpg").Count -eq 1) "Collision gets a unique filename"
    Assert ((Test-Path -LiteralPath "$fixture\gallery\a.jpg")) "Import does not overwrite twin"
    Assert ($listPhotos.SelectedItem -eq "new #1.webp") "Last import is selected"
    Assert ($null -ne $preview.Image) "Special-character filename previews"
    Add-GalleryPhotos @("$fixture\gallery\new #1.webp")
    Assert ($listPhotos.Items.Count -eq 4) "Importing an existing gallery file is a no-op"

    # Exercise a non-contiguous group in both directions and at an interior boundary.
    $initial = @($listPhotos.Items)
    $group = @($initial[0], $initial[2])
    Move-GalleryPhotos $group $initial.Count
    $expected = @($initial[1], $initial[3], $initial[0], $initial[2])
    Assert (($listPhotos.Items -join ",") -eq ($expected -join ",")) "Group drops at end in original relative order"
    Assert (($listPhotos.SelectedItems -join ",") -eq ($group -join ",")) "Dropped group stays selected"
    Move-GalleryPhotos $group 0
    Assert (($listPhotos.Items -join ",") -eq (@($group + @($initial[1], $initial[3])) -join ",")) "Group drops at start"
    Move-GalleryPhotos $group 1
    Assert (($listPhotos.Items -join ",") -eq (@($group + @($initial[1], $initial[3])) -join ",")) "Drop within contiguous selection is a no-op"
    Move-GalleryPhotos $group 3
    Assert (($listPhotos.Items -join ",") -eq (@($initial[1], $group[0], $group[1], $initial[3]) -join ",")) "Group inserts before an interior row"
    Refresh-GalleryList $group
    Assert (($listPhotos.SelectedItems -join ",") -eq ($group -join ",")) "Group order and selection survive regeneration"

    $flags = [System.Reflection.BindingFlags]"Instance,NonPublic"
    $row = $listPhotos.GetItemRectangle($listPhotos.SelectedIndex)
    $clickY = $row.Top + 2
    $message = [System.Windows.Forms.Message]::Create(
        $listPhotos.Handle, 0x0201, [IntPtr]1, [IntPtr](8 -bor ($clickY -shl 16)))
    $arguments = [object[]]@($message)
    [void]$listPhotos.GetType().GetMethod("WndProc", $flags).Invoke($listPhotos, $arguments)
    Assert (($listPhotos.SelectedItems -join ",") -eq ($group -join ",")) "Mouse-down preserves the group for dragging"
    $mouseUp = [System.Windows.Forms.MouseEventArgs]::new(
        [System.Windows.Forms.MouseButtons]::Left, 1, 8, $clickY, 0)
    [void]$listPhotos.GetType().GetMethod("OnMouseUp", $flags).Invoke($listPhotos, @($mouseUp))
    Assert ($listPhotos.SelectedItems.Count -eq 1) "Plain click without dragging selects one row"
    Refresh-GalleryList $group

    $point = [System.Drawing.Point]::new(8, 1)
    Assert ((Get-GalleryDropIndex $point) -eq 0) "Top half of first row inserts before it"
    $point.Y = $listPhotos.ItemHeight - 1
    Assert ((Get-GalleryDropIndex $point) -eq 1) "Bottom half inserts after row"
    $point.Y = $listPhotos.ClientSize.Height - 1
    Assert ((Get-GalleryDropIndex $point) -eq $listPhotos.Items.Count) "Blank list space appends"

    # Raise actual drop events with an internal drag context, without moving the system mouse.
    $dragData = New-Object System.Windows.Forms.DataObject
    $dragData.SetData([NiccolGalleryListBox]::DragFormat, [string[]]$group)
    $activeDragProperty = $listPhotos.GetType().GetProperty("ActiveDrag")
    $activeDragProperty.SetValue($listPhotos, $dragData, $null)
    $screenPoint = $listPhotos.PointToScreen([System.Drawing.Point]::new(8, 1))
    $dragArgs = [System.Windows.Forms.DragEventArgs]::new(
        $dragData, 1, $screenPoint.X, $screenPoint.Y,
        [System.Windows.Forms.DragDropEffects]::Move, [System.Windows.Forms.DragDropEffects]::None)
    [void]$listPhotos.GetType().GetMethod("OnDragEnter", $flags).Invoke($listPhotos, @($dragArgs))
    Assert ($dragArgs.Effect -eq "Move") "Internal drag is accepted on entry"
    Assert ($listPhotos.InsertionIndex -eq 0) "Drag entry shows insertion marker at target"
    $render = [System.Drawing.Bitmap]::new($listPhotos.Width, $listPhotos.Height)
    try {
        $listPhotos.DrawToBitmap($render, [System.Drawing.Rectangle]::new(0, 0, $render.Width, $render.Height))
        $markerColor = [System.Drawing.Color]::FromArgb(180, 150, 255).ToArgb()
        $markerFound = $false
        for ($y = 0; $y -lt 8; $y++) {
            if ($render.GetPixel([int]($render.Width / 2), $y).ToArgb() -eq $markerColor) { $markerFound = $true }
        }
        Assert $markerFound "Insertion line is visibly painted in the list"
    }
    finally { $render.Dispose() }
    [void]$listPhotos.GetType().GetMethod("OnDragLeave", $flags).Invoke($listPhotos, @([System.EventArgs]::Empty))
    Assert ($listPhotos.InsertionIndex -eq -1) "Leaving list clears insertion marker"
    $endPoint = $listPhotos.PointToScreen([System.Drawing.Point]::new(8, $listPhotos.ClientSize.Height - 1))
    $endArgs = [System.Windows.Forms.DragEventArgs]::new(
        $dragData, 1, $endPoint.X, $endPoint.Y,
        [System.Windows.Forms.DragDropEffects]::Move, [System.Windows.Forms.DragDropEffects]::None)
    [void]$listPhotos.GetType().GetMethod("OnDragOver", $flags).Invoke($listPhotos, @($endArgs))
    Assert ($listPhotos.InsertionIndex -eq $listPhotos.Items.Count) "Blank-space hover shows append marker"
    [void]$listPhotos.GetType().GetMethod("OnDragOver", $flags).Invoke($listPhotos, @($dragArgs))
    [void]$listPhotos.GetType().GetMethod("OnDragDrop", $flags).Invoke($listPhotos, @($dragArgs))
    Assert ($listPhotos.InsertionIndex -eq -1) "Dropping clears insertion marker"
    Assert (($listPhotos.Items[0..1] -join ",") -eq ($group -join ",")) "Drop event persists the group at its target"
    $activeDragProperty.SetValue($listPhotos, $null, $null)
    $beforeDrop = $listPhotos.Items -join ","
    [void]$listPhotos.GetType().GetMethod("OnDragDrop", $flags).Invoke($listPhotos, @($dragArgs))
    Assert (($listPhotos.Items -join ",") -eq $beforeDrop) "External or stale drops are ignored"

    # Both UI deletion entry points must invoke the same confirmation flow.
    $originalDelete = ${function:Remove-SelectedGalleryPhotos}
    $script:deleteRequests = @()
    function Remove-SelectedGalleryPhotos {
        $script:deleteRequests += ,@($listPhotos.SelectedItems)
    }
    $onClickRemove = $btnRemove.GetType().GetMethod("OnClick", $flags)
    [void]$onClickRemove.Invoke($btnRemove, @([System.EventArgs]::Empty))
    $deleteKey = [System.Windows.Forms.KeyEventArgs]::new([System.Windows.Forms.Keys]::Delete)
    [void]$listPhotos.GetType().GetMethod("OnKeyDown", $flags).Invoke($listPhotos, @($deleteKey))
    Assert ($script:deleteRequests.Count -eq 2) "Button and Delete key use shared confirmation flow"
    Assert (($script:deleteRequests[0] -join ",") -eq ($group -join ",")) "Button acts on the entire selection"
    Assert (($script:deleteRequests[1] -join ",") -eq ($group -join ",")) "Delete key acts on the entire selection"
    Assert ($deleteKey.Handled -and $deleteKey.SuppressKeyPress) "Delete key is consumed"
    ${function:Remove-SelectedGalleryPhotos} = $originalDelete

    Remove-GalleryPhotos @("a.webp", "new #1.webp")
    Assert (-not (Test-Path "$fixture\gallery\a.webp")) "Selected photo is deleted"
    Assert (-not (Test-Path "$fixture\gallery\a.jpg")) "Hidden twin is deleted too"
    Assert (-not (Test-Path -LiteralPath "$fixture\gallery\new #1.webp")) "Batch deletion removes every selected photo"
    Assert ($listPhotos.Items.Count -eq 2) "Deleted photos do not reappear"

    # Invoke the actual deployment click handler against a local stub, never GitHub.
    Set-Content "$fixture\tools\deploy-github-script.ps1" 'Write-Output ("output" * 20000); [Console]::Error.WriteLine("error" * 20000); exit 1'
    $onClick = $btnDeploy.GetType().GetMethod("OnClick", [System.Reflection.BindingFlags]"Instance,NonPublic")
    [void]$onClick.Invoke($btnDeploy, @([System.EventArgs]::Empty))
    Assert ($lblStatus.Text -like "*exit code 1*") "Failed deployment is reported"
    Assert ($txtOutput.Text.Contains("output") -and $txtOutput.Text.Contains("error")) "Both deployment streams are drained"
    Assert $form.Enabled "GUI is re-enabled after failure"
    Set-Content "$fixture\tools\deploy-github-script.ps1" 'Write-Output "local test success"; exit 0'
    [void]$onClick.Invoke($btnDeploy, @([System.EventArgs]::Empty))
    Assert ($lblStatus.Text -eq "Hotovo! Web byl nahran.") "Successful deployment is reported"

    Remove-GalleryPhotos @($listPhotos.Items)
    Assert ($listPhotos.Items.Count -eq 0) "All photos can be removed"
    Assert ($null -eq $preview.Image) "Empty gallery clears preview"
    Assert (-not $btnRemove.Enabled -and -not $btnOpen.Enabled) "Empty gallery disables selection actions"
    Assert ((Get-Content "$fixture\data\gallery.json" -Raw).Trim() -eq "[]") "Removing last image saves an empty array"
    & "$fixture\tools\update-gallery.ps1" -DisplayOrder @()
    Write-Output "PASS: drag/drop ordering, multi-selection, batch deletion, Delete key routing, imports, WebP preview, deployment UI, and empty/single manifest shapes."
}
finally {
    if ($form) {
        if ($preview.Image) { $preview.Image.Dispose() }
        $form.Dispose()
        $appIcon.Dispose()
    }
    if (Test-Path -LiteralPath $fixture) { Remove-Item -LiteralPath $fixture -Recurse -Force }
}
