document.addEventListener("DOMContentLoaded", function () {
  const urlInput = document.getElementById("urlInput");
  const keywordsInput = document.getElementById("keywordsInput");
  const keywordsInputContainer = document.getElementById("keywordsInputContainer");
  const toggleInputBtn = document.getElementById("toggleInputBtn");
  const uploadKeywordsBtn = document.getElementById("uploadKeywordsBtn");
  const keywordsFileInput = document.getElementById("keywordsFile");
  const resetKeywordsBtn = document.getElementById("resetKeywordsBtn");
  const keywordsStatus = document.getElementById("keywordsStatus");
  const notFiltersCheckbox = document.getElementById("notFiltersCheckbox");
  const notFiltersStatus = document.getElementById("notFiltersStatus");

  // Get current tab URL
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0] && tabs[0].url) {
      const url = new URL(tabs[0].url);
      urlInput.value = url.hostname;
    }
  });

  // Load current keywords and NOT_FILTERS setting
  loadKeywordsStatus();
  loadNotFiltersStatus();

  // Toggle keywords input visibility
  toggleInputBtn.addEventListener("click", function () {
    keywordsInputContainer.classList.toggle("collapsed");
    toggleInputBtn.textContent = keywordsInputContainer.classList.contains("collapsed") ? "▼" : "▲";
    
    if (!keywordsInputContainer.classList.contains("collapsed")) {
      keywordsInput.focus();
    }
  });

  // Handle NOT_FILTERS checkbox
  notFiltersCheckbox.addEventListener("change", function() {
    const enabled = this.checked;
    chrome.runtime.sendMessage({ 
      action: "toggleNotFilters", 
      enabled: enabled 
    }, (response) => {
      if (response && response.ok) {
        loadNotFiltersStatus();
      }
    });
  });

  // Handle file upload
  uploadKeywordsBtn.addEventListener("click", () => {
    keywordsFileInput.click();
  });

  keywordsFileInput.addEventListener("change", function(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(event) {
      try {
        const content = event.target.result;
        let keywords = [];
        
        // Try to parse as JSON first
        try {
          const parsed = JSON.parse(content);
          if (Array.isArray(parsed)) {
            keywords = parsed;
          } else if (typeof parsed === 'object') {
            // If it's an object with a keywords array
            keywords = parsed.keywords || Object.values(parsed).filter(v => typeof v === 'string');
          }
        } catch {
          // If not JSON, parse as text (one per line or comma-separated)
          keywords = content.split(/[\n,]/)
            .map(k => k.trim())
            .filter(k => k.length > 0);
        }
        
        if (keywords.length > 0) {
          updateKeywords(keywords);
          keywordsFileInput.value = ''; // Reset file input
        } else {
          alert("No valid keywords found in file");
        }
      } catch (error) {
        alert("Error reading file: " + error.message);
      }
    };
    reader.readAsText(file);
  });

  // Handle manual keywords input
  keywordsInput.addEventListener("blur", function() {
    const text = keywordsInput.value.trim();
    if (text) {
      const keywords = text.split(/[\n,]/)
        .map(k => k.trim())
        .filter(k => k.length > 0);
      if (keywords.length > 0) {
        updateKeywords(keywords);
      }
    }
  });

  // Handle reset keywords
  resetKeywordsBtn.addEventListener("click", function() {
    if (confirm("Reset to default keywords?")) {
      chrome.runtime.sendMessage({ action: "resetKeywords" }, (response) => {
        if (response && response.ok) {
          keywordsInput.value = '';
          loadKeywordsStatus();
        }
      });
    }
  });

  function updateKeywords(keywords) {
    chrome.runtime.sendMessage({ 
      action: "uploadKeywords", 
      keywords: keywords 
    }, (response) => {
      if (response && response.ok) {
        loadKeywordsStatus();
      } else {
        alert("Failed to update keywords: " + (response.error || "Unknown error"));
      }
    });
  }

  function loadKeywordsStatus() {
    chrome.runtime.sendMessage({ action: "getKeywords" }, (response) => {
      if (response && response.ok) {
        const count = response.keywords.length;
        if (response.isCustom) {
          keywordsStatus.textContent = `Using custom keywords (${count}) - Each will open separate tab`;
          keywordsStatus.classList.add("custom");
        } else {
          keywordsStatus.textContent = `Using default keywords (${count}) - Each will open separate tab`;
          keywordsStatus.classList.remove("custom");
        }
      }
    });
  }

  function loadNotFiltersStatus() {
    chrome.runtime.sendMessage({ action: "getNotFilters" }, (response) => {
      if (response && response.ok) {
        notFiltersCheckbox.checked = response.enabled;
        notFiltersStatus.textContent = `NOT filters: ${response.enabled ? 'Enabled' : 'Disabled'}`;
        notFiltersStatus.style.color = response.enabled ? 'var(--success)' : 'var(--warning)';
      }
    });
  }

  // Handle all action buttons
  document.querySelectorAll(".btn[data-action]").forEach((btn) => {
    btn.addEventListener("click", function () {
      const action = this.getAttribute("data-action");
      let text = urlInput.value.trim();

      if (!text) {
        alert("Please enter a URL or domain");
        return;
      }

      console.log(`[OSINT] Executing action: ${action} with text: ${text}`);

      // Send message to background script
      chrome.runtime.sendMessage(
        {
          action: "executeAction",
          type: action,
          text: text
        },
        (response) => {
          if (chrome.runtime.lastError) {
            console.error("[OSINT] Error:", chrome.runtime.lastError);
          }
          if (response && response.ok) {
            console.log(`[OSINT] Action executed: ${action}`);
          }
        }
      );
    });
  });

  // Handle Open All buttons for regular groups
  document.querySelectorAll(".open-all-btn").forEach((btn) => {
    btn.addEventListener("click", function (e) {
      e.preventDefault();
      const groupId = this.getAttribute("data-group");
      let text = urlInput.value.trim();

      if (!text) {
        alert("Please enter a URL or domain");
        return;
      }

      // Get all buttons in this group
      const groupButtons = document.querySelectorAll(
        `.section .grid[data-group="${groupId}"] .btn[data-action]`
      );

      if (groupButtons.length === 0) {
        console.warn(`[OSINT] No buttons found for group: ${groupId}`);
        return;
      }

      console.log(`[OSINT] Opening ${groupButtons.length} tools in group: ${groupId}`);

      // Execute each action
      groupButtons.forEach((button, index) => {
        const action = button.getAttribute("data-action");
        setTimeout(() => {
          chrome.runtime.sendMessage(
            {
              action: "executeAction",
              type: action,
              text: text
            },
            (response) => {
              if (chrome.runtime.lastError) {
                console.error("[OSINT] Error:", chrome.runtime.lastError);
              }
              if (response && response.ok) {
                console.log(`[OSINT] Action executed: ${action}`);
              }
            }
          );
        }, index * 300);
      });
    });
  });

  // Handle Open All buttons for dork sub-groups
  document.querySelectorAll(".dork-open-all-btn").forEach((btn) => {
    btn.addEventListener("click", function (e) {
      e.preventDefault();
      const groupId = this.getAttribute("data-group");
      let text = urlInput.value.trim();

      if (!text) {
        alert("Please enter a URL or domain");
        return;
      }

      // Get all buttons in this dork group
      const groupButtons = document.querySelectorAll(
        `.dork-category .dork-grid[data-group="${groupId}"] .btn[data-action]`
      );

      if (groupButtons.length === 0) {
        console.warn(`[OSINT] No buttons found for dork group: ${groupId}`);
        return;
      }

      console.log(`[OSINT] Opening ${groupButtons.length} tools in dork group: ${groupId}`);

      // Execute each action
      groupButtons.forEach((button, index) => {
        const action = button.getAttribute("data-action");
        setTimeout(() => {
          chrome.runtime.sendMessage(
            {
              action: "executeAction",
              type: action,
              text: text
            },
            (response) => {
              if (chrome.runtime.lastError) {
                console.error("[OSINT] Error:", chrome.runtime.lastError);
              }
              if (response && response.ok) {
                console.log(`[OSINT] Action executed: ${action}`);
              }
            }
          );
        }, index * 300);
      });
    });
  });

  // Link handlers
  document.getElementById("openGithub").addEventListener("click", (e) => {
    e.preventDefault();
    chrome.tabs.create({
      url: "https://github.com/M7moudx22/OSINT-Extension"
    });
  });

  document.getElementById("openIssues").addEventListener("click", (e) => {
    e.preventDefault();
    chrome.tabs.create({
      url: "https://github.com/M7moudx22/OSINT-Extension/issues"
    });
  });

  document.getElementById("openWiki").addEventListener("click", (e) => {
    e.preventDefault();
    chrome.tabs.create({
      url: "https://github.com/M7moudx22/OSINT-Extension/wiki"
    });
  });

  // OTX jobs UI
  const otxJobsContainer = document.getElementById("otxJobs");

  function refreshOTXJobs() {
    chrome.runtime.sendMessage({ action: "otx_list" }, (resp) => {
      if (chrome.runtime.lastError) return;
      if (!resp || !resp.ok || !resp.jobs) {
        otxJobsContainer.innerHTML = "<em>No active jobs</em>";
        return;
      }
      const jobs = resp.jobs;
      const keys = Object.keys(jobs);
      if (!keys.length) {
        otxJobsContainer.innerHTML = "<em>No active jobs</em>";
        return;
      }
      otxJobsContainer.innerHTML = "";
      keys.forEach((jobId) => {
        const j = jobs[jobId];
        const div = document.createElement("div");
        div.className = "otx-job";
        const left = document.createElement("div");
        left.textContent = `${jobId} (next:${j.nextPage})`;
        const right = document.createElement("div");
        const stopBtn = document.createElement("button");
        stopBtn.textContent = "Stop";
        stopBtn.addEventListener("click", () => {
          chrome.runtime.sendMessage({ action: "otx_stop", jobId }, (r) => {
            refreshOTXJobs();
          });
        });
        right.appendChild(stopBtn);
        div.appendChild(left);
        div.appendChild(right);
        otxJobsContainer.appendChild(div);
      });
    });
  }

  // refresh periodically and on open
  refreshOTXJobs();
  const otxInterval = setInterval(refreshOTXJobs, 2000);

  // also listen for background broadcasts (immediate update when jobs stop)
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg && msg.action === "otx_update") {
      refreshOTXJobs();
    }
    if (msg && msg.action === "keywords_updated") {
      loadKeywordsStatus();
    }
    if (msg && msg.action === "not_filters_updated") {
      loadNotFiltersStatus();
    }
  });

  // clear interval when popup unloads
  window.addEventListener("unload", () => {
    clearInterval(otxInterval);
  });
});