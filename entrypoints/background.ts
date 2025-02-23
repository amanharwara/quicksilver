import { Message } from "../Message";
import { log } from "../Util";

export default defineBackground(() => {
  browser.runtime.onMessage.addListener(async (message: Message) => {
    switch (message.type) {
      case "get-all-tabs": {
        const allTabs = await browser.tabs.query({
          windowId: browser.windows.WINDOW_ID_CURRENT,
        });
        const [activeTab] = await browser.tabs.query({
          active: true,
          lastFocusedWindow: true,
        });
        if (activeTab.id) {
          return allTabs;
        }
        break;
      }
      case "activate-tab": {
        if (!message.tabId) break;
        browser.tabs.update(message.tabId, { active: true });
        break;
      }
      case "close-tab": {
        if (!message.tabId) break;
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
          cookieStoreId: activeTab.cookieStoreId,
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
          cookieStoreId: activeTab.cookieStoreId,
        });
        break;
      }
      default:
        log("error", "Unknown message type", message);
        break;
    }
  });
});
