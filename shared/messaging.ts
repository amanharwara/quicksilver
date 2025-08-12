import { defineExtensionMessaging } from "@webext-core/messaging";

type Tab = Browser.tabs.Tab;

/** https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/contextualIdentities/ContextualIdentity
 */
export type Container = {
  cookieStoreId: string;
  colorCode: string;
  iconUrl: string;
  name: string;
  openTabs: number;
};

export interface ProtocolMap {
  getActiveTab(): Tab;
  getAllTabs(options?: { cookieStoreId?: string }): Tab[];
  getAllContainers(): Container[];
  goToTab(which: { relative: "previous" | "next" } | { index: number }): void;
  openNewTab(options: {
    url?: string;
    background: boolean;
    position?: "before" | "after";
    window?: "current" | "new" | "private";
    cookieStoreId?: string;
  }): void;
  activateTab(id: Tab["id"]): void;
  duplicateTab(id: Tab["id"]): void;
  closeTab(id: Tab["id"]): void;
  search(text: string): void;
  moveTabNextToCurrentTab(id: Tab["id"]): void;
  moveTabToNewWindow(id: Tab["id"]): void;
  reopenTabInPrivateWindow(id: Tab["id"]): void;
}

export const { sendMessage, onMessage } =
  defineExtensionMessaging<ProtocolMap>();
