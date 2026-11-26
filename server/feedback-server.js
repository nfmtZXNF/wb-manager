// 反馈接收服务（跑在你的 VPS 上）
// 功能：接收扩展发来的反馈（文字/日志/图片）→ 存文件 → 网页端查看，可标记已完成
// 零第三方依赖，Node.js >= 18 即可。
// 配置：同目录下放 config.json（参考 config.example.json）
const fs = require("fs");
const http = require("http");
const path = require("path");
const crypto = require("crypto");

// ---------- 配置 ----------
const CONFIG_PATH = path.join(__dirname, "config.json");
if (!fs.existsSync(CONFIG_PATH)) {
  console.error(
    "缺少 config.json！请复制 config.example.json 为 config.json 并填写后再启动。",
  );
  process.exit(1);
}
const config = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
const TOKEN = String(config.token || "");
const HTTP_PORT = Number(config.httpPort || 8437);
const DATA_DIR = path.join(__dirname, "data");
fs.mkdirSync(DATA_DIR, { recursive: true });
if (!TOKEN || TOKEN.length < 16) {
  console.error("config.json 里的 token 太短了，请设置一个至少 16 位的随机串。");
  process.exit(1);
}

// ---------- 工具 ----------
const json = (res, code, obj) => {
  res.writeHead(code, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, x-feedback-token",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  });
  res.end(JSON.stringify(obj));
};
const sanitizeName = (s) =>
  String(s || "")
    .replace(/[^\w.一-龥-]+/g, "_")
    .slice(0, 60);

// 简单限速：每个 IP 每分钟最多 5 条反馈（只在内存里判断，不落盘）
const rateMap = new Map();
const rateLimited = (ip) => {
  const now = Date.now();
  const rec = rateMap.get(ip) || [];
  const recent = rec.filter((t) => now - t < 60_000);
  if (recent.length >= 5) return true;
  recent.push(now);
  rateMap.set(ip, recent);
  return false;
};

// 回复查询限速宽松些：每个 IP 每分钟 60 次
const replyRateMap = new Map();
const replyRateLimited = (ip) => {
  const now = Date.now();
  const rec = replyRateMap.get(ip) || [];
  const recent = rec.filter((t) => now - t < 60_000);
  if (recent.length >= 60) return true;
  recent.push(now);
  replyRateMap.set(ip, recent);
  return false;
};

// ---------- 反馈保存 ----------
const saveFeedback = (fb) => {
  const ts = new Date();
  const stamp = ts
    .toISOString()
    .replace(/[:T]/g, "-")
    .replace(/\..+/, "");
  const dir = path.join(DATA_DIR, stamp.slice(0, 10));
  fs.mkdirSync(dir, { recursive: true });
  const base = path.join(dir, `${stamp}_${sanitizeName(fb.type)}`);
  const savedImages = [];
  (Array.isArray(fb.images) ? fb.images : []).slice(0, 3).forEach((img, i) => {
    try {
      const m = String(img.data || "").match(/^data:image\/(\w+);base64,(.+)$/);
      if (!m) return;
      const ext = m[1] === "jpeg" ? "jpg" : sanitizeName(m[1]);
      const buf = Buffer.from(m[2], "base64");
      if (buf.length > 3 * 1024 * 1024) return; // 单张超 3MB 丢弃
      const fname = `${path.basename(base)}_img${i + 1}.${ext}`;
      fs.writeFileSync(path.join(dir, fname), buf);
      savedImages.push(`${stamp.slice(0, 10)}/${fname}`);
    } catch (e) {}
  });
  const record = {
    id: crypto.randomBytes(8).toString("hex"), // 随机 ID 即取件凭证，只发给发送者
    time: ts.toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" }),
    type: fb.type,
    desc: String(fb.desc || "").slice(0, 5000),
    env: fb.env || {},
    logs: String(fb.logs || "").slice(0, 20000),
    images: savedImages,
    done: false,
    reply: null,
  };
  fs.writeFileSync(`${base}.json`, JSON.stringify(record, null, 2), "utf8");
  return record;
};

// 给某条反馈写/更新回复（管理端）
const saveReply = (rel, text) => {
  const abs = path.join(DATA_DIR, path.normalize(String(rel || "")));
  if (!abs.startsWith(DATA_DIR) || !fs.existsSync(abs) || !abs.endsWith(".json"))
    return null;
  const r = JSON.parse(fs.readFileSync(abs, "utf8"));
  if (!r.id) return null; // 早期反馈没有 ID，无法定向回复
  r.reply = {
    text: String(text || "").slice(0, 2000),
    time: new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" }),
    ts: Date.now(),
  };
  fs.writeFileSync(abs, JSON.stringify(r, null, 2), "utf8");
  return r.reply;
};

// 按随机 ID 查回复（无需管理令牌——ID 本身就是凭证，只有发送者持有）
const getRepliesByIds = (ids) => {
  const out = {};
  if (!ids.length) return out;
  const want = new Set(ids);
  const days = fs
    .readdirSync(DATA_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);
  for (const day of days) {
    const dir = path.join(DATA_DIR, day);
    for (const f of fs.readdirSync(dir).filter((f) => f.endsWith(".json"))) {
      try {
        const r = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
        if (r && r.id && want.has(r.id) && r.reply) {
          out[r.id] = {
            text: r.reply.text,
            time: r.reply.time,
            ts: r.reply.ts || 0,
            fbTime: r.time || "",
            desc: String(r.desc || "").slice(0, 80),
          };
        }
      } catch (e) {}
    }
  }
  return out;
};

// 删除某条反馈（连同配图一起删）
const deleteFeedback = (rel) => {
  const abs = path.join(DATA_DIR, path.normalize(String(rel || "")));
  if (!abs.startsWith(DATA_DIR) || !fs.existsSync(abs) || !abs.endsWith(".json"))
    return false;
  try {
    fs.unlinkSync(abs);
  } catch (e) {
    return false;
  }
  const dir = path.dirname(abs);
  const base = path.basename(abs, ".json");
  for (const f of fs.readdirSync(dir)) {
    if (f.startsWith(`${base}_img`)) {
      try {
        fs.unlinkSync(path.join(dir, f));
      } catch (e) {}
    }
  }
  return true;
};

// 切换某条反馈的「已完成」状态
const toggleDone = (rel) => {
  const abs = path.join(DATA_DIR, path.normalize(String(rel || "")));
  if (!abs.startsWith(DATA_DIR) || !fs.existsSync(abs) || !abs.endsWith(".json"))
    return null;
  const r = JSON.parse(fs.readFileSync(abs, "utf8"));
  r.done = !r.done;
  fs.writeFileSync(abs, JSON.stringify(r, null, 2), "utf8");
  return r.done;
};

// ---------- 查看页 ----------
const esc = (s) =>
  String(s == null ? "" : s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
      c
    ],
  );

