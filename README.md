# README

This folder contains the static site and helper scripts to build and deploy the site.

Quick usage

## Windows GUI and launch icon

Double-click `WebNiccolApp.lnk` to open the gallery editor and uploader without a console.
To create or update the shortcut with its own NICCOL taskbar identity and logo, run:

```powershell
.\tools\create-shortcut.ps1
```

With the GUI open, right-click its taskbar button and choose **Pin to taskbar**.
The shortcut opens the existing GUI, not a standalone compiled executable. Keep this
folder in place; recreate the shortcut if you move it. The GUI uses `images/niccol.ico`
for its window and taskbar icon. Icon generation and previews
use Windows image codecs (WebP/AVIF may require the corresponding Windows extensions).

- **Pridat fotky**: select multiple JPG, PNG, GIF, WebP or AVIF files. Originals are
  copied into `gallery`; duplicate basenames get unique names without overwriting.
- Select a photo for an inline preview. **Otevrit fotku** opens the original in its
  associated Windows app if a preview codec is unavailable.
- Select multiple photos with **Ctrl-click** or **Shift-click**.
- **Smazat vybrane** or the **Delete key**: permanently delete all selected local photos after one confirmation,
  including hidden JPG/JPEG/PNG twins when deleting a WebP. This is not undoable.
- **Drag and drop** selected photos to reorder them together, keeping their relative order.
  Drop above/below a row to insert before/after it, or in the blank space to append.
  A purple insertion line shows the drop location while dragging.
  Drag near the top/bottom edge to scroll. The list matches website
  display order. Changes are saved immediately; there is no separate Save button.
- **Nahraj web**: publish the entire local repository to GitHub using the
  credentials described below. New, changed, and deleted files are included;
  `.git` metadata is excluded. Editing locally does not publish automatically.
  Review the repository folder before uploading: local files such as credentials
  or other private files will also be published if present.

Regeneration and deployment retain saved ordering, drop missing files, and place
new files first on the website. WebP is preferred over same-basename JPG/PNG files.

Run the Windows GUI regression checks (uses temporary photos and a local deployment
stub, never GitHub):

```powershell
powershell.exe -NoProfile -STA -ExecutionPolicy Bypass -File .\tests\gallery.Tests.ps1
```

## Command-line usage

1. Regenerate gallery JSON:

```powershell
.\tools\update-gallery.ps1
```

2. Deploy to GitHub Pages (script will look up a GitHub token — see below):

```powershell
.\tools\deploy-github-script.ps1    # optional: -Branch main -Message "..." -Force
```

Where the deploy script obtains the GitHub token

- Preferred: Windows Credential Manager (CredentialManager module)

```powershell
Install-Module CredentialManager -Scope CurrentUser
New-StoredCredential -Target 'github_token_hair' -UserName 'token' -Password 'ghp_xxx' -Persist LocalMachine
```

- Alternative: set the environment variable `GITHUB_TOKEN_HAIR` (CI or local session):

```powershell
# set for current session
$env:GITHUB_TOKEN_HAIR = 'ghp_xxx'
# to persist for current user (new shell required)
setx GITHUB_TOKEN_HAIR 'ghp_xxx'
```

Using Windows Credential Manager (GUI)

- Open Control Panel → Credential Manager → Windows Credentials (or search "Credential Manager" in Start).
- Click "Add a generic credential".
- For "Internet or network address" enter `github_token_hair`.
- For "User name" enter `token` and for "Password" paste your GitHub personal access token.
- Click OK — the deploy script will read this credential with the `CredentialManager` module.
