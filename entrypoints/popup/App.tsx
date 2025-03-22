import { ComponentProps } from "solid-js";
import {
  disabledGlobally,
  storedBlocklist,
  Blocklist,
} from "../../shared/storage";
import { error } from "../../shared/log";
import { PlusIcon, TrashIcon } from "../../shared/icons";
import { Message } from "../../shared/Message";
import { Tabs } from "wxt/browser";
import { nanoid } from "nanoid";

function SwitchToggle(
  props: {
    checked: boolean;
    onChange?: (checked: boolean) => void;
    inputProps?: ComponentProps<"input">;
  } & Omit<ComponentProps<"div">, "onChange">
) {
  const [state, inputProps, rest] = splitProps(
    props,
    ["checked", "onChange"],
    ["inputProps"]
  );

  return (
    <div class="relative rounded-full focus-within-ring" {...rest}>
      <input
        role="switch"
        type="checkbox"
        class="sr-only absolute top-0 left-0 w-full h-full"
        {...inputProps.inputProps}
        checked={state.checked}
        onChange={(event) => {
          const checked = event.target.checked;
          state.onChange?.(checked);
        }}
      />
      <div
        classList={{
          "flex w-10.75 p-0.75 rounded-full border border-slate-700": true,
          "bg-slate-900": !state.checked,
          "bg-slate-700": state.checked,
        }}
      >
        <div
          classList={{
            "w-4 h-4 rounded-full transition-[margin-left] duration-100 bg-white":
              true,
            "ml-[calc(100%-1rem)]": state.checked,
          }}
        />
      </div>
    </div>
  );
}

function Button(
  props: {
    iconButton?: boolean;
  } & ComponentProps<"button">
) {
  const [styles, rest] = splitProps(props, ["class", "iconButton"]);
  return (
    <button
      classList={{
        "bg-slate-800 hover:bg-slate-600 active:bg-slate-800 border border-slate-700 rounded-md":
          true,
        "px-2 py-1": !styles.iconButton,
        "px-1 py-1": styles.iconButton,
        ...(styles.class
          ? {
              [styles.class]: true,
            }
          : {}),
      }}
      {...rest}
    />
  );
}

