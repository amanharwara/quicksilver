import { onMessage } from "../shared/Message";

onMessage("getAllTabs", async () => {
  const allTabs = await browser.tabs.query({
    windowId: browser.windows.WINDOW_ID_CURRENT,
  });
  return allTabs;
});

onMessage("openNewTab", async (message) => {
  const { url, background = false, position = "after" } = message.data ?? {};
  const [activeTab] = await browser.tabs.query({
    active: true,
    lastFocusedWindow: true,
  });
  const activeTabIndex = activeTab.index;
  browser.tabs.create({
    active: !background,
    url: url,
    index: position === "after" ? activeTabIndex + 1 : activeTabIndex - 1,
    ...(import.meta.env.FIREFOX
      ? {
          // @ts-ignore firefox-only property which is not included in chrome types
          cookieStoreId: activeTab.cookieStoreId,
        }
      : {}),
  });
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

export default defineBackground(() => {});
