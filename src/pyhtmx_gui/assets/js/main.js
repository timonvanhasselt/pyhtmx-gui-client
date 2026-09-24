
// Process newly added elements to DOM
htmx.on(
    'htmx:load',
    function(event) { htmx.process(event.detail.elt); },
);

// Helper function
let dom_ready = (callback) => {
    document.readyState === 'interactive' || document.readyState === 'complete'
        ? callback()
        : document.addEventListener('DOMContentLoaded', callback);
};

const status_elements = ["speech", "utterance", "spinner"];

// TODO: avoid duplication of code
// Function to show tabs temporarily and adjust fullscreen image
function show_tabs() {
    const bottom_container = document.getElementById("bottom-container");
    const full_screen_image = document.getElementById("full-screen-image");
    if (bottom_container != null && full_screen_image != null) {
        // Remove the ‘hidden’ classes from the tabs
        bottom_container.classList.remove("tabs-hidden");
        // Add the ‘tabs-shown’ class to make them visible
        bottom_container.classList.add("tabs-shown");

        // Make the full-screen image smaller
        full_screen_image.classList.add("small");
    }
}

function hide_tabs() {
    const utterance_input = document.getElementById("utterance-input");
    const bottom_container = document.getElementById("bottom-container");
    const full_screen_image = document.getElementById("full-screen-image");
    if (utterance_input !== document.activeElement && bottom_container != null && full_screen_image != null) {
        bottom_container.classList.remove("tabs-shown"); // Hide the tabs after 2 seconds
        bottom_container.classList.add("tabs-hidden");

        // Resize the full-screen image
        full_screen_image.classList.remove("small");
    }
}


// Function to set animation before swapping the element in
function set_animation(event) {
    // Get the classes of the element
    const classes_match = /(?<=class=")[^\"\=]*(?=")/.exec(event.detail.data);
    let classes_list = [];
    let match = [];
    if (classes_match != null) {
        classes_list = classes_match[0].split(' ');
        match = classes_list.filter(
            (c) => c.includes("speech-props") || c.includes("utterance-props") || c.includes("no-text"),
        ).pop();
        if (match != null) {
            if (match.includes("speech-props")) {
                const parts = match.split('-');
                const period = parts[2];
                const length = parts[3];
                console.log(`Setting --speech-period = ${period}s`);
                console.log(`Setting --speech-length = ${length}`);
                document.documentElement.style.setProperty(
                    "--speech-period",
                    `${period}s`,
                );
                document.documentElement.style.setProperty(
                    "--speech-length",
                    length,
                );
                show_tabs();
            } else if (match.includes("utterance-props")) {
                const parts = match.split('-');
                const period = parts[2];
                const length = parts[3];
                console.log(`Setting --utterance-period = ${period}s`);
                console.log(`Setting --utterance-length = ${length}`);
                document.documentElement.style.setProperty(
                    "--utterance-period",
                    `${period}s`,
                );
                document.documentElement.style.setProperty(
                    "--utterance-length",
                    length,
                );
                show_tabs();
            } else {
                hide_tabs();
            }
        }
    }

    // Verify whether a transition should be applied
    const swap_spec = event.target.getAttribute("hx-swap");
    if (swap_spec == null) {
        console.log("Target not set for transition.");
        return;
    }
    match = /(?<=transition:)(true|false)/.exec(swap_spec);
    let should_transition = (match != null) && (match[0] === "true");
    if (!should_transition) {
        console.log("Target not set for transition.");
        return;
    }

    /* Default transition */
    if ((event.target.id == null) || !(status_elements.includes(event.target.id))) {
        document.documentElement.style.setProperty(
            "--swap-animation",
            "fade-in",
        );
    } else {
        document.documentElement.style.setProperty(
            "--swap-animation",
            "none",
        );
    }

    // If there is a transition
    if (classes_list != []) {
        match = classes_list.filter(
            (c) => c.includes("fade-in") || c.includes("swipe-in"),
        ).pop();
        if (match != null) {
            console.log(`Setting --swap-animation = ${match}`)
            document.documentElement.style.setProperty(
                "--swap-animation",
                match,
            );
        } else {
            const swap_animation = document.documentElement.style.getPropertyValue("--swap-animation");
            console.log(`--swap-animation = ${swap_animation}`);
            if ((swap_animation != null) && (swap_animation != "") && (swap_animation !== "fade-in")) {
                console.log("Unsetting --swap-animation");
                document.documentElement.style.removeProperty(
                    "--swap-animation",
                );
            }
        }
    }
};


