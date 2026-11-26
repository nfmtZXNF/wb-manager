// 「扩展」面板入口：版本号、更新徽标与更新确认窗
import {
  checkForUpdates,
  clearUpdateCache,
  getChangelog,
  getLocalVersion,
  performUpdate,
} from "./update-check.js";
import { openFeedbackDialog } from "./feedback.js";

const STYLE_ID = "gwbm-panel-entry-style";
const ENTRY_ID = "gwbm-panel-entry";

let lastCheckResult = null; // 最近一次检查结果（徽标点击时复用）
let autoPromptDone = false; // 每次页面加载只自动弹一次更新确认窗
let $badgeRef = null; // 徽标元素（更新流程里要操作它）

const ensureStyle = () => {
  if (document.getElementById(STYLE_ID)) return;
  const st = document.createElement("style");
  st.id = STYLE_ID;
  st.textContent = `
#gwbm-panel-entry .gwbm-ver {
    font-size: 11px;
    opacity: 0.55;
    font-weight: normal;
    margin-left: 6px;
}
/* 更新徽标：跟随酒馆主题强调色的简约描边小胶囊 */
#gwbm-panel-entry .gwbm-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    margin-left: 8px;
    padding: 2px 10px;
    border-radius: 999px;
    border: 1px solid var(--SmartThemeQuoteColor, #70a1ff);
    color: var(--SmartThemeQuoteColor, #70a1ff);
    background: transparent;
    font-size: 11px;
    font-weight: bold;
    white-space: nowrap;
    cursor: pointer;
    transition: 0.2s;
}
#gwbm-panel-entry .gwbm-badge:hover {
    background: var(--SmartThemeQuoteColor, #70a1ff);
    color: var(--SmartThemeBotMesColor, #fff);
}
#gwbm-panel-entry .gwbm-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: currentColor;
    animation: gwbm-dot-breathe 2.4s ease-in-out infinite;
}
@keyframes gwbm-dot-breathe {
    0%, 100% { opacity: 0.3; }
    50% { opacity: 1; }
}
/* 更新确认小窗 */
.gwbm-upd-ver {
    display: flex;
    gap: 8px;
    margin-bottom: 10px;
}
.gwbm-upd-ver > div {
    flex: 1;
    text-align: center;
    padding: 8px 4px;
    border: 1px solid var(--SmartThemeBorderColor, rgba(125,125,125,0.4));
    border-radius: 6px;
    background: var(--SmartThemeBotMesColor, rgba(125,125,125,0.08));
    font-size: 12px;
}
.gwbm-upd-ver b {
    display: block;
    font-size: 14px;
    margin-top: 4px;
    color: var(--SmartThemeQuoteColor, #70a1ff);
}
.gwbm-upd-arrow {
    align-self: center;
    opacity: 0.6;
}
.gwbm-upd-log {
    max-height: 30vh;
    overflow-y: auto;
    border: 1px solid var(--SmartThemeBorderColor, rgba(125,125,125,0.4));
    border-radius: 6px;
    padding: 8px 10px;
    font-size: 12px;
    line-height: 1.7;
    background: var(--SmartThemeBotMesColor, rgba(125,125,125,0.08));
}
.gwbm-upd-log div::before {
    content: "· ";
    color: var(--SmartThemeQuoteColor, #70a1ff);
    font-weight: bold;
}
`;
  document.head.appendChild(st);
};

