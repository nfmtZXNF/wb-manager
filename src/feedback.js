// 反馈通道：报错日志仅在本地收集，用户主动反馈时才发出
import { getLocalVersion } from "./update-check.js";

// ====== 反馈直连配置 ======
const FEEDBACK_API = "http://43.159.58.45:8437"; // VPS 反馈直连地址
const FEEDBACK_TOKEN = "4a3d80e2e77ce903595b61bc0b08cf0d8579";
const FEEDBACK_ENABLED = !FEEDBACK_API.includes("你的VPS_IP");

const ISSUE_URL = "https://github.com/nfmtZXNF/wb-manager/issues/new";
const LS_KEY = "gwbm_recent_errors";
const MAX_LOGS = 30;
const errorLogs = [];

// 尽早调用：开始收集全局报错
export const initErrorCapture = () => {
  try {
    const saved = JSON.parse(localStorage.getItem(LS_KEY) || "[]");
    if (Array.isArray(saved)) errorLogs.push(...saved.slice(-MAX_LOGS));
  } catch (e) {}
  const push = (kind, msg) => {
    errorLogs.push({
      t: new Date().toLocaleString(),
      kind,
      msg: String(msg == null ? "" : msg).slice(0, 500),
    });
    if (errorLogs.length > MAX_LOGS) errorLogs.shift();
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(errorLogs));
    } catch (e) {}
  };
  window.addEventListener("error", (e) => {
    push(
      "error",
      e.message + (e.filename ? ` @${e.filename}:${e.lineno || 0}` : ""),
    );
  });
  window.addEventListener("unhandledrejection", (e) => {
    const r = e.reason;
    push("promise", (r && (r.stack || r.message)) || r);
  });
};

// 尽力读取酒馆版本号
const getTavernVersion = async () => {
  try {
    const res = await fetch("/version");
    if (!res.ok) return "";
    const data = await res.json();
    if (typeof data === "string") return data;
    return data.agent || data.pkgVersion || data.currentVersion || "";
  } catch (e) {
    return "";
  }
};

const collectEnv = async () => {
  let tavernVersion = "";
  let thVersion = "";
  try {
    if (window.TavernHelper) {
      if (typeof window.TavernHelper.getTavernHelperVersion === "function")
        thVersion = window.TavernHelper.getTavernHelperVersion();
      if (typeof window.TavernHelper.getTavernVersion === "function")
        tavernVersion = window.TavernHelper.getTavernVersion();
    }
  } catch (e) {}
  if (!tavernVersion) tavernVersion = await getTavernVersion();
  return {
    version: `v${await getLocalVersion()}`,
    tavernVersion,
    thVersion,
  };
};

const getLogsText = () =>
  errorLogs
    .slice(-15)
    .map((l) => `[${l.t}] [${l.kind}] ${l.msg}`)
    .join("\n");

// 图片压缩：读文件 → 缩到最长边 1280 → JPEG（白底），返回 dataURL
const compressImage = (file) =>
  new Promise((resolve) => {
    try {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        const scale = Math.min(1, 1280 / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.75));
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(null);
      };
      img.src = url;
    } catch (e) {
      resolve(null);
    }
  });

