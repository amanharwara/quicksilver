import {
  Accessor,
  Component,
  ComponentProps,
  JSX,
  ParentProps,
} from "solid-js";
import { Tabs } from "wxt/browser";
import { Message } from "../../Message";
import {
  ChevronDownIcon,
  LoopIcon,
  MuteIcon,
  PauseIcon,
  PlayIcon,
} from "./icons";

const mainContext = createContext<{
  shouldShowDebugInfo: Accessor<boolean>;
  toggleDebugInfo: () => void;
  hideAllPopups: () => void;
  resetState: (hidePopups: boolean) => void;
  registerKeydownListener: (
    listener: KeyEventListener
  ) => KeyEventListenerCleanup;
}>();

function useMainContext() {
  const ctx = useContext(mainContext);
  if (!ctx) throw new Error("No quicksilver context available");
  return ctx;
}

const letters = Array(26)
  .fill(0)
  .map((_, index) => {
    let i = index + 97;
    return String.fromCharCode(i);
  });

function rem(n: number) {
  return `${n * 16}px`;
}

export function* twoCharIDGenerator() {
  for (const letter of letters) {
    const lettersWithoutCurrent = letters.filter((l) => l !== letter);
    let index = 0;
    while (lettersWithoutCurrent.length > 0) {
      const l2 = lettersWithoutCurrent.shift() || index++;
      yield `${letter}${l2}`;
    }
  }
}

function log(...args: any[]) {
  if (!import.meta.env.DEV) {
    return;
  }
  console.group("quicksilver");
  console.log(...args);
  console.groupEnd();
}

function isElementOverflowing(element: HTMLElement) {
  return element.scrollHeight > element.offsetHeight;
}

function findOverflowingParent(element: Element) {
  let parent = element.parentElement;
  while (parent && parent.scrollHeight === parent.offsetHeight) {
    parent = parent.parentElement;
  }
  return parent;
}

type ElementStyles = {
  [key in keyof Partial<CSSStyleDeclaration>]: string;
};

function createElement(
  tag: keyof HTMLElementTagNameMap,
  options: {
    className?: string;
    styles?: ElementStyles;
    children?: HTMLElement[];
    text?: string;
  } = {}
) {
  const element = document.createElement(tag);
  const { className, styles, children, text } = options;
  if (className) {
    element.className = className;
  }
  if (styles) {
    Object.assign(element.style, styles);
  }
  if (children) {
    for (const child of children) {
      element.append(child);
    }
  } else if (text) {
    element.innerText = text;
  }
  return element;
}

function getKeyRepresentation(event: KeyboardEvent) {
  const { ctrlKey, shiftKey, altKey, key } = event;
  return `${ctrlKey ? "C-" : ""}${shiftKey ? "S-" : ""}${
    altKey ? "A-" : ""
  }${key.toLowerCase()}`;
}

enum HighlightState {
  None = 0,
  Highlighted = 1,
}

enum ElementInteractionMode {
  Click = 0,
  Focus = 1,
  OpenInNewTab = 2,
}

type Actions = Record<
  string,
  { desc: string; fn: (event: KeyboardEvent | MouseEvent) => void }
>;

const Colors = {
  "cb-dark-80": "color-mix(in oklab, cornflowerblue, black 80%)",
  "cb-dark-70": "color-mix(in oklab, cornflowerblue, black 70%)",
  "cb-dark-60": "color-mix(in oklab, cornflowerblue, black 60%)",
  "cb-dark-50": "color-mix(in oklab, cornflowerblue, black 50%)",
  "cb-dark-40": "color-mix(in oklab, cornflowerblue, black 40%)",
  "cb-dark-30": "color-mix(in oklab, cornflowerblue, black 30%)",
  "cb-dark-20": "color-mix(in oklab, cornflowerblue, black 20%)",
  cb: "cornflowerblue",
  "cb-light-90": "color-mix(in oklab, cornflowerblue, white 90%)",
};

const HighlightStyles: ElementStyles = {
  position: "absolute",
  top: "0",
  left: "0",
  zIndex: "69420",
  background: Colors["cb-dark-50"],
  color: Colors["cb-light-90"],
  padding: rem(0.25),
  fontSize: rem(0.85),
  lineHeight: "1",
  fontFamily: "monospace",
  boxShadow: `inset 0 -2px 0 0 ${Colors["cb-dark-20"]}`,
  borderRadius: rem(0.25),
};

const ButtonDefaultStyles: JSX.CSSProperties = {
  margin: "0",
  padding: "0",
  "border-color": "transparent",
  "font-family": "inherit",
  "font-size": "inherit",
  "text-align": "left",
};

const PopupStyles: JSX.CSSProperties = {
  position: "fixed",
  bottom: rem(0.5),
  left: "50%",
  translate: "-50% 0",
  display: "flex",
  "flex-direction": "column",
  background: Colors["cb-dark-70"],
  color: Colors["cb-light-90"],
  width: `min(95vw, ${rem(40)})`,
  "min-height": "0",
  "max-height": "50vh",
  "font-family": "sans-serif",
  "font-size": rem(1),
  "border-radius": rem(0.25),
  "z-index": 69420,
  overflow: "hidden",
  padding: 0,
  border: 0,
};
function Popup(props: ComponentProps<"dialog">) {
  let popup: HTMLDialogElement | undefined;

  const context = useMainContext();

  const clickListener = (event: MouseEvent) => {
    if (!popup || !(event.target instanceof Element)) {
      return;
    }
    if (popup.contains(event.target)) {
      return;
    }
    context.hideAllPopups();
  };

  onMount(() => {
    document.addEventListener("click", clickListener);
  });
  onCleanup(() => {
    document.removeEventListener("click", clickListener);
  });

  return (
    <dialog
      {...props}
      ref={popup}
      class="qs-popup"
      style={{
        ...PopupStyles,
        ...(typeof props.style === "object" ? props.style : {}),
      }}
    >
      {props.children}
    </dialog>
  );
}

const KbdStyles: JSX.CSSProperties = {
  "box-shadow": `inset 0 -2px 0 0 ${Colors["cb-dark-20"]}`,
  "border-radius": rem(0.25),
  background: Colors["cb-dark-50"],
  padding: `${rem(0.125)} ${rem(0.325)}`,
  border: "1px solid transparent",
};
function Kbd(props: ParentProps) {
  return <kbd style={KbdStyles}>{props.children}</kbd>;
}

type KeyEventListener = (event: KeyboardEvent) => boolean;
type KeyEventListenerCleanup = () => void;

