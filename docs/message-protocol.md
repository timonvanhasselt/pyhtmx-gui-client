# Message Protocol

The client communicates with `ovos-gui` over a WebSocket at `ws://localhost:18181/gui`. All messages are JSON objects with a `type` field.

## Outbound Messages (client → ovos-gui)

### `mycroft.gui.connected`

Sent once on startup to register this client with the OVOS GUI service.

```json
{
  "type": "mycroft.gui.connected",
  "gui_id": "pyhtmx-gui-client",
  "framework": "py-htmx",
  "data": {"framework": "py-htmx"}
}
```

The `framework` field tells `ovos-gui` which sub-directory to look for page files in (`gui/py-htmx/`).

### `mycroft.events.triggered`

Sent when the GUI needs to relay a user interaction or navigation event to the OVOS skill.

```json
{
  "type": "mycroft.events.triggered",
  "namespace": "my-skill.namespace",
  "event_name": "page_gained_focus",
  "data": {"number": 0}
}
```

Also used to send a text utterance:

```json
{
  "type": "mycroft.events.triggered",
  "namespace": "system",
  "event_name": "recognizer_loop:utterance",
  "data": {"utterance": "what time is it"}
}
```

## Inbound Messages (ovos-gui → client)

### GUI List Messages

These messages manage which pages are loaded for a given skill namespace.

#### `mycroft.gui.list.insert`

A skill is requesting that one or more pages be loaded.

```json
{
  "type": "mycroft.gui.list.insert",
  "namespace": "my-skill.namespace",
  "position": 0,
  "values": [
    {"url": "/path/to/gui/py-htmx/my_page.py", "page": "my_page"}
  ]
}
```

| Field | Description |
|---|---|
| `namespace` | Skill namespace identifier |
| `position` | Index at which to insert the pages |
| `values` | List of page descriptors; each has `url` (absolute path to .py file) and `page` (page ID) |

The client loads each `.py` file, instantiates its `Page` subclass, and registers it in the `PageGroup` for that namespace.

#### `mycroft.gui.list.move`

Reorder pages within a namespace.

```json
{
  "type": "mycroft.gui.list.move",
  "namespace": "my-skill.namespace",
  "from": 0,
  "to": 2,
  "items_number": 1
}
```

#### `mycroft.gui.list.remove`

Remove pages from a namespace.

```json
{
  "type": "mycroft.gui.list.remove",
  "namespace": "my-skill.namespace",
  "position": 0,
  "items_number": 1
}
```

### Session Messages

These messages carry data values from the skill to update page content.

#### `mycroft.session.set`

Set one or more session variables for a namespace.

```json
{
  "type": "mycroft.session.set",
  "namespace": "my-skill.namespace",
  "data": {
    "title": "Hello World",
    "body": "Some content"
  }
}
```

Each key in `data` is matched against registered `SessionItem.parameter` values. Matching components are updated and SSE patches are sent to all connected browsers.

#### `mycroft.session.delete`

Delete a single session variable.

```json
{
  "type": "mycroft.session.delete",
  "namespace": "my-skill.namespace",
  "property": "title"
}
```

#### `mycroft.session.list.insert`

Insert items into a list-valued session variable, or register a new active skill namespace via `mycroft.system.active_skills`.

```json
{
  "type": "mycroft.session.list.insert",
  "namespace": "mycroft.system.active_skills",
  "position": 0,
  "data": {"skill_id": "my-skill.namespace"}
}
```

When `namespace` is `mycroft.system.active_skills`, this triggers `GUIManager.insert_namespace()` which prepares a `PageGroup` slot for the skill.

#### `mycroft.session.list.remove`

Remove an item from `mycroft.system.active_skills` (skill deactivated) or from a list-valued session variable.

```json
{
  "type": "mycroft.session.list.remove",
  "namespace": "mycroft.system.active_skills",
  "position": 0,
  "items_number": 1
}
```

When a skill is removed from `active_skills`, its `PageGroup` is deleted and, if it was the active namespace, the previous one is shown.

### Event Messages

#### `mycroft.events.triggered`

An OVOS or skill event has fired. The client handles two categories:

1. **`page_gained_focus`** — tells the client which page index to display.

```json
{
  "type": "mycroft.events.triggered",
  "namespace": "my-skill.namespace",
  "event_name": "page_gained_focus",
  "data": {"number": 1}
}
```

2. **System events** (`namespace == "system"`) — lifecycle events that update the `StatusBar`:

| `event_name` | Meaning |
|---|---|
| `recognizer_loop:wakeword` | Wake word detected |
| `recognizer_loop:record_begin` | Recording started |
| `recognizer_loop:record_end` | Recording ended |
| `recognizer_loop:utterance` | Utterance transcribed |
| `ovos.utterance.handled` | Intent matched and handled |
| `ovos.utterance.cancelled` | Utterance cancelled |
| `complete_intent_failure` | No intent matched |
| `speak` | TTS about to speak |
| `recognizer_loop:audio_output_start` | Audio playback started |
| `recognizer_loop:audio_output_end` | Audio playback ended |
| `mycroft.skill.handler.start` | Skill handler executing |
| `mycroft.skill.handler.complete` | Skill handler finished |

3. **General events** — any other `event_name` is forwarded to `GUIManager.update_state()`, which passes it to `Trigger` objects registered on the active page.

## Message Model

All messages are validated with Pydantic using the `Message` model in `types.py`:

```python
class Message(BaseModel):
    type: MessageType
    namespace: Optional[str]
    gui_id: Optional[str]
    framework: Optional[str]
    property: Optional[str]
    position: Optional[int]
    from_position: Optional[int]   # alias: "from"
    to_position: Optional[int]     # alias: "to"
    items_number: Optional[int]
    event_name: Optional[str]
    data: Optional[Union[Dict[str, Any], List[Dict[str, Any]]]]
    values: Optional[List[Dict[str, Any]]]
```
