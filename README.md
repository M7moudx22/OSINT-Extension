# 🕵️‍♂️ OSINT Extension — Chrome extension for quick reconnaissance

**OSINT Extension** is a compact Google Chrome extension that helps security researchers and investigators quickly open a collection of OSINT tools and targeted searches for a given domain or hostname.

It provides:  

✔️ Popup GUI

✔️ Context menu integration

✔️ Automated **AlienVault OTX job runner**

✔️ Background tab automation with pause/resume controls

---

<img width="873" height="706" alt="image" src="https://github.com/user-attachments/assets/3c0b4668-c363-4a6f-afd9-851e9608e802" />
<img width="873" height="737" alt="image" src="https://github.com/user-attachments/assets/9320e760-7207-43e5-ab9b-4e0529120fd3" />
<img width="858" height="765" alt="image" src="https://github.com/user-attachments/assets/1ad22b25-c225-4b23-acef-50f478ca4745" />

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