// 真正执行更新（用户在确认小窗里点「立即更新」之后）
const runUpdateFlow = async (serverInfo) => {
  const st = window.SillyTavern;
  const $b = $badgeRef;
  try {
    if ($b && $b.length)
      $b.html('<i class="fa-solid fa-spinner fa-spin"></i> 更新中...');
    const data = await performUpdate(serverInfo);
    clearUpdateCache();
    if (data && data.isUpToDate) {
      if (typeof toastr !== "undefined") toastr.info("已经是最新版本啦~");
      if ($b && $b.length) $b.hide();
      return;
    }
    const hash = (data && data.shortCommitHash) || "";
    if (typeof toastr !== "undefined")
      toastr.success(
        `全局世界书管理已更新${hash ? `到 ${hash}` : ""}，重启应用后生效~`,
      );
    if ($b && $b.length) $b.html('<i class="fa-solid fa-check"></i> 已更新');
    if (st && typeof st.callGenericPopup === "function") {
      const r = await st.callGenericPopup(
        "更新完成！要现在刷新让新版本生效吗？",
        st.POPUP_TYPE.CONFIRM,
        "",
        { okButton: "立即刷新", cancelButton: "稍后" },
      );
      if (r === st.POPUP_RESULT.AFFIRMATIVE) location.reload();
      else if ($b && $b.length) $b.hide();
    } else if ($b && $b.length) {
      $b.hide();
    }
  } catch (e) {
    console.error("全局世界书管理：更新失败", e);
    if (typeof toastr !== "undefined")
      toastr.error(
        "自动更新失败啦，可以去「管理扩展」里点 wb-manager 的 Update 按钮手动更新~",
      );
    if ($b && $b.length) $b.html('<i class="fa-solid fa-rotate"></i> 重试更新');
  }
};

// 更新确认小窗
const showUpdateDialog = async (checkResult) => {
  const st = window.SillyTavern;
  if (!st || typeof st.callGenericPopup !== "function") return;

  const $dlg = $(
    `<style>
      .gwbm-upd-popup .popup-buttons { display:flex !important; flex-direction:row !important; flex-wrap:wrap; gap:8px; justify-content:flex-end; }
      .gwbm-upd-popup .popup-buttons .menu_button { flex:1 1 auto; min-width:0; margin:0; padding:8px 6px; font-size:13px; text-align:center; white-space:nowrap; }
      .gwbm-upd-popup .popup-button-ok { display:none !important; }
    </style>
    <div style="text-align:left; min-width:0; max-width:480px; line-height:1.7; padding:2px;">
      <h3 style="margin-top:0; color:var(--SmartThemeQuoteColor);">
        <i class="fa-solid fa-arrow-up"></i> 发现新版本
      </h3>
      <div class="gwbm-upd-ver">
        <div>当前版本<b>v${checkResult.localVer || "?"}</b></div>
        <div class="gwbm-upd-arrow"><i class="fa-solid fa-arrow-right"></i></div>
        <div>最新版本<b>${checkResult.remoteVer ? `v${checkResult.remoteVer}` : "（版本号获取失败）"}</b></div>
      </div>
      <div style="font-size:12px; margin-bottom:6px; opacity:0.8;">更新内容：</div>
      <div class="gwbm-upd-log"><i class="fa-solid fa-spinner fa-spin"></i> 正在加载更新记录...</div>
      <div style="font-size:11px; color:gray; margin-top:8px;">
        点「暂不更新」就关掉这个提示，徽标会一直留在扩展面板里，想更的时候点它就行。
      </div>
    </div>`,
  );

  // 异步填更新记录（只含用户能感知的变化；连不上时给出兜底文案）
  getChangelog(checkResult.localVer).then((logs) => {
    const $log = $dlg.find(".gwbm-upd-log");
    if (logs.length) {
      $log.html(logs.map((m) => `<div>${m}</div>`).join(""));
    } else {
      $log.html(
        `<div style="opacity:0.7;">更新记录拉取失败（网络原因），可前往仓库页面查看。</div>`,
      );
    }
  });

  const popupPromise = st.callGenericPopup($dlg, st.POPUP_TYPE.TEXT, "", {
    customButtons: [
      { text: "立即更新", result: 1, classes: ["btn-success"] },
      { text: "暂不更新", result: 2 },
    ],
  });
  // 弹窗挂上专属 class，让上面的按钮排版样式只作用于本弹窗
  setTimeout(() => {
    try {
      $(".gwbm-upd-ver").closest(".popup").addClass("gwbm-upd-popup");
    } catch (e) {}
  }, 0);
  const r = await popupPromise;
  if (r === 1) await runUpdateFlow(checkResult.server);
  // r === 2 或关闭：什么都不做，徽标保留
};

