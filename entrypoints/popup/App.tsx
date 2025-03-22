import { ComponentProps } from "solid-js";
import { disabledGlobally } from "../../shared/storage";
import { error } from "../../shared/log";

function SwitchToggle(
  props: {
    checked: boolean;
    onChange: (checked: boolean) => void;
    inputProps?: ComponentProps<"input">;
  } & Omit<ComponentProps<"div">, "onChange">
) {
  const [state, inputProps, rest] = splitProps(
    props,
    ["checked", "onChange"],
    ["inputProps"]
  );

  return (
    <div class="relative">
      <input
        role="switch"
        type="checkbox"
        class="sr-only absolute top-0 left-0 w-full h-full"
        {...inputProps.inputProps}
        checked={state.checked}
        onChange={(event) => {
          const checked = event.target.checked;
          state.onChange(checked);
        }}
      />
      <div
        classList={{
          "flex w-9.5 p-0.5 rounded-full": true,
          "bg-slate-500": !state.checked,
          "bg-slate-200": state.checked,
        }}
      >
        <div
          classList={{
            "w-4 h-4 bg-slate-800 rounded-full transition-[margin-left] duration-100":
              true,
            "ml-[calc(100%-1rem)]": state.checked,
          }}
        />
      </div>
    </div>
  );
}

function App() {
  const [enabledGlobally, setEnabledGlobally] = createSignal(true);
  onMount(() => {
    disabledGlobally
      .getValue()
      .then((disabled) => setEnabledGlobally(!disabled))
      .catch(error);

    const unwatch = disabledGlobally.watch((value) => {
      setEnabledGlobally(!value);
    });

    onCleanup(() => {
      unwatch();
    });
  });

  return (
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
  );
}

export default App;
