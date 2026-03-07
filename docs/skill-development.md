# Skill Development

This guide explains how to write OVOS skills with pyhtmx-based GUI pages.

## Directory Layout

A skill with pyhtmx GUI pages places its page files under `gui/py-htmx/`:

```
my-skill/
  src/my_skill/
    __init__.py          # OVOSSkill subclass
    gui/
      py-htmx/
        my_page.py       # Page definition
        another_page.py
    locale/
      en-us/
        intent/
          my.intent
```

The `gui/py-htmx/` directory name is the framework identifier that `ovos-gui` uses to select the right page files when it sends `mycroft.gui.list.insert` messages.

## Skill Side

Show pages from the skill using the standard `self.gui` API:

```python
from ovos_workshop.skills import OVOSSkill
from ovos_workshop.decorators import intent_handler

class MySkill(OVOSSkill):

    @intent_handler("my.intent")
    def handle_my_intent(self):
        # Set session variables that pages can read
        self.gui["title"] = "Hello"
        self.gui["body"] = "This is the content."

        # Show one or more pages (multi-page swipe)
        self.gui.show_pages(
            ["my_page", "another_page"],
            override_idle=30,
        )
        self.speak("Hello from my skill.")
```

Session variables set with `self.gui["key"] = value` are delivered to the client via `mycroft.session.set` messages and automatically update any `SessionItem` that is bound to that key.

## Page Files

Each page file must define a class that:
- Subclasses `pyhtmx_gui.kit.Page`
- Sets `_is_page = True` (inherited by default from `Page`)
- Builds its HTML tree in `__init__` using `pyhtmx` tag objects
- Registers reactive bindings using `add_interaction()`

The `PageManager` discovers the class automatically by looking for any attribute of the loaded module that is a subclass of `Page` with `_is_page = True`.

### Minimal Example

```python
from typing import Any, Dict, Optional
from pyhtmx import Div
from pyhtmx_gui.kit import Page, SessionItem

class MyPage(Page):

    def __init__(self, session_data: Optional[Dict[str, Any]] = None):
        super().__init__(name="my-page", session_data=session_data)

        # Create a div whose text is driven by the "title" session variable
        self._title = Div(
            inner_content=session_data.get("title", ""),
            _id="my-title",
            _class="text-4xl font-bold text-white",
        )
        self.add_interaction(
            "title",
            SessionItem(
                parameter="title",
                attribute="inner_content",
                component=self._title,
            ),
        )

        # Build the page layout
        self._page = Div(
            self._title,
            _id="my-page",
            _class="flex flex-col items-center justify-center",
            style={"width": "100vw", "height": "100vh"},
        )
```

### Session Data Binding (`SessionItem`)

`SessionItem` links an OVOS session variable to an HTML attribute:

```python
SessionItem(
    parameter="my_var",        # session key (from self.gui["my_var"])
    attribute="inner_content", # HTML attribute to update ("inner_content" = text)
    component=self._element,   # the HTMLTag to update
    format_value=str.upper,    # optional: transform the value before setting it
)
```

Multiple attributes can be updated from one session variable:

```python
SessionItem(
    parameter="status",
    attribute=("inner_content", "class"),
    component=self._label,
    format_value={
        "inner_content": lambda v: v,
        "class": lambda v: "text-green-400" if v == "ok" else "text-red-400",
    },
)
```

### Event Triggers (`Trigger`)

`Trigger` reacts to OVOS system events (not session data changes):

```python
from pyhtmx_gui.kit import Trigger
from pyhtmx_gui.types import EventType

self._indicator = Div(_id="indicator", _class="hidden")
self.add_interaction(
    EventType.WAKEWORD.value,
    Trigger(
        event="status-indicator",
        attribute=("class",),
        component=self._indicator,
        get_value={"class": lambda event: "visible"},
        target_level="attribute:class",
    ),
)
```

`target_level="attribute:class"` tells the renderer to update only the `class` attribute in-place rather than replacing the full element.

### User Interaction Callbacks (`Control`)

`Control` wires browser events to Python callbacks.

**Local callback** — returns HTML to swap into a target element:

```python
from pyhtmx_gui.kit import Control

self._button = Button("Toggle", _id="my-btn")
self.add_interaction(
    "toggle-click",
    Control(
        context="local",
        event="click",
        callback=lambda page_manager, dom_event: Div("Toggled!", _id="result"),
        source=self._button,
        target=self._result_div,
        target_level="innerHTML",
    ),
)
```

**Global callback** — triggers a side-effect with no HTML response (e.g. close the page):

```python
self.add_interaction(
    "close-click",
    Control(
        context="global",
        event="click",
        callback=lambda page_manager, _: page_manager.renderer.close(),
        source=self._close_button,
    ),
)
```

**Keyboard global callback** — listen for key events on `body`:

```python
self.add_interaction(
    "next-page",
    Control(
        context="global",
        event="keyup[event.code === 'ArrowRight'] from:body",
        callback=lambda page_manager, _: page_manager.renderer.show_next(),
    ),
)
```

When `source` is `None`, a hidden ghost `<div>` is automatically created and inserted into the page to carry the HTMX trigger.

### Multi-Page Navigation

`Renderer` provides built-in navigation methods that skill pages can call from callbacks:

| Method | Effect |
|---|---|
| `renderer.show_next()` | Show the next page in the current namespace |
| `renderer.show_previous()` | Show the previous page |
| `renderer.close()` | Close the current namespace and return to the previous one |
| `renderer.close_page()` | Deactivate the current page within the namespace |

### Dialogs

Register a dialog widget (a `Widget` with `type=WidgetType.DIALOG`) and open/close it via the renderer:

```python
from pyhtmx_gui.kit import Widget, WidgetType

class MyDialog(Widget):
    def __init__(self):
        super().__init__(type=WidgetType.DIALOG, name="confirm-dialog")
        self._widget = Div("Are you sure?", _class="p-4")

# In MyPage.__init__:
dialog = MyDialog()
self.add_component(dialog)

# In a callback:
lambda pm, _: pm.renderer.open_dialog("confirm-dialog")
```

## Hello World Skill

The repository ships a complete reference skill at `skill-pyhtmx-hello-world/`. It demonstrates:

- Three pages with swipe navigation (arrow keys).
- `SessionItem` bindings for `title` and `text` session variables.
- A "Back to Home" button that closes the skill GUI.

```
skill-pyhtmx-hello-world/
  src/skill_pyhtmx_hello_world/
    __init__.py              # HelloWorldSkill
    gui/
      py-htmx/
        hello_world_page1.py # Page 1 — title, text, close button, right-arrow navigation
        hello_world_page2.py # Page 2
        hello_world_page3.py # Page 3
    locale/en-us/intent/pyhtmx.intent
```

Install and trigger it:

```bash
cd skill-pyhtmx-hello-world && pip install -e .
# Then say: "pyhtmx" (or whatever phrase matches pyhtmx.intent)
```

## Styling

Pages have access to:

- **TailwindCSS** utility classes — available globally via the CDN script.
- **daisyUI** component classes (`btn`, `btn-outline`, `modal`, etc.) — bundled in `assets/css/daisyui-full.min.css`.
- **Custom CSS** — add global styles in `assets/css/main.css` or scoped styles via inline `style` attributes.

Standard page dimensions: `width: 100vw; height: 100vh`.

Use `dark:` variants for dark mode support, e.g. `bg-blue-400 dark:bg-blue-900`.
