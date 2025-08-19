// functions/gerar.js — publica um minisite via Netlify Deploy API e retorna a URL final.
import crypto from "node:crypto";

const ALLOW_ORIGIN = "*"; // em produção, troque para o domínio do seu front
const CORS = {
  "Access-Control-Allow-Origin": ALLOW_ORIGIN,
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400"
};

const json = (code, data) => ({
  statusCode: code,
  headers: { "Content-Type": "application/json", ...CORS },
  body: JSON.stringify(data)
});
const noContent = () => ({ statusCode: 204, headers: CORS, body: "" });

const onlyDigits = (s) => String(s || "").replace(/\D+/g, "");
const sha1 = (buf) => crypto.createHash("sha1").update(buf).digest("hex");
const slugify = (s) =>
  String(s || "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "").slice(0, 60);

const buildHtml = ({ servico, descricaoCurta, whats }) => {
  const w = onlyDigits(whats);
  const wa = `https://wa.me/55${w}`;
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${servico} - MiniSite</title>
<meta name="description" content="${descricaoCurta}"/>
<style>
  body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,Cantarell,Arial,sans-serif;margin:0;background:#0f172a;color:#e2e8f0}
  .wrap{max-width:860px;margin:0 auto;padding:32px}
  .card{background:#111827;border:1px solid #1f2937;border-radius:16px;box-shadow:0 10px 30px rgba(0,0,0,.35);padding:28px}
  h1{font-size:28px;margin:0 0 8px}
  p.lead{font-size:18px;margin:0 0 20px;color:#cbd5e1}
  .cta{display:inline-block;padding:14px 18px;border-radius:12px;text-decoration:none;background:#22c55e;color:#052e10;font-weight:600}
  footer{margin-top:24px;color:#94a3b8;font-size:12px}
</style>
</head>
<body>
  <div class="wrap">
    <div class="card">
      <h1>${servico}</h1>
      <p class="lead">${descricaoCurta}</p>
      <a class="cta" href="${wa}" target="_blank" rel="noopener">Falar no WhatsApp</a>
      <footer>MiniSite gerado automaticamente • ${new Date().toLocaleString("pt-BR")}</footer>
    </div>
  </div>
</body>
</html>`;
};

// --- Netlify API helpers ---
async function apiGet(path, token) {
  const r = await fetch(`https://api.netlify.com/api/v1${path}`, {
    headers: { Authorization: `Bearer ${token}`, "User-Agent": "MiniSite-Automator" }
  });
  const t = await r.text();
  if (!r.ok) throw new Error(`${r.status} ${r.statusText} — ${t}`);
  return t ? JSON.parse(t) : {};
}

async function createDeploy({ siteRef, token, filesShaMap }) {
  const r = await fetch(`https://api.netlify.com/api/v1/sites/${siteRef}/deploys`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "User-Agent": "MiniSite-Automator"
    },
    body: JSON.stringify({ files: filesShaMap, draft: false })
  });
  const t = await r.text();
  if (!r.ok) throw new Error(`Falha ao criar deploy: ${r.status} ${r.statusText} — ${t}`);
  return t ? JSON.parse(t) : {};
}

async function uploadFile({ deployId, token, path, content }) {
  const safe = path.startsWith("/") ? path.slice(1) : path;
  const r = await fetch(`https://api.netlify.com/api/v1/deploys/${deployId}/files/${encodeURI(safe)}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/octet-stream",
      "User-Agent": "MiniSite-Automator"
    },
    body: content
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`Falha ao enviar ${path}: ${r.status} ${r.statusText} — ${t}`);
  }
}

export async function handler(event) {
  const method = event.httpMethod || "GET";
  if (method === "OPTIONS") return noContent();
  if (method === "GET") return json(200, { ok: true, service: "gerar", now: new Date().toISOString() });
  if (method !== "POST") return json(405, { ok: false, error: "Method Not Allowed" });

  try {
    const token = process.env.NETLIFY_AUTH_TOKEN || "";
    const siteId = process.env.SITE_BASE_ID || "";
    const siteName = process.env.SITE_NAME || "";
    const siteRef = siteId || siteName;
    if (!token || !siteRef) {
      return json(500, { ok: false, error: "Faltam NETLIFY_AUTH_TOKEN e SITE_BASE_ID (ou SITE_NAME)" });
    }

    // sanity-check
    try { await apiGet(`/user`, token); } catch (e) {
      return json(401, { ok: false, error: "Token inválido/sem acesso (GET /user falhou)", detail: String(e) });
    }
    try { await apiGet(`/sites/${encodeURIComponent(siteRef)}`, token); } catch (e) {
      return json(401, { ok: false, error: "Site não encontrado/sem acesso (GET /sites/:ref falhou)", detail: String(e), ref: siteRef });
    }

    // body
    const data = event.body ? JSON.parse(event.body) : {};
    const servico = (data.servico || "").trim();
    const descricaoCurta = (data.descricaoCurta || "").trim();
    const whats = (data.whats || "").trim();
    if (!servico || !descricaoCurta || !whats) {
      return json(400, { ok: false, error: "Campos obrigatórios ausentes" });
    }

    // conteúdo e caminho
    const htmlBuf = Buffer.from(buildHtml({ servico, descricaoCurta, whats }), "utf8");
    const slug = slugify(servico);
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    const folder = `/minisites/${slug}-${ts}`;

    const files = { [`${folder}/index.html`]: { sha: sha1(htmlBuf), content: htmlBuf } };

    // cria deploy
    const filesShaMap = Object.fromEntries(Object.entries(files).map(([p, v]) => [p, v.sha]));
    const deploy = await createDeploy({ siteRef, token, filesShaMap });

    // envia requeridos
    const need = new Set(deploy.required || []);
    const bySha = new Map(Object.entries(files).map(([p, v]) => [v.sha, { path: p, content: v.content }]));
    for (const sh of need) {
      const item = bySha.get(sh);
      if (item) await uploadFile({ deployId: deploy.id, token, path: item.path, content: item.content });
    }

    // aguarda ficar pronto
    let finalDeploy = deploy;
    for (let i = 0; i < 8; i++) {
      await new Promise((r) => setTimeout(r, 800));
      finalDeploy = await apiGet(`/deploys/${deploy.id}`, token);
      if (finalDeploy.state === "ready") break;
    }

    const publicBase =
      process.env.URL ||
      finalDeploy?.ssl_url ||
      finalDeploy?.url ||
      finalDeploy?.deploy_ssl_url ||
      finalDeploy?.deploy_url || null;

    const previewUrl = publicBase ? `${publicBase}${folder}/index.html` : null;

    return json(200, {
      ok: true,
      mensagem: "MiniSite publicado",
      urlFinal: previewUrl,
      outputs: { previewUrl, docxUrl: null },
      deploy: { id: finalDeploy.id, state: finalDeploy.state, base: publicBase }
    });

  } catch (err) {
    console.error("ERRO gerar:", err);
    return json(500, { ok: false, error: String(err) });
  }
}
