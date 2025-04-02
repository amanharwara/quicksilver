import { defineExtensionMessaging } from "@webext-core/messaging";

type Tab = Browser.tabs.Tab;

interface ProtocolMap {
  getAllTabs(): Tab[];
  goToTab(which: { relative: "previous" | "next" } | { index: number }): void;
  openNewTab(options?: {
    url?: string;
    background: boolean;
    /** Where to insert new tab */
    position?: "before" | "after";
  }): void;
  activateTab(id: Tab["id"]): void;
  closeTab(id: Tab["id"]): void;
}

export const { sendMessage, onMessage } =
  defineExtensionMessaging<ProtocolMap>();
