# Firefox Google Drive OAuth Setup Guide

## Problem: Firefox Shows "Alizom" Instead of "Ranobe Gemini"

When logging into Google Drive in Firefox, you may see:
- **Edge/Chrome**: "Login to Ranobe Gemini"
- **Firefox**: "Login to Alizom" or another name

This is **not a bug** — it's how Firefox handles OAuth redirect URIs for extensions.

## Why This Happens

Firefox uses a special domain format for extension OAuth requests:
- **Firefox**: `https://alizomcf6xpjzb6r67ojzddh3dv53vvb.extensions.allizom.org/` (or similar)
- **Edge/Chrome**: `https://[extension-id].chromiumapp.org/`

The domain changes the presentation in Google's OAuth login, but **the functionality is identical** and **fully secure**.

## How to Set Up Firefox

### Step 1: Get Your Firefox Redirect URI
1. Open **Library Settings** (☁️ Backups tab)
2. Look for "Redirect URI" under Google Drive setup
3. **Copy** the Firefox redirect URI (it will look like `https://alizomXXXXX.extensions.allizom.org/`)

### Step 2: Add to Google Cloud Console
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your **Ranobe Gemini** project
3. Go to **APIs & Services** → **Credentials**
4. Find your OAuth 2.0 Client ID (type: "Web application")
5. Click **Edit**
6. Under **Authorized redirect URIs**, add:
   - Your Firefox redirect URI (from Step 1)
   - Your Edge/Chrome redirect URI (if using both browsers)
   - Example format:
     ```
     https://alizomcf6xpjzb6r67ojzddh3dv53vvb.extensions.allizom.org/
     https://magcpgkibkbmcbicndoeheogkkohknib.chromiumapp.org/
     ```
7. **Save**

### Step 3: Test
1. Go back to **Library Settings** → **Backups** tab
2. Click **Connect Google Drive**
3. You should see the Firefox extension login screen
4. After authorization, the connection should work normally

## Troubleshooting

### "Still seeing Alizom, not Ranobe Gemini"
- **This is normal for Firefox.** It's a browser limitation, not an error.
- As long as you see the authentic Google login screen, you're safe to proceed.

### "Connection failed: Redirect URI mismatch"
1. Copy the exact redirect URI shown in Library Settings
2. Verify it's registered exactly in Google Cloud Console (spaces, slashes, everything)
3. After saving in Console, wait 1-2 minutes for propagation
4. Try connecting again

### "Works in Edge but not Firefox"
1. Make sure the **Firefox-specific** redirect URI is added to Google Cloud Console
2. The Firefox URI must be different from the Edge/Chrome URI
3. Add **both** if you're using multiple browsers

### "Revoked Access" banner appears
If you see a red banner saying your Google Drive access was revoked:
1. Click **🔐 Reconnect Google Drive**
2. Complete the OAuth flow again
3. This usually happens if:
   - You revoked access in [Google Account Settings](https://myaccount.google.com/security)
   - Too many failed token refreshes
   - Token was manually revoked via Google API

## Browser Differences

| Feature             | Edge                | Chrome              | Firefox                    |
| ------------------- | ------------------- | ------------------- | -------------------------- |
| OAuth Login Screen  | "Ranobe Gemini"     | "Ranobe Gemini"     | "Alizom" or similar        |
| Functionality       | ✅ Full              | ✅ Full              | ✅ Full                     |
| Redirect URI Format | `/chromiumapp.org/` | `/chromiumapp.org/` | `/extensions.allizom.org/` |
| Security            | 🔒 Secure            | 🔒 Secure            | 🔒 Secure                   |

## Key Takeaway

**The Firefox "Alizom" text is cosmetic and expected.** What matters is:
1. ✅ The redirect URI is registered in Google Cloud
2. ✅ You see a real Google login screen
3. ✅ The connection succeeds after login

Don't be alarmed by the different name — it's just how Firefox presents extension OAuth flows.
