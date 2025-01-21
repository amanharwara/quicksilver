import { Tabs } from "wxt/browser";

export type Message =
  | {
      type: "get-all-tabs";
    }
  | {
      type: "activate-tab";
      tabId: Tabs.Tab["id"];
    };
