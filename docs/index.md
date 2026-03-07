# PyHTMX GUI Client

`ovos-pyhtmx-gui-client` is a browser-based GUI client for [OpenVoiceOS](https://openvoiceos.org) built on top of [HTMX](https://htmx.org), [TailwindCSS](https://tailwindcss.com), and [daisyUI](https://daisyui.com).

Rather than shipping a native QML or Kirigami frontend, it serves a full-screen web application that connects to the OVOS GUI WebSocket (`ovos-gui`) and renders skill pages written in Python using the `pyhtmx-lib` library.

## Key Properties

- **No JavaScript required for skill authors** — pages are written entirely in Python using `pyhtmx-lib` HTML tag objects.
- **Server-Sent Events (SSE)** push DOM patches from the server to connected browsers in real time.
- **HTMX** handles client-side reactivity: elements are swapped in-place without a full page reload.
- **TailwindCSS + daisyUI** provide utility-first styling with a component library.
- **Multi-session**: multiple browser tabs can connect simultaneously, each tracked by a unique session ID.

## Documentation

| Document | Description |
|---|---|
| [Architecture](architecture.md) | Component overview and data flow |
| [Installation](installation.md) | How to install and run the client |
| [Configuration](configuration.md) | All configuration options |
| [Skill Development](skill-development.md) | Writing skills with pyhtmx GUI pages |
| [API Reference](api-reference.md) | `kit.py` classes: `Widget`, `Page`, `SessionItem`, `Trigger`, `Control` |
| [Message Protocol](message-protocol.md) | OVOS WebSocket message types handled by the client |

## Quick Start

```bash
# Install
pip install ovos-pyhtmx-gui-client pyhtmx-lib

# Run
pyhtmx-gui
# GUI is available at http://localhost:8000
```

See [Installation](installation.md) for the full setup procedure including the OVOS metapackage.
