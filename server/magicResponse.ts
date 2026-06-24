/** Minimal branded HTML page returned to the browser after a magic-link action. */
export function magicPage(opts: {
  title: string;
  message: string;
  ok: boolean;
  openInAppUrl?: string;
  status?: number;
}): Response {
  const accent = opts.ok ? "#16a34a" : "#dc2626";
  const cta = opts.openInAppUrl
    ? `<a href="${opts.openInAppUrl}" style="display:inline-block;margin-top:20px;padding:11px 20px;border-radius:8px;background:#111827;color:#fff;text-decoration:none;font-weight:600">Open ReplyPilot →</a>`
    : "";
  const html = `<!doctype html><html><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${opts.title}</title></head>
<body style="margin:0;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;background:#f9fafb;color:#111827">
  <div style="max-width:480px;margin:80px auto;padding:32px;background:#fff;border:1px solid #e5e7eb;border-radius:16px;text-align:center">
    <div style="width:48px;height:48px;border-radius:50%;background:${accent}1a;color:${accent};font-size:24px;line-height:48px;margin:0 auto 16px">${
      opts.ok ? "✓" : "!"
    }</div>
    <h1 style="margin:0 0 8px;font-size:20px">${opts.title}</h1>
    <p style="margin:0;color:#6b7280">${opts.message}</p>
    ${cta}
  </div>
</body></html>`;
  return new Response(html, {
    status: opts.status ?? (opts.ok ? 200 : 400),
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}
