Using your landing page as the auth proxy is a great architectural choice. Here is the comprehensive Markdown documentation outlining the modular system. It focuses strictly on the proxy flow and the abstract provider pattern to ensure future-proofing for other services.

---

# Modular Extension Synchronization Architecture

## 1. System Overview

This document outlines the architecture for a modular, cross-browser extension synchronization system. The design decouples the core extension logic from the specific storage backend, allowing the system to use a default provider (e.g., Google Drive) while giving users the flexibility to plug in custom solutions like Dropbox, WebDAV, or personal servers.

## 2. The Landing Page Auth Proxy (Mobile & Cross-Browser Support)

To bypass the limitations of mobile browsers (such as Edge for Android) struggling with native `launchWebAuthFlow`, the authentication relies on a web-based proxy hosted on the project's landing/introduction page.

### **The Authentication Flow**

1. **Initiation:** The extension opens a new tab directed to the chosen provider's OAuth 2.0 authorization URL.
2. **Redirect:** Upon successful login, the provider redirects the user back to the project's landing page (e.g., `[https://yourdomain.com/auth-success#access_token=XYZ](https://yourdomain.com/auth-success#access_token=XYZ)`).
3. **Token Capture & Transmission:** A lightweight script on the landing page parses the URL fragment, extracts the access token, and passes it securely back to the extension using `chrome.runtime.sendMessage`.
4. **Cleanup:** The landing page script automatically closes the authentication tab.

**Proxy Implementation (Landing Page script):**

```javascript
// auth-handler.js on your landing page
document.addEventListener("DOMContentLoaded", () => {
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);
    const accessToken = params.get('access_token');
    const provider = params.get('state'); // Useful for identifying the provider

    if (accessToken) {
        // The extension ID should be dynamic or whitelisted based on the environment
        const extensionId = "YOUR_EXTENSION_ID";

        chrome.runtime.sendMessage(extensionId, {
            action: "AUTH_SUCCESS",
            provider: provider,
            token: accessToken
        }, (response) => {
             window.close();
        });
    }
});

```

---

## 3. The Modular Provider Interface

To allow users to switch storage backends, all network calls to external APIs must pass through a standardized interface. The extension will not call Google Drive or WebDAV directly; it will call the `StorageProvider` class.

### **Abstract Interface Structure**

Every storage module must implement the following core methods:

* `authenticate()`: Triggers the proxy auth flow or prompts the user for credentials.
* `pushData(jsonPayload)`: Uploads the localized extension data to the remote server.
* `pullData()`: Retrieves the remote JSON data to update the local extension.
* `getProviderName()`: Returns the string identifier (e.g., `"GoogleDrive"`, `"WebDAV"`).

**Example Provider Wrapper:**

```javascript
class StorageProvider {
    constructor(config) {
        this.config = config;
        this.token = null;
    }

    async authenticate() { throw new Error("Not implemented"); }
    async pushData(data) { throw new Error("Not implemented"); }
    async pullData() { throw new Error("Not implemented"); }
}

```

---

## 4. Implementing Custom Providers

Because the core logic relies on the `StorageProvider` interface, adding new platforms requires zero changes to the extension's internal UI or sync triggers.

### **A. Google Drive (Default)**

* **Auth:** OAuth 2.0 via Landing Page Proxy.
* **API:** Uses Google Drive REST API (`/drive/v3/files`) pointing to the `appDataFolder`.
* **Data Format:** Raw JSON file execution.

### **B. Dropbox (Future Module)**

* **Auth:** OAuth 2.0 via Landing Page Proxy (using Dropbox's implicit grant flow).
* **API:** Uses Dropbox API (`/2/files/upload` and `/2/files/download`).
* **Configuration:** Users select "Dropbox" in the extension settings; the system instantiates `new DropboxProvider()`.

### **C. WebDAV / Nextcloud (User-Configured)**

* **Auth:** Basic Authentication (Username + App Password). No OAuth proxy required.
* **API:** Standard HTTP `PUT` and `GET` requests to a user-defined URL.
* **Configuration:**
1. User selects "WebDAV" in settings.
2. User inputs their Server URL, Username, and App Password.
3. The extension stores these credentials locally in `chrome.storage.local` and instantiates `new WebDAVProvider(credentials)`.



## 5. Storage State Management

To prevent infinite loops and rate-limiting, the synchronization manager should employ conflict resolution:

* **Timestamping:** Embed a `lastModified` timestamp inside the JSON payload.
* **Diff Checking:** Before calling `pushData()`, compare the local JSON hash against the last known remote hash. Only upload if changes exist.
