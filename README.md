# 🕵️‍♂️ OSINT Extension — Chrome extension for quick reconnaissance

**OSINT Extension** is a compact Google Chrome extension that helps security researchers and investigators quickly open a collection of OSINT tools and targeted searches for a given domain or hostname.

It provides:  

✔️ Popup GUI

✔️ Context menu integration

✔️ Automated **AlienVault OTX job runner**

✔️ Background tab automation with pause/resume controls

---

<img width="873" height="706" alt="image" src="https://github.com/user-attachments/assets/3c0b4668-c363-4a6f-afd9-851e9608e802" />
<img width="875" height="738" alt="image" src="https://github.com/user-attachments/assets/8f1fa7a2-3d3f-4936-82b0-260441e0d1f4" />
<img width="866" height="735" alt="image" src="https://github.com/user-attachments/assets/304e72cb-f1cc-4c80-92b9-cb4031447095" />
<img width="871" height="354" alt="image" src="https://github.com/user-attachments/assets/e829ec73-07e4-4973-be21-caa1f979623b" />

---

## ⭐ Key Features

- 🧩 **Popup UI** for tools (search engines, archives, cert lookups, Shodan, LeakIX, GitHub dorks, etc.)
- 🖱️ **Context menu entries** to run tools on a page, selected text, or links.
- 📚 **Open All** groups to sequentially open multiple tools with safe delays.
- 🛰️ **OTX Job Runner**:
  - Opens paged OTX endpoints one-by-one in background tabs.
  - Tracks job progress, next page, and tab groups.
  - Global in-page overlay to stop/resume jobs.
- 🔒 **Lightweight & privacy-friendly:** No servers — everything runs locally in your browser.

---
**interesting default keywords used for github:**
```
defaultKeywords = [
        "Password",
        "DB_PASSWORD",
        "DB_PASS",
        "Secret",
        "Secret_Key",
        "SecretKey",
        "Client_Secret",
        "SecretAccessKey",
        "Secret_Access_Key",
        "Credentials",
        "Token",
        "ApiToken",
        "Api_Token",
        "ApiKey",
        "Api_Key",
        "Auth_Token",
        "AuthToken",
        "Access_Token",
        "AccessToken",
      ]
```
---
**interesting default dorks used for github:**

🎯 High-Confidence Scoped Exposure
```
/[a-zA-Z0-9-]+:\/\/(?:[a-zA-Z0-9-]+\.){2,}${domain}/
/@(?:[a-zA-Z0-9-]+\.){2,}${SLD}\./
/@(?:[a-zA-Z0-9-]+\.){2,}${domain}/
/@(?:[a-zA-Z0-9-]+\.){2,}${domain}/ AND PATH:.env
org:${SLD}
```
🔑 Keyword-Style Secret Patterns
```
/[$#^]?${keyword}[[:space:]]*[:=]?[[:space:]]*['"][A-Za-z0-9_$#^\-@._]*['"]
```
🌐 Core Subdomain & URL Discovery
```
/@(?:[a-zA-Z0-9-]+\.){2,}${SLD}\./
/@(?:[a-zA-Z0-9-]+\.){2,}${domain}/
/[a-zA-Z0-9-]+:\/\/(?:[a-zA-Z0-9-]+\.){2,}${SLD}\./
/[a-zA-Z0-9-]+:\/\/(?:[a-zA-Z0-9-]+\.){2,}${domain}/
```
☁️ Cloud Credentials & Secrets
```
/gserviceaccount.com/ AND /BEGIN PRIVATE KEY/ NOT /@project.iam.gserviceaccount.com/ NOT /your-client-email-here/ NOT /your-service-account/ NOT /@yourproject/
```
🔐 Identity & Auth Providers
```
/(?:[a-zA-Z0-9-]+\.){2,}auth0\.(?:[a-zA-Z0-9-]+\.)*/
/(?:[a-zA-Z0-9-]+\.){2,}okta\.(?:[a-zA-Z0-9-]+\.)*/
/(?:[a-zA-Z0-9-]+\.){2,}onelogin\.(?:[a-zA-Z0-9-]+\.)*/
```
🏢 Enterprise Apps (Confluence · SAP · Looker)
```
/confluence[a-zA-Z0-9-]*\.(?:[a-zA-Z0-9-]+\.){2,}${SLD}\./
/confluence[a-zA-Z0-9-]*\.(?:[a-zA-Z0-9-]+\.){2,}${domain}/
/:sap:\/\/(?:[a-zA-Z0-9-]+\.){2,}${SLD}\./
/:sap:\/\/(?:[a-zA-Z0-9-]+\.){2,}${domain}/
/(?:[a-zA-Z0-9-]+\.){2,}looker\.(?:[a-zA-Z0-9-]+\.)*/
```
⚙️ CI/CD & DevOps Platforms
```
/jenkins\.(?:[a-zA-Z0-9-]+\.){2,}${SLD}\./
/jfrog\.(?:[a-zA-Z0-9-]+\.){2,}${SLD}\./
/gitlab\.(?:[a-zA-Z0-9-]+\.){2,}${SLD}\./
/github\.(?:[a-zA-Z0-9-]+\.){2,}${SLD}\./
/jenkins\.(?:[a-zA-Z0-9-]+\.){2,}${domain}/
/jfrog\.(?:[a-zA-Z0-9-]+\.){2,}${domain}/
/gitlab\.(?:[a-zA-Z0-9-]+\.){2,}${domain}/
/github\.(?:[a-zA-Z0-9-]+\.){2,}${domain}/
```

