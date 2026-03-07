# API Reference

All classes described here live in `pyhtmx_gui.kit`.

---

## `Widget`

Base class for all renderable GUI components.

```python
class Widget:
    _parameters: Tuple[str, ...] = ()
```

`_parameters` declares which session keys this widget reads. Declare them so that `init_session_data` can pre-populate `_session_data` on construction.

### Constructor

```python
Widget(
    type: WidgetType = WidgetType.COMPONENT,
    name: Optional[str] = None,
    session_data: Optional[Dict[str, Any]] = None,
)
```

| Parameter | Description |
|---|---|
| `type` | Widget kind: `PAGE`, `COMPONENT`, or `DIALOG` |
| `name` | Unique HTML ID prefix. Auto-generated if omitted. |
| `session_data` | Initial values for session parameters. Only keys listed in `_parameters` are stored. |

### Properties

| Property | Type | Description |
|---|---|---|
| `id` | `str` | The widget name, used as an ID prefix |
| `type` | `WidgetType` | `PAGE`, `COMPONENT`, or `DIALOG` |
| `widget` | `Optional[HTMLTag]` | The root HTML element. Set in `__init__` as `self._widget`. |
| `session_items` | `Dict[str, List[SessionItem]]` | Registered session bindings |
| `triggers` | `Dict[str, List[Trigger]]` | Registered event triggers |
| `controls` | `Dict[str, Control]` | Registered user interaction callbacks |
| `ghost_elements` | `List[HTMLTag]` | Hidden elements created for `Control` objects with no explicit source |

### Methods

#### `add_interaction(key, value)`

Register a reactive binding.

```python
add_interaction(key: str, value: Union[SessionItem, Trigger, Control]) -> None
```

- `SessionItem`: `key` is the session variable name.
- `Trigger`: `key` is the OVOS event name.
- `Control`: `key` is an arbitrary unique identifier for the callback.

#### `has(parameter) -> bool`

Returns `True` if the widget has a `SessionItem` registered for `parameter`.

#### `acts_on(ovos_event) -> bool`

Returns `True` if the widget has a `Trigger` registered for `ovos_event`.

---

## `Page`

Subclass of `Widget`. Represents a full-screen page that can be shown by the renderer. Skill authors subclass this.

```python
class Page(Widget):
    _is_page: bool = True
```

`_is_page = True` is the marker `PageManager` uses to detect the correct class when loading a page module.

### Constructor

```python
Page(
    name: Optional[str] = None,
    session_data: Optional[Dict[str, Any]] = None,
)
```

### Additional Properties

| Property | Type | Description |
|---|---|---|
| `namespace` | `str` | Set by `set_up()`. Mirrors the OVOS skill namespace. |
| `page_id` | `str` | Set by `set_up()`. The page identifier within the namespace. |
| `page` | `HTMLTag` | The root `<div>` returned to the renderer. Set as `self._page` in `__init__`. |

### Additional Methods

#### `add_component(widgets)`

Add child `Widget` objects whose interactions will be registered alongside the page's own interactions.

```python
add_component(widgets: Union[Widget, List[Widget]]) -> None
```

#### `set_up(page_manager) -> Page`

Called by `PageManager` after loading. Propagates session data, registers all interactions, and sets `namespace` and `page_id`. You do not call this directly.

#### `update_session_data(session_data, renderer)`

Called by the renderer when OVOS sends new session values. Iterates all registered `SessionItem` objects and calls `renderer.update_attributes()` for each affected component. You do not call this directly.

#### `update_trigger_state(ovos_event, renderer)`

Called by the renderer when an OVOS event arrives. Iterates `Trigger` objects registered for `ovos_event`. You do not call this directly.

---

## `SessionItem`

Pydantic model. Binds a session variable to one or more HTML attributes on an element.

```python
class SessionItem(Registrable):
    parameter: str
    attribute: Union[str, Tuple[str, ...], List[str]]
    component: HTMLTag
    format_value: Union[Callable, Dict[str, Callable], None] = None
    target_level: Optional[str] = "innerHTML"
```

