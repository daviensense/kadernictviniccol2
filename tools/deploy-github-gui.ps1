param([switch]$NoShow)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Windows.Forms
. "$PSScriptRoot\windows-images.ps1"
$scriptDir = Split-Path $PSScriptRoot -Parent

if (-not ("NiccolGalleryListBox" -as [type])) {
    Add-Type -ReferencedAssemblies System.Windows.Forms, System.Drawing @"
using System;
using System.Drawing;
using System.Windows.Forms;

public class NiccolGalleryListBox : ListBox {
    public const string DragFormat = "NiccolGallerySelection";
    private Point? dragStart;
    private int pendingClick = -1;
    private int insertionIndex = -1;
    public IDataObject ActiveDrag { get; private set; }
    public int InsertionIndex {
        get { return insertionIndex; }
        set {
            if (insertionIndex == value) return;
            insertionIndex = value;
            Invalidate();
            Update();
        }
    }

    private void DrawInsertionLine(Graphics graphics) {
        if (insertionIndex < 0 || insertionIndex > Items.Count) return;
        int y = 0;
        if (Items.Count > 0) {
            y = insertionIndex == Items.Count
                ? GetItemRectangle(Items.Count - 1).Bottom
                : GetItemRectangle(insertionIndex).Top;
        }
        if (y < 0 || y > ClientSize.Height) return;
        y = Math.Max(2, Math.Min(ClientSize.Height - 3, y));
        using (Pen pen = new Pen(Color.FromArgb(180, 150, 255), 3)) {
            graphics.DrawLine(pen, 2, y, ClientSize.Width - 3, y);
            graphics.DrawLine(pen, 2, y - 3, 2, y + 3);
            graphics.DrawLine(pen, ClientSize.Width - 3, y - 3, ClientSize.Width - 3, y + 3);
        }
    }

    protected override void WndProc(ref Message m) {
        // Defer a plain click on selected rows so native selection does not
        // collapse a multi-selection before the user can drag it.
        if (m.Msg == 0x0201 && ModifierKeys == Keys.None) {
            long coordinates = m.LParam.ToInt64();
            Point point = new Point((short)(coordinates & 0xffff), (short)((coordinates >> 16) & 0xffff));
            int index = IndexFromPoint(point);
            if (index >= 0 && GetSelected(index)) {
                Focus();
                pendingClick = index;
                dragStart = point;
                Capture = true;
                return;
            }
        }
        base.WndProc(ref m);
        // ListBox is painted natively, so draw the marker after its own paint.
        if (m.Msg == 0x000F && insertionIndex >= 0) {
            using (Graphics graphics = CreateGraphics()) { DrawInsertionLine(graphics); }
        }
        else if (m.Msg == 0x0318 && insertionIndex >= 0) {
            using (Graphics graphics = Graphics.FromHdc(m.WParam)) { DrawInsertionLine(graphics); }
        }
    }

    protected override void OnMouseDown(MouseEventArgs e) {
        base.OnMouseDown(e);
        if (e.Button == MouseButtons.Left && IndexFromPoint(e.Location) >= 0) {
            dragStart = e.Location;
        }
    }

    protected override void OnMouseMove(MouseEventArgs e) {
        base.OnMouseMove(e);
        if (!dragStart.HasValue || e.Button != MouseButtons.Left) return;
        Size size = SystemInformation.DragSize;
        Rectangle threshold = new Rectangle(
            dragStart.Value.X - size.Width / 2,
            dragStart.Value.Y - size.Height / 2, size.Width, size.Height);
        if (threshold.Contains(e.Location) || SelectedItems.Count == 0) return;
        string[] names = new string[SelectedItems.Count];
        SelectedItems.CopyTo(names, 0);
        DataObject data = new DataObject();
        data.SetData(DragFormat, names);
        dragStart = null;
        pendingClick = -1;
        ActiveDrag = data;
        try { DoDragDrop(data, DragDropEffects.Move); }
        finally { InsertionIndex = -1; ActiveDrag = null; Capture = false; }
    }

    protected override void OnMouseUp(MouseEventArgs e) {
        if (e.Button == MouseButtons.Left && pendingClick >= 0) {
            int index = pendingClick;
            pendingClick = -1;
            ClearSelected();
            SetSelected(index, true);
            Capture = false;
        }
        dragStart = null;
        base.OnMouseUp(e);
    }
}
"@
}

