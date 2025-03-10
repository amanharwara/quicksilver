import { Message } from "../Message";
import { error } from "../Util";

function isNumber(n: number | undefined): n is number {
  return typeof n === "number";
}

export default defineBackground(() => {
  browser.runtime.onMessage.addListener(async (message: Message) => {
    switch (message.type) {
      case "go-to-prev-tab": {
        const [activeTab] = await browser.tabs.query({
          active: true,
          lastFocusedWindow: true,
        });
        const [prevTab] = await browser.tabs.query({
          index: activeTab.index - 1,
          lastFocusedWindow: true,
        });
        if (prevTab && isNumber(prevTab.id)) {
          browser.tabs.update(prevTab.id, { active: true });
        }
        break;
      }
      case "go-to-next-tab": {
        const [activeTab] = await browser.tabs.query({
          active: true,
          lastFocusedWindow: true,
        });
        const [nextTab] = await browser.tabs.query({
          index: activeTab.index + 1,
          lastFocusedWindow: true,
        });
        if (nextTab && isNumber(nextTab.id)) {
          browser.tabs.update(nextTab.id, { active: true });
        }
        break;
      }
      case "get-all-tabs": {
        const allTabs = await browser.tabs.query({
          windowId: browser.windows.WINDOW_ID_CURRENT,
        });
        const [activeTab] = await browser.tabs.query({
          active: true,
          lastFocusedWindow: true,
        });
        if (isNumber(activeTab.id)) {
          return allTabs;
        }
        break;
      }
      case "activate-tab": {
        if (!isNumber(message.tabId)) break;
        browser.tabs.update(message.tabId, { active: true });
        break;
      }
      case "close-tab": {
        if (!isNumber(message.tabId)) break;
        browser.tabs.remove(message.tabId);
        break;
      }
      case "open-new-tab-in-background": {
        const [activeTab] = await browser.tabs.query({
          active: true,
          lastFocusedWindow: true,
        });
        const activeTabIndex = activeTab.index;
        browser.tabs.create({
          active: false,
          url: message.url,
          index: activeTabIndex + 1,
          ...(import.meta.env.FIREFOX
            ? {
              cookieStoreId: activeTab.cookieStoreId,
            }
            : {}),
        });
        break;
      }
      case "open-new-tab-next-to-current": {
        const [activeTab] = await browser.tabs.query({
          active: true,
          lastFocusedWindow: true,
        });
        const activeTabIndex = activeTab.index;
        browser.tabs.create({
          active: true,
          index: activeTabIndex + 1,
          ...(import.meta.env.FIREFOX
            ? {
              cookieStoreId: activeTab.cookieStoreId,
            }
            : {}),
        });
        break;
      }
      default:
        error("error", "Unknown message type", message);
        break;
    }
  });
});
