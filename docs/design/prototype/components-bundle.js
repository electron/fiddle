
/* @ds-bundle: {"format": 4, "namespace": "Fiddle", "components": [{"name": "TitleBar"}, {"name": "SplitPane"}, {"name": "Tile"}, {"name": "ControlGroup"}, {"name": "Fieldset"}, {"name": "Page"}, {"name": "Divider"}, {"name": "ScrollArea"}, {"name": "Heading"}, {"name": "Text"}, {"name": "Code"}, {"name": "Link"}, {"name": "Button"}, {"name": "RunButton"}, {"name": "SplitButton"}, {"name": "IconButton"}, {"name": "Input"}, {"name": "UrlInput"}, {"name": "InputList"}, {"name": "Checkbox"}, {"name": "RadioGroup"}, {"name": "Switch"}, {"name": "SegmentedControl"}, {"name": "FilePicker"}, {"name": "CompactSelect"}, {"name": "FormField"}, {"name": "Select"}, {"name": "FilterableSelect"}, {"name": "Suggest"}, {"name": "Menu"}, {"name": "ContextMenu"}, {"name": "Dialog"}, {"name": "AlertDialog"}, {"name": "Popover"}, {"name": "Tooltip"}, {"name": "Toast"}, {"name": "ToastStack"}, {"name": "Coachmark"}, {"name": "Spinner"}, {"name": "LoadingBlock"}, {"name": "Progress"}, {"name": "Callout"}, {"name": "EmptyState"}, {"name": "Badge"}, {"name": "Kbd"}, {"name": "FileTree"}, {"name": "Table"}, {"name": "StatusCell"}, {"name": "Tag"}, {"name": "ListRow"}, {"name": "Card"}, {"name": "Icon"}, {"name": "Tabs"}, {"name": "SideNav"}, {"name": "CodeEditor"}, {"name": "EditorGrid"}, {"name": "Console"}, {"name": "VersionPicker"}, {"name": "ModuleList"}, {"name": "VersionManager"}]} */
var Fiddle = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: !0 });
  }, __copyProps = (to, from, except, desc) => {
    if (from && typeof from == "object" || typeof from == "function")
      for (let key of __getOwnPropNames(from))
        !__hasOwnProp.call(to, key) && key !== except && __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: !0 }), mod);
  var all_exports = {};
  __export(all_exports, {
    AlertDialog: () => AlertDialog,
    Badge: () => Badge,
    Button: () => Button,
    Callout: () => Callout,
    Card: () => Card,
    Checkbox: () => Checkbox,
    Coachmark: () => Coachmark,
    Code: () => Code,
    CodeEditor: () => CodeEditor,
    CompactSelect: () => CompactSelect,
    Console: () => Console,
    ContextMenu: () => ContextMenu,
    ControlGroup: () => ControlGroup,
    Dialog: () => Dialog,
    Divider: () => Divider,
    EditorGrid: () => EditorGrid,
    EmptyState: () => EmptyState,
    Fieldset: () => Fieldset,
    FilePicker: () => FilePicker,
    FileTree: () => FileTree,
    FilterableSelect: () => FilterableSelect,
    FormField: () => FormField,
    Heading: () => Heading,
    ICONS: () => ICONS,
    Icon: () => Icon,
    IconButton: () => IconButton,
    Input: () => Input,
    InputList: () => InputList,
    Kbd: () => Kbd,
    Link: () => Link,
    ListRow: () => ListRow,
    LoadingBlock: () => LoadingBlock,
    Menu: () => Menu,
    ModuleList: () => ModuleList,
    Page: () => Page,
    Popover: () => Popover,
    Progress: () => Progress,
    RadioGroup: () => RadioGroup,
    RunButton: () => RunButton,
    ScrollArea: () => ScrollArea,
    SegmentedControl: () => SegmentedControl,
    Select: () => Select,
    SideNav: () => SideNav,
    Spinner: () => Spinner,
    SplitButton: () => SplitButton,
    SplitPane: () => SplitPane,
    StatusCell: () => StatusCell,
    Suggest: () => Suggest,
    Switch: () => Switch,
    Table: () => Table,
    Tabs: () => Tabs,
    Tag: () => Tag,
    Text: () => Text,
    Tile: () => Tile,
    TitleBar: () => TitleBar,
    Toast: () => Toast,
    ToastStack: () => ToastStack,
    Tooltip: () => Tooltip,
    Tree: () => Tree,
    UrlInput: () => UrlInput,
    VersionManager: () => VersionManager,
    VersionPicker: () => VersionPicker,
    monacoTheme: () => monacoTheme
  });
  const { useState, useRef, useEffect, useCallback, Fragment } = React, cx = (...a) => a.filter(Boolean).join(" "), PATHS = {
    play: /* @__PURE__ */ React.createElement("path", { d: "M4.6 2.9v10.2L13 8z", fill: "currentColor", stroke: "none" }),
    stop: /* @__PURE__ */ React.createElement("rect", { x: "4", y: "4", width: "8", height: "8", rx: "1", fill: "currentColor", stroke: "none" }),
    terminal: /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("rect", { x: "2", y: "3", width: "12", height: "10", rx: "1.5" }), /* @__PURE__ */ React.createElement("path", { d: "M5 6.5 7 8l-2 1.5M8.5 10H11" })),
    file: /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("path", { d: "M4.5 2h4.5l3 3v9h-7.5z" }), /* @__PURE__ */ React.createElement("path", { d: "M9 2v3h3" })),
    folder: /* @__PURE__ */ React.createElement("path", { d: "M2 4.5A1.5 1.5 0 0 1 3.5 3h2.8l1.4 1.5h4.8A1.5 1.5 0 0 1 14 6v5.5a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 2 11.5z" }),
    "chevron-down": /* @__PURE__ */ React.createElement("path", { d: "m4.5 6 3.5 3.5L11.5 6" }),
    "chevron-right": /* @__PURE__ */ React.createElement("path", { d: "m6 4.5 3.5 3.5L6 11.5" }),
    upload: /* @__PURE__ */ React.createElement("path", { d: "M8 10.5V3M5 6l3-3 3 3M3 13h10" }),
    download: /* @__PURE__ */ React.createElement("path", { d: "M8 3v7.5M5 7.5l3 3 3-3M3 13h10" }),
    plus: /* @__PURE__ */ React.createElement("path", { d: "M8 3.5v9M3.5 8h9" }),
    search: /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("circle", { cx: "7", cy: "7", r: "4" }), /* @__PURE__ */ React.createElement("path", { d: "m10 10 3 3" })),
    link: /* @__PURE__ */ React.createElement("path", { d: "M7 5H5.5a3 3 0 0 0 0 6H7M9 5h1.5a3 3 0 0 1 0 6H9M6 8h4" }),
    check: /* @__PURE__ */ React.createElement("path", { d: "m3.5 8.5 3 3 6-7" }),
    minus: /* @__PURE__ */ React.createElement("path", { d: "M4 8h8" }),
    x: /* @__PURE__ */ React.createElement("path", { d: "m4.5 4.5 7 7M11.5 4.5l-7 7" }),
    gear: /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("path", { d: "M14.22 6.48 L14.22 9.52 L12.53 9.86 L12.52 9.89 L13.47 11.32 L11.32 13.47 L9.89 12.52 L9.86 12.53 L9.52 14.22 L6.48 14.22 L6.14 12.53 L6.11 12.52 L4.68 13.47 L2.53 11.32 L3.48 9.89 L3.47 9.86 L1.78 9.52 L1.78 6.48 L3.47 6.14 L3.48 6.11 L2.53 4.68 L4.68 2.53 L6.11 3.48 L6.14 3.47 L6.48 1.78 L9.52 1.78 L9.86 3.47 L9.89 3.48 L11.32 2.53 L13.47 4.68 L12.52 6.11 L12.53 6.14Z" }), /* @__PURE__ */ React.createElement("circle", { cx: "8", cy: "8", r: "2" })),
    lock: /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("rect", { x: "3.5", y: "7", width: "9", height: "6.5", rx: "1.2" }), /* @__PURE__ */ React.createElement("path", { d: "M5.5 7V5.2a2.5 2.5 0 0 1 5 0V7" })),
    info: /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("circle", { cx: "8", cy: "8", r: "6" }), /* @__PURE__ */ React.createElement("path", { d: "M8 7.2V11M8 5v.01" })),
    alert: /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("path", { d: "M8 2.2 14.2 13H1.8z" }), /* @__PURE__ */ React.createElement("path", { d: "M8 6.5v3M8 11.2v.01" })),
    "check-circle": /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("circle", { cx: "8", cy: "8", r: "6" }), /* @__PURE__ */ React.createElement("path", { d: "m5.5 8.2 1.8 1.8 3.3-3.8" })),
    copy: /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("rect", { x: "5", y: "5", width: "8", height: "8", rx: "1.5" }), /* @__PURE__ */ React.createElement("path", { d: "M3 10.5V4a1 1 0 0 1 1-1h6.5" })),
    trash: /* @__PURE__ */ React.createElement("path", { d: "M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.7 8.5h5.6l.7-8.5" }),
    refresh: /* @__PURE__ */ React.createElement("path", { d: "M12.5 6A5 5 0 1 0 13 9.5M12.5 2.5V6H9" }),
    package: /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("path", { d: "M8 1.8 13.5 5v6L8 14.2 2.5 11V5z" }), /* @__PURE__ */ React.createElement("path", { d: "M2.5 5 8 8.2 13.5 5M8 8.2v6" })),
    maximize: /* @__PURE__ */ React.createElement("path", { d: "M9.5 2.5h4v4M6.5 13.5h-4v-4M13.5 2.5 9.5 6.5M2.5 13.5l4-4" }),
    minimize: /* @__PURE__ */ React.createElement("path", { d: "M13.5 6.5h-4v-4M2.5 9.5h4v4M9.5 6.5l4-4M6.5 9.5l-4 4" }),
    popout: /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("path", { d: "M9.5 2.5h4v4M13.5 2.5 8 8" }), /* @__PURE__ */ React.createElement("path", { d: "M11.5 9.5v3a1 1 0 0 1-1 1h-7a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1h3" })),
    dock: /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("path", { d: "M13.5 2.5 8.5 7.5M8.5 4v3.5H12" }), /* @__PURE__ */ React.createElement("path", { d: "M11.5 9.5v3a1 1 0 0 1-1 1h-7a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1h3" })),
    pin: /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("path", { d: "M9.5 2.5 13.5 6.5 11 7.5 8.5 10l-.5 3-5-5 3-.5L8.5 5z" }), /* @__PURE__ */ React.createElement("path", { d: "m5.5 10.5-3 3" })),
    more: /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("circle", { cx: "4", cy: "8", r: ".9", fill: "currentColor" }), /* @__PURE__ */ React.createElement("circle", { cx: "8", cy: "8", r: ".9", fill: "currentColor" }), /* @__PURE__ */ React.createElement("circle", { cx: "12", cy: "8", r: ".9", fill: "currentColor" })),
    eye: /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("path", { d: "M1.8 8S4 3.5 8 3.5 14.2 8 14.2 8 12 12.5 8 12.5 1.8 8 1.8 8z" }), /* @__PURE__ */ React.createElement("circle", { cx: "8", cy: "8", r: "2" })),
    "eye-off": /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("path", { d: "M6.2 3.8A6.7 6.7 0 0 1 8 3.5C12 3.5 14.2 8 14.2 8a11 11 0 0 1-1.9 2.6M9.9 9.9A2 2 0 0 1 6.1 6.1M4.1 4.9C2.6 6 1.8 8 1.8 8S4 12.5 8 12.5a6 6 0 0 0 2.9-.7" }), /* @__PURE__ */ React.createElement("path", { d: "m2.5 2.5 11 11" })),
    sidebar: /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("rect", { x: "2", y: "3", width: "12", height: "10", rx: "1.5" }), /* @__PURE__ */ React.createElement("path", { d: "M6 3v10" })),
    columns: /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("rect", { x: "2", y: "3", width: "12", height: "10", rx: "1.5" }), /* @__PURE__ */ React.createElement("path", { d: "M8 3v10" })),
    branch: /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("circle", { cx: "4.5", cy: "4", r: "1.5" }), /* @__PURE__ */ React.createElement("circle", { cx: "4.5", cy: "12", r: "1.5" }), /* @__PURE__ */ React.createElement("circle", { cx: "11.5", cy: "6", r: "1.5" }), /* @__PURE__ */ React.createElement("path", { d: "M4.5 5.5v5M11.5 7.5c0 2.5-2 3-5 3.5" })),
    book: /* @__PURE__ */ React.createElement("path", { d: "M3 3.5A1.5 1.5 0 0 1 4.5 2H13v10H4.5A1.5 1.5 0 0 0 3 13.5zM3 13.5A1.5 1.5 0 0 0 4.5 15H13v-3" }),
    external: /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("path", { d: "M9.5 2.5h4v4M13.5 2.5 8 8" }), /* @__PURE__ */ React.createElement("path", { d: "M12 9.5v3.5H3V4h3.5" })),
    filter: /* @__PURE__ */ React.createElement("path", { d: "M2.5 3.5h11l-4.2 5v4l-2.6 1.3V8.5z" }),
    grip: /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("circle", { cx: "6", cy: "4", r: ".9", fill: "currentColor" }), /* @__PURE__ */ React.createElement("circle", { cx: "10", cy: "4", r: ".9", fill: "currentColor" }), /* @__PURE__ */ React.createElement("circle", { cx: "6", cy: "8", r: ".9", fill: "currentColor" }), /* @__PURE__ */ React.createElement("circle", { cx: "10", cy: "8", r: ".9", fill: "currentColor" }), /* @__PURE__ */ React.createElement("circle", { cx: "6", cy: "12", r: ".9", fill: "currentColor" }), /* @__PURE__ */ React.createElement("circle", { cx: "10", cy: "12", r: ".9", fill: "currentColor" })),
    user: /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("circle", { cx: "8", cy: "5.5", r: "2.5" }), /* @__PURE__ */ React.createElement("path", { d: "M3 13.5c.8-2.4 2.7-3.5 5-3.5s4.2 1.1 5 3.5" })),
    palette: /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("path", { d: "M8 2a6 6 0 0 0 0 12c1 0 1.3-.7 1-1.4-.4-.9.2-1.6 1.1-1.6H12a2 2 0 0 0 2-2A6 6 0 0 0 8 2z" }), /* @__PURE__ */ React.createElement("circle", { cx: "5", cy: "7", r: ".8", fill: "currentColor" }), /* @__PURE__ */ React.createElement("circle", { cx: "8", cy: "5", r: ".8", fill: "currentColor" }), /* @__PURE__ */ React.createElement("circle", { cx: "11", cy: "7", r: ".8", fill: "currentColor" })),
    keyboard: /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("rect", { x: "1.5", y: "4", width: "13", height: "8", rx: "1.5" }), /* @__PURE__ */ React.createElement("path", { d: "M4 6.5h.01M6.5 6.5h.01M9 6.5h.01M11.5 6.5h.01M5 9.5h6" })),
    history: /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("path", { d: "M2.5 8a5.5 5.5 0 1 0 1.6-3.9M2.5 2.5v2.5H5" }), /* @__PURE__ */ React.createElement("path", { d: "M8 5v3l2 1.5" })),
    cloud: /* @__PURE__ */ React.createElement("path", { d: "M4.5 12.5a3 3 0 0 1-.4-6 4 4 0 0 1 7.7-.8 3.4 3.4 0 0 1 .2 6.8z" }),
    bell: /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("path", { d: "M4 11V7.5a4 4 0 0 1 8 0V11l1 1.5H3z" }), /* @__PURE__ */ React.createElement("path", { d: "M6.5 14h3" })),
    sparkle: /* @__PURE__ */ React.createElement("path", { d: "M8 2.5 9.3 6.7 13.5 8 9.3 9.3 8 13.5 6.7 9.3 2.5 8 6.7 6.7z" }),
    window: /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("rect", { x: "2", y: "3", width: "12", height: "10", rx: "1.5" }), /* @__PURE__ */ React.createElement("path", { d: "M2 6h12" })),
    code: /* @__PURE__ */ React.createElement("path", { d: "m5.5 4.5-3.5 3.5 3.5 3.5M10.5 4.5l3.5 3.5-3.5 3.5" }),
    "arrow-right": /* @__PURE__ */ React.createElement("path", { d: "M3 8h10M9 4l4 4-4 4" }),
    "arrow-left": /* @__PURE__ */ React.createElement("path", { d: "M13 8H3M7 4 3 8l4 4" }),
    circle: /* @__PURE__ */ React.createElement("circle", { cx: "8", cy: "8", r: "5.5" }),
    "x-circle": /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("circle", { cx: "8", cy: "8", r: "6" }), /* @__PURE__ */ React.createElement("path", { d: "m6 6 4 4M10 6l-4 4" }))
  }, ICONS = Object.keys(PATHS), ICON_SIZES = { sm: 12, md: 16, lg: 20 };
  function Icon({ name, size = 16, className, label }) {
    return size = ICON_SIZES[size] || size, /* @__PURE__ */ React.createElement(
      "svg",
      {
        className: cx("fd-icon", className),
        width: size,
        height: size,
        viewBox: "0 0 16 16",
        fill: "none",
        stroke: "currentColor",
        strokeWidth: "1.5",
        strokeLinecap: "round",
        strokeLinejoin: "round",
        role: label ? "img" : void 0,
        "aria-label": label,
        "aria-hidden": label ? void 0 : "true"
      },
      PATHS[name] || null
    );
  }
  function Kbd({ children, keys }) {
    const list = keys || (typeof children == "string" ? [children] : null);
    return list ? /* @__PURE__ */ React.createElement("span", { className: "fd-kbds" }, list.map((k, i) => /* @__PURE__ */ React.createElement("kbd", { key: i, className: "fd-kbd" }, k))) : /* @__PURE__ */ React.createElement("kbd", { className: "fd-kbd" }, children);
  }
  function Button({ variant = "secondary", size = "md", icon, iconNode, iconEnd, kbd, loading = !1, active, fill, disabled, children, className, ...rest }) {
    return /* @__PURE__ */ React.createElement(
      "button",
      {
        type: "button",
        className: cx("fd-btn", className),
        "data-variant": variant,
        "data-size": size,
        "data-fill": fill ? "" : void 0,
        "aria-pressed": active,
        disabled: disabled || loading,
        "aria-busy": loading || void 0,
        ...rest
      },
      loading ? /* @__PURE__ */ React.createElement("span", { className: "fd-spin", "aria-hidden": "true" }) : iconNode || (icon ? /* @__PURE__ */ React.createElement(Icon, { name: icon }) : null),
      children != null && /* @__PURE__ */ React.createElement("span", { className: "fd-btn-label" }, children),
      iconEnd && /* @__PURE__ */ React.createElement(Icon, { name: iconEnd }),
      kbd && /* @__PURE__ */ React.createElement("span", { className: "fd-btn-kbd" }, kbd)
    );
  }
  function IconButton({ icon, label, variant = "ghost", size = "md", pressed, className, ...rest }) {
    return /* @__PURE__ */ React.createElement(
      "button",
      {
        type: "button",
        className: cx("fd-btn fd-iconbtn", className),
        "data-variant": variant,
        "data-size": size,
        "aria-label": label,
        title: label,
        "aria-pressed": pressed,
        ...rest
      },
      /* @__PURE__ */ React.createElement(Icon, { name: icon })
    );
  }
  let uid = 0;
  const useId = (p) => {
    const r = useRef(null);
    return r.current == null && (r.current = p + ++uid), r.current;
  };
  function Input({ label, hint, error, icon, suffix, action, size = "md", fill, onSubmit, disabled, className, id, mono, style, ...rest }) {
    const autoId = useId("fd-in-"), iid = id || autoId, msg = error || hint;
    return /* @__PURE__ */ React.createElement("div", { className: cx("fd-fieldwrap", className), "data-fill": fill ? "" : void 0, style }, label && /* @__PURE__ */ React.createElement("label", { className: "fd-label", htmlFor: iid }, label), /* @__PURE__ */ React.createElement("div", { className: "fd-field", "data-size": size, "data-invalid": error ? "" : void 0, "data-disabled": disabled ? "" : void 0 }, icon && /* @__PURE__ */ React.createElement(Icon, { name: icon, className: "fd-field-icon" }), /* @__PURE__ */ React.createElement(
      "input",
      {
        id: iid,
        className: cx("fd-input", mono && "fd-mono"),
        disabled,
        "aria-invalid": error ? !0 : void 0,
        "aria-describedby": msg ? iid + "-m" : void 0,
        onKeyDown: onSubmit ? (e) => {
          e.key === "Enter" && onSubmit(e.currentTarget.value);
        } : void 0,
        ...rest
      }
    ), suffix && /* @__PURE__ */ React.createElement("span", { className: "fd-field-suffix" }, suffix), action && /* @__PURE__ */ React.createElement("span", { className: "fd-field-action" }, action)), msg && /* @__PURE__ */ React.createElement("div", { id: iid + "-m", className: "fd-help", "data-tone": error ? "error" : void 0 }, msg));
  }
  function Menu({ items = [], onSelect, activeIndex, className, style, role = "menu", ...rest }) {
    return rest.onContextMenu === void 0 && delete rest.onContextMenu, /* @__PURE__ */ React.createElement("div", { className: cx("fd-menu", className), role, style, ...rest }, items.map((it, i) => {
      if (it.separator) return /* @__PURE__ */ React.createElement("div", { key: i, className: "fd-menu-sep", role: "separator" });
      if (it.heading) return /* @__PURE__ */ React.createElement("div", { key: i, className: "fd-menu-head" }, it.heading);
      const isOpt = role === "listbox";
      return /* @__PURE__ */ React.createElement(
        "div",
        {
          key: i,
          className: "fd-menu-item",
          role: isOpt ? "option" : it.checked != null ? "menuitemcheckbox" : "menuitem",
          "aria-selected": isOpt ? !!it.checked : void 0,
          "aria-checked": !isOpt && it.checked != null ? !!it.checked : void 0,
          "aria-disabled": it.disabled || void 0,
          "data-active": i === activeIndex ? "" : void 0,
          "data-danger": it.danger ? "" : void 0,
          "data-intent": it.intent,
          tabIndex: -1,
          title: it.disabled && it.reason ? it.reason : void 0,
          onMouseDown: (e) => e.preventDefault(),
          onClick: () => !it.disabled && onSelect && onSelect(it, i)
        },
        /* @__PURE__ */ React.createElement("span", { className: "fd-menu-lead" }, it.checked ? /* @__PURE__ */ React.createElement(Icon, { name: "check" }) : it.icon ? /* @__PURE__ */ React.createElement(Icon, { name: it.icon }) : null),
        /* @__PURE__ */ React.createElement("span", { className: "fd-menu-label" }, it.label),
        it.hint && /* @__PURE__ */ React.createElement("span", { className: "fd-menu-hint" }, it.hint),
        it.kbd && /* @__PURE__ */ React.createElement("span", { className: "fd-menu-kbd" }, it.kbd)
      );
    }));
  }
  function Select({ options = [], value, defaultValue, onChange, placeholder = "Select\u2026", label, defaultOpen = !1, size = "md", icon, disabled, className, width }) {
    const [inner, setInner] = useState(defaultValue ?? value), cur = value !== void 0 ? value : inner, [open, setOpen] = useState(defaultOpen), [active, setActive] = useState(-1), ref = useRef(null), id = useId("fd-sel-"), flat = options.map((o) => o.heading || o.separator ? o : { ...o, checked: o.value === cur }), selectable = flat.map((o, i) => o.heading || o.separator || o.disabled ? -1 : i).filter((i) => i >= 0), selected = options.find((o) => o.value === cur);
    useEffect(() => {
      if (!open) return;
      const onDoc = (e) => {
        ref.current && !ref.current.contains(e.target) && setOpen(!1);
      };
      return document.addEventListener("mousedown", onDoc), () => document.removeEventListener("mousedown", onDoc);
    }, [open]);
    const choose = (o) => {
      value === void 0 && setInner(o.value), onChange && onChange(o.value), setOpen(!1);
    }, onKey = (e) => {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        if (e.preventDefault(), !open) {
          setOpen(!0);
          return;
        }
        const pos = selectable.indexOf(active), next = e.key === "ArrowDown" ? selectable[Math.min(selectable.length - 1, pos + 1)] : selectable[Math.max(0, pos - 1)];
        setActive(next ?? selectable[0]);
      } else e.key === "Enter" || e.key === " " ? (e.preventDefault(), open && active >= 0 ? choose(flat[active]) : setOpen((o) => !o)) : e.key === "Escape" && setOpen(!1);
    };
    return /* @__PURE__ */ React.createElement("div", { className: cx("fd-select", className), ref, style: width ? { width } : void 0 }, label && /* @__PURE__ */ React.createElement("label", { className: "fd-label", htmlFor: id }, label), /* @__PURE__ */ React.createElement(
      "button",
      {
        id,
        type: "button",
        className: "fd-field fd-select-trigger",
        "data-size": size,
        "data-open": open ? "" : void 0,
        "aria-haspopup": "listbox",
        "aria-expanded": open,
        disabled,
        onClick: () => setOpen((o) => !o),
        onKeyDown: onKey
      },
      icon && /* @__PURE__ */ React.createElement(Icon, { name: icon, className: "fd-field-icon" }),
      /* @__PURE__ */ React.createElement("span", { className: cx("fd-select-value", !selected && "fd-placeholder") }, selected ? selected.label : placeholder),
      /* @__PURE__ */ React.createElement(Icon, { name: "chevron-down", className: "fd-select-chev" })
    ), open && /* @__PURE__ */ React.createElement(Menu, { role: "listbox", className: "fd-select-pop", items: flat, activeIndex: active, onSelect: (o) => choose(o) }));
  }
  function Checkbox({ checked, defaultChecked = !1, indeterminate = !1, onChange, label, disabled, className }) {
    const [inner, setInner] = useState(defaultChecked), on = checked !== void 0 ? checked : inner, toggle = () => {
      disabled || (checked === void 0 && setInner(!on), onChange && onChange(!on));
    };
    return /* @__PURE__ */ React.createElement("label", { className: cx("fd-check", className), "data-disabled": disabled ? "" : void 0 }, /* @__PURE__ */ React.createElement(
      "button",
      {
        type: "button",
        role: "checkbox",
        "aria-checked": indeterminate ? "mixed" : on,
        className: "fd-check-box",
        "data-on": on || indeterminate ? "" : void 0,
        disabled,
        onClick: toggle
      },
      indeterminate ? /* @__PURE__ */ React.createElement(Icon, { name: "minus" }) : on ? /* @__PURE__ */ React.createElement(Icon, { name: "check" }) : null
    ), label && /* @__PURE__ */ React.createElement("span", { className: "fd-check-label", onClick: toggle }, label));
  }
  function Switch({ checked, defaultChecked = !1, onChange, label, disabled, className }) {
    const [inner, setInner] = useState(defaultChecked), on = checked !== void 0 ? checked : inner, toggle = () => {
      disabled || (checked === void 0 && setInner(!on), onChange && onChange(!on));
    };
    return /* @__PURE__ */ React.createElement("label", { className: cx("fd-switchwrap", className), "data-disabled": disabled ? "" : void 0 }, /* @__PURE__ */ React.createElement("button", { type: "button", role: "switch", "aria-checked": on, className: "fd-switch", "data-on": on ? "" : void 0, disabled, onClick: toggle }, /* @__PURE__ */ React.createElement("span", { className: "fd-switch-knob" })), label && /* @__PURE__ */ React.createElement("span", { className: "fd-check-label", onClick: toggle }, label));
  }
  function SegmentedControl({ options = [], value, defaultValue, onChange, size = "md", label, className }) {
    const [inner, setInner] = useState(defaultValue ?? (options[0] && options[0].value)), cur = value !== void 0 ? value : inner;
    return /* @__PURE__ */ React.createElement("div", { className: cx("fd-seg", className), role: "radiogroup", "aria-label": label, "data-size": size }, options.map((o) => /* @__PURE__ */ React.createElement(
      "button",
      {
        key: o.value,
        type: "button",
        role: "radio",
        "aria-checked": o.value === cur,
        className: "fd-seg-item",
        onClick: () => {
          value === void 0 && setInner(o.value), onChange && onChange(o.value);
        }
      },
      o.icon && /* @__PURE__ */ React.createElement(Icon, { name: o.icon }),
      o.label
    )));
  }
  function Tabs({ tabs = [], value, defaultValue, onChange, onClose, className }) {
    const [inner, setInner] = useState(defaultValue ?? (tabs[0] && tabs[0].id)), cur = value !== void 0 ? value : inner;
    return /* @__PURE__ */ React.createElement("div", { className: cx("fd-tabs", className), role: "tablist" }, tabs.map((t) => /* @__PURE__ */ React.createElement(
      "div",
      {
        key: t.id,
        role: "tab",
        tabIndex: t.id === cur ? 0 : -1,
        "aria-selected": t.id === cur,
        className: "fd-tab",
        onClick: () => {
          value === void 0 && setInner(t.id), onChange && onChange(t.id);
        }
      },
      t.icon && /* @__PURE__ */ React.createElement(Icon, { name: t.icon }),
      /* @__PURE__ */ React.createElement("span", null, t.label),
      t.errors ? /* @__PURE__ */ React.createElement("span", { className: "fd-tab-err", "aria-label": t.errors + " errors" }, t.errors) : null,
      t.dirty && /* @__PURE__ */ React.createElement("span", { className: "fd-tab-dot", "aria-label": "Unsaved changes" }),
      onClose && /* @__PURE__ */ React.createElement(
        "button",
        {
          type: "button",
          className: "fd-tab-x",
          "aria-label": "Close " + t.label,
          onClick: (e) => {
            e.stopPropagation(), onClose(t.id);
          }
        },
        /* @__PURE__ */ React.createElement(Icon, { name: "x", size: 12 })
      )
    )));
  }
  function Badge({ tone = "neutral", dot = !1, children, className }) {
    return /* @__PURE__ */ React.createElement("span", { className: cx("fd-badge", className), "data-tone": tone }, dot && /* @__PURE__ */ React.createElement("span", { className: "fd-badge-dot" }), children);
  }
  function Tooltip({ label, kbd, open, placement = "top", children }) {
    const [hover, setHover] = useState(!1), shown = open ?? hover, id = useId("fd-tip-");
    return /* @__PURE__ */ React.createElement(
      "span",
      {
        className: "fd-tipwrap",
        onMouseEnter: () => setHover(!0),
        onMouseLeave: () => setHover(!1),
        onFocus: () => setHover(!0),
        onBlur: () => setHover(!1),
        "aria-describedby": shown ? id : void 0
      },
      children,
      shown && /* @__PURE__ */ React.createElement("span", { role: "tooltip", id, className: "fd-tip", "data-placement": placement }, label, kbd && /* @__PURE__ */ React.createElement("span", { className: "fd-tip-kbd" }, kbd))
    );
  }
  function Progress({ value, label, detail, className }) {
    const indeterminate = value == null;
    return /* @__PURE__ */ React.createElement("div", { className: cx("fd-progress", className) }, (label || detail) && /* @__PURE__ */ React.createElement("div", { className: "fd-progress-top" }, /* @__PURE__ */ React.createElement("span", null, label), detail && /* @__PURE__ */ React.createElement("span", { className: "fd-progress-detail" }, detail)), /* @__PURE__ */ React.createElement("div", { className: "fd-progress-track", role: "progressbar", "aria-valuemin": 0, "aria-valuemax": 100, "aria-valuenow": indeterminate ? void 0 : value, "aria-label": label }, /* @__PURE__ */ React.createElement("div", { className: "fd-progress-bar", "data-indeterminate": indeterminate ? "" : void 0, style: indeterminate ? void 0 : { width: Math.max(0, Math.min(100, value)) + "%" } })));
  }
  const TONE_ICON = { info: "info", success: "check-circle", warning: "alert", error: "alert" };
  function Toast({ tone = "info", title, children, action, onAction, onClose, className }) {
    return /* @__PURE__ */ React.createElement("div", { className: cx("fd-toast", className), "data-tone": tone, role: tone === "error" ? "alert" : "status" }, /* @__PURE__ */ React.createElement(Icon, { name: TONE_ICON[tone], className: "fd-toast-icon" }), /* @__PURE__ */ React.createElement("div", { className: "fd-toast-body" }, title && /* @__PURE__ */ React.createElement("div", { className: "fd-toast-title" }, title), children && /* @__PURE__ */ React.createElement("div", { className: "fd-toast-text" }, children), action && /* @__PURE__ */ React.createElement("button", { type: "button", className: "fd-toast-action", onClick: onAction }, action)), onClose !== void 0 && /* @__PURE__ */ React.createElement(IconButton, { icon: "x", label: "Dismiss", size: "sm", onClick: onClose || void 0 }));
  }
  function Dialog({ title, icon, iconTone, description, children, footer, open = !0, inline = !1, onClose, width = 420, className }) {
    if (useEffect(() => {
      if (!open || inline || !onClose) return;
      const k = (e) => {
        e.key === "Escape" && onClose();
      };
      return document.addEventListener("keydown", k), () => document.removeEventListener("keydown", k);
    }, [open, inline, onClose]), !open) return null;
    const panel = /* @__PURE__ */ React.createElement("div", { className: cx("fd-dialog", className), role: "dialog", "aria-modal": inline ? void 0 : !0, "aria-label": title, style: { maxWidth: width } }, /* @__PURE__ */ React.createElement("div", { className: "fd-dialog-head" }, icon && /* @__PURE__ */ React.createElement("span", { className: "fd-dialog-icon", "data-tone": iconTone }, /* @__PURE__ */ React.createElement(Icon, { name: icon })), /* @__PURE__ */ React.createElement("div", { className: "fd-dialog-title" }, title), onClose !== void 0 && /* @__PURE__ */ React.createElement(IconButton, { icon: "x", label: "Close", size: "sm", onClick: onClose || void 0 })), description && /* @__PURE__ */ React.createElement("div", { className: "fd-dialog-desc" }, description), children && /* @__PURE__ */ React.createElement("div", { className: "fd-dialog-body" }, children), footer && /* @__PURE__ */ React.createElement("div", { className: "fd-dialog-foot" }, footer));
    return inline ? panel : /* @__PURE__ */ React.createElement("div", { className: "fd-scrim", onMouseDown: (e) => {
      e.target === e.currentTarget && onClose && onClose();
    } }, panel);
  }
  function FileTree({ items = [], value, defaultValue, onSelect, visibility = !1, creating = !1, onCreate, onCancelCreate, contextItems, className }) {
    const [inner, setInner] = useState(defaultValue), [hidden, setHidden] = useState(() => items.filter((i) => i.hidden).map((i) => i.id)), [ctx, setCtx] = useState(null), [adding, setAdding] = useState(creating), cur = value !== void 0 ? value : inner;
    return useEffect(() => {
      if (!ctx) return;
      const d = () => setCtx(null);
      return document.addEventListener("mousedown", d), () => document.removeEventListener("mousedown", d);
    }, [ctx]), /* @__PURE__ */ React.createElement("div", { className: cx("fd-tree", className), role: "tree", style: { position: "relative" } }, items.map((it) => {
      const folder = it.kind === "folder", off = hidden.includes(it.id);
      return /* @__PURE__ */ React.createElement(
        "div",
        {
          key: it.id || it.name,
          role: "treeitem",
          "aria-selected": it.id === cur || void 0,
          "aria-expanded": folder ? !!it.open : void 0,
          className: "fd-tree-item",
          "data-off": off ? "" : void 0,
          style: { paddingLeft: "calc(" + (it.depth || 0) + " * var(--fd-tree-indent) + var(--fd-tree-pad))" },
          onClick: () => {
            value === void 0 && setInner(it.id), onSelect && onSelect(it.id);
          },
          onContextMenu: contextItems ? (e) => {
            e.preventDefault();
            const r = e.currentTarget.parentElement.getBoundingClientRect();
            setCtx({ x: e.clientX - r.left, y: e.clientY - r.top });
          } : void 0
        },
        /* @__PURE__ */ React.createElement("span", { className: "fd-tree-twist" }, folder ? /* @__PURE__ */ React.createElement(Icon, { name: it.open ? "chevron-down" : "chevron-right", size: 12 }) : null),
        /* @__PURE__ */ React.createElement(Icon, { name: folder ? "folder" : it.icon || "file", className: "fd-tree-icon" }),
        /* @__PURE__ */ React.createElement("span", { className: "fd-tree-name" }, it.name),
        it.badge && /* @__PURE__ */ React.createElement("span", { className: "fd-tree-badge" }, it.badge),
        it.dirty && /* @__PURE__ */ React.createElement("span", { className: "fd-tab-dot", "aria-label": "Unsaved changes" }),
        visibility && !folder && /* @__PURE__ */ React.createElement(
          "button",
          {
            type: "button",
            className: "fd-tree-act",
            "aria-label": (off ? "Show " : "Hide ") + it.name,
            "aria-pressed": !off,
            onClick: (e) => {
              e.stopPropagation(), setHidden(off ? hidden.filter((x) => x !== it.id) : hidden.concat(it.id));
            }
          },
          /* @__PURE__ */ React.createElement(Icon, { name: off ? "eye-off" : "eye", size: 14 })
        )
      );
    }), adding && /* @__PURE__ */ React.createElement("div", { className: "fd-tree-item fd-tree-new", style: { paddingLeft: "calc(1 * var(--fd-tree-indent) + var(--fd-tree-pad))" } }, /* @__PURE__ */ React.createElement("span", { className: "fd-tree-twist" }), /* @__PURE__ */ React.createElement(Icon, { name: "file", className: "fd-tree-icon" }), /* @__PURE__ */ React.createElement(
      "input",
      {
        className: "fd-tree-input",
        autoFocus: !creating,
        defaultValue: typeof creating == "string" ? creating : "",
        placeholder: "new-file.js",
        onKeyDown: (e) => {
          e.key === "Enter" && (onCreate && onCreate(e.currentTarget.value), setAdding(!1)), e.key === "Escape" && (setAdding(!1), onCancelCreate && onCancelCreate());
        }
      }
    )), ctx && /* @__PURE__ */ React.createElement(Menu, { className: "fd-ctx-menu", style: { left: ctx.x, top: ctx.y }, items: contextItems, onMouseDown: (e) => e.stopPropagation(), onSelect: () => setCtx(null) }));
  }
  const Tree = FileTree;
  function Heading({ level = 2, children, className }) {
    const T = "h" + Math.min(4, Math.max(1, level));
    return /* @__PURE__ */ React.createElement(T, { className: cx("fd-heading", className), "data-level": level }, children);
  }
  function Text({ muted, small, mono, as = "p", children, className }) {
    return /* @__PURE__ */ React.createElement(as, { className: cx("fd-text", className), "data-muted": muted ? "" : void 0, "data-small": small ? "" : void 0, "data-mono": mono ? "" : void 0 }, children);
  }
  function Code({ children }) {
    return /* @__PURE__ */ React.createElement("code", { className: "fd-code" }, children);
  }
  function Link({ href = "#", external, children, onClick }) {
    return /* @__PURE__ */ React.createElement("a", { className: "fd-link", href, onClick, target: external ? "_blank" : void 0, rel: external ? "noreferrer" : void 0 }, children, external && /* @__PURE__ */ React.createElement(Icon, { name: "external", size: 12 }));
  }
  function Divider({ vertical, label }) {
    return label ? /* @__PURE__ */ React.createElement("div", { className: "fd-divider-l", role: "separator" }, /* @__PURE__ */ React.createElement("span", null, label)) : /* @__PURE__ */ React.createElement("div", { className: "fd-divider", role: "separator", "aria-orientation": vertical ? "vertical" : "horizontal", "data-vertical": vertical ? "" : void 0 });
  }
  function ScrollArea({ height = 200, children, className }) {
    return /* @__PURE__ */ React.createElement("div", { className: cx("fd-scroll", className), style: { maxHeight: height }, tabIndex: 0 }, children);
  }
  function Spinner({ value, size = "sm", label }) {
    const px = size === "md" ? 24 : 14, sw = size === "md" ? 2.5 : 2, r = (px - sw) / 2, c = 2 * Math.PI * r, det = value != null;
    return /* @__PURE__ */ React.createElement(
      "svg",
      {
        className: "fd-ring",
        "data-indeterminate": det ? void 0 : "",
        width: px,
        height: px,
        viewBox: `0 0 ${px} ${px}`,
        role: "progressbar",
        "aria-label": label,
        "aria-valuemin": det ? 0 : void 0,
        "aria-valuemax": det ? 100 : void 0,
        "aria-valuenow": det ? Math.round(value * 100) : void 0
      },
      /* @__PURE__ */ React.createElement("circle", { cx: px / 2, cy: px / 2, r, fill: "none", strokeWidth: sw, className: "fd-ring-track" }),
      /* @__PURE__ */ React.createElement(
        "circle",
        {
          cx: px / 2,
          cy: px / 2,
          r,
          fill: "none",
          strokeWidth: sw,
          className: "fd-ring-bar",
          strokeLinecap: "round",
          strokeDasharray: c,
          strokeDashoffset: det ? c * (1 - Math.max(0, Math.min(1, value))) : c * 0.7,
          transform: `rotate(-90 ${px / 2} ${px / 2})`
        }
      )
    );
  }
  function LoadingBlock({ label = "Loading\u2026", height = 160 }) {
    return /* @__PURE__ */ React.createElement("div", { className: "fd-loading", style: { minHeight: height } }, /* @__PURE__ */ React.createElement(Spinner, { size: "md", label }), /* @__PURE__ */ React.createElement("span", null, label));
  }
  const RUN_LABEL = { run: "Run", stop: "Stop", busy: "Starting", downloading: "Downloading" };
  function RunButton({ state = "run", progress = 0, version, kbd = "\u2318R", onClick }) {
    const pct = Math.round(progress * 100), label = state === "downloading" ? "Downloading " + pct + "%" : RUN_LABEL[state];
    return /* @__PURE__ */ React.createElement("span", { className: "fd-run", "data-state": state }, /* @__PURE__ */ React.createElement(
      "button",
      {
        type: "button",
        className: "fd-btn fd-run-btn",
        "data-variant": state === "stop" ? "secondary" : "primary",
        "aria-pressed": state === "stop",
        "aria-busy": state === "busy" || state === "downloading" || void 0,
        disabled: state === "busy",
        onClick
      },
      state === "run" ? /* @__PURE__ */ React.createElement(Icon, { name: "play" }) : state === "stop" ? /* @__PURE__ */ React.createElement(Icon, { name: "stop" }) : state === "busy" ? /* @__PURE__ */ React.createElement(Spinner, { label: "Starting" }) : /* @__PURE__ */ React.createElement(Spinner, { value: progress, label: "Downloading" }),
      /* @__PURE__ */ React.createElement("span", { className: "fd-btn-label" }, label),
      state !== "downloading" && state !== "busy" && kbd && /* @__PURE__ */ React.createElement("span", { className: "fd-btn-kbd" }, kbd)
    ), /* @__PURE__ */ React.createElement("span", { className: "fd-sr", "aria-live": "polite" }, state === "run" ? "Ready to run" : state === "stop" ? "Running" + (version ? " Electron " + version : "") : label));
  }
  function Popover({ content, open, defaultOpen = !1, placement = "bottom", children, width }) {
    const [inner, setInner] = useState(defaultOpen), shown = open ?? inner, ref = useRef(null);
    return useEffect(() => {
      if (!shown || open !== void 0) return;
      const d = (e) => {
        ref.current && !ref.current.contains(e.target) && setInner(!1);
      };
      return document.addEventListener("mousedown", d), () => document.removeEventListener("mousedown", d);
    }, [shown, open]), /* @__PURE__ */ React.createElement("span", { className: "fd-popwrap", ref, onClick: () => open === void 0 && setInner(!inner) }, children, shown && /* @__PURE__ */ React.createElement("span", { className: "fd-popover", "data-placement": placement, style: width ? { width } : void 0, onClick: (e) => e.stopPropagation() }, /* @__PURE__ */ React.createElement("span", { className: "fd-popover-arrow" }), content));
  }
  function SplitButton({ label, icon, variant = "primary", kbd, onClick, startLabel, startItems, endItems, onSelect }) {
    const [open, setOpen] = useState(null), ref = useRef(null);
    return useEffect(() => {
      if (!open) return;
      const d = (e) => {
        ref.current && !ref.current.contains(e.target) && setOpen(null);
      };
      return document.addEventListener("mousedown", d), () => document.removeEventListener("mousedown", d);
    }, [open]), /* @__PURE__ */ React.createElement("span", { className: "fd-split", ref, "data-variant": variant }, startItems && /* @__PURE__ */ React.createElement(
      "button",
      {
        type: "button",
        className: "fd-btn fd-split-start",
        "data-variant": "secondary",
        "aria-haspopup": "menu",
        "aria-expanded": open === "start",
        onClick: () => setOpen(open === "start" ? null : "start")
      },
      /* @__PURE__ */ React.createElement("span", { className: "fd-btn-label" }, startLabel),
      /* @__PURE__ */ React.createElement(Icon, { name: "chevron-down" })
    ), /* @__PURE__ */ React.createElement("button", { type: "button", className: "fd-btn fd-split-main", "data-variant": variant, onClick }, icon && /* @__PURE__ */ React.createElement(Icon, { name: icon }), /* @__PURE__ */ React.createElement("span", { className: "fd-btn-label" }, label), kbd && /* @__PURE__ */ React.createElement("span", { className: "fd-btn-kbd" }, kbd)), endItems && /* @__PURE__ */ React.createElement(
      "button",
      {
        type: "button",
        className: "fd-btn fd-split-end",
        "data-variant": variant,
        "aria-label": "More options",
        "aria-haspopup": "menu",
        "aria-expanded": open === "end",
        onClick: () => setOpen(open === "end" ? null : "end")
      },
      /* @__PURE__ */ React.createElement(Icon, { name: "chevron-down" })
    ), open && /* @__PURE__ */ React.createElement(Menu, { className: "fd-split-pop", "data-side": open, items: open === "start" ? startItems : endItems, onSelect: (it) => {
      setOpen(null), onSelect && onSelect(it);
    } }));
  }
  function ControlGroup({ children, fill }) {
    return /* @__PURE__ */ React.createElement("div", { className: "fd-cgroup", role: "group", "data-fill": fill ? "" : void 0 }, children);
  }
  function Fieldset({ legend, pending, children }) {
    return /* @__PURE__ */ React.createElement("fieldset", { className: "fd-fieldset", disabled: pending, "aria-busy": pending || void 0 }, legend && /* @__PURE__ */ React.createElement("legend", { className: "fd-legend" }, legend, pending && /* @__PURE__ */ React.createElement(Spinner, { label: "Saving" })), /* @__PURE__ */ React.createElement("div", { className: "fd-fieldset-body" }, children));
  }
  function FormField({ label, helper, disabled, inline, children }) {
    return /* @__PURE__ */ React.createElement("div", { className: "fd-formfield", "data-disabled": disabled ? "" : void 0, "data-inline": inline ? "" : void 0 }, label && /* @__PURE__ */ React.createElement("div", { className: "fd-label" }, label), /* @__PURE__ */ React.createElement("div", { className: "fd-formfield-control" }, children), helper && /* @__PURE__ */ React.createElement("div", { className: "fd-help" }, helper));
  }
  function UrlInput({ defaultValue = "", placeholder = "Paste a gist URL", pattern = /^https:\/\/gist\.github\.com\/[\w-]+\/?[0-9a-f]*$/i, onSubmit, actionLabel = "Load" }) {
    const [v, setV] = useState(defaultValue), valid = v === "" ? null : pattern.test(v.trim());
    return /* @__PURE__ */ React.createElement("div", { className: "fd-url", "data-has": v ? "" : void 0 }, /* @__PURE__ */ React.createElement("div", { className: "fd-field", "data-invalid": valid === !1 ? "" : void 0 }, /* @__PURE__ */ React.createElement(Icon, { name: "link", className: "fd-field-icon" }), /* @__PURE__ */ React.createElement(
      "input",
      {
        className: "fd-input",
        value: v,
        placeholder,
        "aria-invalid": valid === !1 || void 0,
        onChange: (e) => setV(e.target.value),
        onKeyDown: (e) => {
          e.key === "Enter" && valid && onSubmit && onSubmit(v);
        }
      }
    ), valid === !0 && /* @__PURE__ */ React.createElement(Icon, { name: "check", className: "fd-url-ok" }), v && /* @__PURE__ */ React.createElement(Button, { size: "sm", variant: valid ? "primary" : "ghost", disabled: !valid, onClick: () => onSubmit && onSubmit(v) }, actionLabel)), valid === !1 && /* @__PURE__ */ React.createElement("div", { className: "fd-help", "data-tone": "error" }, "That isn't a gist URL."));
  }
  function InputList({ label, defaultValues = [""], placeholder, addLabel = "Add row", mono = !0 }) {
    const [rows, setRows] = useState(defaultValues.map((v, i) => ({ id: i, v })));
    return /* @__PURE__ */ React.createElement("div", { className: "fd-inlist" }, label && /* @__PURE__ */ React.createElement("div", { className: "fd-label" }, label), rows.map((r, i) => /* @__PURE__ */ React.createElement("div", { className: "fd-inlist-row", key: r.id }, /* @__PURE__ */ React.createElement("div", { className: "fd-field" }, /* @__PURE__ */ React.createElement("input", { className: cx("fd-input", mono && "fd-mono"), defaultValue: r.v, placeholder })), /* @__PURE__ */ React.createElement(IconButton, { icon: "x", size: "sm", label: "Remove row", disabled: rows.length === 1, onClick: () => setRows(rows.filter((x) => x.id !== r.id)) }))), /* @__PURE__ */ React.createElement(Button, { size: "sm", variant: "ghost", icon: "plus", onClick: () => setRows(rows.concat({ id: Date.now(), v: "" })) }, addLabel));
  }
  function RadioGroup({ label, options = [], value, defaultValue, onChange, inline = !1, disabled }) {
    const [inner, setInner] = useState(defaultValue ?? (options[0] && options[0].value)), cur = value !== void 0 ? value : inner;
    return /* @__PURE__ */ React.createElement("div", { className: "fd-radiogroup", role: "radiogroup", "aria-label": label, "data-inline": inline ? "" : void 0 }, label && /* @__PURE__ */ React.createElement("div", { className: "fd-label" }, label), /* @__PURE__ */ React.createElement("div", { className: "fd-radio-list" }, options.map((o) => /* @__PURE__ */ React.createElement("label", { key: o.value, className: "fd-check", "data-disabled": disabled || o.disabled ? "" : void 0 }, /* @__PURE__ */ React.createElement(
      "button",
      {
        type: "button",
        role: "radio",
        "aria-checked": o.value === cur,
        className: "fd-radio",
        disabled: disabled || o.disabled,
        onClick: () => {
          value === void 0 && setInner(o.value), onChange && onChange(o.value);
        }
      },
      /* @__PURE__ */ React.createElement("span", null)
    ), /* @__PURE__ */ React.createElement("span", { className: "fd-check-label" }, o.label)))));
  }
  function FilePicker({ label, value, placeholder = "No folder chosen", directory = !0, buttonLabel = "Choose\u2026", helper }) {
    return /* @__PURE__ */ React.createElement(FormField, { label, helper }, /* @__PURE__ */ React.createElement("div", { className: "fd-picker" }, /* @__PURE__ */ React.createElement("div", { className: "fd-field fd-picker-value", "data-empty": value ? void 0 : "" }, /* @__PURE__ */ React.createElement(Icon, { name: directory ? "folder" : "file", className: "fd-field-icon" }), /* @__PURE__ */ React.createElement("span", { className: cx("fd-select-value", !value && "fd-placeholder", value && "fd-mono") }, value || placeholder)), /* @__PURE__ */ React.createElement(Button, null, buttonLabel)));
  }
  function CompactSelect({ options = [], defaultValue, onChange, label }) {
    return /* @__PURE__ */ React.createElement("span", { className: "fd-compact" }, /* @__PURE__ */ React.createElement("select", { defaultValue, "aria-label": label, onChange: (e) => onChange && onChange(e.target.value) }, options.map((o) => /* @__PURE__ */ React.createElement("option", { key: o, value: o }, o))), /* @__PURE__ */ React.createElement(Icon, { name: "chevron-down", size: 12 }));
  }
  function Highlight({ text, q }) {
    if (!q) return text;
    const i = text.toLowerCase().indexOf(q.toLowerCase());
    return i < 0 ? text : /* @__PURE__ */ React.createElement(React.Fragment, null, text.slice(0, i), /* @__PURE__ */ React.createElement("mark", { className: "fd-mark" }, text.slice(i, i + q.length)), text.slice(i + q.length));
  }
  function FilterableSelect({ items = [], value, defaultValue, onChange, placeholder = "Select\u2026", searchPlaceholder = "Filter", empty = "No matches", defaultOpen = !1, defaultQuery = "", height = 280, itemHeight, width = 260, renderTrigger, onItemContextMenu, label }) {
    const [inner, setInner] = useState(defaultValue), cur = value !== void 0 ? value : inner, [open, setOpen] = useState(defaultOpen), [q, setQ] = useState(defaultQuery), [scroll, setScroll] = useState(0), [active, setActive] = useState(-1), ref = useRef(null);
    useEffect(() => {
      if (!open) return;
      const d = (e) => {
        ref.current && !ref.current.contains(e.target) && setOpen(!1);
      };
      return document.addEventListener("mousedown", d), () => document.removeEventListener("mousedown", d);
    }, [open]);
    const rows = [];
    let pendingHead = null;
    items.forEach((it) => {
      if (it.heading) {
        pendingHead = it;
        return;
      }
      q && (it.label + " " + (it.hint || "")).toLowerCase().indexOf(q.toLowerCase()) < 0 || (pendingHead && (rows.push(pendingHead), pendingHead = null), rows.push(it));
    });
    const [ihv, setIhv] = useState(28);
    useEffect(() => {
      if (open && ref.current) {
        const v = parseFloat(getComputedStyle(ref.current).getPropertyValue("--fd-item-h"));
        v && setIhv(v + 2);
      }
    }, [open]);
    const ih = itemHeight || ihv, start = Math.max(0, Math.floor(scroll / ih) - 4), end = Math.min(rows.length, start + Math.ceil(height / ih) + 8), selected = items.find((i) => i.value === cur), pick = (it) => {
      it.disabled || it.heading || (value === void 0 && setInner(it.value), onChange && onChange(it.value), setOpen(!1), setQ(""));
    }, onKey = (e) => {
      const sel = rows.map((r, i) => r.heading || r.disabled ? -1 : i).filter((i) => i >= 0);
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const p = sel.indexOf(active);
        setActive(e.key === "ArrowDown" ? sel[Math.min(sel.length - 1, p + 1)] : sel[Math.max(0, p - 1)]);
      } else e.key === "Enter" && active >= 0 ? pick(rows[active]) : e.key === "Escape" && setOpen(!1);
    };
    return /* @__PURE__ */ React.createElement("div", { className: "fd-fselect", ref, style: { width } }, label && /* @__PURE__ */ React.createElement("div", { className: "fd-label" }, label), /* @__PURE__ */ React.createElement("button", { type: "button", className: "fd-field fd-select-trigger", "aria-haspopup": "listbox", "aria-expanded": open, "data-open": open ? "" : void 0, onClick: () => setOpen(!open) }, renderTrigger ? renderTrigger(selected) : /* @__PURE__ */ React.createElement(React.Fragment, null, selected && selected.icon && /* @__PURE__ */ React.createElement(Icon, { name: selected.icon, className: "fd-field-icon" }), /* @__PURE__ */ React.createElement("span", { className: cx("fd-select-value", !selected && "fd-placeholder") }, selected ? selected.label : placeholder)), /* @__PURE__ */ React.createElement(Icon, { name: "chevron-down", className: "fd-select-chev" })), open && /* @__PURE__ */ React.createElement("div", { className: "fd-menu fd-fselect-pop", onKeyDown: onKey }, /* @__PURE__ */ React.createElement("div", { className: "fd-fselect-search" }, /* @__PURE__ */ React.createElement("div", { className: "fd-field", "data-size": "sm" }, /* @__PURE__ */ React.createElement(Icon, { name: "search", className: "fd-field-icon" }), /* @__PURE__ */ React.createElement("input", { className: "fd-input", autoFocus: !defaultOpen, value: q, placeholder: searchPlaceholder, onChange: (e) => {
      setQ(e.target.value), setActive(-1);
    } }))), /* @__PURE__ */ React.createElement("div", { className: "fd-fselect-list", style: { maxHeight: height }, onScroll: (e) => setScroll(e.currentTarget.scrollTop), role: "listbox" }, rows.length === 0 && /* @__PURE__ */ React.createElement("div", { className: "fd-fselect-empty" }, empty), /* @__PURE__ */ React.createElement("div", { style: { height: rows.length * ih, position: "relative" } }, rows.slice(start, end).map((it, k) => {
      const i = start + k, style = { position: "absolute", top: i * ih, left: 0, right: 0, height: ih };
      return it.heading ? /* @__PURE__ */ React.createElement("div", { key: "h" + i, className: "fd-menu-head", style }, it.heading) : /* @__PURE__ */ React.createElement(
        "div",
        {
          key: it.value,
          style,
          className: "fd-menu-item",
          role: "option",
          "aria-selected": it.value === cur,
          "aria-disabled": it.disabled || void 0,
          "data-active": i === active ? "" : void 0,
          title: it.disabled ? it.reason : void 0,
          onMouseDown: (e) => e.preventDefault(),
          onClick: () => pick(it),
          onContextMenu: onItemContextMenu ? (e) => {
            e.preventDefault(), onItemContextMenu(it, e);
          } : void 0
        },
        /* @__PURE__ */ React.createElement("span", { className: "fd-menu-lead" }, it.iconNode || (it.icon ? /* @__PURE__ */ React.createElement(Icon, { name: it.icon }) : null)),
        /* @__PURE__ */ React.createElement("span", { className: "fd-menu-label" }, /* @__PURE__ */ React.createElement(Highlight, { text: it.label, q })),
        it.hint && /* @__PURE__ */ React.createElement("span", { className: "fd-menu-hint" }, it.hint)
      );
    })))));
  }
  function Suggest({ source = [], placeholder = "Search npm", emptyPrompt = "Type to search npm packages", onPick, defaultQuery = "", delay = 180, icon = "search" }) {
    const [q, setQ] = useState(defaultQuery), [res, setRes] = useState(null), [focus, setFocus] = useState(!!defaultQuery), [active, setActive] = useState(0);
    useEffect(() => {
      if (!q) {
        setRes(null);
        return;
      }
      const t = setTimeout(() => setRes(source.filter((s) => s.name.toLowerCase().indexOf(q.toLowerCase()) >= 0).slice(0, 6)), delay);
      return () => clearTimeout(t);
    }, [q]);
    const pick = (s) => {
      onPick && onPick(s), setQ(""), setRes(null);
    };
    return /* @__PURE__ */ React.createElement("div", { className: "fd-suggest" }, /* @__PURE__ */ React.createElement("div", { className: "fd-field" }, /* @__PURE__ */ React.createElement(Icon, { name: icon, className: "fd-field-icon" }), /* @__PURE__ */ React.createElement(
      "input",
      {
        className: "fd-input",
        value: q,
        placeholder,
        onFocus: () => setFocus(!0),
        onBlur: () => setTimeout(() => setFocus(!1), 120),
        onChange: (e) => {
          setQ(e.target.value), setActive(0);
        },
        onKeyDown: (e) => {
          res && (e.key === "ArrowDown" && setActive(Math.min(res.length - 1, active + 1)), e.key === "ArrowUp" && setActive(Math.max(0, active - 1)), e.key === "Enter" && res[active] && pick(res[active]));
        }
      }
    ), q && res === null && /* @__PURE__ */ React.createElement(Spinner, { label: "Searching" })), focus && /* @__PURE__ */ React.createElement("div", { className: "fd-menu fd-suggest-pop" }, !q && /* @__PURE__ */ React.createElement("div", { className: "fd-fselect-empty" }, emptyPrompt), q && res && res.length === 0 && /* @__PURE__ */ React.createElement("div", { className: "fd-fselect-empty" }, 'No packages match "', q, '"'), res && res.map((s, i) => /* @__PURE__ */ React.createElement("div", { key: s.name, className: "fd-menu-item fd-suggest-item", "data-active": i === active ? "" : void 0, onMouseDown: (e) => e.preventDefault(), onClick: () => pick(s) }, /* @__PURE__ */ React.createElement("span", { className: "fd-menu-lead" }, /* @__PURE__ */ React.createElement(Icon, { name: "package" })), /* @__PURE__ */ React.createElement("span", { className: "fd-menu-label" }, /* @__PURE__ */ React.createElement("span", { className: "fd-suggest-name" }, /* @__PURE__ */ React.createElement(Highlight, { text: s.name, q })), /* @__PURE__ */ React.createElement("span", { className: "fd-suggest-desc" }, s.description)), /* @__PURE__ */ React.createElement("span", { className: "fd-menu-hint" }, s.version)))));
  }
  function ContextMenu({ items = [], children, open, x = 0, y = 0, onSelect }) {
    const [pos, setPos] = useState(null), shown = open ? { x, y } : pos;
    return useEffect(() => {
      if (!pos) return;
      const d = () => setPos(null);
      return document.addEventListener("mousedown", d), () => document.removeEventListener("mousedown", d);
    }, [pos]), /* @__PURE__ */ React.createElement("div", { className: "fd-ctx", onContextMenu: (e) => {
      e.preventDefault();
      const r = e.currentTarget.getBoundingClientRect();
      setPos({ x: e.clientX - r.left, y: e.clientY - r.top });
    } }, children, shown && /* @__PURE__ */ React.createElement(Menu, { className: "fd-ctx-menu", style: { left: shown.x, top: shown.y }, items, onMouseDown: (e) => e.stopPropagation(), onSelect: (it) => {
      setPos(null), onSelect && onSelect(it);
    } }));
  }
  const ALERT = { warning: ["alert", "warning"], confirm: ["info", "accent"], success: ["check-circle", "success"], danger: ["alert", "spark"] };
  function AlertDialog({ intent = "confirm", title, children, confirmLabel = "OK", cancelLabel = "Cancel", input, inputPlaceholder, inline = !0, onConfirm, onCancel }) {
    const [v, setV] = useState(input || ""), [icon, tone] = ALERT[intent] || ALERT.confirm;
    return /* @__PURE__ */ React.createElement(
      Dialog,
      {
        inline,
        title,
        icon,
        iconTone: tone,
        width: 400,
        description: children,
        onClose: onCancel === void 0 ? void 0 : onCancel,
        footer: /* @__PURE__ */ React.createElement(React.Fragment, null, cancelLabel && /* @__PURE__ */ React.createElement(Button, { variant: "ghost", onClick: onCancel }, cancelLabel), /* @__PURE__ */ React.createElement(Button, { variant: intent === "danger" ? "danger" : "primary", onClick: () => onConfirm && onConfirm(v) }, confirmLabel))
      },
      input !== void 0 && /* @__PURE__ */ React.createElement("div", { className: "fd-field" }, /* @__PURE__ */ React.createElement("input", { className: "fd-input", value: v, placeholder: inputPlaceholder, onChange: (e) => setV(e.target.value), onKeyDown: (e) => {
        e.key === "Enter" && onConfirm && onConfirm(v);
      } }))
    );
  }
  function ToastStack({ toasts = [], inline = !0 }) {
    return /* @__PURE__ */ React.createElement("div", { className: "fd-toasts", "data-inline": inline ? "" : void 0 }, toasts.map((t, i) => /* @__PURE__ */ React.createElement(Toast, { key: i, ...t })));
  }
  function Coachmark({ target, title, children, step = 1, total = 3, onNext, onBack, onSkip, placement = "bottom" }) {
    const [rect, setRect] = useState(typeof target == "object" ? target : null), ref = useRef(null);
    if (useEffect(() => {
      if (typeof target != "string") {
        setRect(target);
        return;
      }
      const measure = () => {
        const host = ref.current && ref.current.parentElement, el = host && host.querySelector(target);
        if (!el) return;
        const a = el.getBoundingClientRect(), b = host.getBoundingClientRect();
        setRect({ x: a.left - b.left, y: a.top - b.top, w: a.width, h: a.height });
      };
      return measure(), window.addEventListener("resize", measure), () => window.removeEventListener("resize", measure);
    }, [target]), !rect) return /* @__PURE__ */ React.createElement("div", { ref });
    const pad = 6, card = placement === "bottom" ? { left: rect.x, top: rect.y + rect.h + pad + 12 } : { left: rect.x + rect.w + pad + 12, top: rect.y };
    return /* @__PURE__ */ React.createElement("div", { className: "fd-coach", ref }, /* @__PURE__ */ React.createElement("div", { className: "fd-coach-hole", style: { left: rect.x - pad, top: rect.y - pad, width: rect.w + pad * 2, height: rect.h + pad * 2 } }), /* @__PURE__ */ React.createElement("div", { className: "fd-coach-card", role: "dialog", "aria-label": title, style: card }, /* @__PURE__ */ React.createElement("div", { className: "fd-coach-step" }, step, " of ", total), /* @__PURE__ */ React.createElement("div", { className: "fd-coach-title" }, title), /* @__PURE__ */ React.createElement("div", { className: "fd-coach-body" }, children), /* @__PURE__ */ React.createElement("div", { className: "fd-coach-foot" }, /* @__PURE__ */ React.createElement(Button, { size: "sm", variant: "ghost", onClick: onSkip }, "Skip tour"), /* @__PURE__ */ React.createElement("span", { style: { flex: 1 } }), step > 1 && /* @__PURE__ */ React.createElement(Button, { size: "sm", onClick: onBack }, "Back"), /* @__PURE__ */ React.createElement(Button, { size: "sm", variant: "primary", onClick: onNext }, step === total ? "Done" : "Next"))));
  }
  function Callout({ intent = "neutral", title, icon, children, action }) {
    return /* @__PURE__ */ React.createElement("div", { className: "fd-callout", "data-intent": intent, role: intent === "danger" ? "alert" : "note" }, /* @__PURE__ */ React.createElement(Icon, { name: icon || (intent === "danger" ? "alert" : intent === "success" ? "check-circle" : "info"), className: "fd-callout-icon" }), /* @__PURE__ */ React.createElement("div", { className: "fd-callout-body" }, title && /* @__PURE__ */ React.createElement("div", { className: "fd-callout-title" }, title), children && /* @__PURE__ */ React.createElement("div", null, children), action && /* @__PURE__ */ React.createElement("div", { className: "fd-callout-action" }, action)));
  }
  function EmptyState({ icon = "code", title, children, action, compact }) {
    return /* @__PURE__ */ React.createElement("div", { className: "fd-empty", "data-compact": compact ? "" : void 0 }, /* @__PURE__ */ React.createElement("span", { className: "fd-empty-icon" }, /* @__PURE__ */ React.createElement(Icon, { name: icon, size: 20 })), /* @__PURE__ */ React.createElement("div", { className: "fd-empty-title" }, title), children && /* @__PURE__ */ React.createElement("div", { className: "fd-empty-text" }, children), action && /* @__PURE__ */ React.createElement("div", { className: "fd-empty-action" }, action));
  }
  const TAG_TONE = { neutral: "neutral", primary: "accent", success: "success", danger: "spark", warning: "warning" };
  function Tag({ tone = "neutral", children, onRemove }) {
    return /* @__PURE__ */ React.createElement("span", { className: "fd-badge fd-tag", "data-tone": TAG_TONE[tone] || tone }, children, onRemove && /* @__PURE__ */ React.createElement("button", { type: "button", className: "fd-tag-x", "aria-label": "Remove", onClick: onRemove }, /* @__PURE__ */ React.createElement(Icon, { name: "x", size: 10 })));
  }
  function StatusCell({ status = "idle", progress, children }) {
    return /* @__PURE__ */ React.createElement("span", { className: "fd-status", "data-status": status }, status === "ok" ? /* @__PURE__ */ React.createElement(Icon, { name: "check-circle" }) : status === "error" ? /* @__PURE__ */ React.createElement(Icon, { name: "x-circle" }) : status === "busy" ? /* @__PURE__ */ React.createElement(Spinner, { value: progress }) : status === "remote" ? /* @__PURE__ */ React.createElement(Icon, { name: "cloud" }) : /* @__PURE__ */ React.createElement(Icon, { name: "circle" }), /* @__PURE__ */ React.createElement("span", null, children));
  }
  function ListRow({ icon, title, meta, tags = [], active, onClick }) {
    return /* @__PURE__ */ React.createElement("div", { className: "fd-listrow", role: "option", "aria-selected": !!active, tabIndex: 0, onClick }, icon && /* @__PURE__ */ React.createElement("span", { className: "fd-listrow-icon" }, /* @__PURE__ */ React.createElement(Icon, { name: icon })), /* @__PURE__ */ React.createElement("span", { className: "fd-listrow-main" }, /* @__PURE__ */ React.createElement("span", { className: "fd-listrow-title" }, title), meta && /* @__PURE__ */ React.createElement("span", { className: "fd-listrow-meta" }, meta)), tags.map((t, i) => /* @__PURE__ */ React.createElement(Tag, { key: i, tone: t.tone }, t.label)));
  }
  function Card({ avatar, icon, title, secondary, onClick, children }) {
    const initials = avatar ? avatar.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase() : null;
    return /* @__PURE__ */ React.createElement("button", { type: "button", className: "fd-card", onClick }, /* @__PURE__ */ React.createElement("span", { className: "fd-card-avatar" }, initials || /* @__PURE__ */ React.createElement(Icon, { name: icon || "file" })), /* @__PURE__ */ React.createElement("span", { className: "fd-card-main" }, /* @__PURE__ */ React.createElement("span", { className: "fd-card-title" }, title), secondary && /* @__PURE__ */ React.createElement("span", { className: "fd-card-sub" }, secondary)), children);
  }
  function SideNav({ items = [], value, defaultValue, onChange, label }) {
    const [inner, setInner] = useState(defaultValue ?? (items[0] && items[0].id)), cur = value !== void 0 ? value : inner;
    return /* @__PURE__ */ React.createElement("nav", { className: "fd-sidenav", "aria-label": label }, items.map((it) => it.heading ? /* @__PURE__ */ React.createElement("div", { key: it.heading, className: "fd-menu-head fd-sidenav-head" }, it.heading) : /* @__PURE__ */ React.createElement(
      "button",
      {
        key: it.id,
        type: "button",
        className: "fd-sidenav-item",
        "aria-current": it.id === cur ? "page" : void 0,
        onClick: () => {
          value === void 0 && setInner(it.id), onChange && onChange(it.id);
        }
      },
      it.icon && /* @__PURE__ */ React.createElement(Icon, { name: it.icon }),
      /* @__PURE__ */ React.createElement("span", null, it.label),
      it.badge && /* @__PURE__ */ React.createElement("span", { className: "fd-menu-hint" }, it.badge)
    )));
  }
  function Page({ title, nav = [], value, defaultValue, onChange, onClose, inline = !1, height = 480, children }) {
    const ref = useRef(null);
    return useEffect(() => {
      if (inline) return;
      const k = (e) => {
        if (e.key === "Escape" && onClose && onClose(), e.key === "Tab" && ref.current) {
          const f = ref.current.querySelectorAll('button, input, select, [tabindex="0"]');
          if (!f.length) return;
          const first = f[0], last = f[f.length - 1];
          e.shiftKey && document.activeElement === first ? (e.preventDefault(), last.focus()) : !e.shiftKey && document.activeElement === last && (e.preventDefault(), first.focus());
        }
      };
      return document.addEventListener("keydown", k), () => document.removeEventListener("keydown", k);
    }, [inline, onClose]), /* @__PURE__ */ React.createElement("div", { className: "fd-page", ref, "data-inline": inline ? "" : void 0, role: "dialog", "aria-modal": inline ? void 0 : !0, "aria-label": title, style: inline ? { height } : void 0 }, /* @__PURE__ */ React.createElement("aside", { className: "fd-page-nav" }, /* @__PURE__ */ React.createElement("div", { className: "fd-page-title" }, title), /* @__PURE__ */ React.createElement(SideNav, { items: nav, value, defaultValue, onChange, label: title })), /* @__PURE__ */ React.createElement("div", { className: "fd-page-body" }, onClose !== void 0 && /* @__PURE__ */ React.createElement("div", { className: "fd-page-close" }, /* @__PURE__ */ React.createElement(IconButton, { icon: "x", label: "Close", onClick: onClose || void 0 }), /* @__PURE__ */ React.createElement(Kbd, null, "esc")), /* @__PURE__ */ React.createElement("div", { className: "fd-page-content" }, children)));
  }
  function TitleBar({ title, subtitle, start, center, end, trafficLights = !0, compact }) {
    return /* @__PURE__ */ React.createElement("div", { className: "fd-titlebar", "data-compact": compact ? "" : void 0 }, /* @__PURE__ */ React.createElement("div", { className: "fd-titlebar-start" }, trafficLights && /* @__PURE__ */ React.createElement("span", { className: "fd-lights", "aria-hidden": "true" }, /* @__PURE__ */ React.createElement("i", null), /* @__PURE__ */ React.createElement("i", null), /* @__PURE__ */ React.createElement("i", null)), start, title && /* @__PURE__ */ React.createElement("span", { className: "fd-titlebar-title" }, /* @__PURE__ */ React.createElement("b", null, title), subtitle && /* @__PURE__ */ React.createElement("span", null, subtitle))), /* @__PURE__ */ React.createElement("div", { className: "fd-titlebar-center" }, center), /* @__PURE__ */ React.createElement("div", { className: "fd-titlebar-end" }, end));
  }
  function SplitPane({ direction = "row", defaultSizes, minSize = 80, children, collapsed = [] }) {
    const kids = React.Children.toArray(children), [sizes, setSizes] = useState(defaultSizes || kids.map(() => 100 / kids.length)), ref = useRef(null), row = direction === "row", drag = (i) => (e) => {
      e.preventDefault();
      const box = ref.current.getBoundingClientRect(), total = row ? box.width : box.height, start = row ? e.clientX : e.clientY, s0 = sizes.slice(), move = (ev) => {
        const d = ((row ? ev.clientX : ev.clientY) - start) / total * 100, minP = minSize / total * 100, a = Math.max(minP, Math.min(s0[i] + s0[i + 1] - minP, s0[i] + d)), next = s0.slice();
        next[i] = a, next[i + 1] = s0[i] + s0[i + 1] - a, setSizes(next);
      }, up = () => {
        window.removeEventListener("pointermove", move), window.removeEventListener("pointerup", up);
      };
      window.addEventListener("pointermove", move), window.addEventListener("pointerup", up);
    };
    return /* @__PURE__ */ React.createElement("div", { className: "fd-splitpane", "data-direction": direction, ref }, kids.map((k, i) => /* @__PURE__ */ React.createElement(Fragment, { key: i }, /* @__PURE__ */ React.createElement("div", { className: "fd-splitpane-pane", "data-collapsed": collapsed.includes(i) ? "" : void 0, style: collapsed.includes(i) ? void 0 : { flexBasis: sizes[i] + "%" } }, k), i < kids.length - 1 && /* @__PURE__ */ React.createElement("div", { className: "fd-splitpane-divider", role: "separator", "aria-orientation": row ? "vertical" : "horizontal", tabIndex: 0, onPointerDown: drag(i), onDoubleClick: () => setSizes(kids.map(() => 100 / kids.length)) }))));
  }
  function Tile({ title, subtitle, severity, count, focused, actions = ["popout", "maximize", "close"], onAction, children, tabs }) {
    const LABEL = { popout: "Pop out into a window", maximize: "Maximize", minimize: "Restore", close: "Close", more: "More" };
    return /* @__PURE__ */ React.createElement("section", { className: "fd-tile", "data-focused": focused ? "" : void 0, "data-severity": severity }, /* @__PURE__ */ React.createElement("header", { className: "fd-tile-head" }, /* @__PURE__ */ React.createElement("span", { className: "fd-tile-grip", "aria-hidden": "true" }, /* @__PURE__ */ React.createElement(Icon, { name: "grip", size: 12 })), tabs || /* @__PURE__ */ React.createElement("span", { className: "fd-tile-title" }, severity && /* @__PURE__ */ React.createElement(Icon, { name: "alert", size: 12 }), title), severity && count ? /* @__PURE__ */ React.createElement("span", { className: "fd-tile-count" }, count, " ", severity, count > 1 ? "s" : "") : null, subtitle && /* @__PURE__ */ React.createElement("span", { className: "fd-tile-sub" }, subtitle), /* @__PURE__ */ React.createElement("span", { className: "fd-tile-actions" }, actions.map((a) => /* @__PURE__ */ React.createElement(IconButton, { key: a, icon: a === "close" ? "x" : a, size: "sm", label: LABEL[a] || a, onClick: () => onAction && onAction(a) })))), /* @__PURE__ */ React.createElement("div", { className: "fd-tile-body" }, children));
  }
  const JS_KW = /^(const|let|var|function|async|await|new|return|if|else|for|of|in|true|false|null|undefined|import|from|export|class|extends|this|typeof)$/;
  function tokenize(line, lang) {
    if (lang === "html") {
      const out2 = [], re2 = /(<\!--.*?-->)|(<\/?\!?[\w-]+)|(\s[\w-:]+)(=)|("[^"]*")|(\/?>)|([^<"]+)/g;
      let m2;
      for (; m2 = re2.exec(line); )
        m2[1] ? out2.push(["c", m2[1]]) : m2[2] ? out2.push(["k", m2[2]]) : m2[3] ? (out2.push(["f", m2[3]]), out2.push(["", m2[4]])) : m2[5] ? out2.push(["s", m2[5]]) : m2[6] ? out2.push(["k", m2[6]]) : out2.push(["", m2[7]]);
      return out2;
    }
    if (/^\s*\/\//.test(line)) return [["c", line]];
    const out = [], re = /('[^']*'|"[^"]*"|`[^`]*`)|(\b\d+(\.\d+)?\b)|([A-Za-z_$][\w$]*)(\s*\()?|(\s+)|(.)/g;
    let m;
    for (; m = re.exec(line); )
      m[1] ? out.push(["s", m[1]]) : m[2] ? out.push(["n", m[2]]) : m[4] ? (out.push([JS_KW.test(m[4]) ? "k" : m[5] ? "f" : "", m[4]]), m[5] && out.push(["", m[5]])) : out.push(["", m[6] || m[7]]);
    return out;
  }
  function CodeEditor({ value = "", language, file, diagnostics = [], cursorLine, fontSize, height, wrap = !1 }) {
    const lang = language || (file && /\.html?$/.test(file) ? "html" : file && /\.css$/.test(file) ? "css" : "js"), lines = value.split(`
`);
    return /* @__PURE__ */ React.createElement("div", { className: "fd-editor", style: { fontSize: fontSize || void 0, lineHeight: fontSize ? Math.round(fontSize * 1.54) + "px" : void 0, height }, "data-wrap": wrap ? "" : void 0 }, lines.map((l, i) => {
      const n = i + 1, d = diagnostics.find((x) => x.line === n);
      return /* @__PURE__ */ React.createElement(Fragment, { key: i }, /* @__PURE__ */ React.createElement("div", { className: "fd-editor-line", "data-cursor": n === cursorLine ? "" : void 0, "data-severity": d ? d.severity || "error" : void 0 }, /* @__PURE__ */ React.createElement("span", { className: "fd-editor-no" }, n), /* @__PURE__ */ React.createElement("span", { className: "fd-editor-text" }, l === "" ? " " : tokenize(l, lang).map((t, j) => {
        const mark = d && d.match && t[1].indexOf(d.match) >= 0;
        return /* @__PURE__ */ React.createElement("span", { key: j, className: cx(t[0] && "fd-tk-" + t[0], mark && "fd-squig") }, t[1]);
      }))), d && d.message && /* @__PURE__ */ React.createElement("div", { className: "fd-editor-lens", "data-severity": d.severity || "error" }, /* @__PURE__ */ React.createElement(Icon, { name: "alert", size: 14 }), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("b", null, d.title || (d.severity === "warning" ? "Warning" : "Error")), " ", d.message, d.hint && /* @__PURE__ */ React.createElement("div", { className: "fd-editor-hint" }, d.hint))));
    }));
  }
  function monacoTheme(el) {
    const cs = getComputedStyle(el || document.documentElement), v = (n) => cs.getPropertyValue("--" + n).trim().replace("#", "");
    return {
      base: /dark/.test((el || document.documentElement).closest("[data-theme]")?.getAttribute("data-theme") || "") ? "vs-dark" : "vs",
      inherit: !0,
      rules: [
        { token: "keyword", foreground: v("syntax-keyword") },
        { token: "string", foreground: v("syntax-string") },
        { token: "number", foreground: v("syntax-number") },
        { token: "comment", foreground: v("syntax-comment"), fontStyle: "italic" },
        { token: "identifier.function", foreground: v("syntax-function") }
      ],
      colors: {
        "editor.background": "#" + v("surface"),
        "editor.foreground": "#" + v("ink"),
        "editor.lineHighlightBackground": "#" + v("surface-hover"),
        "editorLineNumber.foreground": "#" + v("ink-faint"),
        "editorCursor.foreground": "#" + v("accent"),
        "editor.selectionBackground": "#" + v("accent-soft")
      }
    };
  }
  function EditorGrid({ files = [], height = 420, onAdd }) {
    if (!files.length) return /* @__PURE__ */ React.createElement("div", { className: "fd-egrid", style: { height } }, /* @__PURE__ */ React.createElement(EmptyState, { icon: "code", title: "No editors open", action: /* @__PURE__ */ React.createElement(Button, { icon: "plus", onClick: onAdd }, "Open a file") }, "Pick a file in the sidebar, or add a new one."));
    const n = files.length;
    return /* @__PURE__ */ React.createElement("div", { className: "fd-egrid", "data-layout": n === 1 ? "one" : n === 2 ? "two" : n === 3 ? "three" : "four", style: { height } }, files.slice(0, 4).map((f, i) => {
      const errs = (f.diagnostics || []).filter((d) => (d.severity || "error") === "error").length;
      return /* @__PURE__ */ React.createElement(Tile, { key: f.name, title: f.name, subtitle: f.process, severity: errs ? "error" : void 0, count: errs, focused: f.focused }, /* @__PURE__ */ React.createElement(CodeEditor, { file: f.name, value: f.code, diagnostics: f.diagnostics, cursorLine: f.cursorLine }));
    }));
  }
  function Console({ lines = [], height = 220, maxLines = 1e3, running, onClear, processes = ["All", "Main", "Renderer"] }) {
    const [filter, setFilter] = useState(""), [proc, setProc] = useState("All"), ref = useRef(null), shown = lines.slice(-maxLines).filter((l) => (proc === "All" || l.process === proc) && (!filter || l.text.toLowerCase().indexOf(filter.toLowerCase()) >= 0));
    return useEffect(() => {
      ref.current && (ref.current.scrollTop = ref.current.scrollHeight);
    }, [shown.length]), /* @__PURE__ */ React.createElement("div", { className: "fd-console", style: { height } }, /* @__PURE__ */ React.createElement("div", { className: "fd-console-bar" }, /* @__PURE__ */ React.createElement("span", { className: "fd-console-title" }, "Console"), /* @__PURE__ */ React.createElement(SegmentedControl, { options: processes.map((p) => ({ value: p, label: p })), value: proc, onChange: setProc, label: "Process" }), /* @__PURE__ */ React.createElement(Input, { size: "sm", icon: "search", placeholder: "Filter output", value: filter, onChange: (e) => setFilter(e.target.value), style: { width: 180 } }), /* @__PURE__ */ React.createElement("span", { style: { flex: 1 } }), running && /* @__PURE__ */ React.createElement(Badge, { tone: "spark", dot: !0 }, "Running"), /* @__PURE__ */ React.createElement(IconButton, { icon: "popout", size: "sm", label: "Pop out console" }), /* @__PURE__ */ React.createElement(IconButton, { icon: "trash", size: "sm", label: "Clear console", onClick: onClear })), /* @__PURE__ */ React.createElement("div", { className: "fd-console-log", ref, role: "log", "aria-live": "polite" }, shown.map((l, i) => /* @__PURE__ */ React.createElement("div", { key: i, className: "fd-console-line", "data-level": l.level }, /* @__PURE__ */ React.createElement("span", { className: "fd-console-time" }, l.time), /* @__PURE__ */ React.createElement("span", { className: "fd-console-proc" }, l.process), /* @__PURE__ */ React.createElement("span", { className: "fd-console-text" }, l.text, l.link && /* @__PURE__ */ React.createElement(React.Fragment, null, " (", /* @__PURE__ */ React.createElement("a", { className: "fd-link", href: "#" }, l.link), ")"))))));
  }
  const VICON = { installed: "check-circle", remote: "cloud", downloading: null };
  function VersionPicker({ versions = [], value, defaultValue, onChange, defaultOpen, defaultQuery, width = 260, min, max, label }) {
    const [ctx, setCtx] = useState(null), heads = {}, items = [];
    return versions.forEach((v) => {
      min && v.version < min || max && v.version > max || (heads[v.channel] || (heads[v.channel] = 1, items.push({ heading: v.channel === "stable" ? "Stable" : v.channel === "beta" ? "Beta" : v.channel === "nightly" ? "Nightly" : v.channel })), items.push({
        value: v.version,
        label: v.version,
        hint: v.state === "downloading" ? Math.round((v.progress || 0) * 100) + "%" : v.state === "installed" ? "downloaded" : v.size || "",
        iconNode: v.state === "downloading" ? /* @__PURE__ */ React.createElement(Spinner, { value: v.progress }) : /* @__PURE__ */ React.createElement(Icon, { name: VICON[v.state] || "cloud", className: "fd-vstate-" + v.state }),
        disabled: v.disabled,
        reason: v.reason
      }));
    }), /* @__PURE__ */ React.createElement("div", { className: "fd-vpicker" }, /* @__PURE__ */ React.createElement(
      FilterableSelect,
      {
        label,
        items,
        value,
        defaultValue,
        onChange,
        defaultOpen,
        defaultQuery,
        width,
        searchPlaceholder: "Filter versions",
        empty: "No versions match",
        onItemContextMenu: (it, e) => setCtx({ it, x: 24, y: 120 }),
        renderTrigger: (sel) => /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("span", { className: "fd-vpicker-e" }, "Electron"), /* @__PURE__ */ React.createElement("span", { className: "fd-select-value" }, sel ? sel.label : "Choose a version"))
      }
    ), ctx && /* @__PURE__ */ React.createElement(Menu, { className: "fd-ctx-menu", style: { left: ctx.x, top: ctx.y }, items: [{ label: "Copy version", icon: "copy", kbd: "\u2318C" }, { label: "Remove download", icon: "trash", danger: !0 }], onSelect: () => setCtx(null) }));
  }
  function ModuleList({ modules = [], source = [] }) {
    const [list, setList] = useState(modules);
    return /* @__PURE__ */ React.createElement("div", { className: "fd-modules" }, /* @__PURE__ */ React.createElement(Suggest, { source, placeholder: "Add a package from npm", onPick: (s) => setList(list.concat({ name: s.name, version: s.version, versions: [s.version] })) }), /* @__PURE__ */ React.createElement("div", { className: "fd-modules-list" }, list.length === 0 && /* @__PURE__ */ React.createElement("div", { className: "fd-fselect-empty" }, "No packages yet. Anything on npm works."), list.map((m) => /* @__PURE__ */ React.createElement("div", { key: m.name, className: "fd-module-row" }, /* @__PURE__ */ React.createElement(Icon, { name: "package", className: "fd-field-icon" }), /* @__PURE__ */ React.createElement("span", { className: "fd-module-name" }, m.name), /* @__PURE__ */ React.createElement(CompactSelect, { options: m.versions || [m.version], defaultValue: m.version, label: "Version of " + m.name }), /* @__PURE__ */ React.createElement(IconButton, { icon: "x", size: "sm", label: "Remove " + m.name, onClick: () => setList(list.filter((x) => x.name !== m.name)) })))));
  }
  function Table({ columns = [], rows = [], height = 280, rowHeight = 32, zebra = !0, empty = "Nothing to show", filter, selectable, selected = [], onToggle }) {
    const [scroll, setScroll] = useState(0), tpl = (selectable ? "32px " : "") + columns.map((c) => c.width || "minmax(0, 1fr)").join(" "), start = Math.max(0, Math.floor(scroll / rowHeight) - 5), end = Math.min(rows.length, start + Math.ceil(height / rowHeight) + 10);
    let z = 0;
    const zebraIdx = rows.map((r) => r.section ? (z = 0, -1) : z++);
    return /* @__PURE__ */ React.createElement("div", { className: "fd-table", role: "table" }, /* @__PURE__ */ React.createElement("div", { className: "fd-table-head", role: "row", style: { gridTemplateColumns: tpl } }, selectable && /* @__PURE__ */ React.createElement("span", null), columns.map((c) => /* @__PURE__ */ React.createElement("span", { key: c.key, role: "columnheader", style: { textAlign: c.align } }, c.label))), /* @__PURE__ */ React.createElement("div", { className: "fd-table-body", style: { height }, onScroll: (e) => setScroll(e.currentTarget.scrollTop) }, rows.length === 0 && /* @__PURE__ */ React.createElement("div", { className: "fd-table-empty" }, empty), /* @__PURE__ */ React.createElement("div", { style: { height: rows.length * rowHeight, position: "relative" } }, rows.slice(start, end).map((r, k) => {
      const i = start + k, style = { position: "absolute", top: i * rowHeight, left: 0, right: 0, height: rowHeight, gridTemplateColumns: tpl };
      return r.section ? /* @__PURE__ */ React.createElement("div", { key: "s" + i, className: "fd-table-section", style }, /* @__PURE__ */ React.createElement("span", null, r.section)) : /* @__PURE__ */ React.createElement("div", { key: r.id || i, className: "fd-table-row", role: "row", style, "data-zebra": zebra && zebraIdx[i] % 2 ? "" : void 0, "aria-selected": selected.includes(r.id) || void 0 }, selectable && /* @__PURE__ */ React.createElement("span", null, /* @__PURE__ */ React.createElement(Checkbox, { checked: selected.includes(r.id), onChange: () => onToggle && onToggle(r.id) })), columns.map((c) => /* @__PURE__ */ React.createElement("span", { key: c.key, role: "cell", style: { justifyContent: c.align === "right" ? "flex-end" : void 0 }, className: c.mono ? "fd-mono" : void 0 }, c.render ? c.render(r) : r[c.key])));
    }))));
  }
  function VersionManager({ versions = [], height = 300 }) {
    const [sel, setSel] = useState([]), [show, setShow] = useState({ stable: !0, beta: !0, nightly: !1, installed: !1 }), [q, setQ] = useState(""), rows = [];
    ["stable", "beta", "nightly"].forEach((ch) => {
      if (!show[ch]) return;
      const vs = versions.filter((v) => v.channel === ch && (!show.installed || v.state === "installed") && (!q || v.version.indexOf(q) >= 0));
      vs.length && (rows.push({ section: ch === "stable" ? "Stable" : ch === "beta" ? "Beta" : "Nightly" }), vs.forEach((v) => rows.push({ id: v.version, ...v })));
    });
    const cols = [
      { key: "version", label: "Version", mono: !0, width: "1.2fr" },
      { key: "state", label: "Status", width: "1.4fr", render: (r) => r.state === "installed" ? /* @__PURE__ */ React.createElement(StatusCell, { status: "ok" }, "Downloaded") : r.state === "downloading" ? /* @__PURE__ */ React.createElement(StatusCell, { status: "busy", progress: r.progress }, "Downloading ", Math.round(r.progress * 100), "%") : /* @__PURE__ */ React.createElement(StatusCell, { status: "remote" }, "Not downloaded") },
      { key: "size", label: "Size", mono: !0, width: "80px", align: "right" },
      { key: "a", label: "", width: "112px", align: "right", render: (r) => r.state === "installed" ? /* @__PURE__ */ React.createElement(Button, { size: "sm", variant: "ghost", icon: "trash" }, "Remove") : r.state === "remote" ? /* @__PURE__ */ React.createElement(Button, { size: "sm", variant: "ghost", icon: "download" }, "Download") : null }
    ];
    return /* @__PURE__ */ React.createElement("div", { className: "fd-vmanager" }, /* @__PURE__ */ React.createElement("div", { className: "fd-vmanager-bar" }, /* @__PURE__ */ React.createElement(Input, { size: "sm", icon: "search", placeholder: "Filter versions", value: q, onChange: (e) => setQ(e.target.value), style: { width: 180 } }), ["stable", "beta", "nightly"].map((k) => /* @__PURE__ */ React.createElement(Checkbox, { key: k, label: k[0].toUpperCase() + k.slice(1), checked: show[k], onChange: (v) => setShow({ ...show, [k]: v }) })), /* @__PURE__ */ React.createElement(Checkbox, { label: "Downloaded only", checked: show.installed, onChange: (v) => setShow({ ...show, installed: v }) }), /* @__PURE__ */ React.createElement("span", { style: { flex: 1 } }), /* @__PURE__ */ React.createElement(Button, { size: "sm", icon: "download", disabled: !sel.length }, "Download ", sel.length || ""), /* @__PURE__ */ React.createElement(Button, { size: "sm", variant: "danger", icon: "trash", disabled: !sel.length }, "Remove")), /* @__PURE__ */ React.createElement(Table, { columns: cols, rows, height, selectable: !0, selected: sel, onToggle: (id) => setSel(sel.includes(id) ? sel.filter((x) => x !== id) : sel.concat(id)), empty: "No versions match these filters" }));
  }
  return __toCommonJS(all_exports);
})();

window.Fiddle = Fiddle;

