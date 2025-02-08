import { Message } from "../Message";

export default defineBackground(() => {
  browser.runtime.onMessage.addListener(async (message: Message) => {
    if (message.type === "get-all-tabs") {
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
    }
    if (message.type === "activate-tab" && message.tabId !== undefined) {
      browser.tabs.update(message.tabId, { active: true });
    }
    if (message.type === "close-tab" && message.tabId !== undefined) {
      browser.tabs.remove(message.tabId);
    }
    if (message.type === "open-new-tab-in-background" && !!message.url) {
      browser.tabs.create({
        active: false,
        url: message.url,
      });
    }
  });
});
