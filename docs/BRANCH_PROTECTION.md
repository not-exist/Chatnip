# Branch Protection Rules

## Overview
This document explains how to configure GitHub branch protection to require CI checks to pass before merging pull requests.

## Prerequisites
- Repository admin access
- At least one successful CI run on the `master` branch (to populate check names)

## Step-by-Step Setup

### 1. Navigate to Branch Protection Settings
Go to: **Settings → Branches → Add branch protection rule**

### 2. Configure Branch Name Pattern
Enter: `master`

### 3. Required Settings
- [x] **Require a pull request before merging**
  - [x] Require approvals: `1`
- [x] **Require status checks to pass before merging**
  - [x] Require branches to be up to date before merging
  - Search for and select these checks:
    - `lint`
    - `typecheck-and-build`
    - `test`
- [x] **Require conversation resolution before merging**

### 4. Optional (Recommended)
- [x] **Do not allow bypassing the above settings**
- [x] **Require signed commits** (if using commit signing)

### 5. Save Changes
Click "Create" or "Save changes" at the bottom.

## Verification
1. Create a test PR with a failing check
2. Confirm the "Merge" button is disabled
3. Fix the issue and confirm "Merge" becomes available

## CI Checks Reference
| Check Name | Description | Source |
|------------|-------------|--------|
| `lint` | ESLint code quality check | `.github/workflows/ci.yml` |
| `typecheck-and-build` | TypeScript type checking + Vite production build | `.github/workflows/ci.yml` |
| `test` | Vitest test suite | `.github/workflows/ci.yml` |

## Troubleshooting
- **"No status checks found"**: Run CI at least once on the master branch first
- **"Merge button still enabled"**: Verify all checkboxes in the branch protection rule are saved
- **"Required check not appearing"**: The check name must match exactly what appears in CI results (case-sensitive)