// —— 直连 VPS 发送 ——
const sendToVps = async ({ type, desc, env, logs, images }) => {
  const res = await fetch(`${FEEDBACK_API}/feedback`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-feedback-token": FEEDBACK_TOKEN,
    },
    body: JSON.stringify({ type, desc, env, logs, images }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json().catch(() => ({}));
};

// —— 作者回复：随机 ID 即取件凭证，只存在发送者本地 ——
const IDS_KEY = "gwbm_feedback_ids";
const SEEN_KEY = "gwbm_replies_seen";

const getMyFeedbackIds = () => {
  try {
    const list = JSON.parse(localStorage.getItem(IDS_KEY) || "[]");
    return Array.isArray(list) ? list : [];
  } catch (e) {
    return [];
  }
};

const rememberFeedbackId = (id) => {
  if (!id || typeof id !== "string") return;
  const list = getMyFeedbackIds();
  list.unshift({ id, t: Date.now() });
  try {
    localStorage.setItem(IDS_KEY, JSON.stringify(list.slice(0, 20)));
  } catch (e) {}
};

// 查自己历史反馈的回复；没有本地 ID 时完全不发请求
const fetchMyReplies = async () => {
  if (!FEEDBACK_ENABLED) return {};
  const ids = getMyFeedbackIds()
    .map((x) => x && x.id)
    .filter(Boolean);
  if (!ids.length) return {};
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5000);
    const res = await fetch(`${FEEDBACK_API}/replies?ids=${ids.join(",")}`, {
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return {};
    const data = await res.json();
    return (data && data.replies) || {};
  } catch (e) {
    return {};
  }
};

const markRepliesSeen = (replies) => {
  let max = 0;
  for (const id in replies) max = Math.max(max, Number(replies[id].ts) || 0);
  if (max)
    try {
      localStorage.setItem(SEEN_KEY, String(max));
    } catch (e) {}
};

// 扩展加载后调用一次：有新回复就弹个小提示
export const checkFeedbackReplies = async () => {
  try {
    const replies = await fetchMyReplies();
    const ids = Object.keys(replies);
    if (!ids.length) return;
    let seen = 0;
    try {
      seen = Number(localStorage.getItem(SEEN_KEY)) || 0;
    } catch (e) {}
    const hasUnread = ids.some((id) => Number(replies[id].ts || 0) > seen);
    if (hasUnread && typeof toastr !== "undefined")
      toastr.info(
        "你在「全局世界书管理」的反馈收到了作者回复，打开「建议 & Bug 反馈」查看~",
        "",
        { timeOut: 8000 },
      );
  } catch (e) {}
};

// —— GitHub 预填（备选通道）——
const buildIssueBody = (type, desc, withLogs, env) => {
  const logSection = withLogs
    ? errorLogs.length
      ? getLogsText()
      : "（这次没有收集到报错日志）"
    : "（用户选择不附带）";
  return `### 反馈类型
${type}

### 问题描述
${desc || "（未填写）"}

### 环境信息
- 扩展版本: ${env.version || "未知"}
- 酒馆版本: ${env.tavernVersion || "未知"}
- 酒馆助手: ${env.thVersion ? `v${env.thVersion}` : "未检测到"}

### 报错日志（最近 15 条，自动收集）
\`\`\`
${logSection}
\`\`\`

> 截图/图片可以直接拖拽到本输入框上传`;
};

const openGithubIssue = async (type, desc, withLogs, env) => {
  let body = buildIssueBody(type, desc, withLogs, env);
  // 预填链接太长会被截断，超限时砍日志段并复制到剪贴板
  if (body.length > 6000) {
    body = buildIssueBody(type, desc, false, env).replace(
      "（用户选择不附带）",
      "（日志过长被省略，可粘贴剪贴板内容）",
    );
    try {
      await navigator.clipboard.writeText(
        errorLogs.map((l) => `[${l.t}] [${l.kind}] ${l.msg}`).join("\n"),
      );
      if (typeof toastr !== "undefined")
        toastr.info("日志较长已复制到剪贴板，打开页面后粘贴即可~");
    } catch (e) {}
  }
  const titleCore = desc.split("\n")[0].slice(0, 50) || "未填写描述";
  const url =
    `${ISSUE_URL}?title=${encodeURIComponent(`[${type}] ${titleCore}`)}` +
    `&labels=${encodeURIComponent(type === "Bug" ? "bug" : "enhancement")}` +
    `&body=${encodeURIComponent(body)}`;
  const opened = window.open(url, "_blank");
  if (!opened) {
    try {
      await navigator.clipboard.writeText(url);
      if (typeof toastr !== "undefined")
        toastr.info("无法自动打开浏览器，链接已复制，请粘贴到浏览器打开~");
    } catch (e) {}
  }
};

// 打开反馈弹窗
export const openFeedbackDialog = async () => {
  const st = window.SillyTavern;
  if (!st || typeof st.callGenericPopup !== "function") {
    if (typeof toastr !== "undefined")
      toastr.error("弹窗接口不可用，请刷新后重试~");
    return;
  }

  const logCount = errorLogs.length;
  let pickedImages = []; // 压缩后的 dataURL（最多 3 张）
  const myReplies = await fetchMyReplies(); // 有本地 ID 才发请求，否则立即返回 {}

  const $dlg = $(
    `<div style="text-align:left; min-width:300px; max-width:520px; line-height:1.7; padding:2px;">
      <h3 style="margin-top:0; color:var(--SmartThemeQuoteColor);">
        <i class="fa-solid fa-comments"></i> 建议 &amp; Bug 反馈
      </h3>
      <div id="gwbm-fb-replies" style="display:none; margin-bottom:10px;">
        <div style="font-size:13px; color:var(--SmartThemeQuoteColor); font-weight:bold;">
          <i class="fa-solid fa-reply"></i> 作者回复
        </div>
      </div>
      <div style="display:flex; gap:8px; margin-bottom:10px;">
        <label style="flex:1; text-align:center; padding:8px; border:1px solid var(--SmartThemeBorderColor); border-radius:6px; cursor:pointer;">
          <input type="radio" name="gwbm-fb-type" value="建议" style="margin-right:4px;">建议
        </label>
        <label style="flex:1; text-align:center; padding:8px; border:1px solid var(--SmartThemeBorderColor); border-radius:6px; cursor:pointer;">
          <input type="radio" name="gwbm-fb-type" value="Bug" checked style="margin-right:4px;">Bug
        </label>
      </div>
      <textarea id="gwbm-fb-desc" rows="5" placeholder="描述一下你的建议，或 Bug 的触发步骤……" style="width:100%; box-sizing:border-box; padding:8px; border-radius:6px; font-size:13px; background:var(--SmartThemeBotMesColor); color:var(--SmartThemeBodyColor); border:1px solid var(--SmartThemeBorderColor);"></textarea>
      <div style="display:flex; align-items:center; gap:8px; margin-top:8px;">
        <label class="menu_button" style="margin:0; padding:6px 12px; font-size:12px; cursor:pointer;">
          <i class="fa-solid fa-image"></i> 添加图片
          <input type="file" id="gwbm-fb-imgs" accept="image/*" multiple style="display:none;">
        </label>
        <span id="gwbm-fb-img-count" style="font-size:12px; color:gray;">未选择（最多 3 张，自动压缩）</span>
      </div>
      <label style="display:flex; align-items:center; gap:6px; margin-top:8px; cursor:pointer; font-size:12px;">
        <input type="checkbox" id="gwbm-fb-logs" checked>
        附带最近的报错日志（已收集 ${logCount} 条，仅本地记录、随本次反馈发出）
      </label>
      <div style="font-size:11px; color:gray; margin-top:4px; line-height:1.6;">
        隐私说明：除你填写的内容外，只会附带扩展版本、酒馆版本、酒馆助手安装状态，以及（勾选时）报错日志；不收集设备型号、系统信息等。
      </div>
      <div id="gwbm-fb-hint-github" style="font-size:11px; color:gray; margin-top:8px; line-height:1.6; ${FEEDBACK_ENABLED ? "display:none;" : ""}">
        走 GitHub 通道时图片无法从扩展直接上传，在打开的页面里<strong>直接拖拽图片到输入框</strong>即可（需要登录 GitHub）。
      </div>
    </div>`,
  );

  // 有作者回复的话展示在弹窗顶部，并标记已读
  const replyIds = Object.keys(myReplies);
  if (replyIds.length) {
    const $box = $dlg.find("#gwbm-fb-replies");
    $box.show();
    for (const id of replyIds) {
      const r = myReplies[id];
      const $item = $(
        '<div style="border:1px solid var(--SmartThemeBorderColor); border-radius:6px; padding:8px; margin-top:6px; font-size:12px;"></div>',
      );
      $item.append(
        $('<div style="color:gray; margin-bottom:2px;"></div>').text(
          `针对你 ${r.fbTime || "此前"} 的反馈${r.desc ? `「${r.desc}」` : ""}：`,
        ),
      );
      $item.append(
        $('<div style="white-space:pre-wrap;"></div>').text(r.text || ""),
      );
      $item.append(
        $('<div style="color:gray; text-align:right; font-size:11px;"></div>').text(
          r.time || "",
        ),
      );
      $box.append($item);
    }
    markRepliesSeen(myReplies);
  }

  $dlg.find("#gwbm-fb-imgs").on("change", async function () {
    const files = [...(this.files || [])].slice(0, 3);
    const $count = $dlg.find("#gwbm-fb-img-count");
    $count.html('<i class="fa-solid fa-spinner fa-spin"></i> 压缩中...');
    pickedImages = (
      await Promise.all(files.map((f) => compressImage(f)))
    ).filter(Boolean);
    $count.text(
      pickedImages.length
        ? `已选 ${pickedImages.length} 张（已自动压缩）`
        : "未选择（最多 3 张，自动压缩）",
    );
  });

  const buttons = [{ text: "去 GitHub（备选）", result: 2 }];
  if (FEEDBACK_ENABLED)
    buttons.unshift({ text: "直接发送（推荐）", result: 1, classes: ["btn-success"] });

  const r = await st.callGenericPopup($dlg, st.POPUP_TYPE.TEXT, "", {
    customButtons: buttons,
    cancelButton: "取消",
  });
  if (r !== 1 && r !== 2) return;

  const type = $dlg.find('input[name="gwbm-fb-type"]:checked').val() || "Bug";
  const desc = ($dlg.find("#gwbm-fb-desc").val() || "").trim();
  const withLogs = $dlg.find("#gwbm-fb-logs").prop("checked");
  const env = await collectEnv();

  if (r === 2) {
    await openGithubIssue(type, desc, withLogs, env);
    return;
  }

  // 直连 VPS
  if (!desc && pickedImages.length === 0) {
    if (typeof toastr !== "undefined")
      toastr.warning("写点描述或加张图片再发送吧~");
    return;
  }
  try {
    const result = await sendToVps({
      type,
      desc,
      env,
      logs: withLogs ? getLogsText() : "",
      images: pickedImages.map((d) => ({ data: d })),
    });
    rememberFeedbackId(result && result.id);
    if (typeof toastr !== "undefined")
      toastr.success("反馈已发送，谢谢你~ 作者回复会显示在这个弹窗里");
    // 已上报的日志清掉，避免下次重复带
    if (withLogs) {
      errorLogs.length = 0;
      try {
        localStorage.removeItem(LS_KEY);
      } catch (e) {}
    }
  } catch (e) {
    console.error("全局世界书管理：反馈发送失败", e);
    if (typeof toastr !== "undefined")
      toastr.error("直连发送失败（服务器可能暂时不可用），可以改用「去 GitHub」通道~");
  }
};