function App() {
  const [enabledGlobally, setEnabledGlobally] = createSignal(true);

  const [blocklist, setBlocklist] = createSignal<Blocklist>([]);

  onMount(() => {
    disabledGlobally
      .getValue()
      .then((disabled) => setEnabledGlobally(!disabled))
      .catch(error);
    storedBlocklist.getValue().then(setBlocklist).catch(error);

    const unwatchGlobalDisable = disabledGlobally.watch((value) => {
      setEnabledGlobally(!value);
    });
    const unwatchIgnoredWebsites = storedBlocklist.watch(setBlocklist);

    onCleanup(() => {
      unwatchGlobalDisable();
      unwatchIgnoredWebsites();
    });
  });

  const [currentTab] = createResource<Tabs.Tab>(async () => {
    return browser.runtime.sendMessage({
      type: "get-active-tab",
    } satisfies Message);
  });
  const currentURL = createMemo(() => {
    const tab = currentTab();
    if (!tab || !tab.url) return null;
    return new URL(tab.url);
  });

  const [toAddType, setToAddType] =
    createSignal<Blocklist[number]["type"]>("exact");
  const [toAddValue, setToAddValue] =
    createSignal<Blocklist[number]["value"]>("");
  createEffect(() => {
    const tab = currentTab();
    if (tab?.url && !toAddValue()) {
      setToAddValue(tab.url);
    }
  });

  function addToBlocklist() {
    const currentBlocklist = blocklist();

    const typeToAdd = toAddType();
    const valueToAdd = toAddValue();

    const hasSameRule = currentBlocklist.find(
      ({ type, value }) => type === typeToAdd && value === valueToAdd
    );
    if (hasSameRule) {
      return;
    }

    currentBlocklist.push({
      id: nanoid(),
      type: typeToAdd,
      value: valueToAdd,
      enabled: true,
    });
    storedBlocklist.setValue(currentBlocklist);

    // reset
    setToAddType("exact");
    setToAddValue("");
  }

  function toggleRule(index: number) {
    const currentBlocklist = blocklist();
    const rule = currentBlocklist[index];
    if (!rule) return;
    rule.enabled = !rule.enabled;
    storedBlocklist.setValue(currentBlocklist);
  }

  function deleteRule(id: string) {
    const currentBlocklist = blocklist();
    storedBlocklist.setValue(currentBlocklist.filter((rule) => rule.id !== id));
  }

  return (
    <div class="bg-zinc-900 divide-zinc-700 divide-y">
      <div class="px-4 py-2">
        <label class="flex items-center justify-between gap-2 w-full">
          Enabled globally
          <SwitchToggle
            checked={enabledGlobally()}
            onChange={(enabled) => {
              disabledGlobally.setValue(!enabled);
            }}
          />
        </label>
      </div>
      <div class="px-4 py-3">
        <div class="text-sm font-semibold mb-0.5">Blocklist</div>
        <div class="text-xs text-zinc-300">
          Disable quicksilver on the following sites
        </div>
        <div class="space-y-2 my-4 max-h-[25em] overflow-auto [scrollbar-width:thin]">
          <Show
            when={blocklist().length > 0}
            fallback={<div>No sites added</div>}
          >
            <For each={blocklist()}>
              {(rule, index) => (
                <div class="flex items-center gap-2 w-full overflow-hidden">
                  <div class="flex flex-col min-w-0 mr-auto">
                    <div
                      class="text-sm font-medium overflow-hidden text-ellipsis"
                      title={rule.value}
                    >
                      {rule.value}
                    </div>
                    <div class="text-zinc-300 italic">{rule.type}</div>
                  </div>
                  <SwitchToggle
                    checked={rule.enabled}
                    onClick={() => {
                      toggleRule(index());
                    }}
                  />
                  <Button
                    iconButton
                    onClick={() => {
                      deleteRule(rule.id);
                    }}
                  >
                    <TrashIcon class="w-4 h-4" />
                    <div class="sr-only">Remove</div>
                  </Button>
                </div>
              )}
            </For>
          </Show>
        </div>
        <Show when={currentURL()}>
          <form
            class="flex flex-col gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              addToBlocklist();
            }}
          >
            <div class="text-xs font-semibold">Add site</div>
            <select
              class="bg-slate-800 border border-slate-700 rounded-md px-2 py-1 *:bg-zinc-800 *:text-white"
              value={toAddType()}
              onChange={(event) => {
                const type = event.target.value as Blocklist[number]["type"];
                setToAddType(type);
                const url = currentURL()!;
                if (type === "exact") {
                  setToAddValue(url.toString());
                } else if (type === "domain") {
                  setToAddValue(url.hostname);
                } else if (type === "prefix") {
                  setToAddValue(url.toString());
                } else if (type === "regexp") {
                  setToAddValue(`^${url}$`);
                }
              }}
            >
              <option value="exact">Exact URL</option>
              <option value="domain">Domain</option>
              <option value="prefix">URL Prefix</option>
              <option value="regexp">Regexp</option>
            </select>
            <input
              type="text"
              class="border border-slate-700 rounded-md px-2 py-1"
              value={toAddValue()}
              onInput={(event) => {
                setToAddValue(event.target.value);
              }}
            />
            <div class="text-xs text-zinc-300">
              Quicksilver will be disabled when the{" "}
              <Switch>
                <Match when={toAddType() === "exact"}>
                  URL of the page is exactly <i>{toAddValue()}</i>.
                </Match>
                <Match when={toAddType() === "domain"}>
                  domain of the page is <i>{toAddValue()}</i> or ends with{" "}
                  <i>.{toAddValue()}</i>.
                </Match>
                <Match when={toAddType() === "prefix"}>
                  URL of the page starts with <i>{toAddValue()}</i>.
                </Match>
                <Match when={toAddType() === "regexp"}>
                  URL of the page matches the given regular expression.
                </Match>
              </Switch>
            </div>
            <Button type="submit" class="flex items-center gap-1 self-start">
              <PlusIcon class="w-4 h-4" />
              <span>Add</span>
            </Button>
          </form>
        </Show>
      </div>
    </div>
  );
}

export default App;
