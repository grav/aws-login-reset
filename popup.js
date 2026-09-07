const SIGN_IN_SUFFIXES = ["signin.aws", "signin.aws.amazon.com"];

// Some cookies sent to a regional sign-in endpoint are scoped to the parent
// aws.amazon.com domain. Restrict parent-domain deletion to authentication
// cookie names observed in the broken same-device login flow.
const PARENT_DOMAIN_AUTH_COOKIE_NAMES = new Set([
  "aws-account-alias",
  "aws-account-data",
  "aws-creds",
  "aws-mfa-entered",
  "aws-userInfo",
  "aws-userInfo-signed",
  "noflush_awsccs_sid",
  "remember-account",
]);

const resetButton = document.querySelector("#reset");
const dismissButton = document.querySelector("#dismiss");
const reloadCheckbox = document.querySelector("#reload");
const message = document.querySelector("#message");
const status = document.querySelector("#status");
const details = document.querySelector("#details");
const removedList = document.querySelector("#removed");
let activeTab;

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function resolvePrompt() {
  if (activeTab?.id) {
    await chrome.runtime.sendMessage({
      type: "resolveReset",
      tabId: activeTab.id,
    });
  }
}

async function initialize() {
  activeTab = await getActiveTab();
  if (!activeTab?.id) {
    return;
  }

  const pending = (await chrome.storage.session.get("pendingResets"))
    .pendingResets ?? {};
  const detection = pending[String(activeTab.id)];
  if (detection) {
    message.textContent = `AWS sign-in returned HTTP 400 at ${detection.path}. Remove the stale authentication cookies and retry?`;
    resetButton.textContent = "Remove cookies and retry";
    dismissButton.hidden = false;
  }
}

function normalizeDomain(domain) {
  return domain.replace(/^\./, "").toLowerCase();
}

function isAwsSignInCookie(cookie) {
  const domain = normalizeDomain(cookie.domain);
  const belongsToSignInHost = SIGN_IN_SUFFIXES.some(
    (suffix) => domain === suffix || domain.endsWith(`.${suffix}`),
  );

  if (belongsToSignInHost) {
    return true;
  }

  const belongsToAwsParent =
    domain === "aws.amazon.com" || domain.endsWith(".aws.amazon.com");
  return belongsToAwsParent && PARENT_DOMAIN_AUTH_COOKIE_NAMES.has(cookie.name);
}

function cookieUrl(cookie) {
  const scheme = cookie.secure ? "https" : "http";
  return `${scheme}://${normalizeDomain(cookie.domain)}${cookie.path}`;
}

async function removeCookie(cookie) {
  const details = {
    url: cookieUrl(cookie),
    name: cookie.name,
    storeId: cookie.storeId,
  };

  if (cookie.partitionKey) {
    details.partitionKey = cookie.partitionKey;
  }

  return chrome.cookies.remove(details);
}

function showRemoved(cookies) {
  removedList.replaceChildren();
  for (const cookie of cookies) {
    const item = document.createElement("li");
    item.textContent = `${cookie.name} (${cookie.domain}${cookie.path})`;
    removedList.append(item);
  }
  details.hidden = cookies.length === 0;
}

resetButton.addEventListener("click", async () => {
  resetButton.disabled = true;
  status.className = "";
  status.textContent = "Checking AWS sign-in cookies…";
  details.hidden = true;

  try {
    // Filter independently of manifest permissions: all sign-in-host cookies
    // are eligible, while parent-domain cookies require an explicit auth name.
    const accessibleCookies = await chrome.cookies.getAll({});
    const candidates = accessibleCookies.filter(isAwsSignInCookie);
    const results = await Promise.all(candidates.map(removeCookie));
    const removed = candidates.filter((_, index) => results[index] !== null);

    showRemoved(removed);
    await resolvePrompt();
    status.textContent = removed.length
      ? `Removed ${removed.length} AWS sign-in cookie${removed.length === 1 ? "" : "s"}.`
      : "No AWS sign-in cookies were found.";

    if (reloadCheckbox.checked) {
      if (activeTab?.id) {
        await chrome.tabs.reload(activeTab.id);
      }
    }
  } catch (error) {
    status.className = "error";
    status.textContent = `Reset failed: ${error.message}`;
  } finally {
    resetButton.disabled = false;
  }
});

dismissButton.addEventListener("click", async () => {
  await resolvePrompt();
  window.close();
});

void initialize();