if (-not ("NiccolTaskbarIdentity" -as [type])) {
    Add-Type @"
using System;
using System.Runtime.InteropServices;

public static class NiccolTaskbarIdentity {
    public const string AppId = "NICCOL.GalleryEditor";

    [DllImport("shell32.dll", CharSet = CharSet.Unicode, PreserveSig = true)]
    private static extern int SetCurrentProcessExplicitAppUserModelID(string appId);

    public static void Set() {
        Marshal.ThrowExceptionForHR(SetCurrentProcessExplicitAppUserModelID(AppId));
    }
}
"@
}
[NiccolTaskbarIdentity]::Set()

$form = New-Object System.Windows.Forms.Form
$appIcon = [System.Drawing.Icon]::new((Join-Path $scriptDir "images\niccol.ico"))
$form.Icon = $appIcon
$form.ShowIcon = $true
$form.ShowInTaskbar = $true
$form.Text = "Kadernictvi NICCOL - galerie a nahrani webu"
$form.ClientSize = New-Object System.Drawing.Size(900, 650)
$form.StartPosition = "CenterScreen"
$form.FormBorderStyle = "FixedSingle"
$form.MaximizeBox = $false
$form.BackColor = [System.Drawing.Color]::FromArgb(30, 30, 30)
$form.ForeColor = [System.Drawing.Color]::White
$form.Font = New-Object System.Drawing.Font("Segoe UI", 9)

function New-GuiButton($Text, $X, $Y, $Width = 120) {
    $button = New-Object System.Windows.Forms.Button
    $button.Text = $Text
    $button.Location = New-Object System.Drawing.Point($X, $Y)
    $button.Size = New-Object System.Drawing.Size($Width, 32)
    $button.BackColor = [System.Drawing.Color]::FromArgb(75, 75, 75)
    $button.ForeColor = [System.Drawing.Color]::White
    $button.FlatStyle = "Flat"
    $button.FlatAppearance.BorderSize = 0
    $form.Controls.Add($button)
    return $button
}

$lblTitle = New-Object System.Windows.Forms.Label
$lblTitle.Text = "Poradi zmenite pretazenim. Vice fotek: Ctrl/Shift. Smazani: Delete. Zmeny se ukladaji lokalne."
$lblTitle.Location = New-Object System.Drawing.Point(16, 16)
$lblTitle.Size = New-Object System.Drawing.Size(860, 24)
$form.Controls.Add($lblTitle)

$listPhotos = New-Object NiccolGalleryListBox
$listPhotos.SelectionMode = "MultiExtended"
$listPhotos.AllowDrop = $true
$listPhotos.Location = New-Object System.Drawing.Point(16, 50)
$listPhotos.Size = New-Object System.Drawing.Size(410, 350)
$listPhotos.HorizontalScrollbar = $true
$listPhotos.BackColor = [System.Drawing.Color]::FromArgb(20, 20, 20)
$listPhotos.ForeColor = [System.Drawing.Color]::White
$form.Controls.Add($listPhotos)

$preview = New-Object System.Windows.Forms.PictureBox
$preview.Location = New-Object System.Drawing.Point(442, 50)
$preview.Size = New-Object System.Drawing.Size(442, 300)
$preview.SizeMode = "Zoom"
$form.Controls.Add($preview)

$lblPreview = New-Object System.Windows.Forms.Label
$lblPreview.Location = New-Object System.Drawing.Point(442, 356)
$lblPreview.Size = New-Object System.Drawing.Size(442, 50)
$form.Controls.Add($lblPreview)

$btnAdd = New-GuiButton "Pridat fotky" 16 412
$btnRemove = New-GuiButton "Smazat vybrane" 146 412 150
$btnOpen = New-GuiButton "Otevrit fotku" 442 412
$btnDeploy = New-GuiButton "Nahraj web" 370 460 160
$btnDeploy.BackColor = [System.Drawing.Color]::FromArgb(35, 130, 65)

$lblStatus = New-Object System.Windows.Forms.Label
$lblStatus.Location = New-Object System.Drawing.Point(16, 492)
$lblStatus.Size = New-Object System.Drawing.Size(868, 18)
$lblStatus.TextAlign = "MiddleCenter"
$form.Controls.Add($lblStatus)