| Field | Description |
|---|---|
| `parameter` | Session variable name. Must match a key set via `self.gui["key"]` in the skill. |
| `attribute` | HTML attribute(s) to update. Use `"inner_content"` for text content. |
| `component` | The `HTMLTag` element to update. |
| `format_value` | Optional transform. A single callable applies to all attributes; a dict maps attribute names to callables. |
| `target_level` | HTMX swap strategy. `"innerHTML"` replaces children; `"outerHTML"` replaces the element; `"attribute:name"` updates a single attribute. |

### Notes

- If `attribute` is a single `str`, it is automatically wrapped in a tuple.
- If `attribute` is only `"inner_content"`, `target_level` is forced to include `"innerHTML"`.
- Otherwise `target_level` is forced to include `"outerHTML"`.

---

## `Trigger`

Pydantic model. Reacts to OVOS system events (not session data) and updates an element.

```python
class Trigger(Registrable):
    event: str
    attribute: Union[str, Tuple[str], List[str]]
    component: HTMLTag
    get_value: Union[Callable, Dict[str, Callable], None] = None
    target_level: Optional[str] = "innerHTML"
```

| Field | Description |
|---|---|
| `event` | Internal event ID string registered with the renderer's SSE system. |
| `attribute` | HTML attribute(s) to update. |
| `component` | The `HTMLTag` element to update. |
| `get_value` | Dict mapping attribute names to callables. Each callable receives the OVOS event name and returns the new attribute value. |
| `target_level` | HTMX swap strategy. Same options as `SessionItem`. `"attribute:class"` is common for class-only updates. |

Register the same `Trigger` instance under multiple OVOS event names to have it respond to all of them:

```python
for event in [EventType.WAKEWORD, EventType.SKILL_HANDLER_START]:
    self.add_interaction(event.value, my_trigger)
```

---

## `Control`

Pydantic model. Wires a browser DOM event to a Python callback.

```python
class Control(Registrable):
    context: str
    event: str
    callback: Callable
    source: Union[HTMLTag, str, None] = None
    target: Union[HTMLTag, str, None] = None
    target_level: str = "innerHTML"
```

| Field | Description |
|---|---|
| `context` | `"local"` or `"global"` (see below) |
| `event` | HTMX event expression, e.g. `"click"`, `"keyup[event.code==='Enter'] from:body"` |
| `callback` | `(page_manager, dom_event) -> Optional[HTMLTag]`. For local callbacks, return an `HTMLTag` to swap into `target`. |
| `source` | The element that emits the event. If `None`, a hidden ghost `<div>` is created. |
| `target` | For local callbacks: the element whose content is replaced with the callback's return value. |
| `target_level` | HTMX swap strategy for the response. Default `"innerHTML"`. |

### `context` Values

| Value | HTTP method | Response |
|---|---|---|
| `"local"` | `GET /local-event/<id>` | Returns HTML; swapped into `target` |
| `"global"` | `POST /global-event/<id>` | Returns 204 No Content; callback is a side-effect |

Use `"local"` when the callback produces visible output. Use `"global"` for actions like closing a page, sending an event to OVOS, or navigating between pages.

---

## `WidgetType`

```python
class WidgetType(str, Enum):
    PAGE = "page"
    COMPONENT = "component"
    DIALOG = "dialog"
```

---

## `Renderer` (selected methods)

`Renderer` is a singleton (`pyhtmx_gui.renderer.global_renderer`). Callbacks receive a `PageManager` whose `.renderer` attribute exposes these methods:

| Method | Description |
|---|---|
| `renderer.show(namespace, page_id)` | Display a specific page |
| `renderer.show_next()` | Display the next page in the active namespace |
| `renderer.show_previous()` | Display the previous page |
| `renderer.close(namespace, page_id)` | Close the active namespace and fall back to the previous one |
| `renderer.close_page(namespace, page_id)` | Deactivate the current page within the namespace |
| `renderer.open_dialog(dialog_id)` | Open a registered dialog overlay |
| `renderer.close_dialog()` | Close the dialog overlay |
| `renderer.send_utterance_to_ovos(utterance)` | Send a text utterance to OVOS for processing |
| `renderer.send_event_to_ovos(namespace, ovos_event, data)` | Send a raw event to OVOS |
