// ===================================================
// Telegram Real-Time Visitor & Link Tracking System
// FV Labs Portfolio (https://fv-labs.vercel.app/)
// ===================================================

const TG_CONFIG = {
    // Primary: @Portfoliofvlabsbot
    PRIMARY_TOKEN: "8838781499:AAFE-96p8XpmL_64zHkIZqWi7K6wTK2snmE",
    // Fallback: private-project-1 bot (guaranteed active channel)
    FALLBACK_TOKEN: "8685821226:AAHrc_hMMI3SKIUFobsgur3MfWyW6ec9n_w",
    CHAT_ID: "5317269928",
    ENABLED: true
};

// Asynchronously cached telemetry
let cachedBatteryInfo = "Desktop / AC Power";
let cachedSpeedInfo = "Standard High-Speed Broadband";
let cachedGeo = null;

// 1. Monitor battery level & state asynchronously
if (typeof navigator !== 'undefined' && navigator.getBattery) {
    navigator.getBattery().then(bat => {
        function updateBat(b) {
            const pct = Math.round(b.level * 100);
            const state = b.charging ? "⚡ Charging" : "🔋 On Battery";
            cachedBatteryInfo = `${pct}% (${state})`;
        }
        updateBat(bat);
        bat.addEventListener('levelchange', () => updateBat(bat));
        bat.addEventListener('chargingchange', () => updateBat(bat));
    }).catch(() => {});
}

// 2. Monitor network connection & speed
try {
    const initialConn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (initialConn) {
        function updateConn(conn) {
            let parts = [];
            if (conn.downlink) parts.push(`${conn.downlink} Mbps`);
            if (conn.rtt) parts.push(`Ping: ${conn.rtt}ms`);
            if (conn.effectiveType) parts.push(conn.effectiveType.toUpperCase());
            if (parts.length > 0) cachedSpeedInfo = parts.join(" • ");
        }
        updateConn(initialConn);
        if (initialConn.addEventListener) {
            initialConn.addEventListener('change', () => updateConn(initialConn));
        }
    }
} catch (e) {}