$txtOutput = New-Object System.Windows.Forms.RichTextBox
$txtOutput.Location = New-Object System.Drawing.Point(16, 510)
$txtOutput.Size = New-Object System.Drawing.Size(868, 124)
$txtOutput.BackColor = [System.Drawing.Color]::FromArgb(20, 20, 20)
$txtOutput.ForeColor = [System.Drawing.Color]::FromArgb(180, 255, 180)
$txtOutput.Font = New-Object System.Drawing.Font("Consolas", 8)
$txtOutput.ReadOnly = $true
$form.Controls.Add($txtOutput)

function Show-GuiError($ErrorRecord) {
    $lblStatus.Text = "Chyba: $($ErrorRecord.Exception.Message)"
    $txtOutput.Text = $ErrorRecord.ToString()
    [void][System.Windows.Forms.MessageBox]::Show($form, $lblStatus.Text, "Chyba", "OK", "Error")
}

function Update-PhotoPreview {
    if ($preview.Image) {
        $preview.Image.Dispose()
        $preview.Image = $null
    }
    $selected = $listPhotos.SelectedIndex
    $btnRemove.Enabled = $selected -ge 0
    $btnOpen.Enabled = $listPhotos.SelectedItems.Count -eq 1
    $lblPreview.Text = "$($listPhotos.Items.Count) fotek; vybrano: $($listPhotos.SelectedItems.Count)"
    if ($selected -lt 0) { return }
    try {
        $preview.Image = Get-WindowsImage -Path (Join-Path "$scriptDir\gallery" $listPhotos.SelectedItem)
    }
    catch {
        $lblPreview.Text = "Nahled nelze nacist. Pouzijte Otevrit fotku. Pro WebP/AVIF je nutny kodek Windows."
        $txtOutput.Text = "Preview: $($_.Exception.Message)"
    }
}

function Refresh-GalleryList([string[]]$SelectedNames) {
    & "$scriptDir\tools\update-gallery.ps1"
    $saved = Get-Content -LiteralPath "$scriptDir\data\gallery.json" -Raw | ConvertFrom-Json
    $names = @()
    if ($null -ne $saved) { $names = @($saved) }
    [array]::Reverse($names)
    $listPhotos.Items.Clear()
    foreach ($name in $names) { [void]$listPhotos.Items.Add($name) }
    foreach ($name in $SelectedNames) {
        $index = $listPhotos.Items.IndexOf($name)
        if ($index -ge 0) { $listPhotos.SetSelected($index, $true) }
    }
    if ($listPhotos.SelectedItems.Count -eq 0 -and $listPhotos.Items.Count -gt 0) {
        $listPhotos.SelectedIndex = 0
    }
    Update-PhotoPreview
}

function Add-GalleryPhotos([string[]]$Paths) {
    $allowed = @(".jpg", ".jpeg", ".png", ".gif", ".webp", ".avif")
    $lastName = $null
    try {
        foreach ($path in $Paths) {
            $source = Get-Item -LiteralPath $path
            if ($source.PSIsContainer -or $source.Extension.ToLowerInvariant() -notin $allowed) {
                throw "Nepodporovany soubor: $path"
            }
            $target = Join-Path "$scriptDir\gallery" $source.Name
            if ($source.FullName -eq $target) {
                $lastName = $source.Name
                continue
            }
            # A unique basename also avoids hiding an import behind a WebP twin.
            if (@(Get-ChildItem -LiteralPath "$scriptDir\gallery" -File |
                Where-Object { $_.BaseName -eq $source.BaseName }).Count -gt 0) {
                $name = "$($source.BaseName)-$([guid]::NewGuid().ToString('N'))$($source.Extension)"
                $target = Join-Path "$scriptDir\gallery" $name
            }
            Copy-Item -LiteralPath $source.FullName -Destination $target -ErrorAction Stop
            $lastName = [System.IO.Path]::GetFileName($target)
        }
    }
    finally {
        Refresh-GalleryList $lastName
    }
    $lblStatus.Text = "Fotky pridany lokalne. Pro zverejneni kliknete Nahraj web."
}