function handleElementInteraction(
  element: HTMLElement,
  mode: ElementInteractionMode
) {
  switch (mode) {
    case ElementInteractionMode.Click:
      element.click();
      break;
    case ElementInteractionMode.Focus:
      setTimeout(() => element.focus());
      break;
    case ElementInteractionMode.OpenInNewTab: {
      if (!(element instanceof HTMLAnchorElement)) {
        return;
      }
      const href = element.href;
      browser.runtime.sendMessage({
        type: "open-new-tab-in-background",
        url: href,
      } satisfies Message);
      break;
    }
  }
}

function ActionsHelp(props: {
  keyInput: string;
  actionKeys: string[];
  actions: Actions;
}) {
  return (
    <Popup>
      <div
        style={{
          display: "flex",
          "flex-direction": "column",
          gap: rem(0.75),
          padding: rem(1),
          "overflow-y": "auto",
        }}
      >
        <For each={props.actionKeys}>
          {(key) => {
            const keyInputLength = () => props.keyInput.length;
            const noKeyInput = () => keyInputLength() === 0;
            const startsWithKeyInput = () => key.startsWith(props.keyInput);
            return (
              <Show when={noKeyInput() || startsWithKeyInput()}>
                <div
                  style={{
                    display: "flex",
                    "align-items": "center",
                    gap: rem(0.75),
                  }}
                >
                  <Kbd>
                    <Show
                      when={startsWithKeyInput}
                      fallback={key.replace(/\s/g, "")}
                    >
                      <span style="opacity: 0.5">
                        {key.slice(0, keyInputLength()).replace(/\s/g, "")}
                      </span>
                      <span>
                        {key.slice(keyInputLength()).replace(/\s/g, "")}
                      </span>
                    </Show>
                  </Kbd>
                  {props.actions[key].desc}
                </div>
              </Show>
            );
          }}
        </For>
      </div>
    </Popup>
  );
}

type ClickableItem = {
  text: string;
  element: HTMLElement;
  href?: string;
};

function ClickableItemComp(
  allProps: {
    index: number;
    focusedIndex: number;
    children: JSX.Element;
  } & ComponentProps<"button">
) {
  const [props, rest] = splitProps(allProps, [
    "index",
    "focusedIndex",
    "children",
    "style",
    "class",
  ]);

  let itemElement: HTMLButtonElement | undefined;

  const isFocused = () => props.index === props.focusedIndex;

  createEffect(() => {
    if (isFocused() && itemElement) {
      itemElement.scrollIntoView({
        block: "nearest",
      });
    }
  });

  return (
    <button
      ref={itemElement}
      tabIndex={props.index !== 0 ? "-1" : undefined}
      classList={{
        "qs-list-item": true,
        active: isFocused(),
      }}
      style={{
        ...ButtonDefaultStyles,
        display: "grid",
        "align-items": "center",
        gap: rem(0.125),
        "padding-block": rem(0.75),
        "padding-inline": rem(1.25),
        color: "inherit",
        "user-select": "none",
        "overflow-x": "clip",
        width: "100%",
        ...(typeof props.style !== "string" ? props.style || {} : {}),
      }}
      {...rest}
    >
      {props.children}
    </button>
  );
}

function VirtualizedList<Item extends unknown>(props: {
  items: Item[];
  focusedIndex: Accessor<number>;
  itemRenderFn: (item: Item, index: Accessor<number>) => JSX.Element;
  style?: JSX.CSSProperties;
}) {
  const [itemSize, setItemSize] = createSignal(100);
  const [scrollOffset, setScrollOffset] = createSignal(0);
  const [containerClientHeight, setContainerClientHeight] = createSignal(0);

  function isVisible(index: number) {
    const containerHeight = containerClientHeight();
    const scroll = scrollOffset();
    const size = itemSize();
    const halfSize = size / 2;
    const itemTop = index * size;
    const itemBottom = itemTop + size;
    return (
      itemTop >= scroll - halfSize &&
      itemBottom <= containerHeight + scroll + size
    );
  }

  const length = createMemo(() => props.items.length);

  let container: HTMLDivElement | undefined;

  const context = useMainContext();

  return (
    <div
      ref={container}
      style={{
        ...(props.style ?? {}),
        position: "relative",
        "overflow-y": "scroll",
      }}
      onScroll={(event) => setScrollOffset(event.currentTarget.scrollTop)}
    >
      <div
        style={{
          "min-height": `${length() * itemSize()}px`,
        }}
      ></div>
      <For each={props.items}>
        {(item, i) => (
          <Show
            when={
              i() === 0 ||
              i() === length() - 1 ||
              i() === props.focusedIndex() ||
              isVisible(i())
            }
          >
            <div
              style={{
                position: "absolute",
                top: `${itemSize() * i()}px`,
                left: 0,
                width: "100%",
              }}
              ref={(el) => {
                if (i() !== 0) return;
                const resizeObserver = new ResizeObserver((entries) => {
                  if (entries.length !== 1) return;
                  const entry = entries[0];
                  const { contentBoxSize } = entry;
                  const size = contentBoxSize[0];
                  setItemSize(size.blockSize);
                  setContainerClientHeight(container!.clientHeight);
                  resizeObserver.disconnect();
                });
                resizeObserver.observe(el);
              }}
            >
              {props.itemRenderFn(item, i)}
            </div>
          </Show>
        )}
      </For>
      <Show when={context.shouldShowDebugInfo()}>
        <div style={{ position: "fixed", top: 0, right: rem(1) }}>
          {length()}; {scrollOffset()}
        </div>
      </Show>
    </div>
  );
}