dom_ready(() => {
    // Display body when DOM is loaded
    document.body.style.visibility = 'visible';
    const session_element = document.getElementById("session-id");
    if (session_element != null) {
        const session_id = session_element.textContent;
        console.log(`Session opened: ${session_id}`);
    }
    document.body.addEventListener(
        'htmx:sseBeforeMessage',
        set_animation,
    );
});


function objectify_node(node) {
    let attributes = [];
    if (node.getAttributeNames) {
        attributes = Array.from(node.getAttributeNames()).filter(
            (attr) => !attr.startsWith("hx-") && !attr.startsWith("sse")
        );
    }
    const node_object = Object.fromEntries(
        attributes.map((attr) => [attr, node.getAttribute(attr)])
    );
    if ("value" in node) {
        node_object["value"] = node.value;
    }
    return node_object;
}


function stringify_event(e) {
    const obj = {};
    for (let k in e) {
      obj[k] = e[k];
    }
    return JSON.stringify(obj, (k, v) => {
        if (v instanceof Node) return objectify_node(v);
        if (v instanceof Window) return 'Window';
        return v;
    }, ' ');
}

// ============================================================
// Smooth media-player clock
// ============================================================
//
// OCP sends the real playback position approximately every 2 seconds.
//
// IMPORTANT:
// Position SSE messages are intercepted BEFORE HTMX performs its normal
// DOM swap. Otherwise HTMX would write the server position (e.g. 24)
// directly into the time label every 2 seconds, causing visible jumps.
//
// OCP remains the source of truth.
// The browser interpolates between OCP position updates.
//
// Flow:
//
//   OCP position
//        ↓
//   htmx:sseBeforeMessage
//        ↓
//   preventDefault()
//        ↓
//   synchronize local clock
//        ↓
//   local clock updates time + progress
//
// Other SSE events (uri, duration, status, etc.) continue normally.
//


const media_player_clock = {
    position: 0,
    duration: 0,
    playing: false,

    last_tick: null,
    last_displayed_second: -1,

    // Used to recognise the same track after an HTMX root swap.
    track_key: null,

    initialized: false,
};


// ------------------------------------------------------------
// Helpers
// ------------------------------------------------------------

