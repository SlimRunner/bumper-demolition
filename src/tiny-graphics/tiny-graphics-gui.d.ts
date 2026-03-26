import type { tiny } from "./tiny-graphics";

export interface TinyDefs {
  [key: string]: any;
}

export interface WidgetOptions {
  code_in_focus?: tiny.Component;
  hide_navigator?: boolean;
  rows?: number;
  [key: string]: any;
}

export interface SavedControls {
  shortcut_combination: Array<KeyboardEvent["key"]>;
  callback: (event: KeyboardEvent) => void;
  keyup_callback: (event: KeyboardEvent) => void;
}

export namespace widgets {
  export class Controls_Widget {
    row: HTMLTableRowElement;
    panels: Array<HTMLTableCellElement>;
    component: tiny.Component;
    timestamp: number;
    event: number;

    constructor(component: tiny.Component, options?: WidgetOptions);

    make_panels(time: number): void;
    render(time?: number): void;
  }

  export class Keyboard_Manager {
    saved_controls: SavedControls;
    actively_pressed_keys: Set<KeyboardEvent>;
    callback_behavior: (event: KeyboardEvent) => void;

    constructor(
      target: EventTarget,
      callback_behavior: (
        callback: (event: KeyboardEvent) => void,
        event: KeyboardEvent,
      ) => void,
    );

    key_down_handler(event: KeyboardEvent): void;
    key_up_handler(event: KeyboardEvent): void;
    add(
      shortcut_combination: Array<KeyboardEvent["key"]>,
      callback: (event: KeyboardEvent) => void,
      keyup_callback: (event: KeyboardEvent) => void,
    ): void;
  }

  export class Code_Manager {
    tokens: {
      type: string;
      value: string;
    }[];
    no_comments: string[];

    constructor(code: string);
  }

  export class Code_Widget {
    component: tiny.Component;
    definitions: TinyDefs;
    code_display: HTMLDivElement;

    constructor(component: tiny.Component, options?: WidgetOptions);

    private build_reader(
      element: HTMLElement,
      main_scene: tiny.Component,
      definitions: TinyDefs,
    ): void;
    private build_navigator(
      element: HTMLElement,
      main_scene: tiny.Component,
    ): void;
    display_code(code_in_focus: tiny.Component): void;
    format_code(code_string: string): void;
  }

  export class Editor_Widget {
    component: tiny.Component;
    options: WidgetOptions;
    form: HTMLFormElement;
    run_button: HTMLButtonElement;
    submit: HTMLButtonElement;
    author_box: HTMLInputElement;
    password_box: HTMLInputElement;
    overwrite_panel: HTMLSpanElement;
    submit_result: HTMLDivElement;
    new_demo_code: HTMLTextAreaElement;

    constructor(component: tiny.Component, options?: WidgetOptions);

    select_class(class_definition: tiny.Component): void;
    fetch_handler(url: RequestInfo | URL, body: BodyInit): Promise<any>;
    submit_demo(): Promise<void>;
  }
}
