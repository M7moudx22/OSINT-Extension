console.log("[OSINT] Background script loaded");

// Global keywords for GitHub dorks
let customKeywords = [];
// Global NOT_FILTERS toggle
let useNotFilters = true;
// Global domain level setting (default to 2 levels)
let domainLevel = 2;

// Load keywords, NOT_FILTERS setting, and domain level from storage
chrome.storage?.local.get(
  ["githubKeywords", "useNotFilters", "domainLevel"],
  (result) => {
    if (result.githubKeywords && Array.isArray(result.githubKeywords)) {
      customKeywords = result.githubKeywords;
      console.log("[OSINT] Loaded custom keywords:", customKeywords.length);
    }

    if (typeof result.useNotFilters !== "undefined") {
      useNotFilters = result.useNotFilters;
      console.log("[OSINT] Loaded NOT_FILTERS setting:", useNotFilters);
    }

    if (
      typeof result.domainLevel !== "undefined" &&
      result.domainLevel >= 1 &&
      result.domainLevel <= 3
    ) {
      domainLevel = result.domainLevel;
      console.log("[OSINT] Loaded domain level setting:", domainLevel);
    }
  }
);

// Default keywords fallback
const defaultKeywords = [
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
];

// Get keywords as array (not joined with |)
function getKeywordsArray() {
  return customKeywords.length > 0 ? customKeywords : defaultKeywords;
}

// Get NOT_FILTERS based on global setting
function getNotFilters() {
  return useNotFilters
    ? `NOT xxxx NOT **** NOT 123 NOT changeme NOT example NOT guest NOT localhost NOT fake NOT 1234 NOT xxx NOT 127.0.0.1 NOT test NOT tracker NOT RobotsDisallowed NOT disallowed NOT robots`
    : "";
}

// Get domain level pattern
function getDomainLevelPattern() {
  switch (domainLevel) {
    case 1:
      return "{1,}";
    case 2:
      return "{2,}";
    case 3:
      return "{3,}";
    default:
      return "{2,}";
  }
}

// add a job tracker and starter to open OTX pages one-by-one, waiting 5s between pages.
// job entry: { stop: bool, nextPage: number, timerId: number, groupId: int|null, tabIds: [], pagesToOpen: number, pagesOpened: number }
const runningOTXJobs = {}; // jobId -> jobEntry

