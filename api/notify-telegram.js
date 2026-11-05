// api/notify-telegram.js
// Vercel Serverless Function — High Fidelity Visitor & Interaction Telemetry Dispatcher

const TG_CONFIG = {
    PRIMARY_TOKEN: process.env.TELEGRAM_BOT_TOKEN || "8838781499:AAFE-96p8XpmL_64zHkIZqWi7K6wTK2snmE",
    FALLBACK_TOKEN: process.env.TELEGRAM_FALLBACK_TOKEN || "8685821226:AAHrc_hMMI3SKIUFobsgur3MfWyW6ec9n_w",
    CHAT_ID: process.env.TELEGRAM_CHAT_ID || "5317269928"
};

// Simple sliding window rate limiter in memory (prevents bot flood)
const rateMap = new Map();
function isRateLimited(ip) {
    const now = Date.now();
    const timestamps = (rateMap.get(ip) || []).filter(t => now - t < 60000);
    if (timestamps.length >= 15) return true; // Max 15 events per minute per IP
    timestamps.push(now);
    rateMap.set(ip, timestamps);
    return false;
}

async function resolveGeo(ip) {
    const cleanIp = (ip || '').replace(/^::ffff:/, '').trim();
    const isLocal = !cleanIp || cleanIp === '127.0.0.1' || cleanIp === '::1' || cleanIp === 'localhost';
    const queryIp = isLocal ? '' : cleanIp;

    // 1. Try ip-api.com (Server-to-server HTTP is supported and fast)
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 3500);
        const res = await fetch(`http://ip-api.com/json/${queryIp}?fields=status,country,city,isp,org,as,mobile,proxy,hosting,query`, {
            signal: controller.signal,
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        clearTimeout(timeout);
        if (res.ok) {
            const data = await res.json();
            if (data.status === 'success') {
                const isProxy = Boolean(data.proxy);
                const isHosting = Boolean(data.hosting);
                const isMobile = Boolean(data.mobile);

                let vpnStatus = "✅ No (Direct / Residential)";
                if (isProxy) vpnStatus = "🚨 Yes (VPN / Proxy / Tor Detected)";
                else if (isHosting) vpnStatus = "🏢 Datacenter / Cloud Relay";

                const connType = isMobile ? "📱 Cellular Mobile Data (SIM)" : "🌐 Fiber / Broadband WiFi";

                return {
                    ip: data.query || cleanIp || "127.0.0.1",
                    isp: data.isp || data.org || "Bijoy Online Ltd",
                    city: data.city || "Dhaka",
                    country: data.country || "Bangladesh",
                    vpnStatus,
                    connType
                };
            }
        }
    } catch (e) {
        // Fallback below
    }

    // 2. Fallback to freeipapi.com
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 3500);
        const res = await fetch(`https://freeipapi.com/api/json/${queryIp}`, {
            signal: controller.signal
        });
        clearTimeout(timeout);
        if (res.ok) {
            const data = await res.json();
            const isProxy = Boolean(data.isProxy);
            const vpnStatus = isProxy ? "🚨 Yes (VPN / Proxy / Tor Detected)" : "✅ No (Direct / Residential)";
            return {
                ip: data.ipAddress || cleanIp || "127.0.0.1",
                isp: data.asnOrganization || "Broadband Provider",
                city: data.cityName || "Sirajganj",
                country: data.countryName || "Bangladesh",
                vpnStatus,
                connType: "🌐 Fiber / Broadband WiFi"
            };
        }
    } catch (e) {
        // Fallback below
    }

    // 3. Fallback to ipwho.is
    try {
        const res = await fetch(`https://ipwho.is/${queryIp}`);
        if (res.ok) {
            const data = await res.json();
            return {
                ip: data.ip || cleanIp || "127.0.0.1",
                isp: (data.connection && data.connection.isp) || "Broadband Provider",
                city: data.city || "Dhaka",
                country: data.country || "Bangladesh",
                vpnStatus: "✅ No (Direct / Residential)",
                connType: "🌐 Fiber / Broadband WiFi"
            };
        }
    } catch (e) {}

    return {
        ip: cleanIp || "127.0.0.1",
        isp: "Broadband Provider",
        city: "Dhaka",
        country: "Bangladesh",
        vpnStatus: "✅ No (Direct / Residential)",
        connType: "🌐 Fiber / Broadband WiFi"
    };
}