// 检查更新；有新版 → 亮徽标 + （每次加载只一次）自动弹确认小窗
const runUpdateCheck = () => {
  checkForUpdates(true)
    .then((r) => {
      if (!r || !r.hasUpdate) return;
      lastCheckResult = r;
      if ($badgeRef && $badgeRef.length) {
        $badgeRef
          .html(
            `<span class="gwbm-dot"></span>${r.remoteVer ? `v${r.remoteVer} ` : ""}可更新`,
          )
          .show();
      }
      if (!autoPromptDone) {
        autoPromptDone = true;
        // 稍微延迟，等页面加载稳定，不和启动过程抢焦点
        setTimeout(() => showUpdateDialog(r), 5000);
      }
    })
    .catch(() => {});
};

export const initMenuEntry = () => {
  const tryInject = () => {
    const container = document.querySelector("#extensions_settings2");
    if (!container) return false;
    if (document.getElementById(ENTRY_ID)) return true;
    ensureStyle();

    const $entry = $(
      `<div id="${ENTRY_ID}" class="extension_container">
        <div class="inline-drawer">
          <div class="inline-drawer-toggle inline-drawer-header">
            <b><i class="fa-solid fa-book-atlas" style="margin-right:6px;"></i>全局世界书管理<span class="gwbm-ver"></span></b>
            <span id="gwbm-update-badge" class="gwbm-badge" style="display:none;"></span>
            <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
          </div>
          <div class="inline-drawer-content">
            <div class="flex-container flexGap5">
              <button id="gwbm-open-panel" class="menu_button menu_button_icon">
                <i class="fa-solid fa-book-atlas"></i>
                <span>打开管理面板</span>
              </button>
              <button id="gwbm-feedback" class="menu_button menu_button_icon">
                <i class="fa-solid fa-comments"></i>
                <span>建议 &amp; Bug 反馈</span>
              </button>
            </div>
          </div>
        </div>
      </div>`,
    );
    $(container).append($entry);
    try {
      console.log("全局世界书管理：扩展面板入口已注入~");
    } catch (e) {}

    // 打开主面板（复用左下角按钮的点击处理）
    $entry.find("#gwbm-open-panel").on("click", () => {
      $("#option_lulu_wb_manager").trigger("click");
    });
    // 反馈通道
    $entry.find("#gwbm-feedback").on("click", () => {
      openFeedbackDialog();
    });

    // 填上当前版本号
    getLocalVersion().then((v) => {
      if (v) $entry.find(".gwbm-ver").text(`v${v}`);
    });

    // 徽标点击 → 打开更新确认小窗（不再直接更）
    $badgeRef = $entry.find("#gwbm-update-badge");
    $badgeRef.on("click", (e) => {
      e.stopPropagation(); // 别触发抽屉的折叠
      if (lastCheckResult) showUpdateDialog(lastCheckResult);
      else runUpdateCheck();
    });

    // 每次注入后都检查一次更新（页面加载后第一次注入即触发）
    runUpdateCheck();
    return true;
  };

  // 面板由酒馆异步渲染；用 MutationObserver 常驻监听：
  // 晚出现、或被重新渲染清空时，都能自动补注入
  if (tryInject()) return;
  const observer = new MutationObserver(() => {
    if (tryInject()) observer.disconnect();
  });
  observer.observe(document.body, { childList: true, subtree: true });
  // 兜底：每 3 秒自查补回
  setInterval(() => {
    if (!document.getElementById(ENTRY_ID)) tryInject();
  }, 3000);
};