function ListSearch<Item extends unknown>(props: {
  items: Item[] | Accessor<Item[]>;
  filter: (item: Item, lowercaseQuery: string) => boolean;
  itemContent: (item: Item, isFocused: boolean, index: number) => JSX.Element;
  itemProps?: ComponentProps<"button">;
  handleSelect: (item: Item, event: KeyboardEvent | MouseEvent) => void;
  handleKeyDown?: (item: Item, event: KeyboardEvent) => boolean;
}) {
  let input: HTMLInputElement | undefined;

  onMount(() => {
    input?.focus();
  });

  const [focusedIndex, setFocusedIndex] = createSignal(0);
  const [query, setQuery] = createSignal("");

  createEffect(() => {
    const _ = query();
    setFocusedIndex(0);
  });

  const filtered = createMemo(() => {
    const q = query();
    const items =
      typeof props.items === "function" ? props.items() : props.items;
    if (q.length === 0) return items;
    const lowercaseQuery = q.toLowerCase();
    return items.filter((item) => props.filter(item, lowercaseQuery));
  });

  const context = useMainContext();

  return (
    <div
      style={{
        display: "flex",
        "flex-direction": "column",
      }}
      onKeyDown={(event) => {
        const item = filtered()[focusedIndex()];
        if (props.handleKeyDown?.(item, event)) {
          return;
        }
        const { key } = event;
        switch (key) {
          case "Escape":
            event.preventDefault();
            context.resetState(true);
            break;
          case "PageUp":
          case "PageDown":
            event.preventDefault();
            break;
          case "Home":
            setFocusedIndex(0);
            break;
          case "End":
            setFocusedIndex(filtered().length - 1);
            break;
          case "ArrowDown":
            setFocusedIndex((index) => {
              const next = index + 1;
              const last = filtered().length - 1;
              if (next > last) {
                return 0;
              }
              return next;
            });
            break;
          case "ArrowUp":
            setFocusedIndex((index) => {
              const prev = index - 1;
              if (prev < 0) {
                return filtered().length - 1;
              }
              return prev;
            });
            break;
          default:
            break;
        }
      }}
      onKeyUp={(event) => {
        switch (event.key) {
          case "Enter": {
            const item = filtered()[focusedIndex()];
            if (item) {
              props.handleSelect(item, event);
            }
            break;
          }
          default:
            break;
        }
      }}
    >
      <VirtualizedList
        items={filtered()}
        focusedIndex={focusedIndex}
        itemRenderFn={(item, index) => (
          <ClickableItemComp
            {...(props.itemProps ? props.itemProps : {})}
            index={index()}
            focusedIndex={focusedIndex()}
            onClick={(event) => props.handleSelect(item, event)}
          >
            {props.itemContent(item, index() === focusedIndex(), index())}
          </ClickableItemComp>
        )}
        style={{
          display: "flex",
          "flex-direction": "column",
          "padding-inline": 0,
        }}
      />
      <input
        ref={input}
        class="qs-input"
        style={{
          background: "inherit",
          color: "inherit",
          "padding-block": rem(0.5),
          "padding-inline": rem(1),
          border: "1px solid transparent",
          "border-radius": "0",
          "border-bottom-left-radius": rem(0.25),
          "border-bottom-right-radius": rem(0.25),
          "z-index": 1,
        }}
        value={query()}
        onInput={(event) => {
          event.stopImmediatePropagation();
          setQuery(event.target.value);
        }}
      />
    </div>
  );
}

function SearchLinksAndButtons() {
  const context = useMainContext();

  const items: ClickableItem[] = [];
  for (const element of document.querySelectorAll("a,button")) {
    if (!(element instanceof HTMLElement)) {
      continue;
    }
    let text: string | null = "";
    const labelledby = element.getAttribute("aria-labelledby");
    const ariaLabel = element.ariaLabel;
    const textContent = element.textContent;
    if (labelledby) {
      const ids = labelledby.split(" ");
      for (const id of ids) {
        const el = document.getElementById(id);
        if (!el) continue;
        const textContent = el.textContent;
        if (textContent) text += textContent;
      }
    }
    if (text.length === 0) {
      text = ariaLabel || textContent || element.title;
    }
    if (!text) continue;
    let href: string | undefined;
    if (element instanceof HTMLAnchorElement) {
      href = element.href;
    }
    const item: ClickableItem = { text, element, href };
    items.push(item);
  }

  const [selectedItem, setSelectedItem] = createSignal<ClickableItem>();
  const selectedItemActions = [
    {
      desc: "Open",
      fn: (item: ClickableItem) => {
        const element = item.element;
        handleElementInteraction(element, ElementInteractionMode.Click);
      },
    },
    {
      desc: "Focus",
      fn: (item: ClickableItem) => {
        const element = item.element;
        handleElementInteraction(element, ElementInteractionMode.Focus);
      },
    },
    {
      desc: "Open in new tab",
      fn: (item: ClickableItem) => {
        const element = item.element;
        handleElementInteraction(element, ElementInteractionMode.OpenInNewTab);
      },
    },
  ];

  function handleSelect(item: ClickableItem) {
    setSelectedItem(item);
  }

  return (
    <>
      <Popup
        style={{
          visibility: !!selectedItem() ? "hidden" : undefined,
        }}
      >
        <ListSearch
          items={items}
          filter={(a, lowercaseQuery) => {
            return (
              a.text.toLowerCase().includes(lowercaseQuery) ||
              a.href?.toLowerCase().includes(lowercaseQuery) ||
              false
            );
          }}
          itemContent={(item) => (
            <>
              <div
                style={{
                  "font-weight": "bold",
                  "white-space": "nowrap",
                  "text-overflow": "ellipsis",
                  overflow: "hidden",
                }}
              >
                {item.text.trim().length > 0 ? item.text.trim() : "No title"}
              </div>
              <div
                style={{
                  "font-size": "smaller",
                  "white-space": "nowrap",
                  "text-overflow": "ellipsis",
                  overflow: "hidden",
                }}
              >
                <Show when={item.href} fallback={"<button>"}>
                  {item.href}
                </Show>
              </div>
            </>
          )}
          handleSelect={handleSelect}
        />
      </Popup>
      <Show when={selectedItem()}>
        <Popup>
          <ListSearch
            items={selectedItemActions}
            itemContent={({ desc }) => (
              <span style={{ "font-weight": "bold" }}>{desc}</span>
            )}
            filter={({ desc }, lq) => desc.toLowerCase().includes(lq)}
            handleSelect={({ fn }) => {
              context.resetState(true);
              const item = selectedItem();
              if (!item) return;
              fn(item);
            }}
          />
        </Popup>
      </Show>
    </>
  );
}

function Toggle(props: {
  active: boolean;
  onChange: (active: boolean) => void;
  label: JSX.Element;
  icon: Component<ComponentProps<"svg">>;
}) {
  return (
    <label
      classList={{
        "qs-outline-btn": true,
        "qs-toggle": true,
        active: props.active,
      }}
    >
      <input
        class="sr-only"
        type="checkbox"
        checked={props.active}
        onChange={(event) => {
          props.onChange(event.target.checked);
        }}
      />
      {props.icon({
        style: {
          width: rem(1.325),
          height: rem(1.325),
        },
      })}
      <span class="sr-only">{props.label}</span>
    </label>
  );
}

