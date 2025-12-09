console.log("[OSINT] Background script loaded");

// Safe placeholders to avoid ReferenceError if an OTX job is triggered
// before the real implementation is defined later in the file.
function startOTXJob(jobType, host) {
  console.warn("[OSINT] startOTXJob placeholder called before real implementation for", jobType, host);
  // no-op placeholder — real function defined later will override this
}
function startOtxJob(jobType, host) {
  return startOTXJob(jobType, host);
}

chrome.runtime.onInstalled.addListener(() => {
  console.log("[OSINT] Extension installed, creating context menus...");
  
  try {
    chrome.contextMenus.removeAll(() => {
      console.log("[OSINT] Old menus cleared");
      
      // Root parent
      chrome.contextMenus.create({
        id: "osint_parent",
        title: "🔍 OSINT Extension",
        contexts: ["page", "selection", "link"]
      });

      // Group parents
      const groups = {
        search: { id: "grp_search", title: "Search Engines" },
        archives: { id: "grp_archives", title: "Archives" },
        certs: { id: "grp_certs", title: "Certs & Enum Subdomains" },
        leakix: { id: "grp_leakix", title: "leakix & Others" },
        shodan_ips: { id: "grp_shodan_ips", title: "Shodan & IPs Discovery" },
        github_dorking: { id: "grp_github_dorking", title: "GitHub Dorking (Advanced)" }
      };

      Object.values(groups).forEach(g => {
        chrome.contextMenus.create({
          id: g.id,
          parentId: "osint_parent",
          title: g.title,
          contexts: ["page", "selection", "link"]
        });
      });

      const tools = [
        // Search Engines
        { id: "bing_search", title: "Bing Search (site:)", parent: groups.search.id },
        { id: "google_search", title: "Google Search (site:)", parent: groups.search.id },
        { id: "duckduckgo", title: "DuckDuckGo (site:)", parent: groups.search.id },
        { id: "yandex", title: "Yandex (site:)", parent: groups.search.id },

        // Archives
        { id: "wayback_web", title: "Wayback GUI (web/*/domain/*)", parent: groups.archives.id },
        { id: "archive_full", title: "Wayback CDX (Full filters)", parent: groups.archives.id },
        { id: "archive_simple", title: "Wayback CDX (Simple)", parent: groups.archives.id },
        { id: "virustotal", title: "VirusTotal (domain)", parent: groups.archives.id },
        { id: "virustotal_ip", title: "VirusTotal (IP)", parent: groups.archives.id },
        { id: "urlscan", title: "URLScan (search)", parent: groups.archives.id },
        { id: "otx_hostname", title: "OTX (Hostname)", parent: groups.archives.id },
        { id: "otx_domain", title: "OTX (Domain)", parent: groups.archives.id },

        // Certs & Enum Subdomains
        { id: "securitytrails", title: "SecurityTrails (apex)", parent: groups.certs.id },
        { id: "crtsh_cn", title: "crt.sh CN=", parent: groups.certs.id },
        { id: "crtsh_o", title: "crt.sh O=", parent: groups.certs.id },
        { id: "subdomainfinder", title: "SubdomainFinder (c99 scan)", parent: groups.certs.id },

        // Shodan & IPs Discovery
        { id: "shodan_ssl", title: "Shodan (ssl)", parent: groups.shodan_ips.id },
        { id: "shodan_org", title: "Shodan (org)", parent: groups.shodan_ips.id },
        { id: "shodan_cn", title: "Shodan (ssl.cert.CN)", parent: groups.shodan_ips.id },
        { id: "netlas_host", title: "Netlas (Host pattern)", parent: groups.shodan_ips.id },
        { id: "netlas_subdomain", title: "Netlas (Subdomain & A records)", parent: groups.shodan_ips.id },
        { id: "rapiddns", title: "RapidDNS (same IP)", parent: groups.shodan_ips.id },

        // Leak & OTX
        { id: "leakix_plugin", title: "LeakIX (GitConfigHttpPlugin)", parent: groups.leakix.id },
        { id: "leakix_service", title: "LeakIX (service host)", parent: groups.leakix.id },
        { id: "leakix_recent", title: "LeakIX (recent GitConfigHttpPlugin)", parent: groups.leakix.id },
        { id: "toolbox_dig", title: "Google Toolbox DIG (CNAME)", parent: groups.leakix.id },
        { id: "csp_evaluator", title: "CSP Evaluator (Google)", parent: groups.leakix.id },
        { id: "sslshopper", title: "SSLShopper Checker", parent: groups.leakix.id }
      ];

      // GitHub Dorks with proper names
      const githubDorks = [
        { id: "github_dork_1", title: "Email Pattern Search (Subdomain)" },
        { id: "github_dork_2", title: "Email Pattern Search (Domain)" },
        { id: "github_dork_3", title: "URL Protocol Pattern (Domain)" },
        { id: "github_dork_4", title: "URL Protocol Pattern (Subdomain)" },
        { id: "github_dork_5", title: "Credentials in URLs (Domain)" },
        { id: "github_dork_6", title: "Secrets in URLs (Domain)" },
        { id: "github_dork_7", title: "Password Exposure (Subdomain)" },
        { id: "github_dork_8", title: "Secret Exposure (Subdomain)" },
        { id: "github_dork_9", title: "Env File Credentials (Domain)" },
        { id: "github_dork_10", title: "Password Leaks (Domain)" },
        { id: "github_dork_11", title: "Env File Secrets (Domain)" },
        { id: "github_dork_12", title: "Secret Leaks (Domain)" },
        { id: "github_dork_13", title: "Organization Password Search" },
        { id: "github_dork_14", title: "Organization Secret Search" },
        { id: "github_dork_15", title: "Organization Pass Search" },
        { id: "github_dork_16", title: "ServiceNow Instance Search" },
        { id: "github_dork_17", title: "ServiceNow Alt Search" },
        { id: "github_dork_18", title: "ServiceNow Subdomain Search" },
        { id: "github_dork_19", title: "ServiceNow Subdomain Alt Search" },
        { id: "github_dork_20", title: "ServiceNow Reverse Domain" },
        { id: "github_dork_21", title: "ServiceNow Dash Reverse Domain" },
        { id: "github_dork_22", title: "JDBC Credentials (Subdomain)" },
        { id: "github_dork_23", title: "JDBC Secrets (Subdomain)" },
        { id: "github_dork_24", title: "JDBC Connection String" },
        { id: "github_dork_25", title: "JDBC with Auth Password" },
        { id: "github_dork_26", title: "JDBC with Auth Secret" },
        { id: "github_dork_27", title: "JDBC @ Auth Password" },
        { id: "github_dork_28", title: "JDBC @ Auth Secret" },
        { id: "github_dork_29", title: "JDBC @ Pass Search" },
        { id: "github_dork_30", title: "JDBC @ Secret Search" },
        { id: "github_dork_31", title: "Jenkins Client Secret" },
        { id: "github_dork_32", title: "Jenkins Secret Token" },
        { id: "github_dork_33", title: "JFrog Client Secret" },
        { id: "github_dork_34", title: "JFrog Secret Token" },
        { id: "github_dork_35", title: "GitLab Client Secret" },
        { id: "github_dork_36", title: "GitLab Secret Token" },
        { id: "github_dork_37", title: "GitHub Client Secret" },
        { id: "github_dork_38", title: "GitHub Secret Token" },
        { id: "github_dork_39", title: "ServiceNow Domain Search" },
        { id: "github_dork_40", title: "ServiceNow Domain Dash Search" },
        { id: "github_dork_41", title: "JDBC Domain Credentials" },
        { id: "github_dork_42", title: "JDBC Domain Secrets" },
        { id: "github_dork_43", title: "JDBC Domain Connection" },
        { id: "github_dork_44", title: "JDBC Domain Auth Pass" },
        { id: "github_dork_45", title: "JDBC Domain Auth Secret" },
        { id: "github_dork_46", title: "JDBC Domain @ Pass" },
        { id: "github_dork_47", title: "JDBC Domain @ Secret" },
        { id: "github_dork_48", title: "JDBC Domain @ Pass Alt" },
        { id: "github_dork_49", title: "JDBC Domain @ Secret Alt" },
        { id: "github_dork_50", title: "Jenkins Domain Secret" },
        { id: "github_dork_51", title: "Jenkins Domain Token" },
        { id: "github_dork_52", title: "JFrog Domain Secret" },
        { id: "github_dork_53", title: "JFrog Domain Token" },
        { id: "github_dork_54", title: "GitLab Domain Secret" },
        { id: "github_dork_55", title: "GitLab Domain Token" },
        { id: "github_dork_56", title: "GitHub Domain Secret" },
        { id: "github_dork_57", title: "GitHub Domain Token" },
        { id: "github_dork_58", title: "Confluence Token Search" },
        { id: "github_dork_59", title: "SAP Connection Password" },
        { id: "github_dork_60", title: "SAP Connection Secret" },
        { id: "github_dork_61", title: "ODBC Connection String" },
        { id: "github_dork_62", title: "MongoDB Connection String" },
        { id: "github_dork_63", title: "Redis Connection String" },
        { id: "github_dork_64", title: "Couchbase Connection String" },
        { id: "github_dork_65", title: "Google Service Account Keys" },
        { id: "github_dork_66", title: "Confluence Domain Token" },
        { id: "github_dork_67", title: "SAP Domain Password" },
        { id: "github_dork_68", title: "SAP Domain Secret" },
        { id: "github_dork_69", title: "SaaS Credentials (Multi)" },
        { id: "github_dork_70", title: "Subdomain Email Pattern" },
        { id: "github_dork_71", title: "Domain Email Pattern" }
      ];

      // Add GitHub dorks
      githubDorks.forEach(dork => {
        chrome.contextMenus.create({
          id: dork.id,
          title: dork.title,
          parentId: groups.github_dorking.id,
          contexts: ["page", "selection", "link"]
        });
      });

      // Add all tools
      tools.forEach(tool => {
        chrome.contextMenus.create({
          id: tool.id,
          title: tool.title,
          parentId: tool.parent,
          contexts: ["page", "selection", "link"]
        });
      });

      console.log("[OSINT] All context menus created successfully!");
    });
  } catch (e) {
    console.error("[OSINT] Error during menu creation:", e);
  }
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  console.log("[OSINT] Context menu clicked:", info.menuItemId);

  if (!info.menuItemId || info.menuItemId === "osint_parent") return;

  const action = info.menuItemId;
  let text = info.selectionText || info.linkUrl || (tab && tab.url) || "";
  text = text.trim();

  console.log("[OSINT] Action:", action, "Text:", text);

  if (!text) {
    console.warn("[OSINT] No text/URL to process");
    return;
  }

  // Send to content script
  if (tab && tab.id) {
    chrome.tabs.sendMessage(tab.id, { action, text }, { frameId: 0 }, (resp) => {
      if (chrome.runtime.lastError) {
        console.warn("[OSINT] Content script not available");
        processActionInBackground(action, text);
      }
    });
  }
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  // Defensive: ensure msg shape
  if (!msg || typeof msg !== "object") {
    sendResponse && sendResponse({ ok: false });
    return;
  }

  // Handle OTX control messages globally here so content overlay always works
  if (msg.action === "otx_stop_all") {
    try {
      let stoppedAny = false;
      // runningOTXJobs is defined later in file but exists by runtime when handler executes
      if (typeof runningOTXJobs === "object") {
        for (const k in runningOTXJobs) {
          if (typeof stopOTXJob === "function") {
            const r = stopOTXJob(k);
            if (r) stoppedAny = true;
          } else {
            // best-effort: mark stop flag and clear timer if present
            try {
              runningOTXJobs[k].stop = true;
              if (runningOTXJobs[k].timerId) {
                clearTimeout(runningOTXJobs[k].timerId);
                runningOTXJobs[k].timerId = null;
              }
              stoppedAny = true;
            } catch (e) {}  
          }
        }
      }
      // notify content scripts
      if (typeof broadcastOTXJobs === "function") broadcastOTXJobs();
      sendResponse && sendResponse({ ok: stoppedAny });
    } catch (e) {
      console.error("[OSINT] otx_stop_all handler error:", e);
      sendResponse && sendResponse({ ok: false });
    }
    return;
  }

  if (msg.action === "otx_stop") {
    const jobId = msg.jobId;
    if (!jobId) {
      sendResponse && sendResponse({ ok: false });
      return;
    }
    try {
      const ok = (typeof stopOTXJob === "function") ? stopOTXJob(jobId) : (runningOTXJobs[jobId] ? (runningOTXJobs[jobId].stop = true, true) : false);
      if (typeof broadcastOTXJobs === "function") broadcastOTXJobs();
      sendResponse && sendResponse({ ok });
    } catch (e) {
      console.error("[OSINT] otx_stop handler error:", e);
      sendResponse && sendResponse({ ok: false });
    }
    return;
  }

  if (msg.action === "otx_list") {
    try {
      const list = {};
      if (typeof runningOTXJobs === "object") {
        for (const k in runningOTXJobs) {
          const j = runningOTXJobs[k];
          list[k] = { nextPage: j.nextPage, stop: !!j.stop, groupId: j.groupId, tabCount: j.tabIds.length };
        }
      }
      sendResponse && sendResponse({ ok: true, jobs: list });
    } catch (e) {
      console.error("[OSINT] otx_list handler error:", e);
      sendResponse && sendResponse({ ok: false });
    }
    return;
  }

  // Existing handlers for openTabs / executeAction
  console.log("[OSINT] Background received message:", msg.action || msg.type);

  if (!msg || (!msg.action && !msg.type)) {
    sendResponse && sendResponse({ ok: false });
    return;
  }

  const action = msg.type || msg.action;
  const text = msg.text || "";

  if (msg.action === "openTabs" && Array.isArray(msg.urls)) {
    msg.urls.forEach(url => {
      try {
        chrome.tabs.create({ url, active: false });
      } catch (e) {
        console.error("[OSINT] Failed to open tab:", url, e);
      }
    });
    sendResponse && sendResponse({ ok: true });
  } else if (msg.action === "executeAction" && action && text) {
    processActionInBackground(action, text);
    sendResponse && sendResponse({ ok: true });
  } else {
    sendResponse && sendResponse({ ok: false });
  }
});

