import { onMessage, ProtocolMap } from "../shared/messaging";

onMessage("getActiveTab", async () => {
  const [activeTab] = await browser.tabs.query({
    active: true,
    lastFocusedWindow: true,
  });
  return activeTab;
});

onMessage("getAllTabs", async (message) => {
  const options = message.data as Parameters<ProtocolMap["getAllTabs"]>[0];
  const allTabs = await browser.tabs.query({
    windowId: browser.windows.WINDOW_ID_CURRENT,
    ...options,
  });
  return allTabs.sort((a, b) => (b.lastAccessed ?? 0) - (a.lastAccessed ?? 0));
});

onMessage("getAllContainers", async () => {
  // @ts-expect-error firefox-only property not available with normal types
  const containers = await browser.contextualIdentities.query({});
  return containers;
});

async function openNewTab(options: Parameters<ProtocolMap["openNewTab"]>[0]) {
  const { url, background, position = "after" } = options;
  const [activeTab] = await browser.tabs.query({
    active: true,
    lastFocusedWindow: true,
  });
  const activeTabIndex = activeTab.index;
  return browser.tabs.create({
    active: !background,
    url: url,
    index: position === "after" ? activeTabIndex + 1 : activeTabIndex - 1,
    ...(import.meta.env.FIREFOX
      ? {
          // @ts-ignore firefox-only property which is not included in chrome types
          cookieStoreId: options.cookieStoreId || activeTab.cookieStoreId,
        }
      : {}),
  });
}

onMessage("openNewTab", async (message) => {
  await openNewTab(message.data);
});

async function activateTab(id: number) {
  await browser.tabs.update(id, { active: true });
}

function isNumber(x: unknown): x is number {
  return typeof x === "number";
}

onMessage("activateTab", async (message) => {
  const id = message.data;
  if (!isNumber(id)) {
    return;
  }
  activateTab(id);
});

onMessage("duplicateTab", async (message) => {
  const id = message.data;
  if (!isNumber(id)) {
    return;
  }
  await browser.tabs.duplicate(id);
});

onMessage("closeTab", async (message) => {
  const id = message.data;
  if (!isNumber(id)) {
    return;
  }
  await browser.tabs.remove(id);
});

onMessage("goToTab", async (message) => {
  const which = message.data;
  const [activeTab] = await browser.tabs.query({
    active: true,
    lastFocusedWindow: true,
  });

  let tabIndex = -1;

  if ("relative" in which) {
    tabIndex =
      which.relative === "previous" ? activeTab.index - 1 : activeTab.index + 1;
  } else {
    tabIndex = which.index;
  }

  if (tabIndex > -1) {
    const [tab] = await browser.tabs.query({
      index: tabIndex,
      lastFocusedWindow: true,
    });
    if (tab && isNumber(tab.id)) {
      browser.tabs.update(tab.id, { active: true });
    }
  }
});

onMessage("search", async (message) => {
  const text = message.data;
  const newTabInBackground = await openNewTab({
    background: true,
  });
  await browser.search.query({
    text,
    ...(isNumber(newTabInBackground.id)
      ? { tabId: newTabInBackground.id }
      : {
          disposition: "NEW_TAB",
        }),
  });
});

onMessage("moveTabNextToCurrentTab", async (message) => {
  const id = message.data;
  if (!isNumber(id)) {
    return;
  }
  const [activeTab] = await browser.tabs.query({
    active: true,
    lastFocusedWindow: true,
  });
  const activeTabIndex = activeTab.index;
  await browser.tabs.move(id, {
    index: activeTabIndex + 1,
  });
});

export default defineBackground(() => {});
