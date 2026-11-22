const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization"
};

const PROFILES_KEY = "profiles.json";

function json(body, status = 200, headers = {}) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json", ...headers }
    });
}

async function readProfiles(env) {
    const obj = await env.BUCKET.get(PROFILES_KEY);
    if (!obj) return {};
    try {
        return JSON.parse(await obj.text());
    } catch {
        return {};
    }
}

export default {
    async fetch(request, env) {
        if (request.method === "OPTIONS") {
            return new Response(null, { headers: corsHeaders });
        }

        const url = new URL(request.url);

        if (request.method === "GET" && (url.pathname === "/profiles" || url.pathname === "/profiles.json")) {
            const profiles = await readProfiles(env);
            return json(profiles, 200, { "Cache-Control": "no-store" });
        }

        if (request.method === "POST" && url.pathname === "/save") {
            let body;
            try {
                body = await request.json();
            } catch {
                return json({ error: "Invalid JSON body" }, 400);
            }

            const { userId, avatarDecoration, profileEffect, profileFrame, nameplate, displayNameStyle } = body;
            if (!userId) {
                return json({ error: "Missing userId" }, 400);
            }

            const profiles = await readProfiles(env);
            profiles[userId] = {
                avatarDecoration: avatarDecoration || null,
                profileEffect: profileEffect || null,
                profileFrame: profileFrame || null,
                nameplate: nameplate || null,
                displayNameStyle: displayNameStyle || null,
                updatedAt: Date.now()
            };

            await env.BUCKET.put(PROFILES_KEY, JSON.stringify(profiles), {
                httpMetadata: { contentType: "application/json" }
            });

            return json({ success: true, profile: profiles[userId] });
        }

        const key = url.pathname.slice(1);
        if (!key) {
            return new Response("Not found", { status: 404, headers: corsHeaders });
        }

        const file = await env.BUCKET.get(key);
        if (!file) {
            return new Response("Not found", { status: 404, headers: corsHeaders });
        }

        return new Response(file.body, {
            headers: {
                ...corsHeaders,
                "Content-Type": file.httpMetadata?.contentType || "application/octet-stream"
            }
        });
    }
};
