# Dhanashree AgriPulse - Automated Deployment Pipeline
# This script automates the complete commit, push, and force rebuild pipeline.

Param(
    [string]$CommitMessage = ""
)

# Set console output encoding to UTF-8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Clear-Host
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "     DHANASHREE AGRIPULSE - DEPLOYMENT PIPELINE" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

# 1. Audit Working Directory
Write-Host "`n[1/5] Auditing git workspace status..." -ForegroundColor Yellow
$status = git status --porcelain
if ($null -eq $status -or $status.Length -eq 0) {
    Write-Host "✓ Workspace is clean. No local modifications detected." -ForegroundColor Green
    $hasChanges = $false
} else {
    Write-Host "Detected local modifications:" -ForegroundColor White
    git status -s
    $hasChanges = $true
}

# 2. Stage & Commit Changes
if ($hasChanges) {
    Write-Host "`n[2/5] Staging and committing changes..." -ForegroundColor Yellow
    Write-Host "Staging files (git add .)..." -ForegroundColor Gray
    git add .

    if ([string]::IsNullOrEmpty($CommitMessage)) {
        # Prompt for commit message
        Write-Host "Enter commit message (or press Enter for default 'Feature update: $(Get-Date -Format 'yyyy-MM-dd HH:mm')'): " -NoNewline -ForegroundColor White
        $inputMsg = Read-Host
        if ([string]::IsNullOrEmpty($inputMsg)) {
            $CommitMessage = "Feature update: $(Get-Date -Format 'yyyy-MM-dd HH:mm')"
        } else {
            $CommitMessage = $inputMsg
        }
    }

    Write-Host "Committing with message: '$CommitMessage'..." -ForegroundColor Gray
    git commit -m $CommitMessage
    Write-Host "✓ Commit completed successfully." -ForegroundColor Green
} else {
    Write-Host "`n[2/5] Skipping commit (no changes to commit)." -ForegroundColor Gray
}

# 3. Push to GitHub
Write-Host "`n[3/5] Pushing changes to GitHub (origin main)..." -ForegroundColor Yellow
$gitBranch = git branch --show-current
if ($gitBranch -ne "main") {
    Write-Host "Local branch is '$gitBranch'. Renaming local branch to 'main' to match remote track..." -ForegroundColor Gray
    git branch -m $gitBranch main
}

# Run git push and capture status
$pushResult = git push origin main 2>&1
$pushSuccess = $?

if (-not $pushSuccess -or $pushResult -like "*denied*" -or $pushResult -like "*error: 403*" -or $pushResult -like "*fatal:*") {
    Write-Host "`n──────────────────────────────────────────────────" -ForegroundColor Red
    Write-Host "⚠️  WARNING: GITHUB PUSH AUTHENTICATION CONFLICT" -ForegroundColor Red
    Write-Host "──────────────────────────────────────────────────" -ForegroundColor Red
    Write-Host "The background push failed. This is because your system's Git Credential Manager" -ForegroundColor White
    Write-Host "is using cached credentials for another account (e.g., mdamodare-debug)." -ForegroundColor White
    Write-Host "Since this script is running, Windows cannot display the interactive sign-in popup.`n" -ForegroundColor White
    Write-Host "👉 ACTION REQUIRED:" -ForegroundColor Yellow
    Write-Host "Please open a new PowerShell window or VS Code Terminal on your system and run:" -ForegroundColor Cyan
    Write-Host "   git push origin main" -ForegroundColor Green
    Write-Host "`nThis will trigger the Windows Git Credential Manager popup. Sign in with your" -ForegroundColor White
    Write-Host "correct GitHub account (dhanashreeagro-salesapp or authorized account)." -ForegroundColor White
    Write-Host "Once you authenticate once, all subsequent pushes will succeed automatically!`n" -ForegroundColor White
    
    Write-Host "Do you want to proceed with Vercel Deployment anyway using local changes? (y/N): " -NoNewline -ForegroundColor Yellow
    $ans = Read-Host
    if ($ans -ne "y" -and $ans -ne "Y") {
        Write-Host "`nDeployment aborted by user. Please fix GitHub authentication and try again." -ForegroundColor Red
        Exit 1
    }
} else {
    Write-Host "✓ Successfully pushed changes to GitHub (origin main)." -ForegroundColor Green
}

# 4. Force Rebuild and Deploy to Vercel
Write-Host "`n[4/5] Triggering forced production deployment on Vercel..." -ForegroundColor Yellow
Write-Host "Bypassing build cache to ensure fresh assets and instant UI rollout..." -ForegroundColor Gray

# Run vercel deploy with prod and force options
npx vercel --prod --force --yes

if ($?) {
    Write-Host "`n✓ Forced production deployment succeeded on Vercel!" -ForegroundColor Green
} else {
    Write-Host "`n❌ Vercel deployment failed. Please check build logs above." -ForegroundColor Red
    Exit 1
}

# 5. Post-Deployment Validation
Write-Host "`n[5/5] Post-Deployment Validation Information:" -ForegroundColor Yellow
$currentHash = git rev-parse --short HEAD
Write-Host "--------------------------------------------------" -ForegroundColor Cyan
Write-Host "  Build Version (Commit Hash) : $currentHash" -ForegroundColor White
Write-Host "  Live Production URL         : https://salesapp-blue.vercel.app" -ForegroundColor Green
Write-Host "  Vercel Dashboard            : https://vercel.com" -ForegroundColor Gray
Write-Host "--------------------------------------------------" -ForegroundColor Cyan
Write-Host "`nVerify that the App footer displays 'Build Version: $currentHash' to confirm the deployment is live.`n" -ForegroundColor Gray
Write-Host "🎉 PIPELINE RUN COMPLETED SUCCESSFULLY!" -ForegroundColor Green -BackgroundColor Black
