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

// Global cache for visitor geo info
let cachedGeo = null;

// Helper: Get Client IP & Geo Information via free ipwho.is
async function getGeoInfo() {
    if (cachedGeo) return cachedGeo;
    try {
        const res = await fetch("https://ipwho.is/", { cache: "no-store" });
        if (!res.ok) throw new Error("Geo lookup failed");
        const data = await res.json();
        cachedGeo = {
            ip: data.ip || "Unknown IP",
            isp: (data.connection && data.connection.isp) || "N/A",
            city: data.city || "N/A",
            region: data.region || "N/A",
            country: data.country || "Bangladesh",
            countryCode: data.country_code || "",
            flag: data.flag && data.flag.emoji ? data.flag.emoji : "🌐"
        };
        return cachedGeo;
    } catch (e) {
        try {
            const fallback = await fetch("https://api.ipify.org?format=json");
            const data = await fallback.json();
            cachedGeo = {
                ip: data.ip || "Unknown IP",
                isp: "N/A",
                city: "N/A",
                region: "N/A",
                country: "N/A",
                countryCode: "",
                flag: "🌐"
            };
            return cachedGeo;
        } catch (err) {
            cachedGeo = {
                ip: "Unknown IP",
                isp: "N/A",
                city: "N/A",
                region: "N/A",
                country: "N/A",
                countryCode: "",
                flag: "🌐"
            };
            return cachedGeo;
        }
    }
}

// Helper: Get Browser, OS & GPU Details
function getDeviceInfo() {
    const ua = navigator.userAgent;
    let os = "Unknown OS";
    if (ua.includes("Windows NT 10.0") || ua.includes("Windows NT 11.0")) os = "Windows 10/11";
    else if (ua.includes("Windows NT 6.3")) os = "Windows 8.1";
    else if (ua.includes("Windows NT 6.1")) os = "Windows 7";
    else if (ua.includes("Windows")) os = "Windows";
    else if (ua.includes("Mac OS X")) os = "macOS";
    else if (ua.includes("Android")) os = "Android";
    else if (ua.includes("iPhone")) os = "iPhone (iOS)";
    else if (ua.includes("iPad")) os = "iPad (iPadOS)";
    else if (ua.includes("Linux")) os = "Linux";

    let browser = "Unknown Browser";
    if (ua.includes("Edg/")) browser = "Edge";
    else if (ua.includes("Chrome/") && !ua.includes("Edg/")) browser = "Chrome";
    else if (ua.includes("Firefox/")) browser = "Firefox";
    else if (ua.includes("Safari/") && !ua.includes("Chrome/")) browser = "Safari";
    else if (ua.includes("Opera") || ua.includes("OPR/")) browser = "Opera";

    let deviceType = "Desktop";
    if (/Mobi|Android/i.test(ua)) deviceType = "Mobile";
    if (/Tablet|iPad/i.test(ua)) deviceType = "Tablet";

    let gpu = "";
    try {
        const canvas = document.createElement("canvas");
        const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
        if (gl) {
            const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");
            if (debugInfo) {
                gpu = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
            }
        }
    } catch (e) {}

    const screenRes = `${window.screen.width}x${window.screen.height}`;
    const viewport = `${window.innerWidth}x${window.innerHeight}`;
    return { os, browser, deviceType, gpu, screenRes, viewport };
}

// Persistent Visitor Fingerprint
function getVisitorIdentity() {
    let vid = localStorage.getItem("fv_visitor_id");
    let isNew = false;
    if (!vid) {
        vid = "FV-" + Math.random().toString(36).substring(2, 7).toUpperCase();
        localStorage.setItem("fv_visitor_id", vid);
        isNew = true;
    }
    let count = parseInt(localStorage.getItem("fv_visit_count") || "0", 10);
    if (!sessionStorage.getItem("fv_session_active")) {
        count += 1;
        localStorage.setItem("fv_visit_count", count.toString());
        sessionStorage.setItem("fv_session_active", "1");
    }
    return { vid, count, isNew };
}

// Format Bangladesh Local Time
function getBDTime() {
    return new Date().toLocaleString("en-US", {
        timeZone: "Asia/Dhaka",
        dateStyle: "medium",
        timeStyle: "medium"
    });
}