function extractHostFromText(text) {
  if (!text) return "";
  try {
    if (/^https?:\/\//i.test(text)) {
      const u = new URL(text);
      return u.hostname.replace(/^www\./i, "");
    }
    // detect IPv4 first
    const ipv4 = text.match(/(^|\s)(\d{1,3}(?:\.\d{1,3}){3})($|\s)/);
    if (ipv4 && ipv4[2]) {
      return ipv4[2];
    }
    // fixed character-class typo and made it case-insensitive
    const m = text.match(/([A-Za-z0-9.-]+\.[A-Za-z]{2,})/i);
    return (m && m[1]) ? m[1].replace(/^www\./i, "") : "";
  } catch (e) {
    return "";
  }
}

function openUrls(urls) {
  if (!Array.isArray(urls)) return;
  urls.forEach(u => {
    try {
      chrome.tabs.create({ url: u, active: false });
    } catch (e) {
      console.error("[OSINT] openUrls error:", e);
    }
  });
}

const NOT_FILTERS = `NOT xxxx NOT **** NOT 123 NOT changeme NOT example NOT guest NOT localhost NOT fake NOT 1234 NOT xxx NOT 127.0.0.1 NOT test NOT tracker NOT RobotsDisallowed NOT disallowed NOT robots`;

// Safe alias for legacy callers: ensure startOtxJob exists even if startOTXJob is defined later
function startOtxJob(jobType, host) {
  if (typeof startOTXJob === "function") {
    return startOTXJob(jobType, host);
  }
  // defensive fallback (shouldn't happen): log and no-op
  console.warn("[OSINT] startOtxJob not defined yet; cannot start OTX job for", jobType, host);
  return;
}