const playbackRates = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
function PlaybackRateMenu(props: {
  media: HTMLMediaElement;
  closeMenu: () => void;
}) {
  const context = useMainContext();

  const [focusedIndex, setFocusedIndex] = createSignal(
    playbackRates.findIndex((r) => r === props.media.playbackRate)
  );

  function selectRate(rate: number) {
    props.closeMenu();
    props.media.playbackRate = rate;
  }

  onMount(() => {
    const cleanup = context.registerKeydownListener((event) => {
      const key = getKeyRepresentation(event);
      switch (key) {
        case "arrowdown":
          event.preventDefault();
          setFocusedIndex((index) => {
            const next = index + 1;
            const last = playbackRates.length - 1;
            if (next > last) {
              return 0;
            }
            return next;
          });
          return true;
        case "arrowup":
          event.preventDefault();
          setFocusedIndex((index) => {
            const prev = index - 1;
            if (prev < 0) {
              return playbackRates.length - 1;
            }
            return prev;
          });
          return true;
        case "enter":
          event.preventDefault();
          const rate = playbackRates[focusedIndex()];
          selectRate(rate);
          return true;
        case "escape":
          return true;
        default:
          break;
      }
      return false;
    });
    onCleanup(() => cleanup());
  });

  return (
    <div
      style={{
        display: "flex",
        "flex-direction": "column",
      }}
    >
      <For each={playbackRates}>
        {(rate, index) => (
          <button
            classList={{
              "qs-list-item": true,
              active: focusedIndex() === index(),
            }}
            style={{
              ...ButtonDefaultStyles,
              color: Colors["cb-light-90"],
              "font-size": rem(1),
              padding: `${rem(0.325)} ${rem(1.25)}`,
            }}
            onClick={() => selectRate(rate)}
          >
            {rate}x
          </button>
        )}
      </For>
    </div>
  );
}