// Broadcast current OTX jobs snapshot to all content scripts (so they can show/hide overlay)
function broadcastOTXJobs() {
  const list = {};
  for (const k in runningOTXJobs) {
    const j = runningOTXJobs[k];
    // Only include jobs that are not stopped
    if (!j.stop) {
      list[k] = {
        nextPage: j.nextPage,
        stop: !!j.stop,
        groupId: j.groupId,
        tabCount: j.tabIds.length,
        pagesOpened: j.pagesOpened || 0,
        pagesToOpen: j.pagesToOpen || 5,
      };
    }
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
      tabs.forEach((t) => {
        try {
          chrome.tabs.sendMessage(
            t.id,
            { action: "otx_update", jobs: list },
            () => {
              // ignore errors (tab may not have content script)
            }
          );
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
  if (
    typeof job.groupId === "number" &&
    chrome.tabGroups &&
    chrome.tabGroups.update
  ) {
    try {
      chrome.tabGroups.update(job.groupId, { collapsed: true });
    } catch (e) {}
  }
  console.log("[OSINT][OTX] stopped job", jobId);

  // Remove from runningOTXJobs if fully stopped
  delete runningOTXJobs[jobId];

  // notify content scripts
  broadcastOTXJobs();
  return true;
}

/**
 * Start/continue an OTX job that opens pages one-by-one, waiting 5s between pages.
 * Opens 5 pages by default, then pauses.
 * jobType: 'otx_hostname' | 'otx_domain'
 * host: unencoded host
 */
function startOTXJob(jobType, host) {
  const jobId = `${jobType}:${host}`;

  if (runningOTXJobs[jobId] && runningOTXJobs[jobId].timerId) {
    clearTimeout(runningOTXJobs[jobId].timerId);
  }

  // Initialize or reuse job
  if (!runningOTXJobs[jobId]) {
    runningOTXJobs[jobId] = {
      stop: false,
      nextPage: 1,
      timerId: null,
      groupId: null,
      tabIds: [],
      pagesToOpen: 5, // Default: open 5 pages
      pagesOpened: 0,
    };
  }

  const job = runningOTXJobs[jobId];
  job.stop = false;

  // If resuming, add 5 more pages to open
  if (job.pagesOpened > 0) {
    job.pagesToOpen = job.pagesOpened + 5;
  }

  broadcastOTXJobs();

  const encHost = encodeURIComponent(host);
  const endpointBase =
    jobType === "otx_hostname"
      ? `https://otx.alienvault.com/api/v1/indicator/hostname/${encHost}/url_list?limit=500&page=`
      : `https://otx.alienvault.com/api/v1/indicator/domain/${encHost}/url_list?limit=500&page=`;

  function openNext() {
    if (!runningOTXJobs[jobId] || runningOTXJobs[jobId].stop) {
      console.log(`[OSINT][OTX] job ${jobId} stopped or removed`);
      return;
    }

    // Check if we've opened enough pages
    if (job.pagesOpened >= job.pagesToOpen) {
      console.log(
        `[OSINT][OTX] job ${jobId} reached page limit (${job.pagesToOpen})`
      );
      job.stop = true;
      broadcastOTXJobs();
      return;
    }

    const p = job.nextPage;
    const url = `${endpointBase}${p}`;
    console.log(
      `[OSINT][OTX] Opening page ${p} for ${jobId} (${job.pagesOpened + 1}/${
        job.pagesToOpen
      })`
    );

    try {
      chrome.tabs.create({ url, active: false }, (tab) => {
        if (chrome.runtime.lastError) {
          console.error(
            "[OSINT][OTX] tab.create error:",
            chrome.runtime.lastError
          );
          return;
        }
        const tabId = tab.id;
        job.tabIds.push(tabId);
        job.pagesOpened++;

        if (typeof job.groupId === "number") {
          chrome.tabs.group({ groupId: job.groupId, tabIds: tabId }, () => {});
        } else {
          chrome.tabs.group({ tabIds: tabId }, (groupId) => {
            if (!chrome.runtime.lastError && typeof groupId === "number") {
              job.groupId = groupId;
              try {
                chrome.tabGroups.update(groupId, {
                  title: `OTX ${host}`,
                  color: "blue",
                });
              } catch (e) {}
            }
          });
        }
        broadcastOTXJobs();
      });
    } catch (e) {
      console.error("[OSINT][OTX] Failed to open OTX page:", url, e);
    }

    job.nextPage = p + 1;

    job.timerId = setTimeout(() => {
      if (runningOTXJobs[jobId] && !runningOTXJobs[jobId].stop) {
        openNext();
      }
    }, 5000);
  }

  openNext();
}

// alias (preserve legacy name)
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
        contexts: ["page", "selection", "link"],
      });

      // Group parents
      const groups = {
        search: { id: "grp_search", title: "Search Engines" },
        archives: { id: "grp_archives", title: "Archives" },
        certs: { id: "grp_certs", title: "Certs & Enum Subdomains" },
        leakix: { id: "grp_leakix", title: "leakix & Others" },
        shodan_ips: { id: "grp_shodan_ips", title: "Shodan & IPs Discovery" },
        github_dorking: {
          id: "grp_github_dorking",
          title: "GitHub Dorking (Advanced)",
        },
        // GitHub sub-categories
        github_email: {
          id: "grp_github_email",
          title: "Email & Username Patterns",
          parent: "grp_github_dorking",
        },
        github_url: {
          id: "grp_github_url",
          title: "URL Protocol / URL Exposure",
          parent: "grp_github_dorking",
        },
        github_creds: {
          id: "grp_github_creds",
          title: "Credentials in URLs",
          parent: "grp_github_dorking",
        },
        github_secrets: {
          id: "grp_github_secrets",
          title: "Secrets / Tokens",
          parent: "grp_github_dorking",
        },
        github_env: {
          id: "grp_github_env",
          title: "Environment Files (.env)",
          parent: "grp_github_dorking",
        },
        github_jdbc: {
          id: "grp_github_jdbc",
          title: "JDBC / Database Credentials",
          parent: "grp_github_dorking",
        },
        github_servicenow: {
          id: "grp_github_servicenow",
          title: "ServiceNow",
          parent: "grp_github_dorking",
        },
        github_cicd: {
          id: "grp_github_cicd",
          title: "CI/CD Platforms",
          parent: "grp_github_dorking",
        },
        github_cloud: {
          id: "grp_github_cloud",
          title: "Cloud & Auth Platforms",
          parent: "grp_github_dorking",
        },
        github_misc: {
          id: "grp_github_misc",
          title: "Miscellaneous",
          parent: "grp_github_dorking",
        },
      };

      // Create main groups
      Object.values(groups).forEach((g) => {
        if (!g.parent) {
          chrome.contextMenus.create({
            id: g.id,
            parentId: "osint_parent",
            title: g.title,
            contexts: ["page", "selection", "link"],
          });
        }
      });

      // Create GitHub sub-groups
      Object.values(groups).forEach((g) => {
        if (g.parent) {
          chrome.contextMenus.create({
            id: g.id,
            parentId: g.parent,
            title: g.title,
            contexts: ["page", "selection", "link"],
          });
        }
      });

      // Regular tools
      const tools = [
        // Search Engines
        {
          id: "bing_search",
          title: "Bing Search (site:)",
          parent: groups.search.id,
        },
        {
          id: "google_search",
          title: "Google Search (site:)",
          parent: groups.search.id,
        },
        {
          id: "duckduckgo",
          title: "DuckDuckGo (site:)",
          parent: groups.search.id,
        },
        { id: "yandex", title: "Yandex (site:)", parent: groups.search.id },

        // Archives
        {
          id: "wayback_web",
          title: "Wayback GUI (web/*/domain/*)",
          parent: groups.archives.id,
        },
        {
          id: "archive_full",
          title: "Wayback CDX (Full filters)",
          parent: groups.archives.id,
        },
        {
          id: "archive_simple",
          title: "Wayback CDX (Simple)",
          parent: groups.archives.id,
        },
        {
          id: "virustotal",
          title: "VirusTotal (domain)",
          parent: groups.archives.id,
        },
        {
          id: "virustotal_ip",
          title: "VirusTotal (IP)",
          parent: groups.archives.id,
        },
        {
          id: "urlscan",
          title: "URLScan (search)",
          parent: groups.archives.id,
        },
        {
          id: "otx_hostname",
          title: "OTX (Hostname)",
          parent: groups.archives.id,
        },
        { id: "otx_domain", title: "OTX (Domain)", parent: groups.archives.id },

        // Certs & Enum Subdomains
        {
          id: "securitytrails",
          title: "SecurityTrails (apex)",
          parent: groups.certs.id,
        },
        { id: "crtsh_cn", title: "crt.sh CN=", parent: groups.certs.id },
        { id: "crtsh_o", title: "crt.sh O=", parent: groups.certs.id },
        {
          id: "subdomainfinder",
          title: "SubdomainFinder (c99 scan)",
          parent: groups.certs.id,
        },

        // Shodan & IPs Discovery
        {
          id: "shodan_ssl",
          title: "Shodan (ssl)",
          parent: groups.shodan_ips.id,
        },
        {
          id: "shodan_org",
          title: "Shodan (org)",
          parent: groups.shodan_ips.id,
        },
        {
          id: "shodan_cn",
          title: "Shodan (ssl.cert.CN)",
          parent: groups.shodan_ips.id,
        },
        {
          id: "netlas_host",
          title: "Netlas (Host pattern)",
          parent: groups.shodan_ips.id,
        },
        {
          id: "netlas_subdomain",
          title: "Netlas (Subdomain & A records)",
          parent: groups.shodan_ips.id,
        },
        {
          id: "rapiddns",
          title: "RapidDNS (same IP)",
          parent: groups.shodan_ips.id,
        },

        // Leak & OTX
        {
          id: "leakix_plugin",
          title: "LeakIX (GitConfigHttpPlugin)",
          parent: groups.leakix.id,
        },
        {
          id: "leakix_service",
          title: "LeakIX (service host)",
          parent: groups.leakix.id,
        },
        {
          id: "leakix_recent",
          title: "LeakIX (recent GitConfigHttpPlugin)",
          parent: groups.leakix.id,
        },
        {
          id: "toolbox_dig",
          title: "Google Toolbox DIG (CNAME)",
          parent: groups.leakix.id,
        },
        {
          id: "csp_evaluator",
          title: "CSP Evaluator (Google)",
          parent: groups.leakix.id,
        },
        {
          id: "sslshopper",
          title: "SSLShopper Checker",
          parent: groups.leakix.id,
        },
      ];

      // Add all tools
      tools.forEach((tool) => {
        chrome.contextMenus.create({
          id: tool.id,
          title: tool.title,
          parentId: tool.parent,
          contexts: ["page", "selection", "link"],
        });
      });

      console.log("[OSINT] All context menus created successfully!");
    });
  } catch (e) {
    console.error("[OSINT] Error during menu creation:", e);
  }
});