function processActionInBackground(action, text) {
  const host = extractHostFromText(text);
  if (!host) {
    console.warn("[OSINT] No host extracted");
    return;
  }

  // If the action is OTX, start the batched opener and return (no fetch)
  if (action === "otx_hostname" || action === "otx_domain") {
    console.log("[OSINT] Starting OTX batched job for", action, host);

    // Prefer canonical function, then legacy alias, then fallback minimal opener
    if (typeof startOTXJob === "function") {
      startOTXJob(action, host);
    } else if (typeof startOtxJob === "function") {
      startOtxJob(action, host);
    } else {
      console.warn("[OSINT] startOTXJob/startOtxJob not defined — using fallback opener for", action, host);
      const encHost = encodeURIComponent(host);
      const endpointBase = action === "otx_hostname"
        ? `https://otx.alienvault.com/api/v1/indicator/hostname/${encHost}/url_list?limit=500&page=`
        : `https://otx.alienvault.com/api/v1/indicator/domain/${encHost}/url_list?limit=500&page=`;
      for (let p = 1; p <= 5; p++) {
        chrome.tabs.create({ url: `${endpointBase}${p}`, active: false }, () => {});
      }
    }
    return;
  }
  
  console.log("[OSINT] Processing action:", action, "Host:", host);

  const parts = host.split(".");
  const hostShort = parts.length >= 2 ? parts[parts.length - 2] : parts[0];
  const domainOnly = parts.length >= 2 ? parts.slice(-2).join(".") : parts[0];

  // pre-encode host parts so URLs are safe
  const encHost = encodeURIComponent(host);
  const encHostShort = encodeURIComponent(hostShort);
  const encDomainOnly = encodeURIComponent(domainOnly);

  const urlMap = {
    google_search: `https://www.google.com/search?q=site%3A${encHost}`,
    bing_search: `https://www.bing.com/search?q=site%3A${encHost}`,
    duckduckgo: `https://duckduckgo.com/?q=site%3A${encHost}`,
    yandex: `https://yandex.com/search/?text=site%3A${encHost}`,
    wayback_web: `https://web.archive.org/web/*/${encHost}/*`,
    archive_full: `https://web.archive.org/cdx/search/cdx?url=*.${encHost}&fl=original&collapse=urlkey&filter=statuscode:200`,
    archive_simple: `https://web.archive.org/cdx/search/cdx?url=*.${encHost}&fl=original&collapse=urlkey`,
    virustotal: `https://www.virustotal.com/vtapi/v2/domain/report?apikey=93e0745ee0d7113aba3e73847ff4de98c247b52531ee65c6aa672087bb350618&domain=${encHost}`,
    virustotal_ip: `https://www.virustotal.com/vtapi/v2/ip-address/report?apikey=93e0745ee0d7113aba3e73847ff4de98c247b52531ee65c6aa672087bb350618&ip=${encHost}`,
    urlscan: `https://urlscan.io/search/#${encHost}`,
    otx_hostname: `https://otx.alienvault.com/api/v1/indicator/hostname/${encHost}/url_list?limit=500&page=1`,
    otx_domain: `https://otx.alienvault.com/api/v1/indicator/domain/${encHost}/url_list?limit=500&page=1`,
    securitytrails: `https://securitytrails.com/list/apex_domain/${encHost}`,
    crtsh_cn: `https://crt.sh/?CN=${encHost}`,
    crtsh_o: `https://crt.sh/?O=${encHostShort}`,
    subdomainfinder: `https://subdomainfinder.c99.nl/`,
    shodan_ssl: `https://www.shodan.io/search?query=ssl%3A%22${encHost}%22`,
    shodan_org: `https://www.shodan.io/search?query=org%3A%22${encHostShort}%22`,
    shodan_cn: `https://www.shodan.io/search?query=ssl.cert.subject.CN%3A%22${encHost}%22`,
    netlas_host: `https://app.netlas.io/domains/?q=domain%3A${encHost}`,
    netlas_subdomain: `https://app.netlas.io/domains/?q=domain%3A*.${encHost}`,
    rapiddns: `https://rapiddns.io/sameip/${encHost}`,
    leakix_plugin: `https://leakix.net/search?scope=leak&q=%2Bplugin%3A%22GitConfigHttpPlugin%22+${encHost}`,
    leakix_service: `https://leakix.net/search?scope=leak&q=${encHost}`,
    leakix_recent: `https://leakix.net/search?scope=leak&q=%2Bcreation_date%3A%3E2025-10-01`,
    toolbox_dig: `https://toolbox.googleapps.com/apps/dig/#CNAME/${encHost}`,
    csp_evaluator: `https://csp-evaluator.withgoogle.com/`,
    sslshopper: `https://www.sslshopper.com/ssl-checker.html#hostname=${encHost}`,

    // GitHub Dorks 1-71
    github_dork_1: `https://github.com/search?q=${encodeURIComponent(`/@(?:[a-zA-Z0-9-]+\\.){2,}${hostShort}\\./ ${NOT_FILTERS}`)}&type=code`,
    github_dork_2: `https://github.com/search?q=${encodeURIComponent(`/@(?:[a-zA-Z0-9-]+\\.){2,}${domainOnly}/ ${NOT_FILTERS}`)}&type=code`,
    github_dork_3: `https://github.com/search?q=${encodeURIComponent(`/[a-zA-Z0-9_-]+:\\/\\/(?:[a-zA-Z0-9-]+\\.){2,}${domainOnly}/ ${NOT_FILTERS}`)}&type=code`,
    github_dork_4: `https://github.com/search?q=${encodeURIComponent(`/[a-zA-Z0-9_-]+:\\/\\/(?:[a-zA-Z0-9-]+\\.){2,}${hostShort}\\./ ${NOT_FILTERS}`)}&type=code`,
    github_dork_5: `https://github.com/search?q=${encodeURIComponent(`/[a-zA-Z0-9_-]+:\\/\\/(?:[a-zA-Z0-9-]+\\.){2,}${domainOnly}/ AND /[$#^]?password[[:space:]]*[:=]?[[:space:]]*['"][a-zA-Z1-9-$#^]*/ ${NOT_FILTERS}`)}&type=code`,
    github_dork_6: `https://github.com/search?q=${encodeURIComponent(`/[a-zA-Z0-9_-]+:\\/\\/(?:[a-zA-Z0-9-]+\\.){2,}${domainOnly}/ AND /[$#^]?secret[[:space:]]*[:=]?[[:space:]]*['"][a-zA-Z1-9-$#^]*/ ${NOT_FILTERS}`)}&type=code`,
    github_dork_7: `https://github.com/search?q=${encodeURIComponent(`/@(?:[a-zA-Z0-9-]+\\.){2,}${hostShort}\\./ AND /[$#^]?password[[:space:]]*[:=]?[[:space:]]*['"][a-zA-Z1-9-$#^]*/ ${NOT_FILTERS}`)}&type=code`,
    github_dork_8: `https://github.com/search?q=${encodeURIComponent(`/@(?:[a-zA-Z0-9-]+\\.){2,}${hostShort}\\./ AND /[$#^]?secret[[:space:]]*[:=]?[[:space:]]*['"][a-zA-Z1-9-$#^]*/ ${NOT_FILTERS}`)}&type=code`,
    github_dork_9: `https://github.com/search?q=${encodeURIComponent(`/@(?:[a-zA-Z0-9-]+\\.){2,}${domainOnly}/ AND /[$#^]?password[[:space:]]*[:=]?[[:space:]]*['"][a-zA-Z1-9-$#^]*/ AND PATH:.env ${NOT_FILTERS}`)}&type=code`,
    github_dork_10: `https://github.com/search?q=${encodeURIComponent(`/@(?:[a-zA-Z0-9-]+\\.){2,}${domainOnly}/ AND /[$#^]?password[[:space:]]*[:=]?[[:space:]]*['"][a-zA-Z1-9-$#^]*/ ${NOT_FILTERS}`)}&type=code`,
    github_dork_11: `https://github.com/search?q=${encodeURIComponent(`/@(?:[a-zA-Z0-9-]+\\.){2,}${domainOnly}/ AND /[$#^]?secret[[:space:]]*[:=]?[[:space:]]*['"][a-zA-Z1-9-$#^]*/ AND PATH:.env ${NOT_FILTERS}`)}&type=code`,
    github_dork_12: `https://github.com/search?q=${encodeURIComponent(`/@(?:[a-zA-Z0-9-]+\\.){2,}${domainOnly}/ AND /[$#^]?secret[[:space:]]*[:=]?[[:space:]]*['"][a-zA-Z1-9-$#^]*/ ${NOT_FILTERS}`)}&type=code`,
    github_dork_13: `https://github.com/search?q=${encodeURIComponent(`org:${hostShort} /[$#^]?password[[:space:]]*[:=]?[[:space:]]*['"][a-zA-Z1-9-$#^]*/ ${NOT_FILTERS}`)}&type=code`,
    github_dork_14: `https://github.com/search?q=${encodeURIComponent(`org:${hostShort} /[$#^]?secret[[:space:]]*[:=]?[[:space:]]*['"][a-zA-Z1-9-$#^]*/ ${NOT_FILTERS}`)}&type=code`,
    github_dork_15: `https://github.com/search?q=${encodeURIComponent(`org:${hostShort} /[$#^]?pass[[:space:]]*[:=]?[[:space:]]*['"][a-zA-Z1-9-$#^]*/ ${NOT_FILTERS}`)}&type=code`,
    github_dork_16: `https://github.com/search?q=${encodeURIComponent(`/${hostShort}(?:[a-zA-Z0-9_-]+\\.)+service-now\\.com/`)}&type=code`,
    github_dork_17: `https://github.com/search?q=${encodeURIComponent(`/${hostShort}(?:[a-zA-Z0-9_-]+\\.)+servicenow\\.com/`)}&type=code`,
    github_dork_18: `https://github.com/search?q=${encodeURIComponent(`/${hostShort}(?:[a-zA-Z0-9-]+\\.){2,}service-now\\.com/`)}&type=code`,
    github_dork_19: `https://github.com/search?q=${encodeURIComponent(`/${hostShort}(?:[a-zA-Z0-9-]+\\.){2,}servicenow\\.com/`)}&type=code`,
    github_dork_20: `https://github.com/search?q=${encodeURIComponent(`/servicenow\\.(?:[a-zA-Z0-9-]+\\.){2,}${hostShort}\\./ ${NOT_FILTERS}`)}&type=code`,
    github_dork_21: `https://github.com/search?q=${encodeURIComponent(`/service-now\\.(?:[a-zA-Z0-9-]+\\.){2,}${hostShort}\\./ ${NOT_FILTERS}`)}&type=code`,
    github_dork_22: `https://github.com/search?q=${encodeURIComponent(`/jdbc:[a-zA-Z0-9_-]+:\\/\\/(?:[a-zA-Z0-9-]+\\.){2,}${hostShort}\\./ AND /[$#^]?password[[:space:]]*[:=]?[[:space:]]*['"][a-zA-Z1-9-$#^]*/ ${NOT_FILTERS}`)}&type=code`,
    github_dork_23: `https://github.com/search?q=${encodeURIComponent(`/jdbc:[a-zA-Z0-9_-]+:\\/\\/(?:[a-zA-Z0-9-]+\\.){2,}${hostShort}\\./ AND /[$#^]?secret[[:space:]]*[:=]?[[:space:]]*['"][a-zA-Z1-9-$#^]*/ ${NOT_FILTERS}`)}&type=code`,
    github_dork_24: `https://github.com/search?q=${encodeURIComponent(`/jdbc:[a-zA-Z0-9_-]+:[a-zA-Z0-9_-]+:(?:[a-zA-Z0-9-]+\\.){2,}${hostShort}\\./ ${NOT_FILTERS}`)}&type=code`,
    github_dork_25: `https://github.com/search?q=${encodeURIComponent(`/jdbc:[a-zA-Z0-9_-]+:[a-zA-Z0-9_-]+:\\/\\/(?:[a-zA-Z0-9-]+\\.){2,}${hostShort}\\./ AND /[$#^]?password[[:space:]]*[:=]?[[:space:]]*['"][a-zA-Z1-9-$#^]*/ ${NOT_FILTERS}`)}&type=code`,
    github_dork_26: `https://github.com/search?q=${encodeURIComponent(`/jdbc:[a-zA-Z0-9_-]+:[a-zA-Z0-9_-]+:\\/\\/(?:[a-zA-Z0-9-]+\\.){2,}${hostShort}\\./ AND /[$#^]?secret[[:space:]]*[:=]?[[:space:]]*['"][a-zA-Z1-9-$#^]*/ ${NOT_FILTERS}`)}&type=code`,
    github_dork_27: `https://github.com/search?q=${encodeURIComponent(`/jdbc:[a-zA-Z0-9_-]+:[a-zA-Z0-9_-]+:\@\\/\\/(?:[a-zA-Z0-9-]+\\.){2,}${hostShort}\\./ AND /[$#^]?password[[:space:]]*[:=]?[[:space:]]*['"][a-zA-Z1-9-$#^]*/ ${NOT_FILTERS}`)}&type=code`,
    github_dork_28: `https://github.com/search?q=${encodeURIComponent(`/jdbc:[a-zA-Z0-9_-]+:[a-zA-Z0-9_-]+:\@\\/\\/(?:[a-zA-Z0-9-]+\\.){2,}${hostShort}\\./ AND /[$#^]?secret[[:space:]]*[:=]?[[:space:]]*['"][a-zA-Z1-9-$#^]*/ ${NOT_FILTERS}`)}&type=code`,
    github_dork_29: `https://github.com/search?q=${encodeURIComponent(`/jdbc:[a-zA-Z0-9_-]+:[a-zA-Z0-9_-]+:\@(?:[a-zA-Z0-9-]+\\.){2,}${hostShort}\\./ AND /[$#^]?password[[:space:]]*[:=]?[[:space:]]*['"][a-zA-Z1-9-$#^]*/ ${NOT_FILTERS}`)}&type=code`,
    github_dork_30: `https://github.com/search?q=${encodeURIComponent(`/jdbc:[a-zA-Z0-9_-]+:[a-zA-Z0-9_-]+:\@(?:[a-zA-Z0-9-]+\\.){2,}${hostShort}\\./ AND /[$#^]?secret[[:space:]]*[:=]?[[:space:]]*['"][a-zA-Z1-9-$#^]*/ ${NOT_FILTERS}`)}&type=code`,
    github_dork_31: `https://github.com/search?q=${encodeURIComponent(`/jenkins\\.(?:[a-zA-Z0-9-]+\\.){2,}${hostShort}\\./ AND /[$#^]?CLIENT_SECRET[[:space:]]*[:=]?[[:space:]]*['"][a-zA-Z1-9-$#^]*/ ${NOT_FILTERS}`)}&type=code`,
    github_dork_32: `https://github.com/search?q=${encodeURIComponent(`/jenkins\\.(?:[a-zA-Z0-9-]+\\.){2,}${hostShort}\\./ AND /[$#^]?SECRET[[:space:]]*[:=]?[[:space:]]*['"][a-zA-Z1-9-$#^]*/ ${NOT_FILTERS}`)}&type=code`,
    github_dork_33: `https://github.com/search?q=${encodeURIComponent(`/jfrog\\.(?:[a-zA-Z0-9-]+\\.){2,}${hostShort}\\./ AND /[$#^]?CLIENT_SECRET[[:space:]]*[:=]?[[:space:]]*['"][a-zA-Z1-9-$#^]*/ ${NOT_FILTERS}`)}&type=code`,
    github_dork_34: `https://github.com/search?q=${encodeURIComponent(`/jfrog\\.(?:[a-zA-Z0-9-]+\\.){2,}${hostShort}\\./ AND /[$#^]?SECRET[[:space:]]*[:=]?[[:space:]]*['"][a-zA-Z1-9-$#^]*/ ${NOT_FILTERS}`)}&type=code`,
    github_dork_35: `https://github.com/search?q=${encodeURIComponent(`/gitlab\\.(?:[a-zA-Z0-9-]+\\.){2,}${hostShort}\\./ AND /[$#^]?CLIENT_SECRET[[:space:]]*[:=]?[[:space:]]*['"][a-zA-Z1-9-$#^]*/ ${NOT_FILTERS}`)}&type=code`,
    github_dork_36: `https://github.com/search?q=${encodeURIComponent(`/gitlab\\.(?:[a-zA-Z0-9-]+\\.){2,}${hostShort}\\./ AND /[$#^]?SECRET[[:space:]]*[:=]?[[:space:]]*['"][a-zA-Z1-9-$#^]*/ ${NOT_FILTERS}`)}&type=code`,
    github_dork_37: `https://github.com/search?q=${encodeURIComponent(`/github\\.(?:[a-zA-Z0-9-]+\\.){2,}${hostShort}\\./ AND /[$#^]?CLIENT_SECRET[[:space:]]*[:=]?[[:space:]]*['"][a-zA-Z1-9-$#^]*/ ${NOT_FILTERS}`)}&type=code`,
    github_dork_38: `https://github.com/search?q=${encodeURIComponent(`/github\\.(?:[a-zA-Z0-9-]+\\.){2,}${hostShort}\\./ AND /[$#^]?SECRET[[:space:]]*[:=]?[[:space:]]*['"][a-zA-Z1-9-$#^]*/ ${NOT_FILTERS}`)}&type=code`,
    github_dork_39: `https://github.com/search?q=${encodeURIComponent(`/servicenow\\.(?:[a-zA-Z0-9-]+\\.){2,}${domainOnly}/ ${NOT_FILTERS}`)}&type=code`,
    github_dork_40: `https://github.com/search?q=${encodeURIComponent(`/service-now\\.(?:[a-zA-Z0-9-]+\\.){2,}${domainOnly}/ ${NOT_FILTERS}`)}&type=code`,
    github_dork_41: `https://github.com/search?q=${encodeURIComponent(`/jdbc:[a-zA-Z0-9_-]+:\\/\\/(?:[a-zA-Z0-9-]+\\.){2,}${domainOnly}/ AND /[$#^]?password[[:space:]]*[:=]?[[:space:]]*['"][a-zA-Z1-9-$#^]*/ ${NOT_FILTERS}`)}&type=code`,
    github_dork_42: `https://github.com/search?q=${encodeURIComponent(`/jdbc:[a-zA-Z0-9_-]+:\\/\\/(?:[a-zA-Z0-9-]+\\.){2,}${domainOnly}/ AND /[$#^]?secret[[:space:]]*[:=]?[[:space:]]*['"][a-zA-Z1-9-$#^]*/ ${NOT_FILTERS}`)}&type=code`,
    github_dork_43: `https://github.com/search?q=${encodeURIComponent(`/jdbc:[a-zA-Z0-9_-]+:[a-zA-Z0-9_-]+:(?:[a-zA-Z0-9-]+\\.){2,}${domainOnly}/ ${NOT_FILTERS}`)}&type=code`,
    github_dork_44: `https://github.com/search?q=${encodeURIComponent(`/jdbc:[a-zA-Z0-9_-]+:[a-zA-Z0-9_-]+:\\/\\/(?:[a-zA-Z0-9-]+\\.){2,}${domainOnly}/ AND /[$#^]?password[[:space:]]*[:=]?[[:space:]]*['"][a-zA-Z1-9-$#^]*/ ${NOT_FILTERS}`)}&type=code`,
    github_dork_45: `https://github.com/search?q=${encodeURIComponent(`/jdbc:[a-zA-Z0-9_-]+:[a-zA-Z0-9_-]+:\\/\\/(?:[a-zA-Z0-9-]+\\.){2,}${domainOnly}/ AND /[$#^]?secret[[:space:]]*[:=]?[[:space:]]*['"][a-zA-Z1-9-$#^]*/ ${NOT_FILTERS}`)}&type=code`,
    github_dork_46: `https://github.com/search?q=${encodeURIComponent(`/jdbc:[a-zA-Z0-9_-]+:[a-zA-Z0-9_-]+:\@\\/\\/(?:[a-zA-Z0-9-]+\\.){2,}${domainOnly}/ AND /[$#^]?password[[:space:]]*[:=]?[[:space:]]*['"][a-zA-Z1-9-$#^]*/ ${NOT_FILTERS}`)}&type=code`,
    github_dork_47: `https://github.com/search?q=${encodeURIComponent(`/jdbc:[a-zA-Z0-9_-]+:[a-zA-Z0-9_-]+:\@\\/\\/(?:[a-zA-Z0-9-]+\\.){2,}${domainOnly}/ AND /[$#^]?secret[[:space:]]*[:=]?[[:space:]]*['"][a-zA-Z1-9-$#^]*/ ${NOT_FILTERS}`)}&type=code`,
    github_dork_48: `https://github.com/search?q=${encodeURIComponent(`/jdbc:[a-zA-Z0-9_-]+:[a-zA-Z0-9_-]+:\@(?:[a-zA-Z0-9-]+\\.){2,}${domainOnly}/ AND /[$#^]?password[[:space:]]*[:=]?[[:space:]]*['"][a-zA-Z1-9-$#^]*/ ${NOT_FILTERS}`)}&type=code`,
    github_dork_49: `https://github.com/search?q=${encodeURIComponent(`/jdbc:[a-zA-Z0-9_-]+:[a-zA-Z0-9_-]+:\@(?:[a-zA-Z0-9-]+\\.){2,}${domainOnly}/ AND /[$#^]?secret[[:space:]]*[:=]?[[:space:]]*['"][a-zA-Z1-9-$#^]*/ ${NOT_FILTERS}`)}&type=code`,
    github_dork_50: `https://github.com/search?q=${encodeURIComponent(`/jenkins\\.(?:[a-zA-Z0-9-]+\\.){2,}${domainOnly}/ AND /[$#^]?CLIENT_SECRET[[:space:]]*[:=]?[[:space:]]*['"][a-zA-Z1-9-$#^]*/ ${NOT_FILTERS}`)}&type=code`,
    github_dork_51: `https://github.com/search?q=${encodeURIComponent(`/jenkins\\.(?:[a-zA-Z0-9-]+\\.){2,}${domainOnly}/ AND /[$#^]?SECRET[[:space:]]*[:=]?[[:space:]]*['"][a-zA-Z1-9-$#^]*/ ${NOT_FILTERS}`)}&type=code`,
    github_dork_52: `https://github.com/search?q=${encodeURIComponent(`/jfrog\\.(?:[a-zA-Z0-9-]+\\.){2,}${domainOnly}/ AND /[$#^]?CLIENT_SECRET[[:space:]]*[:=]?[[:space:]]*['"][a-zA-Z1-9-$#^]*/ ${NOT_FILTERS}`)}&type=code`,
    github_dork_53: `https://github.com/search?q=${encodeURIComponent(`/jfrog\\.(?:[a-zA-Z0-9-]+\\.){2,}${domainOnly}/ AND /[$#^]?SECRET[[:space:]]*[:=]?[[:space:]]*['"][a-zA-Z1-9-$#^]*/ ${NOT_FILTERS}`)}&type=code`,
    github_dork_54: `https://github.com/search?q=${encodeURIComponent(`/gitlab\\.(?:[a-zA-Z0-9-]+\\.){2,}${domainOnly}/ AND /[$#^]?CLIENT_SECRET[[:space:]]*[:=]?[[:space:]]*['"][a-zA-Z1-9-$#^]*/ ${NOT_FILTERS}`)}&type=code`,
    github_dork_55: `https://github.com/search?q=${encodeURIComponent(`/gitlab\\.(?:[a-zA-Z0-9-]+\\.){2,}${domainOnly}/ AND /[$#^]?SECRET[[:space:]]*[:=]?[[:space:]]*['"][a-zA-Z1-9-$#^]*/ ${NOT_FILTERS}`)}&type=code`,
    github_dork_56: `https://github.com/search?q=${encodeURIComponent(`/github\\.(?:[a-zA-Z0-9-]+\\.){2,}${domainOnly}/ AND /[$#^]?CLIENT_SECRET[[:space:]]*[:=]?[[:space:]]*['"][a-zA-Z1-9-$#^]*/ ${NOT_FILTERS}`)}&type=code`,
    github_dork_57: `https://github.com/search?q=${encodeURIComponent(`/github\\.(?:[a-zA-Z0-9-]+\\.){2,}${domainOnly}/ AND /[$#^]?SECRET[[:space:]]*[:=]?[[:space:]]*['"][a-zA-Z1-9-$#^]*/ ${NOT_FILTERS}`)}&type=code`,
    github_dork_58: `https://github.com/search?q=${encodeURIComponent(`/confluence[a-zA-Z0-9_-]*\\.(?:[a-zA-Z0-9-]+\\.){2,}${hostShort}\\./ AND /[$#^]?Token[[:space:]]*[:=]?[[:space:]]*['"][a-zA-Z1-9-$#^]*/ ${NOT_FILTERS}`)}&type=code`,
    github_dork_59: `https://github.com/search?q=${encodeURIComponent(`/:sap:\\/\\/(?:[a-zA-Z0-9-]+\\.){2,}${hostShort}\\./ AND /[$#^]?password[[:space:]]*[:=]?[[:space:]]*['"][a-zA-Z1-9-$#^]*/ ${NOT_FILTERS}`)}&type=code`,
    github_dork_60: `https://github.com/search?q=${encodeURIComponent(`/:sap:\\/\\/(?:[a-zA-Z0-9-]+\\.){2,}${hostShort}\\./ AND /[$#^]?secret[[:space:]]*[:=]?[[:space:]]*['"][a-zA-Z1-9-$#^]*/ ${NOT_FILTERS}`)}&type=code`,
    github_dork_61: `https://github.com/search?q=${encodeURIComponent(`/odbc:[a-zA-Z0-9_-]+:\\/\\/(?:[a-zA-Z0-9-]+\\.){2,}${hostShort}\\./ ${NOT_FILTERS}`)}&type=code`,
    github_dork_62: `https://github.com/search?q=${encodeURIComponent(`/mongodb:\\/\\/(?:[a-zA-Z0-9-]+\\.){2,}${hostShort}\\./ ${NOT_FILTERS}`)}&type=code`,
    github_dork_63: `https://github.com/search?q=${encodeURIComponent(`/redis:\\/\\/(?:[a-zA-Z0-9-]+\\.){2,}${hostShort}\\./ ${NOT_FILTERS}`)}&type=code`,
    github_dork_64: `https://github.com/search?q=${encodeURIComponent(`/couchbase:\\/\\/(?:[a-zA-Z0-9-]+\\.){2,}${hostShort}\\./ ${NOT_FILTERS}`)}&type=code`,
    github_dork_65: `https://github.com/search?q=${encodeURIComponent(`/gserviceaccount.com/ AND /BEGIN PRIVATE KEY/ NOT /@project.iam.gserviceaccount.com/ NOT /your-client-email-here/ NOT /your-service-account/ NOT /@yourproject/ ${NOT_FILTERS}`)}&type=code`,
    github_dork_66: `https://github.com/search?q=${encodeURIComponent(`/confluence[a-zA-Z0-9_-]*\\.(?:[a-zA-Z0-9-]+\\.){2,}${domainOnly}/ AND /[$#^]?Token[[:space:]]*[:=]?[[:space:]]*['"][a-zA-Z1-9-$#^]*/ ${NOT_FILTERS}`)}&type=code`,
    github_dork_67: `https://github.com/search?q=${encodeURIComponent(`/:sap:\\/\\/(?:[a-zA-Z0-9-]+\\.){2,}${domainOnly}/ AND /[$#^]?password[[:space:]]*[:=]?[[:space:]]*['"][a-zA-Z1-9-$#^]*/ ${NOT_FILTERS}`)}&type=code`,
    github_dork_68: `https://github.com/search?q=${encodeURIComponent(`/:sap:\\/\\/(?:[a-zA-Z0-9-]+\\.){2,}${domainOnly}/ AND /[$#^]?secret[[:space:]]*[:=]?[[:space:]]*['"][a-zA-Z1-9-$#^]*/ ${NOT_FILTERS}`)}&type=code`,
    github_dork_69: `https://github.com/search?q=${encodeURIComponent(`/(?:[a-zA-Z0-9-]+\\.){2,}(auth0|okta|jfrog\\.io|onelogin|looker|jenkins)\\.(?:[a-zA-Z0-9-]+\\.)*/ AND /[$#^]?(SECRET|CLIENT_SECRET|password)[[:space:]]*[:=]?[[:space:]]*['"][a-zA-Z1-9-$#^]*/ ${NOT_FILTERS}`)}&type=code`,
    github_dork_70: `https://github.com/search?q=${encodeURIComponent(`/@(?:[a-zA-Z0-9-]+\\.){2,}${hostShort}\\./ ${NOT_FILTERS}`)}&type=code`,
    github_dork_71: `https://github.com/search?q=${encodeURIComponent(`/@(?:[a-zA-Z0-9-]+\\.){2,}${domainOnly}/ ${NOT_FILTERS}`)}&type=code`
  };

  if (urlMap[action]) {
    chrome.tabs.create({ url: urlMap[action], active: false });
  }
}

// add a job tracker and starter to open OTX pages one-by-one, waiting 5s between pages.
// job entry: { stop: bool, nextPage: number, timerId: number, groupId: int|null, tabIds: [] }
const runningOTXJobs = {}; // jobId -> jobEntry

// Broadcast current OTX jobs snapshot to all content scripts (so they can show/hide overlay)
function broadcastOTXJobs() {
  const list = {};
  for (const k in runningOTXJobs) {
    const j = runningOTXJobs[k];
    list[k] = { nextPage: j.nextPage, stop: !!j.stop, groupId: j.groupId, tabCount: j.tabIds.length };
  }
  try {
    // notify other extension contexts (popup, background listeners)
    chrome.runtime.sendMessage({ action: "otx_update", jobs: list });
  } catch (e) {
    console.warn("[OSINT] broadcastOTXJobs runtime.sendMessage failed:", e);
  }

  // Also explicitly send to all tabs so content scripts in every page will remove the overlay immediately.
  try {
    chrome.tabs.query({}, (tabs) => {
      if (!tabs || tabs.length === 0) return;
      tabs.forEach(t => {
        try {
          chrome.tabs.sendMessage(t.id, { action: "otx_update", jobs: list }, () => {
            // ignore errors (tab may not have content script)
          });
        } catch (e) {
          // ignore per-tab send errors
        }
      });
    });
  } catch (e) {
    console.warn("[OSINT] broadcastOTXJobs tabs.sendMessage failed:", e);
  }
}

function stopOTXJob(jobId) {
  const job = runningOTXJobs[jobId];
  if (!job) return false;
  job.stop = true;
  if (job.timerId) {
    clearTimeout(job.timerId);
    job.timerId = null;
  }
  if (typeof job.groupId === "number" && chrome.tabGroups && chrome.tabGroups.update) {
    try { chrome.tabGroups.update(job.groupId, { collapsed: true }); } catch (e) {}
  }
  console.log("[OSINT][OTX] stopped job", jobId);
  // notify content scripts
  broadcastOTXJobs();
  return true;
}

/**
 * Start/continue an OTX job that opens pages one-by-one, waiting 5s between pages.
 * jobType: 'otx_hostname' | 'otx_domain'
 * host: unencoded host
 */
function startOTXJob(jobType, host) {
  const jobId = `${jobType}:${host}`;
  if (runningOTXJobs[jobId] && runningOTXJobs[jobId].timerId) {
    clearTimeout(runningOTXJobs[jobId].timerId);
  }
  runningOTXJobs[jobId] = runningOTXJobs[jobId] || { stop: false, nextPage: 1, timerId: null, groupId: null, tabIds: [] };
  const job = runningOTXJobs[jobId];
  job.stop = false;

  // broadcast that a job exists / changed
  broadcastOTXJobs();

  const encHost = encodeURIComponent(host);
  const endpointBase = jobType === "otx_hostname"
    ? `https://otx.alienvault.com/api/v1/indicator/hostname/${encHost}/url_list?limit=500&page=`
    : `https://otx.alienvault.com/api/v1/indicator/domain/${encHost}/url_list?limit=500&page=`;

  function openNext() {
    if (!runningOTXJobs[jobId] || runningOTXJobs[jobId].stop) {
      console.log(`[OSINT][OTX] job ${jobId} stopped or removed`);
      return;
    }

    const p = runningOTXJobs[jobId].nextPage;
    const url = `${endpointBase}${p}`;
    console.log(`[OSINT][OTX] Opening page ${p} for ${jobId}`);

    try {
      chrome.tabs.create({ url, active: false }, (tab) => {
        if (chrome.runtime.lastError) {
          console.error("[OSINT][OTX] tab.create error:", chrome.runtime.lastError);
          return;
        }
        const tabId = tab.id;
        runningOTXJobs[jobId].tabIds.push(tabId);

        if (typeof runningOTXJobs[jobId].groupId === "number") {
          chrome.tabs.group({ groupId: runningOTXJobs[jobId].groupId, tabIds: tabId }, () => {});
        } else {
          chrome.tabs.group({ tabIds: tabId }, (groupId) => {
            if (!chrome.runtime.lastError && typeof groupId === "number") {
              runningOTXJobs[jobId].groupId = groupId;
              try { chrome.tabGroups.update(groupId, { title: `OTX ${host}`, color: "blue" }); } catch (e) {}
            }
          });
        }
        // broadcast updated job state (tab count / group)
        broadcastOTXJobs();
      });
    } catch (e) {
      console.error("[OSINT][OTX] Failed to open OTX page:", url, e);
    }

    runningOTXJobs[jobId].nextPage = p + 1;

    runningOTXJobs[jobId].timerId = setTimeout(() => {
      if (runningOTXJobs[jobId] && !runningOTXJobs[jobId].stop) openNext();
    }, 5000);
  }

  openNext();
}

// alias (preserve legacy name)
function startOtxJob(jobType, host) {
  return startOTXJob(jobType, host);
}

// listener from content script reporting OTX page JSON status & other commands
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || !msg.action) return;

  if (msg.action === "otx_page_status") {
    const jobId = `${msg.jobType}:${msg.host}`;
    if (runningOTXJobs[jobId]) {
      console.log(`[OSINT][OTX] received status page=${msg.page} has_next=${msg.has_next} for ${jobId}`);
      if (msg.has_next === false) {
        stopOTXJob(jobId);
      }
    }
    sendResponse && sendResponse({ ok: true });
    return;
  }

  if (msg.action === "otx_list") {
    const list = {};
    for (const k in runningOTXJobs) {
      const j = runningOTXJobs[k];
      list[k] = { nextPage: j.nextPage, stop: !!j.stop, groupId: j.groupId, tabCount: j.tabIds.length };
    }
    sendResponse && sendResponse({ ok: true, jobs: list });
    return;
  }

  if (msg.action === "otx_stop") {
    const jobId = msg.jobId;
    const ok = stopOTXJob(jobId);
    sendResponse && sendResponse({ ok });
    return;
  }

  // new: stop all running jobs on demand (from popup overlay/button)
  if (msg.action === "otx_stop_all") {
    try {
      let stoppedAny = false;
      // runningOTXJobs is defined later in file but exists by runtime when handler executes
      if (typeof runningOTXJobs === "object") {
        for (const k in runningOTXJobs) {
          if (typeof stopOTXJob === "function") {
            const r = stopOTXJob(k);
            if (r) stoppedAny = true;
          } else {
            // best-effort: mark stop flag and clear timer if present
            try {
              runningOTXJobs[k].stop = true;
              if (runningOTXJobs[k].timerId) {
                clearTimeout(runningOTXJobs[k].timerId);
                runningOTXJobs[k].timerId = null;
              }
              stoppedAny = true;
            } catch (e) {}  
          }
        }
      }
      // notify content scripts
      if (typeof broadcastOTXJobs === "function") broadcastOTXJobs();
      sendResponse && sendResponse({ ok: stoppedAny });
    } catch (e) {
      console.error("[OSINT] otx_stop_all handler error:", e);
      sendResponse && sendResponse({ ok: false });
    }
    return;
  }

  // NEW: resume all paused OTX jobs
  if (msg.action === "otx_resume_all") {
    try {
      let resumedAny = false;
      if (typeof runningOTXJobs === "object") {
        for (const k in runningOTXJobs) {
          const job = runningOTXJobs[k];
          if (job && job.stop) {
            // key format: jobType:host
            const parts = k.split(":");
            const jobType = parts[0] || null;
            const host = parts.slice(1).join(":") || null;
            if (jobType && host) {
              try {
                // startOTXJob will reuse existing job entry and continue from nextPage
                startOTXJob(jobType, host);
                resumedAny = true;
              } catch (e) {
                console.error("[OSINT] Failed to resume job", k, e);
              }
            }
          }
        }
      }
      if (typeof broadcastOTXJobs === "function") broadcastOTXJobs();
      sendResponse && sendResponse({ ok: resumedAny });
    } catch (e) {
      console.error("[OSINT] otx_resume_all handler error:", e);
      sendResponse && sendResponse({ ok: false });
    }
    return;
  }
});