function MediaControls(props: { media: HTMLMediaElement }) {
  const [isPlaying, setIsPlaying] = createSignal(!props.media.paused);
  const [currentTime, setCurrentTime] = createSignal(props.media.currentTime);
  const [duration, setDuration] = createSignal(props.media.duration);
  const [playbackRate, setPlaybackRate] = createSignal(
    props.media.playbackRate
  );
  const [volume, setVolume] = createSignal(props.media.volume);
  const [muted, setMuted] = createSignal(props.media.muted);
  const [loop, setLoop] = createSignal(props.media.loop);

  const [isPlaybackRateMenuOpen, setIsPlaybackRateMenuOpen] =
    createSignal(false);

  let popup: HTMLDialogElement | undefined;
  let playbackRateButton: HTMLButtonElement | undefined;
  const [playbackRateMenuPos, setPlaybackRateMenuPos] = createSignal<
    { minWidth: number; bottom: number; right: number } | undefined
  >();

  const context = useMainContext();

  onMount(() => {
    if (popup) {
      popup.focus();
      if (playbackRateButton) {
        const rateBtnRect = playbackRateButton.getBoundingClientRect();
        setPlaybackRateMenuPos({
          minWidth: rateBtnRect.width,
          // bottom: popupRect.bottom - rateBtnRect.bottom + rateBtnRect.height,
          bottom: window.innerHeight - rateBtnRect.top,
          // right: popupRect.right - rateBtnRect.right,
          right: document.documentElement.clientWidth - rateBtnRect.right,
        });
      }
    }

    const controller = new AbortController();

    props.media.addEventListener(
      "play",
      () => {
        setIsPlaying(true);
        setLoop(props.media.loop);
      },
      {
        signal: controller.signal,
      }
    );

    props.media.addEventListener(
      "pause",
      () => {
        setIsPlaying(false);
        setLoop(props.media.loop);
      },
      {
        signal: controller.signal,
      }
    );

    props.media.addEventListener(
      "durationchange",
      () => setDuration(props.media.duration),
      {
        signal: controller.signal,
      }
    );

    props.media.addEventListener(
      "ratechange",
      () => setPlaybackRate(props.media.playbackRate),
      {
        signal: controller.signal,
      }
    );

    props.media.addEventListener(
      "timeupdate",
      () => setCurrentTime(props.media.currentTime),
      {
        signal: controller.signal,
      }
    );

    props.media.addEventListener(
      "volumechange",
      () => {
        setVolume(props.media.volume);
        setMuted(props.media.muted);
      },
      {
        signal: controller.signal,
      }
    );

    //
    // maybe allow registering actions instead of having to handle keydown directly?
    //
    const cleanupKeydownListener = context.registerKeydownListener((event) => {
      const key = getKeyRepresentation(event);
      switch (key) {
        case " ": {
          const input = (event.target as HTMLElement).closest("input");
          if (input && input.type !== "range") {
            return false;
          }
          event.preventDefault();
          toggleMediaPlay();
          return true;
        }
        case "S-<": {
          event.preventDefault();
          const currentRate = props.media.playbackRate;
          props.media.playbackRate = Math.max(currentRate - 0.25, 0);
          return true;
        }
        case "S->": {
          event.preventDefault();
          const currentRate = props.media.playbackRate;
          props.media.playbackRate = Math.min(currentRate + 0.25, 2.5);
          return true;
        }
        case "m": {
          event.preventDefault();
          props.media.muted = !props.media.muted;
          return true;
        }
        case "arrowdown": {
          event.preventDefault();
          props.media.volume = Math.max(props.media.volume - 0.15, 0);
          return true;
        }
        case "arrowup": {
          event.preventDefault();
          props.media.volume = Math.min(props.media.volume + 0.15, 1);
          return true;
        }
        case "arrowleft": {
          event.preventDefault();
          props.media.currentTime = Math.max(props.media.currentTime - 5, 0);
          return true;
        }
        case "arrowright": {
          event.preventDefault();
          props.media.currentTime = Math.min(
            props.media.currentTime + 5,
            props.media.duration
          );
          return true;
        }
        default:
          break;
      }
      return false;
    });

    onCleanup(() => {
      controller.abort();
      cleanupKeydownListener();
    });
  });

  const date = new Date();

  const formattedCurrentTime = createMemo(() => {
    date.setHours(0, 0, currentTime());
    return date.toLocaleTimeString("en-US", {
      minute: "2-digit",
      second: "2-digit",
    });
  });

  const formattedDurationTime = createMemo(() => {
    date.setHours(0, 0, duration());
    return date.toLocaleTimeString("en-US", {
      minute: "2-digit",
      second: "2-digit",
    });
  });

  function toggleMediaPlay() {
    const media = props.media;
    if (isPlaying()) {
      media.pause();
    } else {
      media.play();
    }
  }

  return (
    <Popup
      ref={popup}
      style={{
        display: "grid",
        "grid-template-columns": "repeat(3, 1fr)",
        "grid-template-rows": "repeat(3, auto)",
        gap: rem(0.5),
        padding: rem(0.875),
      }}
      tabIndex={-1}
    >
      <div
        style={{
          "grid-row": "1",
          "grid-column": "1 / 4",
          "font-weight": "bold",
          "text-align": "center",
          "place-self": "center",
        }}
      >
        {props.media.src}
      </div>
      <div
        style={{
          display: "flex",
          "align-items": "center",
          gap: rem(0.5),
          "grid-row": "2",
          "grid-column": "1 / 4",
        }}
      >
        <div style={{ "font-variant-numeric": "tabular-nums" }}>
          {formattedCurrentTime()}
        </div>
        <input
          type="range"
          step={0.01}
          value={currentTime()}
          max={duration()}
          style={{ "flex-grow": "1" }}
          onChange={(event) => {
            const target = event.target;
            props.media.currentTime = parseFloat(target.value);
          }}
        />
        <div style={{ "font-variant-numeric": "tabular-nums" }}>
          {formattedDurationTime()}
        </div>
      </div>
      <div
        style={{
          display: "flex",
          "align-items": "center",
          gap: rem(0.5),
          "grid-column": "1 / 2",
          "grid-row": "3",
          "justify-self": "start",
          "align-self": "center",
        }}
      >
        <Toggle
          active={muted()}
          onChange={(muted) => (props.media.muted = muted)}
          icon={MuteIcon}
          label={
            <Show when={muted()} fallback={"Mute"}>
              Unmute
            </Show>
          }
        />
        <input
          type="range"
          step={0.05}
          value={volume()}
          max={1}
          style={{ "flex-grow": "1" }}
          onChange={(event) => {
            const target = event.target;
            props.media.volume = parseFloat(target.value);
          }}
          disabled={muted()}
        />
      </div>
      <button
        class="qs-outline-btn"
        style={{
          display: "grid",
          "place-items": "center",
          "grid-column": "2 / 3",
          "grid-row": "3",
          "place-self": "center",
          ...ButtonDefaultStyles,
          color: Colors["cb-light-90"],
          padding: rem(0.25),
          border: `2px solid ${Colors["cb-dark-50"]}`,
          "border-radius": rem(0.25),
        }}
        onClick={toggleMediaPlay}
      >
        <Show
          when={isPlaying()}
          fallback={
            <PlayIcon
              style={{
                width: rem(1.325),
                height: rem(1.325),
              }}
            />
          }
        >
          <PauseIcon
            style={{
              width: rem(1.325),
              height: rem(1.325),
            }}
          />
        </Show>
        <span class="sr-only">
          <Show when={isPlaying()} fallback={"Play"}>
            Pause
          </Show>
        </span>
      </button>
      <div
        style={{
          display: "flex",
          "align-items": "center",
          gap: rem(0.5),
          "grid-row": "3",
          "grid-column": "3",
          "justify-self": "end",
          "align-self": "center",
        }}
      >
        <button
          ref={playbackRateButton}
          class="qs-outline-btn"
          popoverTarget="playback-rate-menu"
          style={{
            display: "flex",
            "align-items": "center",
            gap: rem(0.25),
            ...ButtonDefaultStyles,
            color: Colors["cb-light-90"],
            padding: `${rem(0.25)} ${rem(0.325)}`,
            border: `2px solid ${Colors["cb-dark-50"]}`,
            "border-radius": rem(0.25),
            "border-top-right-radius": isPlaybackRateMenuOpen()
              ? "0px"
              : undefined,
            "border-top-left-radius": isPlaybackRateMenuOpen()
              ? "0px"
              : undefined,
            background: isPlaybackRateMenuOpen()
              ? Colors["cb-dark-50"]
              : undefined,
          }}
          onClick={() => setIsPlaybackRateMenuOpen((open) => !open)}
        >
          <div class="sr-only">Playback speed:</div>
          <div>{playbackRate()}x</div>
          <ChevronDownIcon
            style={{
              width: rem(1.25),
              height: rem(1.25),
              transition: "rotate 50ms",
              rotate: isPlaybackRateMenuOpen() ? "180deg" : undefined,
            }}
          />
        </button>
        <Show when={playbackRateMenuPos()}>
          {(pos) => (
            <div
              popover
              id="playback-rate-menu"
              style={{
                position: "fixed",
                inset: "unset",
                right: `${pos().right}px`,
                bottom: `${pos().bottom - 1}px`,
                "min-width": `${pos().minWidth}px`,
                transition: "opacity 50ms",
                opacity: isPlaybackRateMenuOpen() ? 1 : 0,

                border: `2px solid ${Colors["cb-dark-50"]}`,
                "border-bottom": "0px",
                "border-radius": rem(0.25),
                "border-bottom-right-radius": isPlaybackRateMenuOpen()
                  ? "0px"
                  : undefined,
                background: PopupStyles["background"],
                color: Colors["cb-light-90"],
                padding: 0,
              }}
              onToggle={({ newState }) =>
                setIsPlaybackRateMenuOpen(newState === "open")
              }
            >
              <Show when={isPlaybackRateMenuOpen()}>
                <PlaybackRateMenu
                  media={props.media}
                  closeMenu={() =>
                    document.getElementById("playback-rate-menu")?.hidePopover()
                  }
                />
              </Show>
            </div>
          )}
        </Show>
        <Toggle
          active={loop()}
          onChange={(loop) => setLoop((props.media.loop = loop))}
          icon={LoopIcon}
          label={
            <Show when={loop()} fallback={"Loop"}>
              Disable looping
            </Show>
          }
        />
      </div>
    </Popup>
  );
}

function MediaList() {
  const mediaElements: HTMLMediaElement[] = [];
  for (const media of document.querySelectorAll("video, audio")) {
    if (!(media instanceof HTMLMediaElement)) continue;
    mediaElements.push(media);
  }

  const [selectedMedia, setSelectedMedia] =
    createSignal<HTMLMediaElement | null>(null);

  return (
    <>
      <Show when={!selectedMedia()}>
        <Popup>
          <ListSearch
            items={mediaElements}
            itemContent={(item) => <>{item.src}</>}
            filter={(media, lq) => media.src.toLowerCase().includes(lq)}
            handleSelect={function selectMedia(media) {
              setSelectedMedia(media);
            }}
          />
        </Popup>
      </Show>
      <Show when={selectedMedia()}>
        <MediaControls media={selectedMedia()!} />
      </Show>
    </>
  );
}