function Remove-GalleryPhotos([string[]]$Names) {
    if ($Names.Count -eq 0) { return }
    $files = @{}
    foreach ($name in $Names) {
        if (-not $listPhotos.Items.Contains($name)) { throw "Neplatna fotka: $name" }
        $file = Get-Item -LiteralPath (Join-Path "$scriptDir\gallery" $name)
        $files[$file.FullName] = $file
        if ($file.Extension -eq ".webp") {
            foreach ($twin in @(Get-ChildItem -LiteralPath "$scriptDir\gallery" -File | Where-Object {
                $_.BaseName -eq $file.BaseName -and $_.Extension.ToLowerInvariant() -in @(".jpg", ".jpeg", ".png")
            })) {
                $files[$twin.FullName] = $twin
            }
        }
    }
    try {
        foreach ($file in $files.Values) { Remove-Item -LiteralPath $file.FullName -ErrorAction Stop }
    }
    finally { Refresh-GalleryList }
    $lblStatus.Text = "Vybrane fotky smazany lokalne. Pro zverejneni kliknete Nahraj web."
}

function Move-GalleryPhotos([string[]]$Names, [int]$InsertIndex) {
    $order = @($listPhotos.Items)
    if ($Names.Count -eq 0 -or $InsertIndex -lt 0 -or $InsertIndex -gt $order.Count) {
        throw "Neplatne presunuti fotek."
    }
    foreach ($name in $Names) {
        if ($name -notin $order) { throw "Neplatna fotka: $name" }
    }
    $moving = @($order | Where-Object { $_ -in $Names })
    $result = New-Object 'System.Collections.Generic.List[string]'
    for ($i = 0; $i -le $order.Count; $i++) {
        if ($i -eq $InsertIndex) { $result.AddRange([string[]]$moving) }
        if ($i -lt $order.Count -and $order[$i] -notin $Names) { $result.Add($order[$i]) }
    }
    & "$scriptDir\tools\update-gallery.ps1" -DisplayOrder $result.ToArray()
    Refresh-GalleryList $moving
    $lblStatus.Text = "Poradi ulozeno lokalne. Pro zverejneni kliknete Nahraj web."
}

function Remove-SelectedGalleryPhotos {
    $names = @($listPhotos.SelectedItems)
    if ($names.Count -eq 0) { return }
    $answer = [System.Windows.Forms.MessageBox]::Show($form,
        "Trvale smazat vybrane fotky ($($names.Count)) z disku? Smazou se i JPG/PNG varianty stejnych WebP fotek. Zmena na webu se projevi az po nahrani.",
        "Smazat vybrane fotky", "YesNo", "Warning", "Button2")
    if ($answer -eq "Yes") { Remove-GalleryPhotos $names }
}

function Get-GalleryDropIndex([System.Drawing.Point]$Point) {
    $index = $listPhotos.IndexFromPoint($Point)
    if ($index -lt 0) { return $listPhotos.Items.Count }
    $bounds = $listPhotos.GetItemRectangle($index)
    if ($Point.Y -ge $bounds.Top + $bounds.Height / 2) { $index++ }
    return $index
}