function format_media_time(seconds) {
    if (!Number.isFinite(seconds) || seconds <= 0) {
        return "00:00";
    }

    seconds = Math.floor(seconds);

    const minutes = Math.floor(seconds / 60);
    const sec = seconds % 60;

    return `${String(minutes).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}


function parse_media_time(value) {
    if (value == null) {
        return null;
    }

    const text = String(value).trim();

    // MM:SS
    const time_match = text.match(/^(\d+):(\d{2})$/);

    if (time_match != null) {
        return (
            parseInt(time_match[1], 10) * 60 +
            parseInt(time_match[2], 10)
        );
    }

    // Numeric value, interpreted as seconds.
    const number = Number(text);

    if (Number.isFinite(number)) {
        return number;
    }

    return null;
}


// ------------------------------------------------------------
// Track identity
// ------------------------------------------------------------

function media_player_get_track_key() {
    const title = document.getElementById("track-title");
    const artist = document.getElementById("track-artist");
    const image = document.getElementById("track-image");

    const title_text =
        title != null ? title.textContent.trim() : "";

    const artist_text =
        artist != null ? artist.textContent.trim() : "";

    const image_src =
        image != null
            ? image.getAttribute("src") || ""
            : "";

    if (
        title_text === "" &&
        artist_text === "" &&
        image_src === ""
    ) {
        return null;
    }

    return `${title_text}|${artist_text}|${image_src}`;
}


// ------------------------------------------------------------
// Playback state
// ------------------------------------------------------------

function media_player_is_playing() {
    const toggle_icon =
        document.getElementById("toggle-icon");

    if (toggle_icon == null) {
        return media_player_clock.playing;
    }

    return toggle_icon.textContent.trim() === "⏸";
}


function media_player_read_duration() {
    const total_label =
        document.getElementById("total-time-label");

    if (total_label == null) {
        return;
    }

    const duration =
        parse_media_time(total_label.textContent);

    if (duration != null && duration > 0) {
        media_player_clock.duration = duration;
    }
}


// ------------------------------------------------------------
// DOM updates
// ------------------------------------------------------------

function media_player_update_display() {
    const current_label =
        document.getElementById("current-time-label");

    if (current_label == null) {
        return;
    }

    // Time label
    const displayed_second = Math.floor(
        Math.max(0, media_player_clock.position)
    );

    if (
        displayed_second !==
        media_player_clock.last_displayed_second
    ) {
        current_label.textContent =
            format_media_time(media_player_clock.position);

        media_player_clock.last_displayed_second =
            displayed_second;
    }

    // Progress bar
    const progress_fill =
        document.getElementById("progress-fill");

    if (
        progress_fill != null &&
        Number.isFinite(media_player_clock.duration) &&
        media_player_clock.duration > 0
    ) {
        const percentage = Math.min(
            100,
            Math.max(
                0,
                (
                    media_player_clock.position /
                    media_player_clock.duration
                ) * 100
            )
        );

        progress_fill.style.width =
            `${percentage.toFixed(2)}%`;
    }
}


// ------------------------------------------------------------
// OCP synchronisation
// ------------------------------------------------------------

function media_player_sync_position(position) {
    if (!Number.isFinite(position)) {
        return;
    }

    const now = performance.now();

    media_player_clock.position =
        Math.max(0, position);

    media_player_clock.last_tick = now;

    media_player_clock.last_displayed_second =
        Math.floor(media_player_clock.position);

    media_player_clock.playing =
        media_player_is_playing();

    media_player_clock.initialized = true;

    media_player_read_duration();

    console.log(
        `[MEDIA CLOCK] OCP sync position=${position.toFixed(3)}`
    );

    media_player_update_display();
}


// ------------------------------------------------------------
// New track
// ------------------------------------------------------------

function media_player_reset() {
    const now = performance.now();

    media_player_clock.position = 0;
    media_player_clock.last_tick = now;
    media_player_clock.last_displayed_second = 0;

    media_player_clock.last_tick = now;
    media_player_clock.playing =
        media_player_is_playing();

    media_player_clock.initialized = true;

    console.log(
        "[MEDIA CLOCK] New track -> reset"
    );

    media_player_update_display();
}


// ------------------------------------------------------------
// INTERCEPT POSITION SSE BEFORE HTMX SWAP
// ------------------------------------------------------------
//
// This is the important part.
//
// The SSE extension does:
//
//   htmx:sseBeforeMessage
//        ↓
//   swap()
//        ↓
//   htmx:sseMessage
//
// We stop position events before swap().
// This prevents:
//
//   16 → 18 → 20 → 22
//
// from being written directly into the DOM.
//
// The local clock handles the display instead.
//

function media_player_handle_sse_before(event) {
    const sse_event = event.detail;

    if (sse_event == null) {
        return;
    }

    const event_type = sse_event.type || "";

    if (!event_type.startsWith("position-")) {
        return;
    }

    const target = event.target;

    if (target == null) {
        return;
    }

    const target_id = target.id || "";

    // Prevent HTMX from performing the normal SSE DOM swap
    // for both position targets.
    event.preventDefault();

    // Only use one of the two position targets as the
    // synchronization trigger. Otherwise the same OCP position
    // would be processed twice.
    if (target_id !== "current-time-label") {
        return;
    }

    const position =
        parse_media_time(sse_event.data);

    if (position != null) {
        media_player_sync_position(position);
    }
}


// ------------------------------------------------------------
// Handle normal SSE messages after the swap
// ------------------------------------------------------------
//
// Position is deliberately NOT handled here anymore.
// It was intercepted in htmx:sseBeforeMessage.
//

function media_player_handle_sse_message(event) {
    const sse_event = event.detail;

    if (sse_event == null) {
        return;
    }

    const event_type = sse_event.type || "";

    const target = event.target;

    if (target == null) {
        return;
    }

    const target_id = target.id || "";


    // --------------------------------------------------------
    // New track
    // --------------------------------------------------------

    if (
        target_id === "current-time-label" &&
        event_type.startsWith("uri-")
    ) {
        media_player_reset();
        return;
    }


    // --------------------------------------------------------
    // Duration
    // --------------------------------------------------------

    if (
        target_id === "total-time-label" &&
        event_type.startsWith("duration-")
    ) {
        const duration =
            parse_media_time(sse_event.data);

        if (
            duration != null &&
            duration > 0
        ) {
            media_player_clock.duration = duration;

            console.log(
                `[MEDIA CLOCK] Duration=${duration.toFixed(3)}`
            );

            media_player_update_display();
        }

        return;
    }


    // --------------------------------------------------------
    // Playback status
    // --------------------------------------------------------

    if (
        target_id === "toggle-icon" &&
        event_type.startsWith("status-")
    ) {
        media_player_clock.playing =
            media_player_is_playing();

        media_player_clock.last_tick =
            performance.now();

        console.log(
            `[MEDIA CLOCK] Playing=${media_player_clock.playing}`
        );

        return;
    }
}


// ------------------------------------------------------------
// Local playback clock
// ------------------------------------------------------------

function media_player_tick() {
    const current_label =
        document.getElementById("current-time-label");

    // Player is not visible.
    //
    // IMPORTANT:
    // Do not reset position here. Another HTMX page may simply
    // be displayed temporarily.
    if (current_label == null) {
        media_player_clock.last_tick = null;
        return;
    }

    const now = performance.now();

    if (media_player_clock.last_tick == null) {
        media_player_clock.last_tick = now;
        return;
    }

    const elapsed =
        (now - media_player_clock.last_tick) / 1000;

    media_player_clock.last_tick = now;

    media_player_clock.playing =
        media_player_is_playing();

    if (media_player_clock.playing) {
        media_player_clock.position += elapsed;
    }

    // Don't exceed known duration.
    if (
        media_player_clock.duration > 0 &&
        media_player_clock.position >=
            media_player_clock.duration
    ) {
        media_player_clock.position =
            media_player_clock.duration;
    }

    media_player_update_display();
}


// ------------------------------------------------------------
// HTMX page/load handling
// ------------------------------------------------------------

htmx.on(
    "htmx:load",
    function(event) {
        const current_label =
            document.getElementById(
                "current-time-label"
            );

        if (current_label == null) {
            return;
        }

        media_player_read_duration();

        const current_track_key =
            media_player_get_track_key();


        // First player load.
        if (!media_player_clock.initialized) {
            const position =
                parse_media_time(
                    current_label.textContent
                );

            if (position != null) {
                media_player_clock.position =
                    position;
            }

            media_player_clock.last_tick =
                performance.now();

            media_player_clock.last_displayed_second =
                Math.floor(
                    media_player_clock.position
                );

            media_player_clock.playing =
                media_player_is_playing();

            media_player_clock.track_key =
                current_track_key;

            media_player_clock.initialized =
                true;

            console.log(
                `[MEDIA CLOCK] Initial position=${media_player_clock.position.toFixed(3)}`
            );

            return;
        }


        // Same track, new DOM.
        //
        // This commonly happens after a root SSE swap.
        // Keep the interpolated local position.
        if (
            current_track_key != null &&
            current_track_key ===
                media_player_clock.track_key
        ) {
            media_player_clock.last_tick =
                performance.now();

            media_player_clock.playing =
                media_player_is_playing();

            console.log(
                "[MEDIA CLOCK] Same track after HTMX swap -> preserving clock"
            );

            return;
        }


        // Different track.
        if (
            current_track_key != null &&
            current_track_key !==
                media_player_clock.track_key
        ) {
            const position =
                parse_media_time(
                    current_label.textContent
                );

            if (position != null) {
                media_player_clock.position =
                    position;
            }

            media_player_clock.track_key =
                current_track_key;

            media_player_clock.last_tick =
                performance.now();

            media_player_clock.last_displayed_second =
                Math.floor(
                    media_player_clock.position
                );

            media_player_clock.playing =
                media_player_is_playing();

            console.log(
                `[MEDIA CLOCK] Track changed -> position=${media_player_clock.position.toFixed(3)}`
            );
        }
    }
);


// ------------------------------------------------------------
// Initialise
// ------------------------------------------------------------

dom_ready(() => {
    // Position events must be intercepted BEFORE the SSE extension
    // performs its normal DOM swap.
    document.body.addEventListener(
        "htmx:sseBeforeMessage",
        media_player_handle_sse_before,
    );

    // Normal SSE messages continue through the normal swap path.
    document.body.addEventListener(
        "htmx:sseMessage",
        media_player_handle_sse_message,
    );


    media_player_read_duration();

    const current_label =
        document.getElementById(
            "current-time-label"
        );

    if (current_label != null) {
        const position =
            parse_media_time(
                current_label.textContent
            );

        if (position != null) {
            media_player_clock.position =
                position;
        }

        media_player_clock.last_tick =
            performance.now();

        media_player_clock.last_displayed_second =
            Math.floor(
                media_player_clock.position
            );

        media_player_clock.playing =
            media_player_is_playing();

        media_player_clock.track_key =
            media_player_get_track_key();

        media_player_clock.initialized =
            true;
    }


    // Run the local player clock at 10 Hz.
    //
    // The label changes once per second.
    // The progress bar is updated continuously.
    window.setInterval(
        media_player_tick,
        100,
    );
});