function TabList() {
  const [tabs] = createResource(async function getAllTabs() {
    const response = (await browser.runtime.sendMessage({
      type: "get-all-tabs",
    } satisfies Message)) as Message;
    if (!Array.isArray(response)) {
      throw new Error("Did not receive correct response");
    }
    return response as Tabs.Tab[];
  });

  const context = useMainContext();

  const [selectedTab, setSelectedTab] = createSignal<Tabs.Tab>();

  const tabActions = [
    {
      name: "Open tab",
      fn: function openTab() {
        const tab = selectedTab();
        if (!tab) return;
        browser.runtime.sendMessage({
          type: "activate-tab",
          tabId: tab.id,
        } satisfies Message);
      },
    },
    {
      name: "Close tab",
      fn: function closeTab() {
        const tab = selectedTab();
        if (!tab) return;
        browser.runtime.sendMessage({
          type: "close-tab",
          tabId: tab.id,
        } satisfies Message);
      },
    },
  ];

  return (
    <Show when={tabs()}>
      <Popup
        style={{
          visibility: !!selectedTab() ? "hidden" : undefined,
        }}
      >
        <ListSearch
          items={tabs()!}
          itemContent={(tab) => (
            <>
              <div style={{ "font-weight": "bold" }}>{tab.title}</div>
              <div
                style={{
                  "font-size": "smaller",
                  "grid-row": "2",
                  "white-space": "nowrap",
                  overflow: "hidden",
                  "text-overflow": "ellipsis",
                }}
              >
                {tab.url}
              </div>
            </>
          )}
          filter={(item, lowercaseQuery) =>
            Boolean(
              item.title?.toLowerCase().includes(lowercaseQuery) ||
                item.url?.toLowerCase().includes(lowercaseQuery)
            )
          }
          handleSelect={function selectTab(item, event) {
            setSelectedTab(item);
          }}
        />
      </Popup>
      <Show when={selectedTab()}>
        <Popup>
          <ListSearch
            items={tabActions}
            itemContent={(item) => (
              <span style={{ "font-weight": "bold" }}>{item.name}</span>
            )}
            filter={({ name }, lq) => name.toLowerCase().includes(lq)}
            handleSelect={(action) => {
              context.resetState(true);
              action.fn();
            }}
          />
        </Popup>
      </Show>
    </Show>
  );
}

function noop() {}

function DebugList() {
  const debug: number[] = [];
  for (let i = 0; i < 5000; i++) {
    debug.push(i);
  }
  return (
    <Popup>
      <ListSearch
        items={debug}
        filter={(i, lq) => i.toString().includes(lq)}
        itemContent={(i) => (
          <div
            style={{
              background: i % 2 === 0 ? "cornflowerblue" : "blueviolet",
            }}
          >
            {i}
          </div>
        )}
        handleSelect={noop}
      />
    </Popup>
  );
}

function CommandPalette(props: {
  actions: Actions;
  getCurrentElement: () => HTMLElement | null;
  showDebugList: () => boolean;
}) {
  const context = useMainContext();

  const commands: {
    desc: string;
    fn: (event: KeyboardEvent | MouseEvent) => void;
    key?: string;
  }[] = [];
  for (const [key, action] of Object.entries(props.actions)) {
    commands.push({
      desc: action.desc,
      fn: action.fn,
      key,
    });
  }

  if (!import.meta.env.PROD) {
    commands.push({
      desc: "Show debug list",
      fn: props.showDebugList,
    });
  }

  commands.push({
    desc: "Toggle debug info",
    fn: context.toggleDebugInfo,
  });

  function handleSelect(
    item: (typeof commands)[number],
    event: KeyboardEvent | MouseEvent
  ) {
    context.resetState(true);
    item.fn(event);
  }

  return (
    <Popup>
      <ListSearch
        items={commands}
        itemContent={(item) => (
          <div
            style={{ display: "flex", "align-items": "center", gap: rem(1) }}
          >
            <Show when={item.key}>
              <div>
                <Kbd>{item.key}</Kbd>
              </div>
            </Show>
            <div>{item.desc}</div>
          </div>
        )}
        filter={({ key, desc }, lowercaseQuery) => {
          return Boolean(
            key?.toLowerCase().includes(lowercaseQuery) ||
              desc.toLowerCase().includes(lowercaseQuery)
          );
        }}
        handleSelect={handleSelect}
      />
    </Popup>
  );
}

