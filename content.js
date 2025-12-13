// --- Utility: extract all domains/subdomains from any text ---
function extractDomainsFromText(text) {
  // Regex matches domains/subdomains with optional http/https/www
  const regex = /(?:https?:\/\/)?(?:www\.)?([A-Za-z0-9.-]+\.[A-Za-z]{2,})/g;
  const matches = [];
  let match;
  while ((match = regex.exec(text)) !== null) {
    matches.push(match[1]); // match[1] is the domain/subdomain
  }
  return matches;
}

// --- Main handler function ---
function handleInsertFromSelection(text, useFullFilters, apiType) {
  const domains = extractDomainsFromText(text);
  if (!domains.length) return;

  domains.forEach((subdomain) => {
    let newURL = "";

    // compute hostShort for org searches (best-effort)
    const parts = subdomain.split(".");
    const hostShort = parts.length >= 2 ? parts[parts.length - 2] : parts[0];
    const domainOnly = parts.length >= 2 ? parts.slice(-2).join(".") : parts[0];

    // Github dorking patterns
    const domainLower = (domainOnly || subdomain).toLowerCase();

    if (apiType === "otx") {
      const endpoint = useFullFilters
        ? `hostname/${subdomain}/url_list`
        : `domain/${subdomain}/url_list`;
      const pages = [];
      for (let page = 1; page <= 5; page++) {
        pages.push(`https://otx.alienvault.com/api/v1/indicators/${endpoint}?limit=500&page=${page}`);
      }
      // send to background to open in background tabs
      chrome.runtime.sendMessage({ action: "openTabs", urls: pages });
      return;
    }

    // Github dorks - send to background for keyword processing
    if (apiType === "github_org_password" || 
        apiType === "github_regex_password" || 
        apiType === "github_org_secret" || 
        apiType === "github_regex_secret" || 
        apiType === "github_regex_secret2") {
      
      chrome.runtime.sendMessage({ 
        action: "executeKeywordDork", 
        type: apiType, 
        text: text,
        domain: subdomain,
        hostShort: hostShort,
        domainOnly: domainOnly
      });
      return;
    }

    // Shodan: SSL, CN, Org (Ltd/Inc)
    if (apiType === "shodan_ssl") {
      newURL = `https://www.shodan.io/search?query=ssl%3A%22${encodeURIComponent(subdomain)}%22`;
    } else if (apiType === "shodan_ssl.cert.subject.cn") {
      newURL = `https://www.shodan.io/search?query=ssl.cert.subject.CN%3A%22${encodeURIComponent(subdomain)}%22`;
    } else if (apiType === "shodan_org") {
      const orgLtd = `https://www.shodan.io/search?query=org%3A%22${encodeURIComponent(hostShort + " Ltd.")}%22`;
      const orgInc = `https://www.shodan.io/search?query=org%3A%22${encodeURIComponent(hostShort + " Inc.")}%22`;
      chrome.runtime.sendMessage({ action: "openTabs", urls: [orgLtd, orgInc] });
      return;
    } else if (apiType === "wayback") {
      newURL = `https://web.archive.org/web/*/${subdomain}/*`;
    } else if (apiType === "archive") {
      newURL = `https://web.archive.org/cdx/search/cdx?url=*.${subdomain}&fl=original&collapse=urlkey`;
      if (useFullFilters) {
        newURL += `&filter=!mimetype:warc/revisit|text/css|image/jpeg|image/jpg|image/png|image/svg.xml|image/gif|image/tiff|image/webp|image/bmp|image/vnd|image/x-icon|font/ttf|font/woff|font/woff2|font/x-woff2|font/x-woff|font/otf|audio/mpeg|audio/wav|audio/webm|audio/aac|audio/ogg|audio/wav|audio/webm|video/mp4|video/mpeg|video/webm|video/ogg|video/mp2t|video/webm|video/x-msvideo|video/x-flv|application/font-woff|application/font-woff2|application/x-font-woff|application/x-font-woff2|application/vnd.ms-fontobject|application/font-sfnt|application/vnd.android.package-archive|binary/octet-stream|application/octet-stream|application/pdf|application/x-font-ttf|application/x-font-otf|video/webm|video/3gpp|application/font-ttf|audio/mp3|audio/x-wav|image/pjpeg|audio/basic|application/font-otf`;
      }
    } else if (apiType === "bing") {
      newURL = `https://www.bing.com/search?q=site%3A${subdomain}`;
    } else if (apiType === "google") {
      newURL = `https://www.google.com/search?q=site%3A${subdomain}`;
    } else if (apiType === "duckduckgo") {
      newURL = `https://duckduckgo.com/?q=site%3A${subdomain}`;
    } else if (apiType === "yandex") {
      newURL = `https://yandex.com/search/?text=site%3A${subdomain}`;
    } else if (apiType === "urlscan") {
      newURL = `https://urlscan.io/api/v1/search/?q=domain:${subdomain}&size=10000`;
    } else if (apiType === "virustotal") {
      const apiKey = "93e0745ee0d7113aba3e73847ff4de98c247b52531ee65c6aa672087bb350618";
      newURL = `https://www.virustotal.com/vtapi/v2/domain/report?apikey=${apiKey}&domain=${subdomain}`;
    } else if (apiType === "virustotal_ip") {
      // try to detect an IPv4 address in the original text first
      const ipMatch = text.match(/(^|\s)(\d{1,3}(?:\.\d{1,3}){3})($|\s)/);
      const apiKey = "93e0745ee0d7113aba3e73847ff4de98c247b52531ee65c6aa672087bb350618";
      if (ipMatch && ipMatch[2]) {
        const ip = ipMatch[2];
        newURL = `https://www.virustotal.com/vtapi/v2/ip-address/report?apikey=${apiKey}&ip=${ip}`;
      } else if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(subdomain)) {
        // fallback if domain extractor returned an IP-like string
        newURL = `https://www.virustotal.com/vtapi/v2/ip-address/report?apikey=${apiKey}&ip=${subdomain}`;
      } else {
        // no IP found — try to extract host part and use domain report as fallback
        newURL = `https://www.virustotal.com/vtapi/v2/domain/report?apikey=${apiKey}&domain=${subdomain}`;
      }
    } else if (apiType === "securitytrails") {
      newURL = `https://securitytrails.com/list/apex_domain/${subdomain}`;
    } else if (apiType === "subdomainfinder") {
      newURL = `https://subdomainfinder.c99.nl/scans/2021-02-03/${subdomain}`;
    } else if (apiType === "netlas_host") {
      const host = subdomain.replace(/\.[^.]+$/, "");
      newURL = `https://app.netlas.io/domains/?q=domain%3A${encodeURIComponent(host)}.*.*&page=1&indices=`;
    } else if (apiType === "netlas_subdomain") {
      newURL = `https://app.netlas.io/domains/?q=(domain%3A*.${encodeURIComponent(subdomain)})%20AND%20a%3A*&page=1&indices=`;
    } else if (apiType === "rapiddns") {
      newURL = `https://rapiddns.io/sameip/${subdomain}#result`;
    } else if (apiType === "leakix_recent") {
      newURL =
        "https://leakix.net/search?scope=leak&q=%2Bcreation_date%3A%3E2025-10-01+%2Bplugin%3A%22GitConfigHttpPlugin%22";
    } else if (apiType === "toolbox_dig") {
      newURL = `https://toolbox.googleapps.com/apps/dig/#CNAME/${subdomain}`;
    } else if (apiType === "csp_evaluator") {
      newURL = `https://csp-evaluator.withgoogle.com/`;
    }

    if (newURL) chrome.runtime.sendMessage({ action: "openTabs", urls: [newURL] });
  });
}

