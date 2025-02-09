import { Tabs } from "wxt/browser";

export type Message =
  | {
      type: "get-all-tabs";
    }
  | {
      type: "activate-tab";
      tabId: Tabs.Tab["id"];
    }
  | {
      type: "open-new-tab-in-background";
      url: string;
    }
  | {
      type: "open-new-tab-next-to-current";
    }
  | {
      type: "close-tab";
      tabId: Tabs.Tab["id"];
    };