$listPhotos.Add_SelectedIndexChanged({ Update-PhotoPreview })
$listPhotos.Add_KeyDown({
    param($sender, $eventArgs)
    if ($eventArgs.KeyCode -eq [System.Windows.Forms.Keys]::Delete) {
        $eventArgs.Handled = $true
        $eventArgs.SuppressKeyPress = $true
        try { Remove-SelectedGalleryPhotos } catch { Show-GuiError $_ }
    }
})
$galleryDragOver = {
    param($sender, $eventArgs)
    $eventArgs.Effect = [System.Windows.Forms.DragDropEffects]::None
    if (-not $listPhotos.ActiveDrag -or -not $eventArgs.Data.GetDataPresent([NiccolGalleryListBox]::DragFormat)) {
        $listPhotos.InsertionIndex = -1
        return
    }
    $point = $listPhotos.PointToClient([System.Drawing.Point]::new($eventArgs.X, $eventArgs.Y))
    if ($point.Y -lt $listPhotos.ItemHeight) {
        $listPhotos.TopIndex = [Math]::Max(0, $listPhotos.TopIndex - 1)
    }
    elseif ($point.Y -gt $listPhotos.ClientSize.Height - $listPhotos.ItemHeight) {
        $listPhotos.TopIndex = [Math]::Min($listPhotos.Items.Count - 1, $listPhotos.TopIndex + 1)
    }
    $eventArgs.Effect = [System.Windows.Forms.DragDropEffects]::Move
    $index = Get-GalleryDropIndex $point
    $listPhotos.InsertionIndex = $index
    $lblStatus.Text = "Pustit na pozici $($index + 1) (pred odebranim presouvanych fotek)."
}
$listPhotos.Add_DragEnter($galleryDragOver)
$listPhotos.Add_DragOver($galleryDragOver)
$listPhotos.Add_DragLeave({ $listPhotos.InsertionIndex = -1 })
$listPhotos.Add_DragDrop({
    param($sender, $eventArgs)
    $listPhotos.InsertionIndex = -1
    if (-not $listPhotos.ActiveDrag -or -not $eventArgs.Data.GetDataPresent([NiccolGalleryListBox]::DragFormat)) { return }
    try {
        $point = $listPhotos.PointToClient([System.Drawing.Point]::new($eventArgs.X, $eventArgs.Y))
        Move-GalleryPhotos -Names $eventArgs.Data.GetData([NiccolGalleryListBox]::DragFormat) -InsertIndex (Get-GalleryDropIndex $point)
    }
    catch { Show-GuiError $_ }
})
$btnAdd.Add_Click({
    $dialog = New-Object System.Windows.Forms.OpenFileDialog
    $dialog.Title = "Vyberte fotky do galerie"
    $dialog.Filter = "Fotografie|*.jpg;*.jpeg;*.png;*.gif;*.webp;*.avif"
    $dialog.Multiselect = $true
    try {
        if ($dialog.ShowDialog($form) -eq "OK") { Add-GalleryPhotos $dialog.FileNames }
    }
    catch { Show-GuiError $_ }
    finally { $dialog.Dispose() }
})
$btnRemove.Add_Click({
    try { Remove-SelectedGalleryPhotos } catch { Show-GuiError $_ }
})
$btnOpen.Add_Click({
    try { Start-Process -FilePath (Join-Path "$scriptDir\gallery" $listPhotos.SelectedItem) }
    catch { Show-GuiError $_ }
})

$btnDeploy.Add_Click({
    $form.Enabled = $false
    $lblStatus.Text = "Nahravam web..."
    $txtOutput.Clear()
    $form.Refresh()
    $proc = $null
    try {
        $psi = New-Object System.Diagnostics.ProcessStartInfo
        $psi.FileName = "powershell.exe"
        $psi.Arguments = "-NoProfile -ExecutionPolicy Bypass -File `"$scriptDir\tools\deploy-github-script.ps1`""
        $psi.RedirectStandardOutput = $true
        $psi.RedirectStandardError = $true
        $psi.UseShellExecute = $false
        $psi.CreateNoWindow = $true
        $psi.WorkingDirectory = $scriptDir
        $proc = [System.Diagnostics.Process]::Start($psi)
        # Drain both pipes concurrently so a full error pipe cannot block deployment.
        $stdout = $proc.StandardOutput.ReadToEndAsync()
        $stderr = $proc.StandardError.ReadToEndAsync()
        $proc.WaitForExit()
        $txtOutput.Text = ($stdout.Result + "`r`n" + $stderr.Result).Trim()
        if ($proc.ExitCode -eq 0) {
            $lblStatus.Text = "Hotovo! Web byl nahran."
        }
        else { throw "Nahrani selhalo (exit code $($proc.ExitCode)). Viz vypis nize." }
    }
    catch {
        $lblStatus.Text = $_.Exception.Message
        $txtOutput.AppendText("`r`n$($_.Exception.Message)")
    }
    finally {
        if ($proc) { $proc.Dispose() }
        $form.Enabled = $true
    }
})

$form.Add_FormClosed({
    if ($preview.Image) { $preview.Image.Dispose() }
    $appIcon.Dispose()
})
try { Refresh-GalleryList }
catch { Show-GuiError $_ }
if (-not $NoShow) {
    [void]$form.ShowDialog()
    $form.Dispose()
}