// --- Message listener for actions ---
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || (!msg.action && !msg.type)) return;

  const action = msg.type || msg.action;
  const text = msg.text || "";

  if (!text) return;

  const map = {
    bing_search: () => handleInsertFromSelection(text, true, "bing"),
    google_search: () => handleInsertFromSelection(text, false, "google"),
    duckduckgo: () => handleInsertFromSelection(text, false, "duckduckgo"),
    yandex: () => handleInsertFromSelection(text, false, "yandex"),
    wayback_web: () => handleInsertFromSelection(text, false, "wayback"),
    archive_full: () => handleInsertFromSelection(text, true, "archive"),
    archive_simple: () => handleInsertFromSelection(text, false, "archive"),
    virustotal: () => handleInsertFromSelection(text, false, "virustotal"),
    otx_hostname: () => handleInsertFromSelection(text, true, "otx"),
    otx_domain: () => handleInsertFromSelection(text, false, "otx"),
    urlscan: () => handleInsertFromSelection(text, false, "urlscan"),
    securitytrails: () => handleInsertFromSelection(text, false, "securitytrails"),
    virustotal: () => handleInsertFromSelection(text, false, "virustotal"),
    virustotal_ip: () => handleInsertFromSelection(text, false, "virustotal_ip"),
    subdomainfinder: () => handleInsertFromSelection(text, false, "subdomainfinder"),
    netlas_host: () => handleInsertFromSelection(text, false, "netlas_host"),
    netlas_subdomain: () => handleInsertFromSelection(text, false, "netlas_subdomain"),
    rapiddns: () => handleInsertFromSelection(text, false, "rapiddns"),
    crtsh_cn: () => handleInsertFromSelection(text, false, "crt.sh"),
    crtsh_o: () => handleInsertFromSelection(text, false, "crt.sh_1"),
    shodan_ssl: () => handleInsertFromSelection(text, false, "shodan_ssl"),
    shodan_org: () => handleInsertFromSelection(text, false, "shodan_org"),
    shodan_cn: () => handleInsertFromSelection(text, false, "shodan_ssl.cert.subject.cn"),
    leakix_plugin: () => handleInsertFromSelection(text, false, "leakix_plugin"),
    leakix_service: () => handleInsertFromSelection(text, false, "leakix_service"),
    leakix_recent: () => handleInsertFromSelection(text, false, "leakix_recent"),
    toolbox_dig: () => handleInsertFromSelection(text, false, "toolbox_dig"),
    csp_evaluator: () => handleInsertFromSelection(text, false, "csp_evaluator"),
    sslshopper: () => handleInsertFromSelection(text, false, "sslshopper")
  };

  if (map[action]) {
    map[action]();
    sendResponse && sendResponse({ ok: true });
  }
});

