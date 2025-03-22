import { Tabs } from "wxt/browser";

export type Message =
  | {
      type: "get-all-tabs";
    }
  | {
      type: "get-active-tab";
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
      type: "go-to-prev-tab";
    }
  | {
      type: "go-to-next-tab";
    }
  | {
      type: "close-tab";
      tabId: Tabs.Tab["id"];
    };