// Add GitHub dork context menus after the main ones are created
setTimeout(() => {
  try {
    const githubDorks = [
      // Email & Username Patterns (1-4)
      {
        id: "github_dork_1",
        title: "Email pattern (3+ subdomains to SLD)",
        parent: "grp_github_email",
      },
      {
        id: "github_dork_2",
        title: "Email pattern (3+ subdomains to domain)",
        parent: "grp_github_email",
      },

      // URL Protocol / URL Exposure (3-6)
      {
        id: "github_dork_3",
        title: "URL with protocol (3+ subdomains to domain)",
        parent: "grp_github_url",
      },
      {
        id: "github_dork_4",
        title: "URL with protocol (3+ subdomains to SLD)",
        parent: "grp_github_url",
      },
      {
        id: "github_dork_5",
        title: "URL with protocol + keywords",
        parent: "grp_github_url",
      },
      {
        id: "github_dork_6",
        title: "Email pattern + keywords",
        parent: "grp_github_url",
      },

      // Credentials in URLs (7-8)
      {
        id: "github_dork_7",
        title: "Email pattern + keywords + .env",
        parent: "grp_github_creds",
      },
      {
        id: "github_dork_8",
        title: "Email pattern + keywords",
        parent: "grp_github_creds",
      },

      // Secrets / Tokens (9)
      {
        id: "github_dork_9",
        title: "Org search + keywords",
        parent: "grp_github_secrets",
      },

      // ServiceNow (10-15)
      {
        id: "github_dork_10",
        title: "ServiceNow host pattern 1",
        parent: "grp_github_servicenow",
      },
      {
        id: "github_dork_11",
        title: "ServiceNow host pattern 2",
        parent: "grp_github_servicenow",
      },
      {
        id: "github_dork_12",
        title: "ServiceNow host pattern 3",
        parent: "grp_github_servicenow",
      },
      {
        id: "github_dork_13",
        title: "ServiceNow host pattern 4",
        parent: "grp_github_servicenow",
      },
      {
        id: "github_dork_14",
        title: "ServiceNow reversed 1",
        parent: "grp_github_servicenow",
      },
      {
        id: "github_dork_15",
        title: "ServiceNow reversed 2",
        parent: "grp_github_servicenow",
      },

      // JDBC / Database Credentials (16-20)
      {
        id: "github_dork_16",
        title: "JDBC URL + keywords",
        parent: "grp_github_jdbc",
      },
      {
        id: "github_dork_17",
        title: "JDBC without protocol",
        parent: "grp_github_jdbc",
      },
      {
        id: "github_dork_18",
        title: "JDBC with protocol + keywords",
        parent: "grp_github_jdbc",
      },
      {
        id: "github_dork_19",
        title: "JDBC with @// + keywords",
        parent: "grp_github_jdbc",
      },
      {
        id: "github_dork_20",
        title: "JDBC with @ + keywords",
        parent: "grp_github_jdbc",
      },

      // CI/CD Platforms - Jenkins (21-22)
      {
        id: "github_dork_21",
        title: "Jenkins + short keywords",
        parent: "grp_github_cicd",
      },
      {
        id: "github_dork_22",
        title: "Jenkins + full keywords",
        parent: "grp_github_cicd",
      },

      // CI/CD Platforms - JFrog (23-24)
      {
        id: "github_dork_23",
        title: "JFrog + short keywords",
        parent: "grp_github_cicd",
      },
      {
        id: "github_dork_24",
        title: "JFrog + full keywords",
        parent: "grp_github_cicd",
      },

      // CI/CD Platforms - GitLab (25-26)
      {
        id: "github_dork_25",
        title: "GitLab + short keywords",
        parent: "grp_github_cicd",
      },
      {
        id: "github_dork_26",
        title: "GitLab + full keywords",
        parent: "grp_github_cicd",
      },

      // CI/CD Platforms - GitHub (27-28)
      {
        id: "github_dork_27",
        title: "GitHub + short keywords",
        parent: "grp_github_cicd",
      },
      {
        id: "github_dork_28",
        title: "GitHub + full keywords",
        parent: "grp_github_cicd",
      },

      // ServiceNow with domain (29-30)
      {
        id: "github_dork_29",
        title: "ServiceNow to domain",
        parent: "grp_github_servicenow",
      },
      {
        id: "github_dork_30",
        title: "ServiceNow to domain 2",
        parent: "grp_github_servicenow",
      },

      // JDBC with domain (31-35)
      {
        id: "github_dork_31",
        title: "JDBC URL to domain + keywords",
        parent: "grp_github_jdbc",
      },
      {
        id: "github_dork_32",
        title: "JDBC without protocol to domain",
        parent: "grp_github_jdbc",
      },
      {
        id: "github_dork_33",
        title: "JDBC with protocol to domain + keywords",
        parent: "grp_github_jdbc",
      },
      {
        id: "github_dork_34",
        title: "JDBC with @// to domain + keywords",
        parent: "grp_github_jdbc",
      },
      {
        id: "github_dork_35",
        title: "JDBC with @ to domain + keywords",
        parent: "grp_github_jdbc",
      },

      // CI/CD Platforms with domain - Jenkins (36-37)
      {
        id: "github_dork_36",
        title: "Jenkins to domain + short keywords",
        parent: "grp_github_cicd",
      },
      {
        id: "github_dork_37",
        title: "Jenkins to domain + full keywords",
        parent: "grp_github_cicd",
      },

      // CI/CD Platforms with domain - JFrog (38-39)
      {
        id: "github_dork_38",
        title: "JFrog to domain + short keywords",
        parent: "grp_github_cicd",
      },
      {
        id: "github_dork_39",
        title: "JFrog to domain + full keywords",
        parent: "grp_github_cicd",
      },

      // CI/CD Platforms with domain - GitLab (40-41)
      {
        id: "github_dork_40",
        title: "GitLab to domain + short keywords",
        parent: "grp_github_cicd",
      },
      {
        id: "github_dork_41",
        title: "GitLab to domain + full keywords",
        parent: "grp_github_cicd",
      },

      // CI/CD Platforms with domain - GitHub (42-43)
      {
        id: "github_dork_42",
        title: "GitHub to domain + short keywords",
        parent: "grp_github_cicd",
      },
      {
        id: "github_dork_43",
        title: "GitHub to domain + full keywords",
        parent: "grp_github_cicd",
      },

      // Enterprise Apps (44-49)
      {
        id: "github_dork_44",
        title: "Confluence + short keywords",
        parent: "grp_github_misc",
      },
      {
        id: "github_dork_45",
        title: "SAP + full keywords",
        parent: "grp_github_misc",
      },
      {
        id: "github_dork_46",
        title: "ODBC connections",
        parent: "grp_github_misc",
      },
      {
        id: "github_dork_47",
        title: "MongoDB connections",
        parent: "grp_github_misc",
      },
      {
        id: "github_dork_48",
        title: "Redis connections",
        parent: "grp_github_misc",
      },
      {
        id: "github_dork_49",
        title: "Couchbase connections",
        parent: "grp_github_misc",
      },

      // Cloud Keys (50, 53-57)
      {
        id: "github_dork_50",
        title: "GCP Service Accounts",
        parent: "grp_github_cloud",
      },
      {
        id: "github_dork_53",
        title: "Auth0 + keywords",
        parent: "grp_github_cloud",
      },
      {
        id: "github_dork_54",
        title: "Okta + keywords",
        parent: "grp_github_cloud",
      },
      {
        id: "github_dork_55",
        title: "JFrog.io + keywords",
        parent: "grp_github_cloud",
      },
      {
        id: "github_dork_56",
        title: "OneLogin + keywords",
        parent: "grp_github_cloud",
      },
      {
        id: "github_dork_57",
        title: "Looker + keywords",
        parent: "grp_github_cloud",
      },
      {
        id: "github_dork_58",
        title: "Jenkins generic + keywords",
        parent: "grp_github_cloud",
      },

      // Miscellaneous (51-52)
      {
        id: "github_dork_51",
        title: "Confluence to domain + keywords",
        parent: "grp_github_misc",
      },
      {
        id: "github_dork_52",
        title: "SAP to domain + keywords",
        parent: "grp_github_misc",
      },
    ];

    // Add GitHub dorks
    githubDorks.forEach((dork) => {
      chrome.contextMenus.create({
        id: dork.id,
        title: dork.title,
        parentId: dork.parent,
        contexts: ["page", "selection", "link"],
      });
    });

    console.log("[OSINT] GitHub dork context menus created!");
  } catch (e) {
    console.error("[OSINT] Error creating GitHub dork menus:", e);
  }
}, 100);

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
    chrome.tabs.sendMessage(
      tab.id,
      { action, text },
      { frameId: 0 },
      (resp) => {
        if (chrome.runtime.lastError) {
          console.warn("[OSINT] Content script not available");
          processActionInBackground(action, text);
        }
      }
    );
  }
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  // Handle keyword upload
  if (msg.action === "uploadKeywords") {
    try {
      const keywords = msg.keywords || [];
      if (Array.isArray(keywords) && keywords.length > 0) {
        customKeywords = [
          ...new Set(keywords.map((k) => k.trim()).filter((k) => k)),
        ];
        // Save to storage
        if (chrome.storage?.local) {
          chrome.storage.local.set({ githubKeywords: customKeywords }, () => {
            console.log("[OSINT] Keywords saved:", customKeywords.length);
            // Broadcast to popup
            chrome.runtime.sendMessage({ action: "keywords_updated" });
            sendResponse({ ok: true, count: customKeywords.length });
          });
        } else {
          sendResponse({ ok: true, count: customKeywords.length });
        }
      } else {
        sendResponse({ ok: false, error: "No valid keywords provided" });
      }
    } catch (e) {
      console.error("[OSINT] Keyword upload error:", e);
      sendResponse({ ok: false, error: e.message });
    }
    return true;
  }

  // Handle NOT_FILTERS toggle
  if (msg.action === "toggleNotFilters") {
    useNotFilters = msg.enabled || false;
    // Save to storage
    if (chrome.storage?.local) {
      chrome.storage.local.set({ useNotFilters: useNotFilters }, () => {
        console.log("[OSINT] NOT_FILTERS setting saved:", useNotFilters);
        // Broadcast to popup
        chrome.runtime.sendMessage({
          action: "not_filters_updated",
          enabled: useNotFilters,
        });
        sendResponse({ ok: true, enabled: useNotFilters });
      });
    } else {
      sendResponse({ ok: true, enabled: useNotFilters });
    }
    return true;
  }

  // Handle get NOT_FILTERS setting
  if (msg.action === "getNotFilters") {
    sendResponse({ ok: true, enabled: useNotFilters });
    return true;
  }

  // Handle domain level setting
  if (msg.action === "setDomainLevel") {
    const level = msg.level;
    if (level >= 1 && level <= 3) {
      domainLevel = level;
      // Save to storage
      if (chrome.storage?.local) {
        chrome.storage.local.set({ domainLevel: level }, () => {
          console.log("[OSINT] Domain level saved:", level);
          // Broadcast to popup
          chrome.runtime.sendMessage({
            action: "domain_level_updated",
            level: level,
          });
          sendResponse({ ok: true, level: level });
        });
      } else {
        sendResponse({ ok: true, level: level });
      }
    } else {
      sendResponse({ ok: false, error: "Invalid domain level" });
    }
    return true;
  }

  // Handle get domain level
  if (msg.action === "getDomainLevel") {
    sendResponse({ ok: true, level: domainLevel });
    return true;
  }

  // Handle keyword reset
  if (msg.action === "resetKeywords") {
    customKeywords = [];
    if (chrome.storage?.local) {
      chrome.storage.local.remove("githubKeywords", () => {
        console.log("[OSINT] Keywords reset to default");
        // Broadcast to popup
        chrome.runtime.sendMessage({ action: "keywords_updated" });
        sendResponse({ ok: true });
      });
    } else {
      sendResponse({ ok: true });
    }
    return true;
  }

  // Handle get keywords
  if (msg.action === "getKeywords") {
    const keywords =
      customKeywords.length > 0 ? customKeywords : defaultKeywords;
    sendResponse({ ok: true, keywords, isCustom: customKeywords.length > 0 });
    return true;
  }

  // Handle executeKeywordDork - for GitHub dorks with keywords
  if (msg.action === "executeKeywordDork") {
    const { type, text, domain, SLD, domainOnly } = msg;
    const keywordsArray = getKeywordsArray();

    if (keywordsArray.length === 0) {
      // Use default if no keywords
      keywordsArray.push("password");
    }

    console.log(
      `[OSINT] Opening ${keywordsArray.length} tabs for ${type} with individual keywords`
    );

    // Get domain level pattern
    const domainPattern = getDomainLevelPattern();

    // Open a tab for each keyword
    keywordsArray.forEach((keyword, index) => {
      setTimeout(() => {
        try {
          const url = getGitHubDorkURL(
            type,
            domain,
            SLD,
            domainOnly,
            keyword,
            domainPattern
          );
          if (url) {
            chrome.tabs.create({ url, active: false });
          }
        } catch (e) {
          console.error(
            `[OSINT] Error creating GitHub dork tab for keyword "${keyword}":`,
            e
          );
        }
      }, index * 300); // Stagger tab creation
    });

    sendResponse && sendResponse({ ok: true, count: keywordsArray.length });
    return true;
  }

  // Handle OTX control messages globally here so content overlay always works
  if (msg.action === "otx_stop_all") {
    try {
      let stoppedAny = false;
      if (typeof runningOTXJobs === "object") {
        for (const k in runningOTXJobs) {
          if (typeof stopOTXJob === "function") {
            const r = stopOTXJob(k);
            if (r) stoppedAny = true;
          } else {
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
      const ok =
        typeof stopOTXJob === "function"
          ? stopOTXJob(jobId)
          : runningOTXJobs[jobId]
          ? ((runningOTXJobs[jobId].stop = true), true)
          : false;
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
          // Only include jobs that are not stopped
          if (!j.stop) {
            list[k] = {
              nextPage: j.nextPage,
              stop: !!j.stop,
              groupId: j.groupId,
              tabCount: j.tabIds.length,
              pagesOpened: j.pagesOpened || 0,
              pagesToOpen: j.pagesToOpen || 5,
            };
          }
        }
      }
      sendResponse && sendResponse({ ok: true, jobs: list });
    } catch (e) {
      console.error("[OSINT] otx_list handler error:", e);
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
            // Resume the job by calling startOTXJob
            const parts = k.split(":");
            const jobType = parts[0] || null;
            const host = parts.slice(1).join(":") || null;
            if (jobType && host) {
              try {
                // Add 5 more pages to open when resuming
                job.pagesToOpen = (job.pagesOpened || 0) + 5;
                job.stop = false;

                // Continue opening pages
                const encHost = encodeURIComponent(host);
                const endpointBase =
                  jobType === "otx_hostname"
                    ? `https://otx.alienvault.com/api/v1/indicator/hostname/${encHost}/url_list?limit=500&page=`
                    : `https://otx.alienvault.com/api/v1/indicator/domain/${encHost}/url_list?limit=500&page=`;

                function openNext() {
                  if (!job || job.stop) {
                    console.log(`[OSINT][OTX] job ${k} stopped or removed`);
                    return;
                  }

                  // Check if we've opened enough pages
                  if (job.pagesOpened >= job.pagesToOpen) {
                    console.log(
                      `[OSINT][OTX] job ${k} reached page limit (${job.pagesToOpen})`
                    );
                    job.stop = true;
                    broadcastOTXJobs();
                    return;
                  }

                  const p = job.nextPage;
                  const url = `${endpointBase}${p}`;
                  console.log(
                    `[OSINT][OTX] Opening page ${p} for ${k} (${
                      job.pagesOpened + 1
                    }/${job.pagesToOpen})`
                  );

                  try {
                    chrome.tabs.create({ url, active: false }, (tab) => {
                      if (chrome.runtime.lastError) {
                        console.error(
                          "[OSINT][OTX] tab.create error:",
                          chrome.runtime.lastError
                        );
                        return;
                      }
                      const tabId = tab.id;
                      job.tabIds.push(tabId);
                      job.pagesOpened++;

                      if (typeof job.groupId === "number") {
                        chrome.tabs.group(
                          { groupId: job.groupId, tabIds: tabId },
                          () => {}
                        );
                      }
                      broadcastOTXJobs();
                    });
                  } catch (e) {
                    console.error(
                      "[OSINT][OTX] Failed to open OTX page:",
                      url,
                      e
                    );
                  }

                  job.nextPage = p + 1;

                  job.timerId = setTimeout(() => {
                    if (job && !job.stop) {
                      openNext();
                    }
                  }, 5000);
                }

                openNext();
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

  // Existing handlers for openTabs / executeAction
  console.log("[OSINT] Background received message:", msg.action || msg.type);

  if (!msg || (!msg.action && !msg.type)) {
    sendResponse && sendResponse({ ok: false });
    return;
  }

  const action = msg.type || msg.action;
  const text = msg.text || "";

  if (msg.action === "openTabs" && Array.isArray(msg.urls)) {
    msg.urls.forEach((url) => {
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
    const m = text.match(/([A-Za-z0-9.-]+\.[A-Za-z]{2,})/i);
    return m && m[1] ? m[1].replace(/^www\./i, "") : "";
  } catch (e) {
    return "";
  }
}

function openUrls(urls) {
  if (!Array.isArray(urls)) return;
  urls.forEach((u) => {
    try {
      chrome.tabs.create({ url: u, active: false });
    } catch (e) {
      console.error("[OSINT] openUrls error:", e);
    }
  });
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
    if (typeof startOTXJob === "function") {
      startOTXJob(action, host);
    }
    return;
  }

  console.log("[OSINT] Processing action:", action, "Host:", host);

  const parts = host.split(".");
  const SLD = parts.length >= 2 ? parts[parts.length - 2] : parts[0];
  const domain = parts.length >= 2 ? parts.slice(-2).join(".") : parts[0];

  // pre-encode host parts so URLs are safe
  const encHost = encodeURIComponent(host);
  const encSLD = encodeURIComponent(SLD);
  const encDomain = encodeURIComponent(domain);

  // Get keywords array
  const keywordsArray = getKeywordsArray();

  // Get domain level pattern
  const domainPattern = getDomainLevelPattern();

  // List of actions that use keywords and should open multiple tabs
  const keywordDorkActions = [
    "github_dork_5",
    "github_dork_6",
    "github_dork_7",
    "github_dork_8",
    "github_dork_9",
    "github_dork_16",
    "github_dork_18",
    "github_dork_19",
    "github_dork_20",
    "github_dork_21",
    "github_dork_22",
    "github_dork_23",
    "github_dork_24",
    "github_dork_25",
    "github_dork_26",
    "github_dork_27",
    "github_dork_28",
    "github_dork_31",
    "github_dork_33",
    "github_dork_34",
    "github_dork_35",
    "github_dork_36",
    "github_dork_37",
    "github_dork_38",
    "github_dork_39",
    "github_dork_40",
    "github_dork_41",
    "github_dork_42",
    "github_dork_43",
    "github_dork_44",
    "github_dork_45",
    "github_dork_51",
    "github_dork_52",
    "github_dork_53",
    "github_dork_54",
    "github_dork_55",
    "github_dork_56",
    "github_dork_57",
    "github_dork_58",
  ];

  // If this action uses keywords and we have multiple keywords, open separate tabs
  if (keywordDorkActions.includes(action) && keywordsArray.length > 0) {
    console.log(
      `[OSINT] Opening ${keywordsArray.length} tabs for ${action} with individual keywords`
    );

    // For each keyword, create a separate URL and open a tab
    keywordsArray.forEach((keyword, index) => {
      setTimeout(() => {
        try {
          // Get the URL for this action with the specific keyword
          const url = getURLForAction(
            action,
            host,
            SLD,
            domain,
            keyword,
            domainPattern
          );
          if (url) {
            chrome.tabs.create({ url, active: false });
          }
        } catch (e) {
          console.error(
            `[OSINT] Error creating tab for keyword "${keyword}":`,
            e
          );
        }
      }, index * 300);
    });

    return;
  }

  // For non-keyword actions, use the original single URL logic
  const urlMap = {
    // Search Engines
    google_search: `https://www.google.com/search?q=site%3A${encHost}`,
    bing_search: `https://www.bing.com/search?q=site%3A${encHost}`,
    duckduckgo: `https://duckduckgo.com/?q=site%3A${encHost}`,
    yandex: `https://yandex.com/search/?text=site%3A${encHost}`,

    // Archives
    wayback_web: `https://web.archive.org/web/*/${encHost}/*`,
    archive_full: `https://web.archive.org/cdx/search/cdx?url=*.${encHost}&fl=original&collapse=urlkey`,
    archive_simple: `https://web.archive.org/cdx/search/cdx?url=*.${encHost}&fl=original&collapse=urlkey&filter=!mimetype:warc/revisit|text/css|image/jpeg|image/jpg|image/png|image/svg.xml|image/gif|image/tiff|image/webp|image/bmp|image/vnd|image/x-icon|font/ttf|font/woff|font/woff2|font/x-woff2|font/x-woff|font/otf|audio/mpeg|audio/wav|audio/webm|audio/aac|audio/ogg|audio/wav|audio/webm|video/mp4|video/mpeg|video/webm|video/ogg|video/mp2t|video/webm|video/x-msvideo|video/x-flv|application/font-woff|application/font-woff2|application/x-font-woff|application/x-font-woff2|application/vnd.ms-fontobject|application/font-sfnt|application/vnd.android.package-archive|binary/octet-stream|application/octet-stream|application/pdf|application/x-font-ttf|application/x-font-otf|video/webm|video/3gpp|application/font-ttf|audio/mp3|audio/x-wav|image/pjpeg|audio/basic|application/font-otf`,
    virustotal: `https://www.virustotal.com/vtapi/v2/domain/report?apikey=44649223c3e852464365e9b5825962e5abc258f38f066dcdd57ad5224d35f3fb&domain=${encHost}`,
    virustotal_ip: `https://www.virustotal.com/vtapi/v2/ip-address/report?apikey=44649223c3e852464365e9b5825962e5abc258f38f066dcdd57ad5224d35f3fb&ip=${encHost}`,
    urlscan: `https://urlscan.io/search/#${encHost}`,
    otx_hostname: `https://otx.alienvault.com/api/v1/indicator/hostname/${encHost}/url_list?limit=500&page=1`,
    otx_domain: `https://otx.alienvault.com/api/v1/indicator/domain/${encHost}/url_list?limit=500&page=1`,

    // Certs & Subdomains
    securitytrails: `https://securitytrails.com/list/apex_domain/${encHost}`,
    crtsh_cn: `https://crt.sh/?CN=${encHost}`,
    crtsh_o: `https://crt.sh/?O=${encSLD}`,
    subdomainfinder: `https://subdomainfinder.c99.nl/`,

    // Shodan & IPs
    shodan_ssl: `https://www.shodan.io/search?query=ssl%3A%22${encHost}%22`,
    shodan_org: `https://www.shodan.io/search?query=org%3A%22${encSLD}%22`,
    shodan_cn: `https://www.shodan.io/search?query=ssl.cert.subject.CN%3A%22${encHost}%22`,
    netlas_host: `https://app.netlas.io/domains/?q=domain%3A${encHost}`,
    netlas_subdomain: `https://app.netlas.io/domains/?q=domain%3A*.${encHost}`,
    rapiddns: `https://rapiddns.io/sameip/${encHost}`,

    // Leakix & Others
    leakix_plugin: `https://leakix.net/search?scope=leak&q=%2Bplugin%3A%22GitConfigHttpPlugin%22+${encHost}`,
    leakix_service: `https://leakix.net/search?scope=leak&q=${encHost}`,
    leakix_recent: `https://leakix.net/search?scope=leak&q=%2Bcreation_date%3A%3E2025-10-01`,
    toolbox_dig: `https://toolbox.googleapps.com/apps/dig/#CNAME/${encHost}`,
    csp_evaluator: `https://csp-evaluator.withgoogle.com/`,
    sslshopper: `https://www.sslshopper.com/ssl-checker.html#hostname=${encHost}`,

    // GitHub Dorks without keywords (single tab)
    github_dork_1: `https://github.com/search?q=${encodeURIComponent(
      `/@(?:[a-zA-Z0-9-]+\\.)${domainPattern}${SLD}\\./ ${getNotFilters()}`
    )}&type=code`,
    github_dork_2: `https://github.com/search?q=${encodeURIComponent(
      `/@(?:[a-zA-Z0-9-]+\\.)${domainPattern}${domain}/ ${getNotFilters()}`
    )}&type=code`,
    github_dork_3: `https://github.com/search?q=${encodeURIComponent(
      `/[a-zA-Z0-9-]+:\\/\\/(?:[a-zA-Z0-9-]+\\.)${domainPattern}${domain}/ ${getNotFilters()}`
    )}&type=code`,
    github_dork_4: `https://github.com/search?q=${encodeURIComponent(
      `/[a-zA-Z0-9-]+:\\/\\/(?:[a-zA-Z0-9-]+\\.)${domainPattern}${SLD}\\./ ${getNotFilters()}`
    )}&type=code`,
    github_dork_10: `https://github.com/search?q=${encodeURIComponent(
      `/${SLD}(?:[a-zA-Z0-9-]+\\.)+service-now\\.com/`
    )}&type=code`,
    github_dork_11: `https://github.com/search?q=${encodeURIComponent(
      `/${SLD}(?:[a-zA-Z0-9-]+\\.)+servicenow\\.com/`
    )}&type=code`,
    github_dork_12: `https://github.com/search?q=${encodeURIComponent(
      `/${SLD}(?:[a-zA-Z0-9-]+\\.){2,}service-now\\.com/`
    )}&type=code`,
    github_dork_13: `https://github.com/search?q=${encodeURIComponent(
      `/${SLD}(?:[a-zA-Z0-9-]+\\.){2,}servicenow\\.com/`
    )}&type=code`,
    github_dork_14: `https://github.com/search?q=${encodeURIComponent(
      `/servicenow\\.(?:[a-zA-Z0-9-]+\\.)${domainPattern}${SLD}\\./ ${getNotFilters()}`
    )}&type=code`,
    github_dork_15: `https://github.com/search?q=${encodeURIComponent(
      `/service-now\\.(?:[a-zA-Z0-9-]+\\.)${domainPattern}${SLD}\\./ ${getNotFilters()}`
    )}&type=code`,
    github_dork_17: `https://github.com/search?q=${encodeURIComponent(
      `/jdbc:[a-zA-Z0-9-]+:[a-zA-Z0-9-]+:(?:[a-zA-Z0-9-]+\\.)${domainPattern}${SLD}\\./ ${getNotFilters()}`
    )}&type=code`,
    github_dork_29: `https://github.com/search?q=${encodeURIComponent(
      `/servicenow\\.(?:[a-zA-Z0-9-]+\\.)${domainPattern}${domain}/ ${getNotFilters()}`
    )}&type=code`,
    github_dork_30: `https://github.com/search?q=${encodeURIComponent(
      `/service-now\\.(?:[a-zA-Z0-9-]+\\.)${domainPattern}${domain}/ ${getNotFilters()}`
    )}&type=code`,
    github_dork_32: `https://github.com/search?q=${encodeURIComponent(
      `/jdbc:[a-zA-Z0-9-]+:[a-zA-Z0-9-]+:(?:[a-zA-Z0-9-]+\\.)${domainPattern}${domain}/ ${getNotFilters()}`
    )}&type=code`,
    github_dork_46: `https://github.com/search?q=${encodeURIComponent(
      `/odbc:[a-zA-Z0-9-]+:\\/\\/(?:[a-zA-Z0-9-]+\\.)${domainPattern}${SLD}\\./ ${getNotFilters()}`
    )}&type=code`,
    github_dork_47: `https://github.com/search?q=${encodeURIComponent(
      `/mongodb:\\/\\/(?:[a-zA-Z0-9-]+\\.)${domainPattern}${SLD}\\./ ${getNotFilters()}`
    )}&type=code`,
    github_dork_48: `https://github.com/search?q=${encodeURIComponent(
      `/redis:\\/\\/(?:[a-zA-Z0-9-]+\\.)${domainPattern}${SLD}\\./ ${getNotFilters()}`
    )}&type=code`,
    github_dork_49: `https://github.com/search?q=${encodeURIComponent(
      `/couchbase:\\/\\/(?:[a-zA-Z0-9-]+\\.)${domainPattern}${SLD}\\./ ${getNotFilters()}`
    )}&type=code`,
    github_dork_50: `https://github.com/search?q=${encodeURIComponent(
      `/gserviceaccount.com/ AND /BEGIN PRIVATE KEY/ NOT /@project.iam.gserviceaccount.com/ NOT /your-client-email-here/ NOT /your-service-account/ NOT /@yourproject/ ${getNotFilters()}`
    )}&type=code`,
  };

  // For keyword actions with no keywords, use the first default keyword
  if (keywordDorkActions.includes(action) && keywordsArray.length === 0) {
    const firstKeyword = "password"; // Fallback
    const url = getURLForAction(
      action,
      host,
      SLD,
      domain,
      firstKeyword,
      domainPattern
    );
    if (url) {
      chrome.tabs.create({ url, active: false });
    }
    return;
  }

  if (urlMap[action]) {
    chrome.tabs.create({ url: urlMap[action], active: false });
  }
}

// Helper function to create URL for a specific action with a specific keyword
function getURLForAction(action, host, SLD, domain, keyword, domainPattern) {
  // Build fulldork pattern
  const fulldork = `[$#^]?${keyword}[[:space:]]*[:=]?[[:space:]]*['"][A-Za-z0-9_$#^\\-@._]*['"]`;
  const notFilters = getNotFilters();

  const urlTemplates = {
    // GitHub Dorks with keywords (will open multiple tabs)
    github_dork_5: `https://github.com/search?q=${encodeURIComponent(
      `/[a-zA-Z0-9-]+:\\/\\/(?:[a-zA-Z0-9-]+\\.)${domainPattern}${domain}/ AND /${fulldork}/ ${notFilters}`
    )}&type=code`,
    github_dork_6: `https://github.com/search?q=${encodeURIComponent(
      `/@(?:[a-zA-Z0-9-]+\\.)${domainPattern}${SLD}\\./ AND /${fulldork}/ ${notFilters}`
    )}&type=code`,
    github_dork_7: `https://github.com/search?q=${encodeURIComponent(
      `/@(?:[a-zA-Z0-9-]+\\.)${domainPattern}${domain}/ AND /${fulldork}/ AND PATH:.env ${notFilters}`
    )}&type=code`,
    github_dork_8: `https://github.com/search?q=${encodeURIComponent(
      `/@(?:[a-zA-Z0-9-]+\\.)${domainPattern}${domain}/ AND /${fulldork}/ ${notFilters}`
    )}&type=code`,
    github_dork_9: `https://github.com/search?q=${encodeURIComponent(
      `org:${SLD} /${fulldork}/ ${notFilters}`
    )}&type=code`,
    github_dork_16: `https://github.com/search?q=${encodeURIComponent(
      `/jdbc:[a-zA-Z0-9-]+:\\/\\/(?:[a-zA-Z0-9-]+\\.)${domainPattern}${SLD}\\./ AND /${fulldork}/ ${notFilters}`
    )}&type=code`,
    github_dork_18: `https://github.com/search?q=${encodeURIComponent(
      `/jdbc:[a-zA-Z0-9-]+:[a-zA-Z0-9-]+:\\/\\/(?:[a-zA-Z0-9-]+\\.)${domainPattern}${SLD}\\./ AND /${fulldork}/ ${notFilters}`
    )}&type=code`,
    github_dork_19: `https://github.com/search?q=${encodeURIComponent(
      `/jdbc:[a-zA-Z0-9-]+:[a-zA-Z0-9-]+:\@\\/\\/(?:[a-zA-Z0-9-]+\\.)${domainPattern}${SLD}\\./ AND /${fulldork}/ ${notFilters}`
    )}&type=code`,
    github_dork_20: `https://github.com/search?q=${encodeURIComponent(
      `/jdbc:[a-zA-Z0-9-]+:[a-zA-Z0-9-]+:\@(?:[a-zA-Z0-9-]+\\.)${domainPattern}${SLD}\\./ AND /${fulldork}/ ${notFilters}`
    )}&type=code`,
    github_dork_21: `https://github.com/search?q=${encodeURIComponent(
      `/jenkins\\.(?:[a-zA-Z0-9-]+\\.)${domainPattern}${SLD}\\./ AND /${fulldork}/ ${notFilters}`
    )}&type=code`,
    github_dork_22: `https://github.com/search?q=${encodeURIComponent(
      `/jenkins\\.(?:[a-zA-Z0-9-]+\\.)${domainPattern}${SLD}\\./ AND /${fulldork}/ ${notFilters}`
    )}&type=code`,
    github_dork_23: `https://github.com/search?q=${encodeURIComponent(
      `/jfrog\\.(?:[a-zA-Z0-9-]+\\.)${domainPattern}${SLD}\\./ AND /${fulldork}/ ${notFilters}`
    )}&type=code`,
    github_dork_24: `https://github.com/search?q=${encodeURIComponent(
      `/jfrog\\.(?:[a-zA-Z0-9-]+\\.)${domainPattern}${SLD}\\./ AND /${fulldork}/ ${notFilters}`
    )}&type=code`,
    github_dork_25: `https://github.com/search?q=${encodeURIComponent(
      `/gitlab\\.(?:[a-zA-Z0-9-]+\\.)${domainPattern}${SLD}\\./ AND /${fulldork}/ ${notFilters}`
    )}&type=code`,
    github_dork_26: `https://github.com/search?q=${encodeURIComponent(
      `/gitlab\\.(?:[a-zA-Z0-9-]+\\.)${domainPattern}${SLD}\\./ AND /${fulldork}/ ${notFilters}`
    )}&type=code`,
    github_dork_27: `https://github.com/search?q=${encodeURIComponent(
      `/github\\.(?:[a-zA-Z0-9-]+\\.)${domainPattern}${SLD}\\./ AND /${fulldork}/ ${notFilters}`
    )}&type=code`,
    github_dork_28: `https://github.com/search?q=${encodeURIComponent(
      `/github\\.(?:[a-zA-Z0-9-]+\\.)${domainPattern}${SLD}\\./ AND /${fulldork}/ ${notFilters}`
    )}&type=code`,
    github_dork_31: `https://github.com/search?q=${encodeURIComponent(
      `/jdbc:[a-zA-Z0-9-]+:\\/\\/(?:[a-zA-Z0-9-]+\\.)${domainPattern}${domain}/ AND /${fulldork}/ ${notFilters}`
    )}&type=code`,
    github_dork_33: `https://github.com/search?q=${encodeURIComponent(
      `/jdbc:[a-zA-Z0-9-]+:[a-zA-Z0-9-]+:\\/\\/(?:[a-zA-Z0-9-]+\\.)${domainPattern}${domain}/ AND /${fulldork}/ ${notFilters}`
    )}&type=code`,
    github_dork_34: `https://github.com/search?q=${encodeURIComponent(
      `/jdbc:[a-zA-Z0-9-]+:[a-zA-Z0-9-]+:\@\\/\\/(?:[a-zA-Z0-9-]+\\.)${domainPattern}${domain}/ AND /${fulldork}/ ${notFilters}`
    )}&type=code`,
    github_dork_35: `https://github.com/search?q=${encodeURIComponent(
      `/jdbc:[a-zA-Z0-9-]+:[a-zA-Z0-9-]+:\@(?:[a-zA-Z0-9-]+\\.)${domainPattern}${domain}/ AND /${fulldork}/ ${notFilters}`
    )}&type=code`,
    github_dork_36: `https://github.com/search?q=${encodeURIComponent(
      `/jenkins\\.(?:[a-zA-Z0-9-]+\\.)${domainPattern}${domain}/ AND /${fulldork}/ ${notFilters}`
    )}&type=code`,
    github_dork_37: `https://github.com/search?q=${encodeURIComponent(
      `/jenkins\\.(?:[a-zA-Z0-9-]+\\.)${domainPattern}${domain}/ AND /${fulldork}/ ${notFilters}`
    )}&type=code`,
    github_dork_38: `https://github.com/search?q=${encodeURIComponent(
      `/jfrog\\.(?:[a-zA-Z0-9-]+\\.)${domainPattern}${domain}/ AND /${fulldork}/ ${notFilters}`
    )}&type=code`,
    github_dork_39: `https://github.com/search?q=${encodeURIComponent(
      `/jfrog\\.(?:[a-zA-Z0-9-]+\\.)${domainPattern}${domain}/ AND /${fulldork}/ ${notFilters}`
    )}&type=code`,
    github_dork_40: `https://github.com/search?q=${encodeURIComponent(
      `/gitlab\\.(?:[a-zA-Z0-9-]+\\.)${domainPattern}${domain}/ AND /${fulldork}/ ${notFilters}`
    )}&type=code`,
    github_dork_41: `https://github.com/search?q=${encodeURIComponent(
      `/gitlab\\.(?:[a-zA-Z0-9-]+\\.)${domainPattern}${domain}/ AND /${fulldork}/ ${notFilters}`
    )}&type=code`,
    github_dork_42: `https://github.com/search?q=${encodeURIComponent(
      `/github\\.(?:[a-zA-Z0-9-]+\\.)${domainPattern}${domain}/ AND /${fulldork}/ ${notFilters}`
    )}&type=code`,
    github_dork_43: `https://github.com/search?q=${encodeURIComponent(
      `/github\\.(?:[a-zA-Z0-9-]+\\.)${domainPattern}${domain}/ AND /${fulldork}/ ${notFilters}`
    )}&type=code`,
    github_dork_44: `https://github.com/search?q=${encodeURIComponent(
      `/confluence[a-zA-Z0-9-]*\\.(?:[a-zA-Z0-9-]+\\.)${domainPattern}${SLD}\\./ AND /${fulldork}/ ${notFilters}`
    )}&type=code`,
    github_dork_45: `https://github.com/search?q=${encodeURIComponent(
      `/:sap:\\/\\/(?:[a-zA-Z0-9-]+\\.)${domainPattern}${SLD}\\./ AND /${fulldork}/ ${notFilters}`
    )}&type=code`,
    github_dork_51: `https://github.com/search?q=${encodeURIComponent(
      `/confluence[a-zA-Z0-9-]*\\.(?:[a-zA-Z0-9-]+\\.)${domainPattern}${domain}/ AND /${fulldork}/ ${notFilters}`
    )}&type=code`,
    github_dork_52: `https://github.com/search?q=${encodeURIComponent(
      `/:sap:\\/\\/(?:[a-zA-Z0-9-]+\\.)${domainPattern}${domain}/ AND /${fulldork}/ ${notFilters}`
    )}&type=code`,
    github_dork_53: `https://github.com/search?q=${encodeURIComponent(
      `/(?:[a-zA-Z0-9-]+\\.)${domainPattern}auth0\\.(?:[a-zA-Z0-9-]+\\.)*/ AND /${fulldork}/ ${notFilters}`
    )}&type=code`,
    github_dork_54: `https://github.com/search?q=${encodeURIComponent(
      `/(?:[a-zA-Z0-9-]+\\.)${domainPattern}okta\\.(?:[a-zA-Z0-9-]+\\.)*/ AND /${fulldork}/ ${notFilters}`
    )}&type=code`,
    github_dork_55: `https://github.com/search?q=${encodeURIComponent(
      `/(?:[a-zA-Z0-9-]+\\.)${domainPattern}jfrog\\.io\\.(?:[a-zA-Z0-9-]+\\.)*/ AND /${fulldork}/ ${notFilters}`
    )}&type=code`,
    github_dork_56: `https://github.com/search?q=${encodeURIComponent(
      `/(?:[a-zA-Z0-9-]+\\.)${domainPattern}onelogin\\.(?:[a-zA-Z0-9-]+\\.)*/ AND /${fulldork}/ ${notFilters}`
    )}&type=code`,
    github_dork_57: `https://github.com/search?q=${encodeURIComponent(
      `/(?:[a-zA-Z0-9-]+\\.)${domainPattern}looker\\.(?:[a-zA-Z0-9-]+\\.)*/ AND /${fulldork}/ ${notFilters}`
    )}&type=code`,
    github_dork_58: `https://github.com/search?q=${encodeURIComponent(
      `/(?:[a-zA-Z0-9-]+\\.)${domainPattern}jenkins\\.(?:[a-zA-Z0-9-]+\\.)*/ AND /${fulldork}/ ${notFilters}`
    )}&type=code`,
  };

  return urlTemplates[action];
}

// Helper function for GitHub dork URLs from content.js
function getGitHubDorkURL(
  apiType,
  domain,
  SLD,
  domainOnly,
  keyword,
  domainPattern
) {
  // Build fulldork pattern
  const fulldork = `[$#^]?${keyword}[[:space:]]*[:=]?[[:space:]]*['"][A-Za-z0-9_$#^\\-@._]*['"]`;
  const notFilters = getNotFilters();

  const domainLower = domain.toLowerCase();
  const SLDLower = SLD.toLowerCase();
  const domainOnlyLower = domainOnly.toLowerCase();

  const dorkMap = {
    github_org_password: `https://github.com/search?q=org%3A${encodeURIComponent(
      SLD
    )}+%2F${encodeURIComponent(fulldork)}%2F+${encodeURIComponent(
      notFilters
    )}&type=code`,

    github_regex_password: `https://github.com/search?q=${encodeURIComponent(
      `/@(?:[a-zA-Z0-9-]+\\.)${domainPattern}${domainLower}/ AND /${fulldork}/ ${notFilters}`
    )}&type=code`,

    github_org_secret: `https://github.com/search?q=org%3A${encodeURIComponent(
      SLD
    )}+%2F${encodeURIComponent(fulldork)}%2F+${encodeURIComponent(
      notFilters
    )}&type=code`,

    github_regex_secret: `https://github.com/search?q=${encodeURIComponent(
      `/[a-zA-Z0-9_-]+:\\/\\/(?:[a-zA-Z0-9-]+\\.)${domainPattern}${domainLower}/ AND /${fulldork}/ ${notFilters}`
    )}&type=code`,

    github_regex_secret2: `https://github.com/search?q=${encodeURIComponent(
      `/[a-zA-Z0-9_-]+:\\/\\/(?:[a-zA-Z0-9-]+\\.)${domainPattern}${domainLower}/ AND /${fulldork}/ ${notFilters}`
    )}&type=code`,
  };

  return dorkMap[apiType];
}

// listener from content script reporting OTX page JSON status & other commands
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || !msg.action) return;

  if (msg.action === "otx_page_status") {
    const jobId = `${msg.jobType}:${msg.host}`;
    if (runningOTXJobs[jobId]) {
      console.log(
        `[OSINT][OTX] received status page=${msg.page} has_next=${msg.has_next} for ${jobId}`
      );
      if (msg.has_next === false) {
        stopOTXJob(jobId);
      }
    }
    sendResponse && sendResponse({ ok: true });
    return;
  }
});
