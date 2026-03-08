# Configuration

Configuration is loaded from `src/pyhtmx_gui/config/config.toml` at startup. Edit this file to change defaults.

## Default `config.toml`

```toml
connection-check-wait = 0.5
ping-period = 5.0
server-host = "127.0.0.1"
server-port = 8000
log-level = "debug"
client-id = "pyhtmx-gui-client"
ovos-server-url = "ws://localhost:18181/gui"
cache-dir = "~/.cache/ovos_gui"
```

## Options

### `server-host`

**Type:** string
**Default:** `"127.0.0.1"`

The network interface the FastAPI/uvicorn server binds to. Set to `"0.0.0.0"` to accept connections from other devices on the network.

### `server-port`

**Type:** integer
**Default:** `8000`

The TCP port the HTTP server listens on. Browse to `http://<server-host>:<server-port>` to open the GUI.

### `ovos-server-url`

**Type:** string
**Default:** `"ws://localhost:18181/gui"`

WebSocket URL of the `ovos-gui` service. Change this if OVOS runs on a different host or port.

### `client-id`

**Type:** string
**Default:** `"pyhtmx-gui-client"`

The identifier sent to `ovos-gui` in the `mycroft.gui.connected` handshake. Only needs to change if you run multiple GUI clients simultaneously.

### `cache-dir`

**Type:** string (path, supports `~`)
**Default:** `"~/.cache/ovos_gui"`

Path to the OVOS GUI cache directory. This directory is mounted as `/cache` in the web server so skill-generated assets (images, etc.) are accessible to the browser. The directory must exist before starting the client.

### `ping-period`

**Type:** float (seconds)
**Default:** `5.0`

How often the browser is expected to send a ping to `/ping/<session_id>`. If a session has not pinged within `ping-period + 3 * connection-check-wait` seconds it is considered disconnected and deregistered.

### `connection-check-wait`

**Type:** float (seconds)
**Default:** `0.5`

How frequently the background thread checks for disconnected sessions.

### `log-level`

**Type:** string
**Default:** `"debug"`

Log verbosity. Passed to Python's `logging` module. Valid values: `"debug"`, `"info"`, `"warning"`, `"error"`, `"critical"`.
