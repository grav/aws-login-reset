const AWS_SIGN_IN_URLS = [
  "https://signin.aws/*",
  "https://*.signin.aws/*",
  "https://signin.aws.amazon.com/*",
  "https://*.signin.aws.amazon.com/*",
];

const PROMPT_DEBOUNCE_MS = 10_000;

chrome.webRequest.onCompleted.addListener(
  async (request) => {
    if (request.statusCode !== 400 || request.tabId < 0) {
      return;
    }

    const key = String(request.tabId);
    const pending = (await chrome.storage.session.get("pendingResets"))
      .pendingResets ?? {};
    const previous = pending[key];

    if (previous && Date.now() - previous.detectedAt < PROMPT_DEBOUNCE_MS) {
      return;
    }

    pending[key] = {
      detectedAt: Date.now(),
      path: new URL(request.url).pathname,
    };
    await chrome.storage.session.set({ pendingResets: pending });

    await chrome.action.setBadgeBackgroundColor({
      color: "#d13212",
      tabId: request.tabId,
    });
    await chrome.action.setBadgeText({ text: "400", tabId: request.tabId });
    await chrome.action.setTitle({
      title: "AWS sign-in returned HTTP 400",
      tabId: request.tabId,
    });

    try {
      const tab = await chrome.tabs.get(request.tabId);
      await chrome.action.openPopup({ windowId: tab.windowId });
    } catch {
      // If the browser refuses programmatic popup opening, the badge remains as
      // a fallback and the user can click the toolbar action themselves.
    }
  },
  { urls: AWS_SIGN_IN_URLS, types: ["main_frame"] },
);

chrome.runtime.onMessage.addListener((message, sender) => {
  if (message?.type !== "resolveReset" || !Number.isInteger(message.tabId)) {
    return;
  }

  void (async () => {
    const key = String(message.tabId);
    const pending = (await chrome.storage.session.get("pendingResets"))
      .pendingResets ?? {};
    delete pending[key];
    await chrome.storage.session.set({ pendingResets: pending });
    await chrome.action.setBadgeText({ text: "", tabId: message.tabId });
    await chrome.action.setTitle({
      title: "Reset AWS sign-in",
      tabId: message.tabId,
    });
  })();
});
