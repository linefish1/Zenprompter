# Mobile App Build Instructions

This project has been configured to build both Android and iOS apps using Capacitor. Here's how to use the setup:

## Current Status

✅ Capacitor has been installed and configured
✅ Android platform has been added
✅ iOS platform has been added
✅ GitHub Actions workflow has been created for automatic builds
⚠️ Web build has some configuration issues that need to be resolved

## How to Fix the Web Build Issue

The current web build is failing due to a Vite configuration issue with CSS processing. Here are the steps to fix it:

1. **Check the error**: The build is failing with `Could not load index.html?html-proxy&inline-css&index=0.css`

2. **Possible solutions**:
   - Remove any CSS-related plugins from `vite.config.ts`
   - Ensure all CSS files referenced in `index.html` exist
   - Try running `npm run build` with `--debug` flag for more details

3. **Quick fix attempt**:
   ```bash
   rm -rf node_modules/.vite
   npm install
   npm run build
   ```

## How to Build and Test Locally

Once the web build is working:

1. Build the web app:
   ```bash
   npm run build
   ```

2. Sync with Capacitor:
   ```bash
   npx cap sync
   ```

3. Open Android project:
   ```bash
   npx cap open android
   ```

4. Open iOS project:
   ```bash
   npx cap open ios
   ```

## GitHub Actions Workflow

The workflow `.github/workflows/build-and-deploy.yml` will automatically:

1. Build the web app
2. Build Android APK and create a GitHub Release
3. Build iOS IPA and create a GitHub Release

This workflow triggers on pushes to the `main` branch.

## Automatic Updates

The workflow includes automatic versioning using GitHub run numbers and creates releases for each successful build. You can configure your mobile apps to check for new releases using the GitHub API.

## Next Steps

1. Fix the web build configuration issue
2. Test the Capacitor sync locally
3. Push to GitHub to trigger the automatic build workflow
4. Configure your mobile apps to check for updates from GitHub Releases