const renderListPage = () => {
  const rows = [];
  const days = fs
    .readdirSync(DATA_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort()
    .reverse()
    .slice(0, 14);
  for (const day of days) {
    const dir = path.join(DATA_DIR, day);
    for (const f of fs.readdirSync(dir).filter((f) => f.endsWith(".json"))) {
      try {
        const r = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
        rows.push({ ...r, file: `${day}/${f}` });
      } catch (e) {}
    }
  }
  // 未完成的排前面，各自按时间倒序
  rows.sort((a, b) =>
    a.done === b.done ? (a.time < b.time ? 1 : -1) : a.done ? 1 : -1,
  );
  const undone = rows.filter((r) => !r.done).length;
  const items = rows
    .slice(0, 100)
    .map(
      (r) => `<div class="fb ${r.done ? "done" : ""}">
      <div class="fb-head">
        <b>[${esc(r.type)}]</b> ${esc(r.time)}
        <button class="donebtn" data-file="${esc(r.file)}">${r.done ? "恢复" : "标记完成"}</button>
        <button class="delbtn" data-file="${esc(r.file)}">删除</button>
      </div>
      <div style="margin:6px 0;white-space:pre-wrap;">${esc(r.desc)}</div>
      <div style="font-size:12px;color:#888;">扩展 ${esc(r.env && r.env.version)} · 酒馆 ${esc(r.env && r.env.tavernVersion)} · 酒馆助手 ${esc(r.env && r.env.thVersion ? "v" + r.env.thVersion : "未检测到")}</div>
      ${r.images.map((p) => `<a href="/file?token=${TOKEN}&p=${encodeURIComponent(p)}" target="_blank">图片</a>`).join(" ")}
      <details><summary>日志</summary><pre style="font-size:11px;white-space:pre-wrap;">${esc(r.logs)}</pre></details>
      ${
        r.id
          ? `<div class="replybox">
        <div style="font-size:11px;color:#777;">ID: ${esc(r.id)}</div>
        ${
          r.reply
            ? `<div style="font-size:12px;color:#9ecf9e;margin:4px 0;">已回复（${esc(r.reply.time)}）：${esc(r.reply.text)}</div>`
            : ""
        }
        <div style="display:flex;gap:6px;margin-top:4px;">
          <input class="replytext" data-file="${esc(r.file)}" placeholder="回复该用户（对方会在自己的酒馆里看到）" value="${r.reply ? esc(r.reply.text) : ""}">
          <button class="replybtn" data-file="${esc(r.file)}">${r.reply ? "更新回复" : "回复"}</button>
        </div>
      </div>`
          : `<div style="font-size:11px;color:#666;margin-top:6px;">（早期反馈，无 ID，无法回复）</div>`
      }
    </div>`,
    )
    .join("\n");
  return `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <title>反馈箱</title><style>
  body { max-width:720px; margin:20px auto; font-family:sans-serif; background:#222; color:#ddd; padding:0 12px; }
  .fb { border:1px solid #555; border-radius:8px; padding:12px; margin:10px 0; }
  .fb.done { opacity:0.4; }
  .fb-head { display:flex; align-items:center; gap:8px; }
  .donebtn { margin-left:auto; padding:4px 12px; border-radius:6px; border:1px solid #888; background:transparent; color:#ddd; cursor:pointer; font-size:12px; }
  .donebtn:hover { background:#444; }
  .delbtn { padding:4px 12px; border-radius:6px; border:1px solid #a66; background:transparent; color:#e08a8a; cursor:pointer; font-size:12px; }
  .delbtn:hover { background:#433; }
  .replybox { margin-top:8px; border-top:1px dashed #555; padding-top:6px; }
  .replytext { flex:1; padding:5px 8px; border-radius:6px; border:1px solid #666; background:#1a1a1a; color:#ddd; font-size:12px; }
  .replybtn { padding:4px 14px; border-radius:6px; border:1px solid #7a9; background:transparent; color:#9ecf9e; cursor:pointer; font-size:12px; }
  .replybtn:hover { background:#344; }
  a { color:#7ab3ff; }
  </style><body>
  <h2>全局世界书管理 · 反馈箱（${undone} 条待处理 / 共 ${rows.length} 条）</h2>
  ${items || "<p>还没有反馈~</p>"}
  <script>
  document.querySelectorAll(".donebtn").forEach(function (btn) {
    btn.onclick = async function () {
      btn.disabled = true;
      try {
        await fetch("/done", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: ${JSON.stringify(TOKEN)}, file: btn.dataset.file }),
        });
      } catch (e) {}
      location.reload();
    };
  });
  document.querySelectorAll(".delbtn").forEach(function (btn) {
    btn.onclick = async function () {
      if (!confirm("确定删除这条反馈？（连同配图一起删，不可恢复）")) return;
      btn.disabled = true;
      try {
        await fetch("/delete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: ${JSON.stringify(TOKEN)}, file: btn.dataset.file }),
        });
      } catch (e) {}
      location.reload();
    };
  });
  document.querySelectorAll(".replybtn").forEach(function (btn) {
    btn.onclick = async function () {
      var input = document.querySelector('.replytext[data-file="' + btn.dataset.file + '"]');
      var text = ((input && input.value) || "").trim();
      if (!text) { alert("先写点回复内容再发~"); return; }
      btn.disabled = true;
      try {
        await fetch("/reply", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: ${JSON.stringify(TOKEN)}, file: btn.dataset.file, text: text }),
        });
      } catch (e) {}
      location.reload();
    };
  });
  </script>
  </body>`;
};

// ---------- HTTP 服务 ----------
const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://localhost");
  if (req.method === "OPTIONS") return json(res, 204, {});

  // 切换完成状态
  if (req.method === "POST" && url.pathname === "/done") {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      try {
        const { token, file } = JSON.parse(body || "{}");
        if (token !== TOKEN) return json(res, 403, { ok: false });
        const done = toggleDone(file);
        if (done === null) return json(res, 404, { ok: false });
        json(res, 200, { ok: true, done });
      } catch (e) {
        json(res, 400, { ok: false });
      }
    });
    return;
  }

  // 写/更新回复（管理端）
  if (req.method === "POST" && url.pathname === "/reply") {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      try {
        const { token, file, text } = JSON.parse(body || "{}");
        if (token !== TOKEN) return json(res, 403, { ok: false });
        const reply = saveReply(file, text);
        if (reply === null) return json(res, 404, { ok: false });
        console.log("已回复反馈:", file);
        json(res, 200, { ok: true });
      } catch (e) {
        json(res, 400, { ok: false });
      }
    });
    return;
  }

  // 删除反馈（管理端，连同配图）
  if (req.method === "POST" && url.pathname === "/delete") {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      try {
        const { token, file } = JSON.parse(body || "{}");
        if (token !== TOKEN) return json(res, 403, { ok: false });
        if (!deleteFeedback(file)) return json(res, 404, { ok: false });
        console.log("已删除反馈:", file);
        json(res, 200, { ok: true });
      } catch (e) {
        json(res, 400, { ok: false });
      }
    });
    return;
  }

  // 按随机 ID 查回复（发送者专用，ID 即凭证）
  if (req.method === "GET" && url.pathname === "/replies") {
    const ip = req.socket.remoteAddress || "";
    if (replyRateLimited(ip))
      return json(res, 429, { ok: false, error: "rate limited" });
    const ids = String(url.searchParams.get("ids") || "")
      .split(",")
      .map((s) => s.trim())
      .filter((s) => /^[0-9a-f]{16}$/.test(s))
      .slice(0, 30);
    return json(res, 200, { ok: true, replies: getRepliesByIds(ids) });
  }

  // 查看页与图片文件（需要 token）
  if (req.method === "GET" && url.pathname === "/") {
    if (url.searchParams.get("token") !== TOKEN)
      return json(res, 403, { ok: false });
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    return res.end(renderListPage());
  }
  if (req.method === "GET" && url.pathname === "/file") {
    if (url.searchParams.get("token") !== TOKEN)
      return json(res, 403, { ok: false });
    const rel = path.normalize(String(url.searchParams.get("p") || ""));
    const abs = path.join(DATA_DIR, rel);
    if (!abs.startsWith(DATA_DIR) || !fs.existsSync(abs))
      return json(res, 404, { ok: false });
    return fs.createReadStream(abs).pipe(res);
  }

  // 接收反馈
  if (req.method === "POST" && url.pathname === "/feedback") {
    if (req.headers["x-feedback-token"] !== TOKEN)
      return json(res, 403, { ok: false, error: "bad token" });
    const ip = req.socket.remoteAddress || "";
    if (rateLimited(ip))
      return json(res, 429, { ok: false, error: "rate limited" });
    let size = 0;
    const chunks = [];
    req.on("data", (c) => {
      size += c.length;
      if (size > 10 * 1024 * 1024) {
        json(res, 413, { ok: false, error: "too large" });
        req.destroy();
      } else chunks.push(c);
    });
    req.on("end", () => {
      try {
        const fb = JSON.parse(Buffer.concat(chunks).toString("utf8"));
        const record = saveFeedback(fb);
        json(res, 200, { ok: true, id: record.id });
        console.log("收到反馈:", record.type, record.time, "ID:", record.id);
      } catch (e) {
        json(res, 400, { ok: false, error: "bad json" });
      }
    });
    return;
  }

  json(res, 404, { ok: false });
});

server.listen(HTTP_PORT, () => {
  console.log(`反馈接收服务已启动：`);
  console.log(`  接收接口: http://0.0.0.0:${HTTP_PORT}/feedback`);
  console.log(`  查看页面: http://你的IP:${HTTP_PORT}/?token=你的TOKEN`);
});
