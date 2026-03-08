# Installation

## Requirements

- Python 3.9 or later
- A running OVOS stack (specifically `ovos-gui` listening on `ws://localhost:18181/gui`)
- A modern web browser to display the UI

## Option A: Metapackage (Recommended)

The OVOS PyHTMX metapackage replaces several standard OVOS GUI components with pyhtmx-compatible versions in one step.

```bash
# Remove the standard OVOS GUI components
pip uninstall ovos-gui ovos-audio ovos-dinkum-listener \
    ovos-skill-homescreen ovos-plugin-common-play \
    ovos-skill-date-time ovos-skill-weather

# Install the metapackage
pip install git+https://github.com/femelo/ovos-pyhtmx-gui-metapackage.git
```

Then install the `pyhtmx-lib` core library:

```bash
pip install pyhtmx-lib
```

## Option B: Standalone Install

Install the client package directly:

```bash
pip install ovos-pyhtmx-gui-client pyhtmx-lib
```

This installs the `pyhtmx-gui` command but does not replace other OVOS components. Use this if you are integrating selectively or developing against an existing OVOS stack.

## Development Install (Editable)

Clone the repository and install in editable mode so that source changes take effect immediately:

```bash
git clone https://github.com/femelo/pyhtmx-gui-client.git
cd pyhtmx-gui-client
pip install -e .
pip install pyhtmx-lib
```

To also install the bundled example skill in editable mode:

```bash
cd skill-pyhtmx-hello-world
pip install -e .
```

## Running the Client

```bash
pyhtmx-gui
```

The server starts at `http://127.0.0.1:8000` by default. Open that URL in a browser while OVOS is running to see the GUI.

To override host or port at the command line:

```bash
pyhtmx-gui --host 0.0.0.0 --port 9000
```

Persistent configuration is done via `config.toml`. See [Configuration](configuration.md).

## Verifying the Connection

On startup the client logs:

```
Connected to ovos-gui websocket
PyHTMX GUI started...
```

If the OVOS WebSocket is not reachable, the log will show:

```
Error connecting to ovos-gui: ...
```

The GUI will still start and serve the browser shell; it will display pages once the OVOS connection is established.
