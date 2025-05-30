# quicksilver

Browser extension for better movement using the keyboard.

## Installation

Firefox: https://addons.mozilla.org/en-US/firefox/addon/quicksilver-1/

## Development

### Install dependencies

```console
corepack enable
yarn install
```

### Start temp browser instance with hot-reload

```console
yarn dev
```

Starts a new temporary chromium/chrome instance with the extension loaded and the wikipedia homepage opened. Pass `-b firefox` to start a firefox instance instead.

### Building for Firefox

```console
yarn zip:firefox
```

### Building for Chrome

```console
yarn zip:chrome
```

## Features

### Highlight interactive elements

Press <kbd>f</kbd> to highlight all the interactive elements visible on the screen, and then the key combination to interact with them.

![Screenshot of a github page showing all interactive elements highlight](./screenshots/highlight_interactive_elements_1.png)

### Search list of interactive elements

Press <kbd>lf</kbd> to list all the interactive elements in the document. Start typing to search, press <kbd>Enter</kbd> to select.

![Screenshot of a list of all interactive elements](./screenshots/list_interactive_elements_0.png)

![Screenshot of the menu for an interactive element](./screenshots/list_interactive_elements_1.png)

### Scrolling

Use the following commands to scroll the active scroll container:

<kbd>k</kbd> Scroll up by 70px

<kbd>j</kbd> Scroll down by 70px

<kbd>e</kbd> Scroll up by half page

<kbd>d</kbd> Scroll down by half page

<kbd>gg</kbd> Scroll to top

<kbd>S-g</kbd> Scroll to bottom

### Visual mode

Press <kbd>v</kbd> to highlight all the words visible on the screen and enter visual caret mode.

![Screenshot of wikipedia page with all visible words highlighted](./screenshots/visual_mode_highlights.png)

#### Visual caret mode

Visual caret mode allows moving the selection caret using certain vim motions like <kbd>h</kbd>, <kbd>l</kbd>, <kbd>w</kbd>, <kbd>b</kbd>, etc.

https://github.com/user-attachments/assets/87fa67a0-ee07-4610-925a-793900927568

#### Visual range mode

Visual range mode allows extending the selection caret using certain vim motions like <kbd>h</kbd>, <kbd>l</kbd>, <kbd>w</kbd>, <kbd>b</kbd>, etc.

https://github.com/user-attachments/assets/990fee20-36ae-4506-be68-8c6558479f43

### Others

Press <kbd>S-?</kbd> to show all possible keyboard shortcuts.

![Screenshot of the help page that shows all shortcuts](./screenshots/all_shortcuts.png)
