# Architecture

## Overview

The client is a FastAPI application that bridges two worlds:

1. **OVOS GUI WebSocket** (`ws://localhost:18181/gui`) — receives page and session messages from the OVOS skill runtime.
2. **Browser clients** (`http://localhost:8000`) — serves an HTML shell and pushes real-time DOM updates via Server-Sent Events.

```
OVOS Core / Skills
       |
  ovos-gui service
       | WebSocket (ws://localhost:18181/gui)
       |
  GUIClient (gui_client.py)
       |
  GUIManager (gui_manager.py)
       |
  PageGroup --> PageManager --> Page (kit.py)
       |
  Renderer (renderer.py)
       |   \
       |    SSE stream (/updates)
       |         |
  FastAPI app   Browser(s)
  (app.py)       HTMX + TailwindCSS + daisyUI
```

## Components

### `GUIClient` (`gui_client.py`)

The entry point for all OVOS communication. On startup it:
- Opens a WebSocket connection to `ovos-gui`.
- Sends a `mycroft.gui.connected` handshake identifying itself as `framework: py-htmx`.
- Spawns a background thread that loops on `recv()` and dispatches each message to the appropriate handler.

Message handlers translate OVOS protocol messages into calls on `GUIManager`.

### `GUIManager` (`gui_manager.py`)

Maintains the ordered list of active namespaces and a catalog of `PageGroup` objects keyed by namespace. Responsibilities:

- **Namespace lifecycle** — insert, remove, activate, deactivate namespaces as skills start and stop.
- **Page lifecycle** — insert, remove, move pages within a namespace's `PageGroup`.
- **Routing show/close requests** to `Renderer`.
- **Forwarding data/state updates** to the active `PageGroup`.

The active namespace is always `_namespaces[0]`.

### `PageGroup` (`page_group.py`)

A collection of `PageManager` objects belonging to one skill namespace. Manages an ordered list of page IDs and tracks which page index is active (`_active_indexes[0]`).

### `PageManager` (`page_manager.py`)

Loads a single page from a Python source file (the skill's `gui/py-htmx/*.py` file). It:
- Dynamically imports the module and instantiates the `Page` subclass.
- Calls `page.set_up(self)` which registers all `SessionItem`, `Trigger`, and `Control` interactions.
- Stores registered `InteractionParameter` objects (for SSE targeting) and `Callback` objects (for event routing).

### `Renderer` (`renderer.py`)

The single source of truth for what is currently displayed. It owns:
- `_root` — the `<div id="root">` SSE swap target that holds the current page content.
- `_dialog_root` — the `<dialog id="dialog">` element for modal overlays.
- `_status` — the persistent `StatusBar` page overlaid at the top.
- `_last_shown` — the `(namespace, page_id)` tuple of what is currently rendered, used to suppress redundant updates.

When asked to `show()` a page, the renderer replaces the children of `_root` and sends the new HTML to all connected browsers via the SSE stream.

### `EventSender` / SSE stream (`event_sender.py`, `app.py:/updates`)

`EventSender` maintains a list of per-client `Queue` objects. `Renderer.send()` puts formatted SSE messages into every queue. The `/updates` endpoint streams from its own queue indefinitely, one message at a time.

SSE messages are formatted as:
```
event: <event_id>
data: <html>

```

HTMX on the browser side listens to `<event_id>` and swaps the HTML into the element with `sse-swap="<event_id>"`.

### `StatusBar` (`status_bar.py`)

A special always-visible `Page` (with `_is_page = False` so it is never managed by the normal page stack) that displays:
- The current utterance (what the user said).
- The current speech output (what OVOS is saying).
- An animated spinner that reacts to OVOS lifecycle events (wakeword, skill start, handled, failure, etc.).

### `Page` / `Widget` Kit (`kit.py`)

Base classes that skill authors subclass to build GUI pages. See [API Reference](api-reference.md).

## Request Flow: Displaying a Page

```
ovos-gui  --GUI_LIST_INSERT--> GUIClient.handle_gui_list_insert()
                                  --> GUIManager.insert_pages()
                                        --> PageGroup.insert_page()
                                              --> PageManager (loads .py file)

ovos-gui  --EVENT_TRIGGERED(page_gained_focus)--> GUIClient.handle_event_triggered()
                                                    --> GUIManager.show()
                                                          --> Renderer.show()
                                                                --> Renderer.update_root()
                                                                      --> Renderer.send(html, "root")
                                                                            --> SSE --> Browser
```

## Request Flow: Updating Session Data

```
ovos-gui  --SESSION_SET--> GUIClient.handle_session_set()
                             --> GUIManager.update_data()
                                   --> PageGroup.update_data()
                                         --> PageManager.update_data()
                                               --> Page.update_session_data()
                                                     --> Renderer.update_attributes()
                                                           --> Renderer.send(html, parameter_id)
                                                                 --> SSE --> Browser (element swap)
```

## Session Management

Each browser tab that loads `http://localhost:8000` is assigned a random hex session ID. The HTML shell contains an HTMX `hx-post` that pings `/ping/<session_id>` every N seconds. A background thread evicts sessions that have not pinged recently, calling `GUIClient.deregister()` to remove them from the SSE broadcast list.