🗄️ Database & Backend Connection Strings
```
/jdbc:[a-zA-Z0-9-]+:[a-zA-Z0-9-]+:(?:[a-zA-Z0-9-]+\.){2,}${SLD}\./
/jdbc:[a-zA-Z0-9-]+:[a-zA-Z0-9-]+:(?:[a-zA-Z0-9-]+\.){2,}${domain}/
/jdbc:[a-zA-Z0-9-]+:\/\/(?:[a-zA-Z0-9-]+\.){2,}${SLD}\./
/jdbc:[a-zA-Z0-9-]+:\/\/(?:[a-zA-Z0-9-]+\.){2,}${domain}/
/jdbc:[a-zA-Z0-9-]+:[a-zA-Z0-9-]+:\@\/\/(?:[a-zA-Z0-9-]+\.){2,}${SLD}\./
/jdbc:[a-zA-Z0-9-]+:[a-zA-Z0-9-]+:\@(?:[a-zA-Z0-9-]+\.){2,}${SLD}\./
/jdbc:[a-zA-Z0-9-]+:[a-zA-Z0-9-]+:\@\/\/(?:[a-zA-Z0-9-]+\.){2,}${domain}/
/jdbc:[a-zA-Z0-9-]+:[a-zA-Z0-9-]+:\@(?:[a-zA-Z0-9-]+\.){2,}${domain}/
/odbc:[a-zA-Z0-9-]+:\/\/(?:[a-zA-Z0-9-]+\.){2,}${SLD}\./
/mongodb:\/\/(?:[a-zA-Z0-9-]+\.){2,}${SLD}\./
/redis:\/\/(?:[a-zA-Z0-9-]+\.){2,}${SLD}\./
/couchbase:\/\/(?:[a-zA-Z0-9-]+\.){2,}${SLD}\./
```
🧩 ServiceNow Infrastructure
```
/${SLD}(?:[a-zA-Z0-9-]+\.)+service-now\.com/
/${SLD}(?:[a-zA-Z0-9-]+\.)+servicenow\.com/
/${SLD}(?:[a-zA-Z0-9-]+\.){2,}service-now\.com/
/${SLD}(?:[a-zA-Z0-9-]+\.){2,}servicenow\.com/
/servicenow\.(?:[a-zA-Z0-9-]+\.){2,}${SLD}\./
/service-now\.(?:[a-zA-Z0-9-]+\.){2,}${SLD}\./
/servicenow\.(?:[a-zA-Z0-9-]+\.){2,}${domain}/
/service-now\.(?:[a-zA-Z0-9-]+\.){2,}${domain}/
```
---

## 🛠️ Installation (Developer / Local)

1. 📥 Clone or download this repository  
2. 🌐 Open `chrome://extensions/`  
3. 🔧 Enable **Developer Mode**  
4. 📂 Click **Load unpacked** and select the extension folder  
5. 📌 Pin the extension for quick access  

**Windows example:**  
Choose the folder `C:\Users\<you>\Downloads\OSINT-Extension` when loading.

> ⚠️ Configure your VirusTotal API key before loading
>
> This extension uses the VirusTotal API Key for some lookups. Before you load the unpacked extension, set your private VirusTotal API key in the source files:
>
> - Open `background.js` and `content.js` by any editor.
> - Search for the (apikey=) and replace the placeholder/apikey value with your own API key.
>  
---

## 🚀 Usage

### 🔳 Popup UI

- Click the extension icon  
- Hostname is auto-filled from current tab  
- Enter or adjust the target domain  
- Click a tool button to open in a background tab  
- Use **Open All** for grouped tools  
- GitHub dork groups include multiple deep-search templates

---

### 🖱️ Context Menu

Right-click on:
- a page  
- selected text  
- a link  

Then choose:  
**🔍 OSINT Extension → [Tool]**

The extension extracts the hostname automatically.

---

### 🧪 AlienVault OTX Jobs

- Launch OTX jobs from the popup  
- Opens paged JSON endpoints every **5 seconds**  
- Popup shows active/paused jobs  
- Global overlay allows pausing/resuming from any page  
- Stop all or resume all jobs from the popup or overlay

#### 📌 Notes about OTX behavior
- The extension does **not** parse OTX results — it only opens API pages  
- Simple heuristics detect when there's no next page  
- Groups opened tabs for easier management

---

## 📁 Files of Interest

- 📄 `manifest.json` — Extension manifest (MV3)  
- 🪟 `popup.html`, `popup.js` — Popup UI  
- 🧩 `content.js` — Domain extraction + OTX overlay  
- 🎛️ `background.js` — Context menus + OTX automation  
- 🖼️ `icons/*` — All icons used by the extension  

---

## 🔐 Privacy & Security

- Only opens **public OSINT tools and APIs**  
- No server communication, no data collection  
- Use responsibly and within legal boundaries

---

## 🤝 Contributing

- Issues and PRs welcome
---

- Provided for educational and legitimate security research  
