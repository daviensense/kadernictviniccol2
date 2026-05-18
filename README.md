# README

This folder contains the static site and helper scripts to build and deploy the site.

Quick usage

1. Regenerate gallery JSON:

```powershell
.\update-gallery.ps1
```

2. Deploy to GitHub Pages (script will look up a GitHub token — see below):

```powershell
.\deploy-github.ps1    # optional: -Branch main -Message "..." -Force
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