// NEW: detect when an OTX API JSON page loads, parse it and inform background about has_next
window.addEventListener("load", () => {
  try {
    const loc = window.location;
    if (!loc || !loc.hostname) return;
    if (loc.hostname !== "otx.alienvault.com") return;

    // path format: /api/v1/indicator/{hostname|domain}/{the_host}/url_list
    const m = loc.pathname.match(/^\/api\/v1\/indicator\/(hostname|domain)\/([^/]+)\/url_list/i);
    if (!m) return;

    const jobType = m[1] === "hostname" ? "otx_hostname" : "otx_domain";
    const host = decodeURIComponent(m[2]);

    // page number from query param
    const urlObj = new URL(loc.href);
    const page = parseInt(urlObj.searchParams.get("page") || "1", 10);

    // try to parse JSON from page body; fallback by searching for the text if parse fails
    let hasNext = undefined;
    const text = document.body ? (document.body.innerText || document.body.textContent || "") : "";

    try {
      const j = JSON.parse(text);
      if (typeof j.has_next !== "undefined") hasNext = j.has_next;
    } catch (e) {
      // not valid JSON; try simple substring search
      if (/\"has_next\"\s*:\s*false/i.test(text)) hasNext = false;
      else if (/\"has_next\"\s*:\s*true/i.test(text)) hasNext = true;
    }

    // only send message if we could determine has_next (true/false)
    if (typeof hasNext !== "undefined") {
      chrome.runtime.sendMessage({
        action: "otx_page_status",
        jobType,
        host,
        page,
        has_next: hasNext
      }, (resp) => {
        // ignore response
      });
    }
  } catch (e) {
    // silent
  }
});

// GLOBAL OTX overlay button logic
(function () {
  let otxOverlay = null;
  let overlayState = { exists: false, running: false }; // running = any active job (false = all paused)

  function updateOverlayAppearance() {
    if (!otxOverlay) return;
    if (overlayState.running) {
      otxOverlay.style.background = "rgba(200,40,40,0.95)";
      otxOverlay.style.color = "#fff";
      otxOverlay.textContent = "Stop OTX Jobs";
      otxOverlay.title = "Click to stop all running OTX jobs";
    } else {
      otxOverlay.style.background = "rgba(40,160,60,0.95)"; // green
      otxOverlay.style.color = "#fff";
      otxOverlay.textContent = "Resume OTX Jobs";
      otxOverlay.title = "Click to resume paused OTX jobs";
    }
  }

  function createOverlay() {
    if (otxOverlay) return;
    otxOverlay = document.createElement("div");
    otxOverlay.id = "osint-otx-overlay";
    otxOverlay.style.position = "fixed";
    otxOverlay.style.top = "12px";
    otxOverlay.style.right = "12px";
    otxOverlay.style.zIndex = "2147483647"; // highest practical z-index
    otxOverlay.style.padding = "8px 10px";
    otxOverlay.style.borderRadius = "6px";
    otxOverlay.style.boxShadow = "0 2px 8px rgba(0,0,0,0.5)";
    otxOverlay.style.cursor = "pointer";
    otxOverlay.style.fontFamily = "Arial, Helvetica, sans-serif";
    otxOverlay.style.fontSize = "13px";
    otxOverlay.style.userSelect = "none";

    otxOverlay.addEventListener("click", () => {
      try {
        // If currently running -> request stop all, else request resume all
        if (overlayState.running) {
          // optimistic UI switch to paused
          overlayState.running = false;
          updateOverlayAppearance();

          chrome.runtime.sendMessage({ action: "otx_stop_all" }, (resp) => {
            if (chrome.runtime.lastError || !resp || !resp.ok) {
              console.error("[OSINT] otx_stop_all error:", chrome.runtime.lastError || resp);
              // revert UI on error
              setTimeout(() => {
                overlayState.running = true;
                updateOverlayAppearance();
              }, 250);
            }
            // background will broadcast otx_update which will sync UI across pages
          });
        } else {
          // optimistic UI switch to running
          overlayState.running = true;
          updateOverlayAppearance();

          chrome.runtime.sendMessage({ action: "otx_resume_all" }, (resp) => {
            if (chrome.runtime.lastError || !resp || !resp.ok) {
              console.error("[OSINT] otx_resume_all error:", chrome.runtime.lastError || resp);
              // revert UI on error
              setTimeout(() => {
                overlayState.running = false;
                updateOverlayAppearance();
              }, 250);
            }
            // background will broadcast otx_update which will sync UI across pages
          });
        }
      } catch (e) {
        console.error("[OSINT] otx overlay click failed:", e);
      }
    });

    updateOverlayAppearance();
    document.documentElement.appendChild(otxOverlay);
  }

  function removeOverlay() {
    if (!otxOverlay) return;
    try {
      otxOverlay.remove();
    } catch (e) {}
    otxOverlay = null;
  }

  function handleUpdateFromJobs(jobs) {
    const keys = jobs && typeof jobs === "object" ? Object.keys(jobs) : [];
    if (!keys.length) {
      overlayState.exists = false;
      removeOverlay();
      return;
    }
    overlayState.exists = true;
    // running if any job has stop == false
    const anyRunning = keys.some(k => !jobs[k] || !jobs[k].stop === false ? false : !jobs[k].stop) 
      || keys.some(k => jobs[k] && !jobs[k].stop); // defensive
    overlayState.running = anyRunning;
    createOverlay();
    updateOverlayAppearance();
  }

  // receive broadcasts from background about job status
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (!msg || msg.action !== "otx_update") return;
    const jobs = msg.jobs || {};
    handleUpdateFromJobs(jobs);
  });

  // ask background for current jobs snapshot when the page loads
  window.addEventListener("load", () => {
    try {
      chrome.runtime.sendMessage({ action: "otx_list" }, (resp) => {
        if (chrome.runtime.lastError) return;
        const jobs = resp && resp.jobs ? resp.jobs : {};
        handleUpdateFromJobs(jobs);
      });
    } catch (e) {}
  });

  // cleanup on unload
  window.addEventListener("beforeunload", () => {
    removeOverlay();
  });
})();