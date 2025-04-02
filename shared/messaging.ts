import { defineExtensionMessaging } from "@webext-core/messaging";

type Tab = Browser.tabs.Tab;

export interface ProtocolMap {
  getActiveTab(): Tab;
  getAllTabs(): Tab[];
  goToTab(which: { relative: "previous" | "next" } | { index: number }): void;
  openNewTab(options: {
    url?: string;
    background: boolean;
    position?: "before" | "after";
  }): void;
  activateTab(id: Tab["id"]): void;
  closeTab(id: Tab["id"]): void;
  search(text: string): void;
}

export const { sendMessage, onMessage } =
  defineExtensionMessaging<ProtocolMap>();
