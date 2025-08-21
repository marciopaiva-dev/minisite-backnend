const CORS = {
  "Access-Control-Allow-Origin": "https://minisites-servicos.vercel.app", // ← seu domínio
  "Access-Control-Allow-Methods": "GET,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400"
};


export async function handler(event) {
  const method = event.httpMethod || "GET";
  if (method === "OPTIONS") {
    return { statusCode: 204, headers: CORS, body: "" };
  }
  if (method !== "GET") {
    return {
      statusCode: 405,
      headers: { ...CORS, "Content-Type": "application/json" },
      body: JSON.stringify({ ok:false, error:"Method Not Allowed" })
    };
  }
  return {
    statusCode: 200,
    headers: { ...CORS, "Content-Type": "application/json" },
    body: JSON.stringify({ ok:true, ping:"alive", platform:"netlify", now:new Date().toISOString() })
  };
}