function Root() {
  let highlightsContainer: HTMLDivElement | undefined;

  const state: {
    activeElement: HTMLElement | null;
    keyInput: string;
    highlightState: HighlightState;
    highlightInput: string;
    highlightInteractionMode: ElementInteractionMode;
  } = {
    activeElement: null,
    keyInput: "",
    highlightState: HighlightState.None,
    highlightInput: "",
    highlightInteractionMode: ElementInteractionMode.Click,
  };

  const [isPassthrough, setIsPassthrough] = createSignal(false);
  const [keyInput, setKeyInput] = createSignal("");

  const [showActionHelp, setShowActionHelp] = createSignal(false);
  const [showLinkAndButtonList, setShowListAndButtonList] = createSignal(false);
  const [showMediaList, setShowMediaList] = createSignal(false);
  const [showTabList, setShowTabList] = createSignal(false);
  const [showDebugList, setShowDebugList] = createSignal(false);
  const [showCommandPalette, setShowCommandPalette] = createSignal(false);

  const [shouldShowDebugInfo, setShouldShowDebugInfo] = createSignal(false);

  function hideAllPopups() {
    setShowActionHelp(false);
    setShowListAndButtonList(false);
    setShowMediaList(false);
    setShowTabList(false);
    setShowCommandPalette(false);
    setShowDebugList(false);
  }

  const idToHighlightMap = new Map<string, HTMLElement>();
  const highlightToElementMap = new WeakMap<HTMLElement, HTMLElement>();

  function removeHighlight(id: string, highlight: HTMLElement) {
    highlight.remove();
    idToHighlightMap.delete(id);
    highlightToElementMap.delete(highlight);
  }

  function clearAllHighlights() {
    for (const [id, highlight] of idToHighlightMap) {
      removeHighlight(id, highlight);
    }
    if (!highlightsContainer) {
      return;
    }
    for (const child of Array.from(highlightsContainer.children)) {
      child.remove();
    }
  }

  function highlightElementsBySelector(selector: string, checkOpacity = true) {
    clearAllHighlights();
    const elements = document.querySelectorAll<HTMLElement>(selector);
    if (!elements) {
      return;
    }
    const elementRects = Array.from(
      elements.values().map((linkEl) => linkEl.getBoundingClientRect())
    );
    const highlightIDs = twoCharIDGenerator();
    const windowHeight = window.innerHeight;
    let createdHighlights = 0;
    for (let index = 0; index < elements.length; index++) {
      const element = elements[index];
      const elementRect = elementRects[index];
      const isInViewport =
        elementRect.top >= 0 &&
        elementRect.bottom <= windowHeight &&
        elementRect.width > 0 &&
        elementRect.height > 0;
      const isVisible = element.checkVisibility({
        checkOpacity,
      });
      if (!isInViewport || !isVisible) {
        continue;
      }
      const id = highlightIDs.next().value;
      const highlight = createElement("div", {
        styles: {
          ...HighlightStyles,
          translate: `${elementRect.x}px ${elementRect.y}px`,
        },
        text: id as string,
      });
      highlightsContainer?.append(highlight);
      idToHighlightMap.set(id as string, highlight);
      highlightToElementMap.set(highlight, element);
      createdHighlights++;
    }
    if (createdHighlights === 0) {
      return;
    }
    state.highlightState = HighlightState.Highlighted;
  }

  function handleHighlightInteraction(id: string) {
    const highlight = idToHighlightMap.get(id);
    if (!highlight) {
      return;
    }
    const element = highlightToElementMap.get(highlight);
    if (element) {
      handleElementInteraction(
        element,
        element instanceof HTMLInputElement
          ? ElementInteractionMode.Focus
          : state.highlightInteractionMode
      );
    }
  }

  function updateHighlightInput(key: string, event: KeyboardEvent) {
    state.highlightInput += key;
    const ids = Array.from(idToHighlightMap.keys());
    const highlightInput = state.highlightInput;
    const filtered = ids.filter((id) => id.startsWith(highlightInput));
    for (const [id, highlight] of idToHighlightMap) {
      if (!filtered.includes(id)) {
        removeHighlight(id, highlight);
      } else {
        const text = highlight.innerText;
        const s1 = text.slice(0, highlightInput.length);
        const s2 = text.slice(highlightInput.length);
        highlight.innerHTML = `<span style="opacity:0.5">${s1}</span>${s2}`;
      }
    }
    const firstResult = filtered[0];
    if (filtered.length === 1 && firstResult === highlightInput) {
      event.preventDefault();
      event.stopImmediatePropagation();
      handleHighlightInteraction(firstResult);
      state.highlightState = HighlightState.None;
      state.highlightInput = "";
      clearAllHighlights();
    } else if (filtered.length === 0) {
      state.highlightState = HighlightState.None;
      state.highlightInput = "";
      clearAllHighlights();
    }
  }

  function getElementToScroll(element: HTMLElement) {
    let elementToScroll: HTMLElement | null = null;
    elementToScroll = isElementOverflowing(element)
      ? element
      : findOverflowingParent(element);
    if (!elementToScroll) {
      elementToScroll = document.documentElement;
    }
    return elementToScroll;
  }

  function getCurrentElement() {
    let element = state.activeElement;
    if (!element || !element.isConnected) {
      state.activeElement = element =
        document.activeElement as HTMLElement | null;
    }
    if (!(element instanceof HTMLElement)) {
      return null;
    }
    return element;
  }

  function scrollUp() {
    const element = getCurrentElement();
    if (!element) {
      return;
    }
    const elementToScroll = getElementToScroll(element);
    elementToScroll.scrollBy({
      top: -70,
    });
  }

  function scrollHalfPageUp() {
    const element = getCurrentElement();
    if (!element) {
      return;
    }
    const elementToScroll = getElementToScroll(element);
    elementToScroll.scrollBy({
      top: -(window.innerHeight / 2),
    });
  }

  function scrollDown() {
    const element = getCurrentElement();
    if (!element) {
      return;
    }
    const elementToScroll = getElementToScroll(element);
    elementToScroll.scrollBy({
      top: 70,
    });
  }

  function scrollHalfPageDown() {
    const element = getCurrentElement();
    if (!element) {
      return;
    }
    const elementToScroll = getElementToScroll(element);
    elementToScroll.scrollBy({
      top: window.innerHeight / 2,
    });
  }

  function scrollToTop() {
    const element = getCurrentElement();
    if (!element) {
      return;
    }
    const elementToScroll = getElementToScroll(element);
    elementToScroll.scrollTop = 0;
  }

  function scrollToBottom() {
    const element = getCurrentElement();
    if (!element) {
      return;
    }
    const elementToScroll = getElementToScroll(element);
    elementToScroll.scrollTop = elementToScroll.scrollHeight;
  }

  function highlightLinksButtonsAndInputs() {
    if (state.highlightState === HighlightState.None) {
      state.highlightInteractionMode = ElementInteractionMode.Click;
      highlightElementsBySelector("a,button,input");
    }
  }

  function highlightLinksToOpenInNewTab() {
    if (state.highlightState === HighlightState.None) {
      state.highlightInteractionMode = ElementInteractionMode.OpenInNewTab;
      highlightElementsBySelector("a");
    }
  }

  function highlightAllInputs() {
    if (state.highlightState === HighlightState.None) {
      state.highlightInteractionMode = ElementInteractionMode.Focus;
      highlightElementsBySelector("input,textarea,[contenteditable]", false);
    }
  }

  function togglePassthrough() {
    setIsPassthrough((is) => !is);
  }

  function toggleCommandPalette() {
    setShowCommandPalette(true);
  }

  const actions: Actions = {
    k: { desc: "Scroll up", fn: scrollUp },
    j: { desc: "Scroll down", fn: scrollDown },
    e: { desc: "Scroll half-page up", fn: scrollHalfPageUp },
    d: { desc: "Scroll half-page down", fn: scrollHalfPageDown },
    "g g": { desc: "Scroll to top", fn: scrollToTop },
    "S-g": { desc: "Scroll to bottom", fn: scrollToBottom },
    i: { desc: "Highlight editable elements", fn: highlightAllInputs },
    "l f": {
      desc: "List all links & buttons",
      fn: () => setShowListAndButtonList((show) => !show),
    },
    "l v": {
      desc: "List all media",
      fn: () => setShowMediaList((show) => !show),
    },
    "l t": {
      desc: "List all tabs",
      fn: () => setShowTabList((show) => !show),
    },
    f: {
      desc: "Highlight links, buttons and inputs",
      fn: highlightLinksButtonsAndInputs,
    },
    "g f": {
      desc: "Highlight links to open in new tab",
      fn: highlightLinksToOpenInNewTab,
    },
    "S-?": {
      desc: "Show help",
      fn: () => {
        hideAllPopups();
        setShowActionHelp((show) => !show);
      },
    },
    p: { desc: "Toggle passthrough", fn: togglePassthrough },
    "C-p": { desc: "Show command palette", fn: toggleCommandPalette },
  };

  const actionKeyCombinations = Object.keys(actions);

  const actionUniqueKeys = new Set(
    actionKeyCombinations
      .map((kc) => kc.replace(/[CSA]-/g, "").split(" "))
      .flat()
  );

  const clickListener = (event: MouseEvent) => {
    if (event.target instanceof HTMLElement) {
      state.activeElement = event.target;
    }
  };

  const focusListener = (event: FocusEvent) => {
    if (event.target instanceof HTMLElement) {
      state.activeElement = event.target;
    }
  };

  function resetState(hidePopups: boolean) {
    if (hidePopups) {
      hideAllPopups();
    }
    clearAllHighlights();
    setKeyInput("");
    setIsPassthrough(false);
    state.highlightState = HighlightState.None;
    state.highlightInput = "";
  }

  const keydownListeners = new Set<KeyEventListener>();

  function registerKeydownListener(
    listener: KeyEventListener
  ): KeyEventListenerCleanup {
    keydownListeners.add(listener);
    return () => {
      keydownListeners.delete(listener);
    };
  }

  const mainKeydownListener = (event: KeyboardEvent) => {
    if (keydownListeners.size > 0) {
      const listeners = Array.from(keydownListeners);
      for (let i = listeners.length - 1; i >= 0; i--) {
        const listener = listeners[i];
        if (listener(event)) {
          return;
        }
      }
    }

    const { key, ctrlKey, shiftKey, altKey } = event;

    if (key === "Control" || key === "Shift" || key === "Alt") {
      return;
    }

    const element = getCurrentElement();
    const isInputElement =
      element instanceof HTMLInputElement ||
      element instanceof HTMLTextAreaElement ||
      element?.closest('[contenteditable="true"]');
    if (isInputElement) {
      resetState(false);
      return;
    }
    if (key === "Escape") {
      resetState(true);
      return;
    }

    if (
      !ctrlKey &&
      !shiftKey &&
      !altKey &&
      state.highlightState === HighlightState.Highlighted &&
      key !== "Escape"
    ) {
      event.stopImmediatePropagation();
      event.stopPropagation();
      updateHighlightInput(key, event);
      return;
    }

    const keyRepresentation = getKeyRepresentation(event);

    if (isPassthrough() && keyRepresentation !== "p") {
      return;
    }

    if (!actionUniqueKeys.has(key.toLowerCase())) {
      return;
    }

    if (keyInput().length > 0) {
      setKeyInput((ki) => ki + " ");
    }

    setKeyInput((ki) => ki + keyRepresentation);

    event.stopImmediatePropagation();
    event.stopPropagation();

    const input = keyInput();
    const filtered = actionKeyCombinations.filter((key) =>
      key.startsWith(input)
    );
    const firstResult = filtered[0];
    if (filtered.length === 1 && firstResult === input) {
      event.preventDefault();
      actions[firstResult].fn(event);
      setKeyInput("");
    } else if (filtered.length === 0) {
      setKeyInput("");
    }
  };

  onMount(() => {
    document.documentElement.addEventListener("click", clickListener);
    document.body.addEventListener("focusin", focusListener);
    document.body.addEventListener("keydown", mainKeydownListener, {
      capture: true,
    });
  });

  onCleanup(() => {
    document.documentElement.removeEventListener("click", clickListener);
    document.body.removeEventListener("focusin", focusListener);
    document.body.removeEventListener("keydown", mainKeydownListener, {
      capture: true,
    });
  });

  return (
    <mainContext.Provider
      value={{
        shouldShowDebugInfo,
        toggleDebugInfo: () => setShouldShowDebugInfo((b) => !b),
        hideAllPopups,
        resetState,
        registerKeydownListener,
      }}
    >
      <div
        ref={highlightsContainer}
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          "z-index": 69420,
          "pointer-events": "none",
        }}
      />
      <Show when={keyInput().length > 0 || showActionHelp()}>
        <ActionsHelp
          keyInput={keyInput()}
          actions={actions}
          actionKeys={actionKeyCombinations}
        />
      </Show>
      <Show when={showLinkAndButtonList()}>
        <SearchLinksAndButtons />
      </Show>
      <Show when={showMediaList()}>
        <MediaList />
      </Show>
      <Show when={showTabList()}>
        <TabList />
      </Show>
      <Show when={showDebugList()}>
        <DebugList />
      </Show>
      <Show when={isPassthrough()}>
        <div
          style={{
            ...PopupStyles,
            width: "auto",
            padding: rem(0.5),
          }}
        >
          Passthrough
        </div>
      </Show>
      <Show when={showCommandPalette()}>
        <CommandPalette
          actions={actions}
          getCurrentElement={getCurrentElement}
          showDebugList={() => setShowDebugList(true)}
        />
      </Show>
      <style>{`
.qs-input { outline: 0; }
.qs-input:focus-visible { outline: 2px solid cornflowerblue; }
.qs-popup > * { min-height: 0; }
.qs-popup ::-webkit-scrollbar { width: 16px; }
.qs-popup ::-webkit-scrollbar-thumb {
  background: ${Colors["cb"]};
  border-radius: ${rem(0.5)};
  border: 4px solid rgba(0,0,0,0);
  background-clip: padding-box;
}
.qs-popup:focus-visible, .qs-popup *:focus-visible { outline: 2px solid cornflowerblue; }
.qs-list-item { --is-hovered: 0; background: transparent; }
.qs-list-item:hover, .qs-list-item.active { --is-hovered: 1; background: ${
        Colors["cb-dark-60"]
      }; }
.qs-outline-btn { background: transparent; }
.qs-outline-btn:hover { background: ${Colors["cb-dark-60"]}; }
.qs-outline-btn:focus-visible { outline: 2px solid cornflowerblue; }
.qs-toggle {
  display: grid;
  place-items: center;
  padding: ${rem(0.25)};
  border: 2px solid ${Colors["cb-dark-50"]};
  border-radius: ${rem(0.25)}
}
.qs-toggle.active {
  background: ${Colors["cb-dark-50"]};
}
.qs-toggle:has(input:focus-visible) {
  outline: 2px solid cornflowerblue;
}
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}
`}</style>
    </mainContext.Provider>
  );
}

export default defineContentScript({
  matches: ["<all_urls>"],
  allFrames: true,
  matchOriginAsFallback: true,
  cssInjectionMode: "ui",
  main(ctx) {
    log("Loaded content script");

    const ui = createIntegratedUi(ctx, {
      position: "inline",
      onMount(uiContainer) {
        render(() => <Root />, uiContainer);
      },
    });
    ui.mount();
  },
});
