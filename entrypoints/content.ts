function log(...args: any[]) {
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

function createElement(
  tag: keyof HTMLElementTagNameMap,
  options: {
    styles?: {
      [key in keyof Partial<CSSStyleDeclaration>]: string;
    };
    children?: HTMLElement[];
    text?: string;
  } = {}
) {
  const element = document.createElement(tag);
  const { styles, children, text } = options;
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

enum HighlightState {
  None = 0,
  Highlighted = 1,
}

enum HighlightInteractionMode {
  Click = 0,
  Focus = 1,
  OpenInNewTab = 2,
}

export default defineContentScript({
  matches: ["<all_urls>"],
  allFrames: true,
  matchOriginAsFallback: true,
  main() {
    log("Loaded content script");

    const letters = Array(26)
      .fill(0)
      .map((_, index) => {
        let i = index + 97;
        return String.fromCharCode(i);
      });

    const state: {
      activeElement: HTMLElement | null;
      keyInput: string;
      highlightsContainer: HTMLElement;
      highlightState: HighlightState;
      highlightInput: string;
      highlightInteractionMode: HighlightInteractionMode;
    } = {
      activeElement: null,
      keyInput: "",
      highlightsContainer: createElement("div", {
        styles: {
          position: "fixed",
          pointerEvents: "none",
          top: "0",
          left: "0",
          width: "100%",
          height: "100%",
        },
      }),
      highlightState: HighlightState.None,
      highlightInput: "",
      highlightInteractionMode: HighlightInteractionMode.Click,
    };

    document.body.append(state.highlightsContainer);

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
      for (const child of Array.from(state.highlightsContainer.children)) {
        child.remove();
      }
    }

    function generateIDsForLength(length: number) {
      const ids: string[] = [];
      let leaderKeys: string[] = [
        letters[Math.floor(Math.random() * 10) % letters.length],
      ];
      let lettersWithoutLeader = letters.filter((l) => !leaderKeys.includes(l));
      for (let i = 0; i < length; i++) {
        let id = "";
        const letter = lettersWithoutLeader.shift();
        let leaderKey = leaderKeys.slice(0, leaderKeys.length - 1);
        if (leaderKeys.length - 1 !== 0) {
          id += leaderKey.join("");
        }
        if (letter) {
          id += letter;
        }
        if (lettersWithoutLeader.length === 0) {
          const lettersWithoutLatestLeaderKey = letters.filter(
            (l) => !leaderKeys.includes(l)
          );
          const newLeaderKey =
            lettersWithoutLatestLeaderKey[
              Math.floor(Math.random() * 10) %
                lettersWithoutLatestLeaderKey.length
            ];
          leaderKeys.push(newLeaderKey);
          lettersWithoutLeader = letters.filter((l) => !leaderKeys.includes(l));
        }
        ids.push(id);
      }
      return ids;
    }

    function highlightElementsBySelector(selector: string) {
      clearAllHighlights();
      const elements = document.querySelectorAll<HTMLElement>(selector);
      if (!elements) {
        return;
      }
      const elementRects = Array.from(
        elements.values().map((linkEl) => linkEl.getBoundingClientRect())
      );
      const highlightIDs = generateIDsForLength(elements.length);
      let createdHighlights = 0;
      for (let index = 0; index < elements.length; index++) {
        const element = elements[index];
        const elementRect = elementRects[index];
        const overflowParent = findOverflowingParent(element);
        if (overflowParent) {
          const parentRect = overflowParent.getBoundingClientRect();
          if (elementRect.bottom < parentRect.top) {
            continue;
          }
        }
        const id = highlightIDs[index];
        const highlight = createElement("div", {
          styles: {
            position: "absolute",
            top: "0",
            left: "0",
            zIndex: "69420",
            translate: `${elementRect.x}px ${elementRect.y}px`,
            background: `hsl(50deg 80% 80%)`,
            color: "black",
            padding: "1px 4px",
          },
          text: id,
        });
        state.highlightsContainer.append(highlight);
        idToHighlightMap.set(id, highlight);
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
        switch (state.highlightInteractionMode) {
          case HighlightInteractionMode.Click:
            element.click();
            break;
          case HighlightInteractionMode.Focus:
            element.focus();
            break;
          case HighlightInteractionMode.OpenInNewTab: {
            if (!(element instanceof HTMLAnchorElement)) {
              return;
            }
            const href = element.href;
            window.open(href, "_blank");
            break;
          }
        }
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

    document.documentElement.addEventListener("click", (event) => {
      if (event.target instanceof HTMLElement) {
        state.activeElement = event.target;
      }
    });

    document.body.addEventListener("focusin", (event) => {
      if (event.target instanceof HTMLElement) {
        state.activeElement = event.target;
      }
    });

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
      const element = state.activeElement || document.activeElement;
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

    function highlightLinksAndButtons() {
      if (state.highlightState === HighlightState.None) {
        state.highlightInteractionMode = HighlightInteractionMode.Click;
        highlightElementsBySelector("a,button");
      }
    }

    function highlightLinksToOpenInNewTab() {
      if (state.highlightState === HighlightState.None) {
        state.highlightInteractionMode = HighlightInteractionMode.OpenInNewTab;
        highlightElementsBySelector("a");
      }
    }

    function highlightAllInputs() {
      if (state.highlightState === HighlightState.None) {
        state.highlightInteractionMode = HighlightInteractionMode.Focus;
        highlightElementsBySelector("input,textarea,[contenteditable]");
      }
    }

    const actions: Readonly<Record<string, (event: KeyboardEvent) => void>> =
      Object.freeze({
        d: scrollHalfPageDown,
        e: scrollHalfPageUp,
        j: scrollDown,
        k: scrollUp,
        "g g": scrollToTop,
        i: highlightAllInputs,
        f: highlightLinksAndButtons,
        "g f": highlightLinksToOpenInNewTab,
        "S-g": scrollToBottom,
      });

    const actionKeys = Object.keys(actions);

    document.documentElement.addEventListener("keydown", (event) => {
      const { key, ctrlKey, shiftKey, altKey } = event;

      if (key === "Control" || key === "Shift" || key === "Alt") {
        return;
      }

      const element = getCurrentElement();
      const isInputElement =
        element instanceof HTMLInputElement ||
        element instanceof HTMLTextAreaElement ||
        element?.closest('[contenteditable="true"]');
      if (key === "Escape" || isInputElement) {
        if (key === "Escape") {
          event.preventDefault();
        }

        clearAllHighlights();
        state.keyInput = "";
        state.highlightState = HighlightState.None;
        state.highlightInput = "";
        return;
      }

      if (
        !ctrlKey &&
        !shiftKey &&
        !altKey &&
        state.highlightState === HighlightState.Highlighted &&
        key !== "Escape"
      ) {
        updateHighlightInput(key, event);
        return;
      }

      if (state.keyInput.length > 0) {
        state.keyInput += " ";
      }

      state.keyInput += `${ctrlKey ? "C-" : ""}${shiftKey ? "S-" : ""}${
        altKey ? "A-" : ""
      }${key.toLowerCase()}`;

      const keyInput = state.keyInput;
      const filtered = actionKeys.filter((key) => key.startsWith(keyInput));
      const firstResult = filtered[0];
      if (filtered.length === 1 && firstResult === keyInput) {
        event.preventDefault();
        actions[firstResult](event);
        state.keyInput = "";
      } else if (filtered.length === 0) {
        state.keyInput = "";
      }
    });
  },
});