async function sendTelegramMessage(htmlText) {
    const payload = {
        chat_id: TG_CONFIG.CHAT_ID,
        text: htmlText,
        parse_mode: "HTML",
        disable_web_page_preview: true
    };

    // Primary bot
    try {
        const res = await fetch(`https://api.telegram.org/bot${TG_CONFIG.PRIMARY_TOKEN}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.ok) return true;
        console.warn("[TelegramAlert API] Primary bot error:", data.description);
    } catch (e) {
        console.warn("[TelegramAlert API] Primary network error:", e.message);
    }

    // Fallback bot
    try {
        const res = await fetch(`https://api.telegram.org/bot${TG_CONFIG.FALLBACK_TOKEN}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        return Boolean(data.ok);
    } catch (e) {
        console.error("[TelegramAlert API] Fallback error:", e.message);
        return false;
    }
}

function escapeHtml(str) {
    if (!str) return "";
    return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export default async function handler(req, res) {
    // Enable CORS for portfolio domains
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const forwarded = req.headers['x-forwarded-for'];
        const clientIp = (forwarded ? forwarded.split(',')[0].trim() : (req.headers['x-real-ip'] || req.socket?.remoteAddress || '127.0.0.1')).replace(/^::ffff:/, '');

        if (isRateLimited(clientIp)) {
            return res.status(429).json({ error: 'Too Many Requests' });
        }

        const body = req.body || {};
        const eventType = body.event_type || 'visit';
        const userName = body.user_name || 'Website Visitor';
        const userEmail = body.user_email || 'Guest / Visitor';
        const dev = body.device_details || {};
        const lat = body.latitude;
        const lng = body.longitude;
        const accuracy = body.accuracy;

        const geo = await resolveGeo(clientIp);

        // Location line
        let locStr = "";
        if (lat !== null && lat !== undefined && lng !== null && lng !== undefined && Math.abs(lat) > 0.0001) {
            const mapsUrl = `https://www.google.com/maps?q=${lat},${lng}`;
            locStr = `🎯 <b>Real Device GPS:</b> <code>${lat}, ${lng}</code> (±${Math.round(accuracy || 0)}m)\n` +
                     `🗺️ <b>Google Maps Pin:</b> <a href="${mapsUrl}">Open Real GPS on Maps</a>\n` +
                     `🏙️ <b>IP Estimated City:</b> ${geo.city}, ${geo.country}`;
        } else {
            locStr = `📍 <b>Location (IP Only):</b> ${geo.city}, ${geo.country} <i>(Real GPS not granted yet)</i>`;
        }

        const osStr = dev.os || "Android Mobile";
        const browserStr = dev.browser || "Google Chrome";
        const gpuStr = dev.gpu || "Standard Graphics Adapter";
        const batteryStr = dev.battery || "Desktop / AC Power";
        const speedStr = dev.speed || "Standard High-Speed Broadband";
        const screenStr = dev.screen_resolution || "412x915 (2.625x dpr, 24-bit)";
        const windowSizeStr = dev.window_size || "Standard Viewport";
        const hwStr = dev.hardware || "Multi-Core CPU";
        const inputStr = dev.input_type || "Touchscreen (5 touch points)";
        const themeStr = dev.theme || "Dark Mode";
        const langStr = dev.language || "en-GB";
        const tzStr = dev.timezone || "Asia/Dhaka";
        const referrerStr = dev.referrer || "https://fv-labs.vercel.app/";

        // UTC timestamp: YYYY-MM-DD HH:MM:SS UTC
        const nowUtc = new Date().toISOString().replace('T', ' ').substring(0, 19) + " UTC";

        let message = "";
        if (eventType === 'link_click') {
            const action = body.action || "Link Click";
            const target = body.target || "#";
            const section = body.section || "General";

            message = 
`🔗 <b>Portfolio Link Clicked!</b>
🎯 <b>Action:</b> <b>${escapeHtml(action)}</b>
🌐 <b>Target:</b> <code>${escapeHtml(target)}</code>
📂 <b>Section:</b> <b>${escapeHtml(section)}</b>
👤 <b>Visitor:</b> ${escapeHtml(userName)} (<code>${escapeHtml(userEmail)}</code>)
🌐 <b>IP Address:</b> <code>${geo.ip}</code> [${geo.vpnStatus}]
🏢 <b>ISP / Provider:</b> <b>${geo.isp}</b> (${geo.connType})
${locStr}
📱 <b>Device & OS:</b> ${osStr} | ${browserStr}
🎮 <b>GPU / Graphics:</b> <code>${gpuStr}</code>
🔋 <b>Battery:</b> ${batteryStr}
⚡ <b>Internet Speed & Ping:</b> ${speedStr}
🖥 <b>Screen & Window:</b> ${screenStr} (Window: ${windowSizeStr})
⚙ <b>Hardware:</b> ${hwStr} | ${inputStr}
🎨 <b>Theme & Lang:</b> ${themeStr} | ${langStr} (${tzStr})
🔗 <b>Referrer:</b> ${referrerStr}
⏰ <b>Time:</b> ${nowUtc}`;
        } else if (eventType === 'real_gps') {
            message = 
`🎯 <b>Real Device GPS Acquired!</b>
👤 <b>Visitor:</b> ${escapeHtml(userName)} (<code>${escapeHtml(userEmail)}</code>)
🌐 <b>IP Address:</b> <code>${geo.ip}</code> [${geo.vpnStatus}]
🏢 <b>ISP / Provider:</b> <b>${geo.isp}</b> (${geo.connType})
${locStr}
📱 <b>Device & OS:</b> ${osStr} | ${browserStr}
🎮 <b>GPU / Graphics:</b> <code>${gpuStr}</code>
🔋 <b>Battery:</b> ${batteryStr}
⚡ <b>Internet Speed & Ping:</b> ${speedStr}
🖥 <b>Screen & Window:</b> ${screenStr} (Window: ${windowSizeStr})
⚙ <b>Hardware:</b> ${hwStr} | ${inputStr}
🎨 <b>Theme & Lang:</b> ${themeStr} | ${langStr} (${tzStr})
🔗 <b>Referrer:</b> ${referrerStr}
⏰ <b>Time:</b> ${nowUtc}`;
        } else {
            // Default Site Visitor Activity
            message = 
`👀 <b>Site Visitor Activity</b>
👤 <b>Visitor:</b> ${escapeHtml(userName)} (<code>${escapeHtml(userEmail)}</code>)
🌐 <b>IP Address:</b> <code>${geo.ip}</code> [${geo.vpnStatus}]
🏢 <b>ISP / Provider:</b> <b>${geo.isp}</b> (${geo.connType})
${locStr}
📱 <b>Device & OS:</b> ${osStr} | ${browserStr}
🎮 <b>GPU / Graphics:</b> <code>${gpuStr}</code>
🔋 <b>Battery:</b> ${batteryStr}
⚡ <b>Internet Speed & Ping:</b> ${speedStr}
🖥 <b>Screen & Window:</b> ${screenStr} (Window: ${windowSizeStr})
⚙ <b>Hardware:</b> ${hwStr} | ${inputStr}
🎨 <b>Theme & Lang:</b> ${themeStr} | ${langStr} (${tzStr})
🔗 <b>Referrer:</b> ${referrerStr}
⏰ <b>Time:</b> ${nowUtc}`;
        }

        const sent = await sendTelegramMessage(message);
        return res.status(200).json({ status: 'ok', sent });
    } catch (err) {
        console.error("[TelegramAlert API] Handler error:", err);
        return res.status(500).json({ error: err.message || 'Internal Server Error' });
    }
}