// Send Message with Automatic Primary -> Fallback failover
async function sendRawTelegram(htmlText) {
    if (!TG_CONFIG.ENABLED) return;
    const payload = {
        chat_id: TG_CONFIG.CHAT_ID,
        text: htmlText,
        parse_mode: "HTML",
        disable_web_page_preview: true
    };

    // 1. Try Primary Bot (@Portfoliofvlabsbot)
    try {
        const res = await fetch(`https://api.telegram.org/bot${TG_CONFIG.PRIMARY_TOKEN}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
        const json = await res.json();
        if (json.ok) return; // Successfully delivered
        console.warn("[TelegramTracker] Primary bot failed, failing over to secondary:", json.description);
    } catch (e) {
        console.warn("[TelegramTracker] Network error on primary bot:", e);
    }

    // 2. Fallback Bot (private-project-1 bot)
    try {
        await fetch(`https://api.telegram.org/bot${TG_CONFIG.FALLBACK_TOKEN}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
    } catch (e) {
        console.error("[TelegramTracker] Fallback also failed:", e);
    }
}

// Trigger: Page Visit Alert
async function triggerPageVisitAlert() {
    try {
        const geo = await getGeoInfo();
        const device = getDeviceInfo();
        const visitor = getVisitorIdentity();
        const now = getBDTime();
        const page = window.location.pathname || "/";
        const ref = document.referrer ? new URL(document.referrer).hostname : "Direct Visit";

        const message = 
`🔔 <b>Portfolio Visitor Alert!</b>

• <b>Status:</b> 👁️ Website Visited (Opened)
• <b>Visitor:</b> <code>#${visitor.vid}</code> (${visitor.isNew ? "🆕 New Visitor" : `🔄 Returning (Visit #${visitor.count})`})
• <b>IP Address:</b> <code>${geo.ip}</code> (ISP: ${geo.isp})
• <b>Location:</b> ${geo.flag} ${geo.city}, ${geo.region}, ${geo.country}
• <b>Device:</b> ${device.os} (${device.browser} on ${device.deviceType})
• <b>Screen:</b> ${device.screenRes} (Viewport: ${device.viewport})
${device.gpu ? `• <b>GPU:</b> <code>${device.gpu}</code>\n` : ""}• <b>Source:</b> <code>${ref}</code>
• <b>Page:</b> <code>${page}</code>
• <b>Time:</b> ${now}`.trim();

        await sendRawTelegram(message);
    } catch (err) {
        console.error("[TelegramTracker] Error sending visit alert:", err);
    }
}

// Trigger: Link Click Alert
let lastClickTime = 0;
const recentClicks = new Map();

async function triggerLinkClickAlert(label, href, section) {
    const nowTimestamp = Date.now();
    // Anti-flood: Throttle repeated clicks on the exact same href within 6 seconds
    if (recentClicks.has(href) && nowTimestamp - recentClicks.get(href) < 6000) {
        return;
    }
    // Global rate limit: max 1 alert per 1.5 seconds
    if (nowTimestamp - lastClickTime < 1500) {
        return;
    }
    lastClickTime = nowTimestamp;
    recentClicks.set(href, nowTimestamp);

    try {
        const geo = await getGeoInfo();
        const device = getDeviceInfo();
        const visitor = getVisitorIdentity();
        const now = getBDTime();

        const message = 
`🔗 <b>Portfolio Link Clicked!</b>

• <b>Action:</b> <b>${escapeHtml(label)}</b>
• <b>Target:</b> <code>${escapeHtml(href)}</code>
• <b>Section:</b> <b>${escapeHtml(section)}</b>
• <b>Visitor:</b> <code>#${visitor.vid}</code>
• <b>Location:</b> ${geo.flag} ${geo.city}, ${geo.country}
• <b>Device:</b> ${device.os} (${device.browser})
• <b>IP:</b> <code>${geo.ip}</code>
• <b>Time:</b> ${now}`.trim();

        await sendRawTelegram(message);
    } catch (err) {
        console.error("[TelegramTracker] Error sending link alert:", err);
    }
}

function escapeHtml(str) {
    if (!str) return "";
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Auto-Listen for All Link & CTA Clicks
function initLinkTracker() {
    document.addEventListener("click", (e) => {
        const targetLink = e.target.closest("a, button[data-track]");
        if (!targetLink) return;

        let href = targetLink.getAttribute("href") || targetLink.getAttribute("data-href") || "Button Action";
        if (!href || href === "#") return;

        // Extract friendly label
        let label = targetLink.innerText.trim() || targetLink.getAttribute("title") || targetLink.getAttribute("aria-label") || href;
        label = label.replace(/\s+/g, " ").substring(0, 40);

        // Identify Section
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

// Initialize on Load
(function initTelegramTracker() {
    try {
        initLinkTracker();

        // Send page visit once per session
        if (!sessionStorage.getItem("fv_tg_visit_sent")) {
            sessionStorage.setItem("fv_tg_visit_sent", "true");
            setTimeout(() => {
                triggerPageVisitAlert();
            }, 800);
        }
    } catch (e) {
        console.error("[TelegramTracker] Init error:", e);
    }
})();