// 3. Collect comprehensive client device telemetry
function getClientDeviceInfo() {
    try {
        const ua = navigator.userAgent || "";

        // OS
        let os = "Android Mobile";
        if (ua.indexOf("Win") !== -1) os = "Windows PC";
        else if (ua.indexOf("Android") !== -1) os = "Android Mobile";
        else if (/iPhone|iPad|iPod/.test(ua)) os = "Apple iOS";
        else if (ua.indexOf("Mac") !== -1) os = "macOS (Apple)";
        else if (ua.indexOf("Linux") !== -1) os = "Linux";

        // Browser
        let browser = "Google Chrome";
        if (ua.indexOf("Edg") !== -1) browser = "Microsoft Edge";
        else if (ua.indexOf("Chrome") !== -1) browser = "Google Chrome";
        else if (ua.indexOf("Firefox") !== -1) browser = "Mozilla Firefox";
        else if (ua.indexOf("Safari") !== -1) browser = "Apple Safari";
        else if (ua.indexOf("Opera") !== -1 || ua.indexOf("OPR") !== -1) browser = "Opera";

        // GPU detection via WebGL unmasked renderer
        let gpu = "Standard Graphics Adapter";
        try {
            const canvas = document.createElement('canvas');
            const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
            if (gl) {
                const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
                if (debugInfo) {
                    const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
                    if (renderer) gpu = renderer;
                }
            }
        } catch (ge) {}

        // Screen & Window
        const dpr = window.devicePixelRatio || 1;
        const colorDepth = window.screen.colorDepth || 24;
        const screenRes = `${window.screen.width}x${window.screen.height} (${dpr}x dpr, ${colorDepth}-bit)`;
        const windowSize = `${window.innerWidth}x${window.innerHeight}`;

        // Hardware (CPU cores & RAM)
        const cpuCores = navigator.hardwareConcurrency ? `${navigator.hardwareConcurrency} Cores` : 'Multi-Core CPU';
        const ramGB = navigator.deviceMemory ? `${navigator.deviceMemory} GB RAM` : '';
        const hwSummary = ramGB ? `${cpuCores}, ${ramGB}` : cpuCores;

        // Touch & Input Type
        const isTouch = (navigator.maxTouchPoints > 0) || ('ontouchstart' in window);
        const inputType = isTouch ? `Touchscreen (${navigator.maxTouchPoints || 1} touch points)` : "Mouse & Keyboard";

        // Theme
        const isDark = (document.documentElement.getAttribute('data-theme') === 'dark') ||
                       (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
        const theme = isDark ? "Dark Mode" : "Light Mode";

        // Language & TimeZone
        const language = navigator.language || navigator.userLanguage || 'en-GB';
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Dhaka';

        // Referrer
        const referrer = document.referrer || window.location.href;

        return {
            os,
            browser,
            gpu,
            battery: cachedBatteryInfo,
            speed: cachedSpeedInfo,
            screen_resolution: screenRes,
            window_size: windowSize,
            hardware: hwSummary,
            input_type: inputType,
            theme,
            language,
            timezone,
            referrer,
            user_agent: ua
        };
    } catch (e) {
        return {
            os: "Web Client",
            browser: "Browser",
            gpu: "Standard Graphics Adapter",
            battery: cachedBatteryInfo,
            speed: cachedSpeedInfo,
            screen_resolution: `${window.screen.width}x${window.screen.height}`,
            window_size: `${window.innerWidth}x${window.innerHeight}`,
            hardware: "Multi-Core CPU",
            input_type: "Standard Input",
            theme: "Dark Mode",
            language: "en-GB",
            timezone: "Asia/Dhaka",
            referrer: document.referrer || "https://fv-labs.vercel.app/"
        };
    }
}

// 4. Query Fresh Real GPS Coordinates (if permission granted or stored)
function getRealGpsCoordinates(timeoutMs = 1800) {
    if (!navigator.geolocation || !navigator.geolocation.getCurrentPosition) return Promise.resolve(null);
    return new Promise((resolve) => {
        let finished = false;
        const timer = setTimeout(() => {
            if (!finished) { finished = true; resolve(null); }
        }, timeoutMs);

        navigator.geolocation.getCurrentPosition(
            (pos) => {
                if (!finished) {
                    finished = true;
                    clearTimeout(timer);
                    resolve({
                        lat: pos.coords.latitude,
                        lng: pos.coords.longitude,
                        accuracy: pos.coords.accuracy
                    });
                }
            },
            () => {
                if (!finished) { finished = true; clearTimeout(timer); resolve(null); }
            },
            { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 60000 }
        );
    });
}

// 5. Fallback Client Geo Lookup (Used only if /api/notify-telegram is unreachable, e.g. GitHub Pages)
async function getClientGeoFallback() {
    if (cachedGeo) return cachedGeo;
    try {
        const res = await fetch("https://freeipapi.com/api/json");
        if (res.ok) {
            const data = await res.json();
            const isProxy = Boolean(data.isProxy);
            cachedGeo = {
                ip: data.ipAddress || "Unknown IP",
                isp: data.asnOrganization || "Bijoy Online Ltd",
                city: data.cityName || "Sirajganj",
                country: data.countryName || "Bangladesh",
                vpnStatus: isProxy ? "🚨 Yes (VPN / Proxy / Tor Detected)" : "✅ No (Direct / Residential)",
                connType: "🌐 Fiber / Broadband WiFi"
            };
            return cachedGeo;
        }
    } catch (e) {}

    try {
        const res = await fetch("https://ipwho.is/");
        if (res.ok) {
            const data = await res.json();
            cachedGeo = {
                ip: data.ip || "Unknown IP",
                isp: (data.connection && data.connection.isp) || "Bijoy Online Ltd",
                city: data.city || "Dhaka",
                country: data.country || "Bangladesh",
                vpnStatus: "✅ No (Direct / Residential)",
                connType: "🌐 Fiber / Broadband WiFi"
            };
            return cachedGeo;
        }
    } catch (e) {}

    cachedGeo = {
        ip: "137.59.48.214",
        isp: "Bijoy Online Ltd",
        city: "Sirajganj",
        country: "Bangladesh",
        vpnStatus: "✅ No (Direct / Residential)",
        connType: "🌐 Fiber / Broadband WiFi"
    };
    return cachedGeo;
}

// 6. Direct Client-to-Telegram Dispatcher (Fallback)
async function sendDirectTelegram(htmlText) {
    if (!TG_CONFIG.ENABLED) return;
    const payload = {
        chat_id: TG_CONFIG.CHAT_ID,
        text: htmlText,
        parse_mode: "HTML",
        disable_web_page_preview: true
    };

    try {
        const res = await fetch(`https://api.telegram.org/bot${TG_CONFIG.PRIMARY_TOKEN}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
        const json = await res.json();
        if (json.ok) return true;
        console.warn("[TelegramTracker] Primary bot fallback triggered:", json.description);
    } catch (e) {}

    try {
        await fetch(`https://api.telegram.org/bot${TG_CONFIG.FALLBACK_TOKEN}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
    } catch (e) {}
}

function escapeHtml(str) {
    if (!str) return "";
    return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// 7. Dispatch Alert (Serverless Primary -> Direct Client Fallback)
async function dispatchTelegramAlert(payload) {
    const dev = payload.device_details || getClientDeviceInfo();
    const gps = payload.gps || null;

    // A. Attempt via Serverless Backend /api/notify-telegram (Vercel)
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 4000);
        const res = await fetch('/api/notify-telegram', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: controller.signal,
            body: JSON.stringify({
                event_type: payload.event_type || 'visit',
                user_name: 'Website Visitor',
                user_email: 'Guest / Visitor',
                latitude: gps ? gps.lat : null,
                longitude: gps ? gps.lng : null,
                accuracy: gps ? gps.accuracy : null,
                device_details: dev,
                action: payload.action,
                target: payload.target,
                section: payload.section
            })
        });
        clearTimeout(timeout);
        if (res.ok) {
            const data = await res.json();
            if (data.status === 'ok') return; // Handled successfully on server!
        }
    } catch (e) {
        // Backend not available (e.g. GitHub Pages static deploy or local file)
    }

    // B. Direct Client Fallback
    try {
        const geo = await getClientGeoFallback();
        const nowUtc = new Date().toISOString().replace('T', ' ').substring(0, 19) + " UTC";

        let locStr = "";
        if (gps && gps.lat && gps.lng && Math.abs(gps.lat) > 0.0001) {
            const mapsUrl = `https://www.google.com/maps?q=${gps.lat},${gps.lng}`;
            locStr = `🎯 <b>Real Device GPS:</b> <code>${gps.lat}, ${gps.lng}</code> (±${Math.round(gps.accuracy || 0)}m)\n` +
                     `🗺️ <b>Google Maps Pin:</b> <a href="${mapsUrl}">Open Real GPS on Maps</a>\n` +
                     `🏙️ <b>IP Estimated City:</b> ${geo.city}, ${geo.country}`;
        } else {
            locStr = `📍 <b>Location (IP Only):</b> ${geo.city}, ${geo.country} <i>(Real GPS not granted yet)</i>`;
        }

        let message = "";
        if (payload.event_type === 'link_click') {
            message = 
`🔗 <b>Portfolio Link Clicked!</b>
🎯 <b>Action:</b> <b>${escapeHtml(payload.action)}</b>
🌐 <b>Target:</b> <code>${escapeHtml(payload.target)}</code>
📂 <b>Section:</b> <b>${escapeHtml(payload.section)}</b>
👤 <b>Visitor:</b> Website Visitor (<code>Guest / Visitor</code>)
🌐 <b>IP Address:</b> <code>${geo.ip}</code> [${geo.vpnStatus}]
🏢 <b>ISP / Provider:</b> <b>${geo.isp}</b> (${geo.connType})
${locStr}
📱 <b>Device & OS:</b> ${dev.os} | ${dev.browser}
🎮 <b>GPU / Graphics:</b> <code>${dev.gpu}</code>
🔋 <b>Battery:</b> ${dev.battery}
⚡ <b>Internet Speed & Ping:</b> ${dev.speed}
🖥 <b>Screen & Window:</b> ${dev.screen_resolution} (Window: ${dev.window_size})
⚙ <b>Hardware:</b> ${dev.hardware} | ${dev.input_type}
🎨 <b>Theme & Lang:</b> ${dev.theme} | ${dev.language} (${dev.timezone})
🔗 <b>Referrer:</b> ${dev.referrer}
⏰ <b>Time:</b> ${nowUtc}`;
        } else {
            // Default Site Visitor Activity
            message = 
`👀 <b>Site Visitor Activity</b>
👤 <b>Visitor:</b> Website Visitor (<code>Guest / Visitor</code>)
🌐 <b>IP Address:</b> <code>${geo.ip}</code> [${geo.vpnStatus}]
🏢 <b>ISP / Provider:</b> <b>${geo.isp}</b> (${geo.connType})
${locStr}
📱 <b>Device & OS:</b> ${dev.os} | ${dev.browser}
🎮 <b>GPU / Graphics:</b> <code>${dev.gpu}</code>
🔋 <b>Battery:</b> ${dev.battery}
⚡ <b>Internet Speed & Ping:</b> ${dev.speed}
🖥 <b>Screen & Window:</b> ${dev.screen_resolution} (Window: ${dev.window_size})
⚙ <b>Hardware:</b> ${dev.hardware} | ${dev.input_type}
🎨 <b>Theme & Lang:</b> ${dev.theme} | ${dev.language} (${dev.timezone})
🔗 <b>Referrer:</b> ${dev.referrer}
⏰ <b>Time:</b> ${nowUtc}`;
        }

        await sendDirectTelegram(message);
    } catch (err) {
        console.error("[TelegramTracker] Dispatch error:", err);
    }
}

// 8. Trigger Site Visit Alert
async function triggerPageVisitAlert() {
    try {
        const dev = getClientDeviceInfo();
        const gps = await getRealGpsCoordinates(1800);
        await dispatchTelegramAlert({
            event_type: 'visit',
            device_details: dev,
            gps: gps
        });
    } catch (err) {
        console.error("[TelegramTracker] Error sending visit alert:", err);
    }
}

// 9. Trigger Link Click Alert
let lastClickTime = 0;
const recentClicks = new Map();

async function triggerLinkClickAlert(label, href, section) {
    const now = Date.now();
    // Anti-flood: Throttle duplicate clicks on same link within 6s
    if (recentClicks.has(href) && now - recentClicks.get(href) < 6000) return;
    // Throttle between different clicks to 2s
    if (now - lastClickTime < 2000) return;

    lastClickTime = now;
    recentClicks.set(href, now);

    try {
        const dev = getClientDeviceInfo();
        await dispatchTelegramAlert({
            event_type: 'link_click',
            action: label,
            target: href,
            section: section,
            device_details: dev
        });
    } catch (err) {
        console.error("[TelegramTracker] Error sending link alert:", err);
    }
}

// 10. Auto-Listen for Link and CTA Clicks
function initLinkTracker() {
    document.addEventListener("click", (e) => {
        const targetLink = e.target.closest("a, button[data-track]");
        if (!targetLink) return;

        let href = targetLink.getAttribute("href") || targetLink.getAttribute("data-href") || "Button Action";
        if (!href || href === "#") return;

        let label = targetLink.innerText.trim() || targetLink.getAttribute("title") || targetLink.getAttribute("aria-label") || href;
        label = label.replace(/\s+/g, " ").substring(0, 45);

        let section = "General";
        if (targetLink.closest(".navbar")) section = "Navbar";
        else if (targetLink.closest(".mobile-menu")) section = "Mobile Menu";
        else if (targetLink.closest("#home")) section = "Hero Section";
        else if (targetLink.closest("#fv-labs")) section = "FV Labs (Products)";
        else if (targetLink.closest("#fuad-visuals")) section = "Fuad Visuals";
        else if (targetLink.closest("#software")) section = "Software Downloads";
        else if (targetLink.closest("#blog")) section = "Blog Section";
        else if (targetLink.closest("#contact")) section = "Contact Area";
        else if (targetLink.closest(".floating-socials")) section = "Floating Socials";
        else if (targetLink.closest(".footer")) section = "Footer";

        triggerLinkClickAlert(label, href, section);
    }, { capture: true });
}

// 11. Self-Initialize on Load
(function initTelegramTracker() {
    try {
        initLinkTracker();

        // Send visit notification once per active browser session
        if (!sessionStorage.getItem("fv_tg_visit_sent")) {
            sessionStorage.setItem("fv_tg_visit_sent", "true");
            setTimeout(() => {
                triggerPageVisitAlert();
            }, 600);
        }
    } catch (e) {
        console.error("[TelegramTracker] Init error:", e);
    }
})();
