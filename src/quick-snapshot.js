import { getCharWorldbookNames, getCurrentCharacterName, getGlobalWorldbookNames, getWorldbook, getWorldbookNames, rebindGlobalWorldbooks, replaceWorldbook } from "./compat.js";
import { luluGetChatSnapBinding, luluSetChatSnapBinding, luluUpdateCharSnapshotFlow } from "./char-snapshot.js";
import { getSnapshotOrder, setCharSnapshotOrder, setSnapshotOrder, sortCharSnapshotNames, sortSnapshotNames } from "./snapshot-order.js";
import { luluGetGlobalVars, luluUpdateGlobalVars } from "./state.js";
import { luluGetPanelThemePalette } from "./theme.js";
import { luluHexToRgba } from "./utils.js";

window.luluOpenQuickSnapshotView = async () => {
  /* 保持原有快照控制台代码不变，受限字数省略详细内部只展开外皮，此处保留全部防止损坏 */
  let snapshots = luluGetGlobalVars().wb_snapshots;
  if (typeof snapshots === "string") {
    try {
      snapshots = JSON.parse(snapshots);
    } catch (e) {
      snapshots = {};
    }
  }
  if (!snapshots || typeof snapshots !== "object" || Array.isArray(snapshots))
    snapshots = {};
  const { mode: savedMode, custom: savedCustom } = luluGetPanelThemePalette();

  let themeOverrideCSS = "";
  if (savedMode === "dark") {
    themeOverrideCSS = `dialog.lulu-qs-dialog { background: rgba(22, 24, 28, 1) !important; border: 1px solid #d1c5a1 !important; } dialog.lulu-qs-dialog, #lulu-quick-snap-modal { --SmartThemeBlurTintColor: rgba(22, 24, 28, 1) !important; --SmartThemeBotMesColor: rgba(32, 35, 40, 1) !important; --SmartThemeBodyColor: #c0c2c8 !important; --SmartThemeQuoteColor: #d1c5a1 !important; --SmartThemeBorderColor: #3d414d !important; color: #c0c2c8 !important; }`;
  } else if (savedMode === "light") {
    themeOverrideCSS = `dialog.lulu-qs-dialog { background: rgba(253, 246, 227, 1) !important; border: 1px solid #8b5d33 !important; } dialog.lulu-qs-dialog, #lulu-quick-snap-modal { --SmartThemeBlurTintColor: rgba(253, 246, 227, 1) !important; --SmartThemeBotMesColor: rgba(255, 251, 240, 1) !important; --SmartThemeBodyColor: #4a3b32 !important; --SmartThemeQuoteColor: #8b5d33 !important; --SmartThemeBorderColor: #e0d0b8 !important; color: #4a3b32 !important; } dialog.lulu-qs-dialog *, #lulu-quick-snap-modal * { text-shadow: none !important; }`;
  } else if (savedMode === "custom") {
    const bgRgba = luluHexToRgba(savedCustom.bg, savedCustom.alpha);
    themeOverrideCSS = `dialog.lulu-qs-dialog { background: ${bgRgba} !important; border: 1px solid var(--SmartThemeQuoteColor) !important; } dialog.lulu-qs-dialog, #lulu-quick-snap-modal { --SmartThemeBlurTintColor: ${bgRgba} !important; --SmartThemeBotMesColor: ${savedCustom.bg} !important; --SmartThemeBodyColor: ${savedCustom.text} !important; color: ${savedCustom.text} !important; }`;
  }

  const customCss = `<style>
.lulu-qs-tab { background: rgba(125,125,125,0.12); color: gray; border: 1px solid var(--SmartThemeBorderColor); }
.lulu-qs-tab:hover { color: var(--SmartThemeBodyColor); background: rgba(125,125,125,0.2); }
.lulu-qs-tab.lulu-qs-tab-active { background: var(--SmartThemeBotMesColor); color: var(--SmartThemeQuoteColor); border-color: var(--SmartThemeQuoteColor); }
.lulu-qs-btn-hover:hover { filter: brightness(1.2); }
 .lulu-qs-item { transition: 0.2s; } .lulu-qs-item:hover { border-color: var(--SmartThemeQuoteColor) !important; transform: translateY(-1px); box-shadow: 0 4px 10px rgba(0,0,0,0.1); } .lulu-qs-active { border-color: #51cf66 !important; background: rgba(81, 207, 102, 0.05) !important; } dialog.lulu-qs-dialog { background: var(--SmartThemeBlurTintColor) !important; border: 1px solid var(--SmartThemeBorderColor) !important; border-radius: 12px; } dialog.lulu-qs-dialog::backdrop { background: rgba(0,0,0,0.4) !important; backdrop-filter: blur(4px) !important; } @media (max-width: 768px) {
  #lulu-quick-snap-modal { min-width: unset !important; width: 90vw !important; padding: 5px !important; max-width: 500px !important; }
  .lulu-qs-item {
    padding: 12px !important;
    gap: 10px !important;
    flex-direction: column !important;
    align-items: stretch !important;
  }
  .lulu-qs-item > div:first-child {
    width: 100% !important;
    flex: auto !important;
    min-width: 0 !important;
  }
  .lulu-qs-item > div:first-child > div:first-child {
    white-space: normal !important;
    overflow: visible !important;
    text-overflow: initial !important;
    line-height: 1.4 !important;
  }
  .lulu-qs-item > div:last-child {
    width: 100% !important;
    justify-content: flex-end !important;
    flex-wrap: nowrap !important;
  }
  .lulu-qs-item > div:last-child > button.lulu-qs-apply-btn {
    flex: 1 !important;
    white-space: nowrap !important;
    justify-content: center !important;
  }
  .lulu-qs-item > button.lulu-qs-char-apply {
    width: 100% !important;
    justify-content: center !important;
    white-space: nowrap !important;
    flex: 1 !important;
  }
  .lulu-qs-item .lulu-qs-move-up,
  .lulu-qs-item .lulu-qs-move-down {
    min-width: 34px !important;
    min-height: 34px !important;
    padding: 6px !important;
    font-size: 13px !important;
  }
}
 #lulu-quick-snap-modal input[type="text"] { background: var(--SmartThemeBotMesColor) !important; color: var(--SmartThemeBodyColor) !important; border: 1px solid var(--SmartThemeBorderColor) !important; } dialog.lulu-qs-dialog .popup-controls .menu_button, dialog.lulu-qs-dialog .popup-button-ok { background: var(--SmartThemeBotMesColor) !important; color: var(--SmartThemeBodyColor) !important; border: 1px solid var(--SmartThemeQuoteColor) !important; } dialog.lulu-qs-dialog .popup-controls .menu_button:hover, dialog.lulu-qs-dialog .popup-button-ok:hover { background: var(--SmartThemeQuoteColor) !important; color: #fff !important; }
/* 极速快照面板内部：上下排序等普通按钮统一跟随主题 */
#lulu-quick-snap-modal .menu_button:not(.btn-success):not(.btn-primary):not(.btn-danger) {
  background: var(--SmartThemeBotMesColor) !important;
  color: var(--SmartThemeBodyColor) !important;
  border: 1px solid var(--SmartThemeBorderColor) !important;
}
#lulu-quick-snap-modal .menu_button:not(.btn-success):not(.btn-primary):not(.btn-danger):hover {
  background: var(--SmartThemeQuoteColor) !important;
  color: #fff !important;
  border-color: var(--SmartThemeQuoteColor) !important;
}
/* “运行”按钮统一：跟随主题强调色（未生效）/ 灰色（生效中） */
#lulu-quick-snap-modal .lulu-qs-apply-btn.btn-primary,
#lulu-quick-snap-modal .lulu-qs-char-apply.btn-primary {
  background: rgba(125,125,125,0.12) !important;
  color: var(--SmartThemeQuoteColor) !important;
  border: 1px solid var(--SmartThemeQuoteColor) !important;
}
#lulu-quick-snap-modal .lulu-qs-apply-btn.btn-primary:hover,
#lulu-quick-snap-modal .lulu-qs-char-apply.btn-primary:hover {
  background: var(--SmartThemeQuoteColor) !important;
  color: var(--SmartThemeBotMesColor) !important;
}
#lulu-quick-snap-modal .lulu-qs-apply-btn.btn-secondary,
#lulu-quick-snap-modal .lulu-qs-char-apply.btn-secondary {
  background: rgba(150,150,150,0.15) !important;
  color: gray !important;
  border: 1px solid rgba(150,150,150,0.5) !important;
  cursor: default !important;
}
/* ========== 手机端极速面板修复（最终版） ========== */
@media (max-width: 768px) {
  #lulu-quick-snap-modal {
    width: 92vw !important;
    max-width: 520px !important;
    padding: 6px !important;
    min-width: unset !important;
    overflow-x: visible !important;
    overflow-y: auto !important;
  }

  /* ✨ 手机端条目改成上下两行：第一行名字占满全宽，第二行按钮靠右一字排开，
     不再让按钮把名字挤成一小块（与 PC 端的宽松观感对齐） */
  #lulu-quick-snap-modal .lulu-qs-item {
    display: flex !important;
    flex-direction: column !important;
    flex-wrap: nowrap !important;
    align-items: stretch !important;
    justify-content: space-between !important;
    gap: 8px !important;
    padding: 10px 8px !important;
    overflow: visible !important;
  }

  #lulu-quick-snap-modal .lulu-qs-item > div:first-child {
    flex: 1 1 auto !important;
    min-width: 0 !important;
    width: 100% !important;
  }

  #lulu-quick-snap-modal .lulu-qs-item > div:first-child > div:first-child {
    white-space: normal !important;
    overflow: visible !important;
    text-overflow: initial !important;
    line-height: 1.35 !important;
    word-break: break-word !important;
  }

  #lulu-quick-snap-modal .lulu-qs-item > div:last-child {
    flex: 0 0 auto !important;
    width: 100% !important;
    display: flex !important;
    flex-direction: row !important;
    align-items: center !important;
    gap: 4px !important;
    justify-content: flex-end !important;
  }

  #lulu-quick-snap-modal .lulu-qs-item > div:last-child > div {
    display: flex !important;
    flex-direction: row !important;
    gap: 2px !important;
  }

  #lulu-quick-snap-modal .lulu-qs-move-up,
  #lulu-quick-snap-modal .lulu-qs-move-down,
  #lulu-quick-snap-modal .lulu-qs-char-move-up,
  #lulu-quick-snap-modal .lulu-qs-char-move-down,
  #lulu-quick-snap-modal .lulu-qs-char-update,
  #lulu-quick-snap-modal .lulu-qs-char-bind {
    width: 34px !important;
    min-width: 34px !important;
    height: 34px !important;
    min-height: 34px !important;
    padding: 0 !important;
    font-size: 13px !important;
    display: inline-flex !important;
    align-items: center !important;
    justify-content: center !important;
  }

  #lulu-quick-snap-modal .lulu-qs-item > div:last-child > button.lulu-qs-apply-btn,
  #lulu-quick-snap-modal .lulu-qs-item > button.lulu-qs-char-apply {
    width: 38px !important;
    height: 38px !important;
    min-width: 38px !important;
    padding: 0 !important;
    font-size: 0 !important;
    display: inline-flex !important;
    align-items: center !important;
    justify-content: center !important;
    flex: 0 0 auto !important;
    border-radius: 6px !important;
  }

  #lulu-quick-snap-modal .lulu-qs-item > div:last-child > button.lulu-qs-apply-btn i,
  #lulu-quick-snap-modal .lulu-qs-item > button.lulu-qs-char-apply i {
    font-size: 16px !important;
    margin: 0 !important;
  }

  #lulu-quick-snap-modal .lulu-qs-item button {
    max-width: none !important;
  }
}
${themeOverrideCSS} </style>
<style>
/* ========== 极速面板：运行按钮统一只显示图标（桌面+手机） ========== */
#lulu-quick-snap-modal .lulu-qs-item > div:last-child > button.lulu-qs-apply-btn,
#lulu-quick-snap-modal .lulu-qs-item > div:last-child > button.lulu-qs-char-apply {
    font-size: 0 !important;
    width: 38px !important;
    height: 38px !important;
    min-width: 38px !important;
    padding: 0 !important;
    display: inline-flex !important;
    align-items: center !important;
    justify-content: center !important;
    gap: 0 !important;
    flex: 0 0 auto !important;
    border-radius: 6px !important;
    white-space: nowrap !important;
}

#lulu-quick-snap-modal .lulu-qs-item > div:last-child > button.lulu-qs-apply-btn i,
#lulu-quick-snap-modal .lulu-qs-item > div:last-child > button.lulu-qs-char-apply i {
    font-size: 16px !important;
    margin: 0 !important;
}
</style>`;

  let html = `${customCss}<div id="lulu-quick-snap-modal" style="padding:10px; font-family:sans-serif; min-width:320px; max-width:550px;"><h3 style="margin-top:0; color:var(--SmartThemeQuoteColor); border-bottom:2px solid var(--SmartThemeBorderColor); padding-bottom:10px; font-size: 16px; display:flex; align-items:center; justify-content:space-between; gap:8px;"><span><i class="fa-solid fa-bolt" style="color:#fcc419;"></i> 极速快照控制台</span><span style="display:flex; align-items:center; gap:8px;"><span id="lulu-qs-open-main" class="lulu-qs-btn-hover" style="cursor:pointer; font-size:12px; font-weight:bold; color:var(--SmartThemeQuoteColor); border:1px solid var(--SmartThemeQuoteColor); border-radius:6px; padding:4px 8px; white-space:nowrap;" title="收起本面板并打开全局世界书管理面板"><i class="fa-solid fa-book-journal-whills"></i> 全局管理</span><span id="lulu-qs-status-text" style="color:var(--SmartThemeQuoteColor); font-size: 12px; font-weight:normal;">正在检测状态...</span></span></h3>`;

  // 切换标签栏
  html += `<div style="display:flex; gap:6px; margin-bottom:12px;">
    <div id="lulu-qs-tab-global" class="lulu-qs-tab lulu-qs-tab-active" style="flex:1; text-align:center; padding:9px; border-radius:6px; cursor:pointer; font-size:13px; font-weight:bold; transition:0.2s;"><i class="fa-solid fa-earth-asia"></i> 全局快照</div>
    <div id="lulu-qs-tab-char" class="lulu-qs-tab" style="flex:1; text-align:center; padding:9px; border-radius:6px; cursor:pointer; font-size:13px; font-weight:bold; transition:0.2s;"><i class="fa-solid fa-user-astronaut"></i> 当前角色</div>
  </div>`;

  // ===== 全局快照区（默认显示）=====
  html += `<div id="lulu-qs-global-section">`;
  html += `<div style="margin-bottom:10px;">
    <input type="text" id="lulu-qs-search" class="text_pole" placeholder="🔍 检索快照名称..." style="width:100%; box-sizing:border-box; padding:8px; border-radius:6px; font-size:13px; margin-bottom:10px;">
    <div style="display:flex; gap:6px; flex-wrap:wrap;">
      <button id="lulu-qs-clear-all" class="menu_button interactable lulu-qs-btn-hover" style="flex:1; margin:0; border:1px solid var(--SmartThemeQuoteColor); padding:9px; border-radius:6px; background:rgba(125,125,125,0.08); color:var(--SmartThemeQuoteColor); font-weight:bold; font-size:12px; display:flex; justify-content:center; align-items:center; gap:6px;"><i class="fa-solid fa-power-off"></i> 一键关闭</button>
      <button id="lulu-qs-batch-del" class="menu_button interactable lulu-qs-btn-hover" style="flex:1; margin:0; border:1px solid #ff6b6b; padding:9px; border-radius:6px; background:rgba(255,107,107,0.1); color:#ff6b6b; font-weight:bold; font-size:12px; display:flex; justify-content:center; align-items:center; gap:6px;"><i class="fa-solid fa-trash-can"></i> 批量删除</button>
    </div>
  </div>
  <div style="max-height: 50vh; overflow-y: auto; display:flex; flex-direction:column; gap:10px; padding:4px;" class="scrollableInnerFull">`;

  let __quickOrder = getSnapshotOrder();
  const __sortedQuickNames = Object.keys(snapshots).sort((a, b) => {
    let ia = __quickOrder.indexOf(a);
    let ib = __quickOrder.indexOf(b);
    if (ia === -1) ia = 9999;
    if (ib === -1) ib = 9999;
    return ia - ib;
  });
  const snapEntries = __sortedQuickNames.map((n) => [n, snapshots[n]]);
  if (snapEntries.length === 0) {
    html += `<div style="color:gray; text-align:center; padding: 30px; background:var(--SmartThemeBlurTintColor, rgba(0,0,0,0.1)); border-radius:8px; border:1px dashed var(--SmartThemeBorderColor);">存储库目前是空的哦，<br>可以先去主页面的重度面板收纳一些快照进来呀~</div>`;
  } else {
    const qsEsc = (s) =>
      String(s).replace(/</g, "&lt;").replace(/>/g, "&gt;");
    snapEntries.forEach(([name, snapData]) => {
      const isDetailed =
        !Array.isArray(snapData) && snapData.type === "detailed";
      const wbs = isDetailed
        ? Object.keys(snapData.data)
        : Array.isArray(snapData)
          ? snapData
          : snapData.wbs;
      const qsWbsListHtml =
        wbs && wbs.length
          ? wbs.map((w) => `<div style="padding:1px 0;">📖 ${qsEsc(w)}</div>`).join("")
          : '<div style="color:gray;">（空组合）</div>';
      const safeName = btoa(unescape(encodeURIComponent(name))).replace(
        /[^a-zA-Z0-9]/g,
        "",
      );
      html += `<div class="lulu-qs-item" data-itemname="${safeName}" style="background:var(--SmartThemeBotMesColor); border:1px solid var(--SmartThemeBorderColor); border-radius:8px; padding:12px; display:flex; justify-content:space-between; align-items:center; gap: 10px;"><div style="flex:1; min-width:0;"><div style="font-weight:bold; font-size:15px; color:var(--SmartThemeBodyColor); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;"><i class="fa-solid ${isDetailed ? "fa-puzzle-piece" : "fa-camera-retro"}" style="color:var(--SmartThemeQuoteColor);"></i> ${name}</div><div class="lulu-qs-wbs-toggle" style="font-size:11px; color:gray; margin-top:6px; display:flex; align-items:center; gap:6px; cursor:pointer;" title="点击展开/收起包含的世界书名单"><i class="fa-solid fa-chevron-right lulu-qs-wbs-arrow" style="font-size:9px;"></i><span>${isDetailed ? "复合场景" : "基础组合"} | 共涉及 ${wbs.length || 0} 本书</span></div><div class="lulu-qs-wbs-list" style="display:none; margin-top:4px; font-size:11px; color:gray; line-height:1.6; word-break:break-all; border-left:2px solid var(--SmartThemeBorderColor); padding-left:8px;">${qsWbsListHtml}</div><div class="lulu-qs-badge" data-badgename="${safeName}" style="display:none; margin-top:6px; font-size:11px; color:#51cf66; font-weight:bold;"><i class="fa-solid fa-circle-check"></i> 当前全局生效中</div></div><div style="display:flex; align-items:center; gap:6px; flex-shrink:0;"><div style="display:flex; flex-direction:column; gap:2px;"><button class="menu_button interactable lulu-qs-move-up" data-rawname="${encodeURIComponent(name)}" style="margin:0; padding:2px 8px; min-width:unset; font-size:11px; line-height:1;" title="上移"><i class="fa-solid fa-chevron-up"></i></button><button class="menu_button interactable lulu-qs-move-down" data-rawname="${encodeURIComponent(name)}" style="margin:0; padding:2px 8px; min-width:unset; font-size:11px; line-height:1;" title="下移"><i class="fa-solid fa-chevron-down"></i></button></div><button class="menu_button interactable btn-primary lulu-qs-btn-hover lulu-qs-apply-btn"data-btnname="${safeName}" data-rawname="${encodeURIComponent(name)}" style="margin:0; border:none; border-radius:6px; font-size:13px; font-weight:bold; padding: 8px 14px; flex-shrink:0; display:inline-flex; align-items:center; justify-content:center; gap:6px; white-space:nowrap !important; word-break:keep-all;">运行 <i class="fa-solid fa-play"></i></button></div></div>`;
    });
  }
  html += `</div>`; // 关闭全局列表滚动区
  html += `</div>`; // 关闭 lulu-qs-global-section

  // ===== 当前角色快照区（默认隐藏，onOpen 时动态填充）=====
  html += `<div id="lulu-qs-char-section" style="display:none;">
    <div id="lulu-qs-char-header" style="font-size:13px; color:var(--SmartThemeQuoteColor); font-weight:bold; margin-bottom:6px; padding:8px 10px; background:var(--SmartThemeBotMesColor); border:1px solid var(--SmartThemeBorderColor); border-radius:6px; display:flex; align-items:center; gap:6px;"></div>
    <div id="lulu-qs-char-bind-info" style="font-size:11px; margin-bottom:8px; display:none; line-height:1.5;"></div>
    <input type="text" id="lulu-qs-char-search" class="text_pole" placeholder="🔍 检索角色快照名称..." style="width:100%; box-sizing:border-box; padding:8px; border-radius:6px; font-size:13px; margin-bottom:8px;">
    <div style="display:flex; gap:6px; margin-bottom:10px;">
      <button id="lulu-qs-char-batch-del" class="menu_button interactable lulu-qs-btn-hover" style="flex:1; margin:0; border:1px solid #ff6b6b; padding:9px; border-radius:6px; background:rgba(255,107,107,0.1); color:#ff6b6b; font-weight:bold; font-size:12px; display:flex; justify-content:center; align-items:center; gap:6px;"><i class="fa-solid fa-trash-can"></i> 批量删除</button>
    </div>
    <div id="lulu-qs-char-list" style="max-height:50vh; overflow-y:auto; display:flex; flex-direction:column; gap:10px; padding:4px;" class="scrollableInnerFull"></div>
  </div>`;

  html += `</div>`; // 关闭 lulu-quick-snap-modal

  const popup = new SillyTavern.Popup(
    $(html),
    SillyTavern.POPUP_TYPE.TEXT,
    "",
    {
      allowVerticalScrolling: true,
      okButton: "关闭面板",
      onOpen: () => {
        const $dlg = $(popup.dlg);
        $dlg.addClass("lulu-qs-dialog");
        // ========== 当前角色快照：读取、渲染、应用 ==========
        // 读取当前角色名
        const qsGetCharName = () => {
          try {
            if (typeof getCurrentCharacterName === "function")
              return getCurrentCharacterName();
            if (typeof SillyTavern !== "undefined")
              return SillyTavern.getContext().name2;
          } catch (e) {}
          return null;
        };

        // 读取当前角色绑定的所有世界书
        const qsGetCharBoundBooks = () => {
          let obj = { primary: null, additional: [] };
          try {
            if (typeof getCharWorldbookNames === "function")
              obj = getCharWorldbookNames("current") || obj;
          } catch (e) {}
          const list = [];
          if (obj.primary) list.push(obj.primary);
          if (obj.additional) list.push(...obj.additional);
          return list;
        };

        // 读取角色快照对象
        const qsGetCharSnaps = () => {
          let cs = luluGetGlobalVars().wb_char_snapshots;
          if (typeof cs === "string") {
            try {
              cs = JSON.parse(cs);
            } catch (e) {
              cs = {};
            }
          }
          if (!cs || typeof cs !== "object" || Array.isArray(cs)) cs = {};
          return cs;
        };

        // 应用某个角色快照（精简独立版）
        const qsApplyCharSnap = async (snapData) => {
          const boundBooks = qsGetCharBoundBooks();
          const snapWbNames = Object.keys(snapData);
          const missing = snapWbNames.filter((wb) => !boundBooks.includes(wb));
          if (missing.length === snapWbNames.length) {
            toastr.error(
              `当前角色没有绑定快照里的任何世界书，无法应用哦(＞﹏＜)`,
            );
            return false;
          }
          if (missing.length > 0) {
            toastr.warning(
              `注意：快照里的 [${missing.join(", ")}] 当前没绑定在角色身上，这几本无法复原~`,
            );
          }
          for (const wb of boundBooks) {
            let entries = await getWorldbook(wb);
            let changed = false;
            const targetUIDs = snapData[wb] || [];
            entries.forEach((entry) => {
              const should = targetUIDs.includes(entry.uid);
              if (entry.enabled !== should) {
                entry.enabled = should;
                changed = true;
              }
            });
            if (changed) await replaceWorldbook(wb, entries);
          }
          return true;
        };

        // 检测某个角色快照当前是否正生效
        // ✨ readFn 可传入带缓存的读取函数；所有绑定书并行读取（原来是逐本串行 await）
        const qsIsCharSnapActive = async (snapData, readFn = getWorldbook) => {
          const boundBooks = qsGetCharBoundBooks();
          const snapWbNames = Object.keys(snapData);
          for (const wb of snapWbNames) {
            if (!boundBooks.includes(wb)) return false;
          }
          const allEntries = await Promise.all(
            boundBooks.map((wb) => readFn(wb)),
          );
          for (let i = 0; i < boundBooks.length; i++) {
            const entries = allEntries[i];
            const enabledUIDs = entries
              .filter((e) => e.enabled)
              .map((e) => e.uid)
              .sort();
            const targetUIDs = [...(snapData[boundBooks[i]] || [])].sort();
            if (
              enabledUIDs.length !== targetUIDs.length ||
              !enabledUIDs.every((v, idx) => v === targetUIDs[idx])
            )
              return false;
          }
          return true;
        };

        // 渲染角色快照列表
        const renderCharSnapList = async () => {
          const $header = $dlg.find("#lulu-qs-char-header");
          const $list = $dlg.find("#lulu-qs-char-list").empty();
          const charName = qsGetCharName();

          if (!charName) {
            $header.html(
              '<i class="fa-solid fa-circle-info" style="color:#fcc419;"></i> 未打开角色聊天',
            );
            $dlg.find("#lulu-qs-char-bind-info").hide();
            $list.html(
              '<div style="color:gray; text-align:center; padding:30px; background:var(--SmartThemeBotMesColor); border-radius:8px; border:1px dashed var(--SmartThemeBorderColor); line-height:1.6;">当前没有打开任何角色的聊天哦~<br>进入聊天后，这里就会显示该角色的专属快照啦 (๑>؂<๑)</div>',
            );
            return;
          }

          $header.html(
            `<i class="fa-solid fa-user-astronaut"></i> 当前角色：${charName}`,
          );

          // ✨ 本聊天的快照绑定状态提示
          const qsBinding =
            typeof luluGetChatSnapBinding === "function"
              ? luluGetChatSnapBinding()
              : null;
          const qsBoundName =
            qsBinding && qsBinding.charName === charName
              ? qsBinding.snapName
              : null;
          const $qsBindInfo = $dlg.find("#lulu-qs-char-bind-info");
          if (qsBoundName) {
            $qsBindInfo
              .show()
              .html(
                `<span style="color:#4dabf7; font-weight:bold;"><i class="fa-solid fa-link"></i> 本聊天已绑定【${qsBoundName}】，进入本聊天时会自动应用它</span>`,
              );
          } else {
            $qsBindInfo
              .show()
              .html(
                `<span style="color:gray;"><i class="fa-solid fa-link-slash"></i> 本聊天未绑定快照，点每行的 <i class="fa-solid fa-link"></i> 即可绑定</span>`,
              );
          }

          const allSnaps = qsGetCharSnaps();
          const mySnaps = allSnaps[charName] || {};
          const snapNames =
            typeof sortCharSnapshotNames === "function"
              ? sortCharSnapshotNames(charName, Object.keys(mySnaps))
              : Object.keys(mySnaps);

          if (snapNames.length === 0) {
            $list.html(
              '<div style="color:gray; text-align:center; padding:30px; background:var(--SmartThemeBotMesColor); border-radius:8px; border:1px dashed var(--SmartThemeBorderColor);">这个角色还没有保存过专属快照呢~<br>可以去管理面板的「当前聊天角色」页收纳哦</div>',
            );
            return;
          }

          const moveCharSnap = (dir, snapName) => {
            const currentChar = qsGetCharName();
            if (!currentChar) return;
            const allSnaps2 = qsGetCharSnaps();
            const mySnaps2 = allSnaps2[currentChar] || {};
            let order =
              typeof sortCharSnapshotNames === "function"
                ? sortCharSnapshotNames(currentChar, Object.keys(mySnaps2))
                : Object.keys(mySnaps2);
            const idx = order.indexOf(snapName);
            const swapWith = idx + dir;
            if (swapWith < 0 || swapWith >= order.length) return;
            [order[idx], order[swapWith]] = [order[swapWith], order[idx]];
            if (typeof setCharSnapshotOrder === "function")
              setCharSnapshotOrder(currentChar, order);
            renderCharSnapList();
          };

          // ✨ 并行预检所有快照的生效状态；同一次渲染里同一本书只读一次
          const wbReadCache = new Map();
          const cachedWbRead = (wb) => {
            if (!wbReadCache.has(wb)) wbReadCache.set(wb, getWorldbook(wb));
            return wbReadCache.get(wb);
          };
          const activeMap = new Map();
          await Promise.all(
            snapNames.map(async (n) => {
              let flag = false;
              try {
                flag = await qsIsCharSnapActive(mySnaps[n], cachedWbRead);
              } catch (e) {}
              activeMap.set(n, flag);
            }),
          );

          for (const name of snapNames) {
            const snapData = mySnaps[name];
            const bookCount = Object.keys(snapData).length;
            const totalEntries = Object.values(snapData).reduce(
              (a, arr) => a + (Array.isArray(arr) ? arr.length : 0),
              0,
            );
            const $item = $(
              `<div class="lulu-qs-item" data-snapname="${encodeURIComponent(name)}" style="background:var(--SmartThemeBotMesColor); border:1px solid var(--SmartThemeBorderColor); border-radius:8px; padding:12px; display:flex; justify-content:space-between; align-items:center; gap:10px;">
                <div style="flex:1; min-width:0;">
                  <div style="font-weight:bold; font-size:15px; color:var(--SmartThemeBodyColor); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;"><i class="fa-solid fa-camera-retro" style="color:var(--SmartThemeQuoteColor);"></i> ${name}</div>
                  <div class="lulu-qs-char-detail-toggle" style="font-size:11px; color:gray; margin-top:6px; cursor:pointer;" title="点击展开/收起包含的条目名单"><i class="fa-solid fa-chevron-right" style="font-size:9px;"></i> 涉及 ${bookCount} 本书 · 共开启 ${totalEntries} 项</div>
                  <div class="lulu-qs-char-detail" style="display:none; margin-top:4px; font-size:11px; color:gray; line-height:1.6; word-break:break-all; border-left:2px solid var(--SmartThemeBorderColor); padding-left:8px; max-height:160px; overflow-y:auto;"></div>
                  <div class="lulu-qs-char-badge" style="display:none; margin-top:6px; font-size:11px; color:#51cf66; font-weight:bold;"><i class="fa-solid fa-circle-check"></i> 当前生效中</div>
                  ${qsBoundName === name ? `<div style="margin-top:4px; font-size:11px; color:#4dabf7; font-weight:bold;"><i class="fa-solid fa-link"></i> 已绑定本聊天</div>` : ""}
                </div>
                <div style="display:flex; align-items:center; gap:6px; flex-shrink:0;">
                  <div style="display:flex; flex-direction:column; gap:2px;">
                    <button class="menu_button interactable lulu-qs-char-move-up" data-rawname="${encodeURIComponent(name)}" style="margin:0; padding:2px 8px; min-width:unset; font-size:11px; line-height:1;" title="上移"><i class="fa-solid fa-chevron-up"></i></button>
                    <button class="menu_button interactable lulu-qs-char-move-down" data-rawname="${encodeURIComponent(name)}" style="margin:0; padding:2px 8px; min-width:unset; font-size:11px; line-height:1;" title="下移"><i class="fa-solid fa-chevron-down"></i></button>
                  </div>
                  <div style="display:flex; flex-direction:column; gap:2px;">
                    <button class="menu_button interactable lulu-qs-char-update" style="margin:0; padding:2px 8px; min-width:unset; font-size:11px; line-height:1;" title="用当前条目状态覆盖/更新此快照"><i class="fa-solid fa-rotate"></i></button>
                    <button class="menu_button interactable lulu-qs-char-bind ${qsBoundName === name ? "btn-success" : ""}" style="margin:0; padding:2px 8px; min-width:unset; font-size:11px; line-height:1;" title="${qsBoundName === name ? "已绑定到本聊天，点击解除绑定" : "把这个快照绑定到本聊天，进入本聊天时自动应用"}"><i class="fa-solid ${qsBoundName === name ? "fa-link-slash" : "fa-link"}"></i></button>
                  </div>
                  <button class="menu_button interactable btn-primary lulu-qs-btn-hover lulu-qs-char-apply" style="margin:0; border:none; border-radius:6px; font-size:13px; font-weight:bold; padding:8px 14px; flex-shrink:0; display:inline-flex; align-items:center; gap:6px; white-space:nowrap;">运行 <i class="fa-solid fa-play"></i></button>
                </div>
              </div>`,
            );

            // 检测是否生效（已在上面并行预检过）
            const isActive = activeMap.get(name) === true;
            if (isActive) {
              $item.find(".lulu-qs-char-badge").show();
              $item.addClass("lulu-qs-active");
              $item
                .find(".lulu-qs-char-apply")
                .removeClass("btn-primary")
                .addClass("btn-secondary")
                .html('生效中 <i class="fa-solid fa-check"></i>')
                .css("opacity", "0.7");
            }

            $item.find(".lulu-qs-char-apply").on("click", async function () {
              if ($(this).hasClass("btn-secondary"))
                return toastr.info("这个组合已经在生效啦~ (๑>؂<๑)");
              toastr.info(`正在为角色应用组合 [${name}] ...`);
              $dlg.find(".lulu-qs-char-apply").css("pointer-events", "none");
              try {
                const ok = await qsApplyCharSnap(snapData);
                if (ok) {
                  toastr.success(`✨ 角色组合 [${name}] 应用成功！`);
                  await renderCharSnapList();
                }
              } catch (e) {
                toastr.error(`出了点小意外：${e.message}`);
              } finally {
                $dlg.find(".lulu-qs-char-apply").css("pointer-events", "auto");
              }
            });
            $item.find(".lulu-qs-char-move-up").on("click", function (e) {
              e.stopPropagation();
              moveCharSnap(-1, name);
            });
            $item.find(".lulu-qs-char-move-down").on("click", function (e) {
              e.stopPropagation();
              moveCharSnap(1, name);
            });
            // ✨ 用当前条目状态原地更新此快照（可顺便改名）
            $item.find(".lulu-qs-char-update").on("click", async function (e) {
              e.stopPropagation();
              await luluUpdateCharSnapshotFlow(
                charName,
                name,
                renderCharSnapList,
              );
            });
            // ✨ 绑定/解绑到当前聊天
            $item.find(".lulu-qs-char-bind").on("click", async function (e) {
              e.stopPropagation();
              try {
                if (qsBoundName === name) {
                  const unRes = await SillyTavern.callGenericPopup(
                    `确认解除本聊天对快照【${name}】的绑定吗？<br>解除后进入本聊天就不会再自动应用它啦。`,
                    SillyTavern.POPUP_TYPE.CONFIRM,
                  );
                  if (unRes !== SillyTavern.POPUP_RESULT.AFFIRMATIVE) return;
                  await luluSetChatSnapBinding(charName, null);
                  toastr.success("已解除本聊天的快照绑定~");
                } else {
                  await luluSetChatSnapBinding(charName, name);
                  toastr.success(
                    `🔗 已把快照【${name}】绑定到本聊天！以后进入本聊天会自动应用它~`,
                  );
                }
                await renderCharSnapList();
              } catch (err) {
                toastr.error("绑定操作失败：" + err.message);
              }
            });

            // ✨ 展开/收起：这个快照由哪些书的哪些条目构成（第一次展开时才去读世界书）
            $item
              .find(".lulu-qs-char-detail-toggle")
              .on("click", async function (e) {
                e.stopPropagation();
                const $d = $item.find(".lulu-qs-char-detail");
                const $arrow = $(this).find("i").first();
                if ($d.is(":visible")) {
                  $d.slideUp(120);
                  $arrow.toggleClass("fa-chevron-right fa-chevron-down");
                  return;
                }
                $arrow.toggleClass("fa-chevron-right fa-chevron-down");
                if ($d.data("loaded")) return $d.slideDown(120);
                $d
                  .html('<i class="fa-solid fa-spinner fa-spin"></i> 读取中...')
                  .slideDown(120);
                const qsEscH = (s) =>
                  String(s).replace(/</g, "&lt;").replace(/>/g, "&gt;");
                const parts = [];
                for (const [wb, uids] of Object.entries(snapData)) {
                  let names = [];
                  try {
                    const entries = await getWorldbook(wb);
                    const uidSet = new Set(Array.isArray(uids) ? uids : []);
                    names = (entries || [])
                      .filter((en) => uidSet.has(en.uid))
                      .map(
                        (en) => en.name || en.comment || `(UID ${en.uid})`,
                      );
                  } catch (e2) {
                    names = ["（这本书已不存在或读取失败）"];
                  }
                  parts.push(
                    `<div style="margin-bottom:2px;"><span style="color:var(--SmartThemeQuoteColor); font-weight:bold;">📖 ${qsEscH(wb)}</span>：${names.length ? names.map(qsEscH).join("、") : "（无开启条目）"}</div>`,
                  );
                }
                $d.data("loaded", true).html(parts.join(""));
              });

            $list.append($item);
          }
        };
        // 极速面板角色区：一键关闭
        $dlg
          .find("#lulu-qs-char-close-all")
          .off("click")
          .on("click", async () => {
            const charName = qsGetCharName();
            if (!charName) return toastr.warning("当前没有打开角色聊天哦~");
            const boundBooks = qsGetCharBoundBooks();
            if (boundBooks.length === 0)
              return toastr.info("当前角色没有绑定世界书~");
            const res = await SillyTavern.callGenericPopup(
              `确认关闭 [${charName}] 绑定的 ${boundBooks.length} 本世界书的所有条目吗？`,
              SillyTavern.POPUP_TYPE.CONFIRM,
            );
            if (res !== SillyTavern.POPUP_RESULT.AFFIRMATIVE) return;
            toastr.info("正在关闭...");
            $dlg.find("#lulu-qs-char-close-all").css("pointer-events", "none");
            try {
              for (const wb of boundBooks) {
                let entries = await getWorldbook(wb);
                let changed = false;
                entries.forEach((e) => {
                  if (e.enabled) {
                    e.enabled = false;
                    changed = true;
                  }
                });
                if (changed) await replaceWorldbook(wb, entries);
              }
              toastr.success(`✨ 已关闭 [${charName}] 所有条目~`);
              await renderCharSnapList();
            } catch (e) {
              toastr.error("关闭失败：" + e.message);
            } finally {
              $dlg
                .find("#lulu-qs-char-close-all")
                .css("pointer-events", "auto");
            }
          });

        // 极速面板角色区：批量删除
        $dlg
          .find("#lulu-qs-char-batch-del")
          .off("click")
          .on("click", async () => {
            const charName = qsGetCharName();
            if (!charName) return toastr.warning("当前没有打开角色聊天哦~");
            const allSnaps = qsGetCharSnaps();
            const mySnaps = allSnaps[charName] || {};
            const names =
              typeof sortCharSnapshotNames === "function"
                ? sortCharSnapshotNames(charName, Object.keys(mySnaps))
                : Object.keys(mySnaps);
            if (names.length === 0)
              return toastr.info("这个角色还没有快照可删~");

            let listHtml =
              '<div style="max-height:50vh; overflow-y:auto; display:flex; flex-direction:column; gap:6px;">';
            names.forEach((name) => {
              const safeN = encodeURIComponent(name);
              listHtml += `<label style="display:flex; align-items:center; gap:8px; padding:8px 10px; background:var(--SmartThemeBotMesColor); border:1px solid var(--SmartThemeBorderColor); border-radius:6px; cursor:pointer;"><input type="checkbox" class="lulu-qscsdel-chk" data-name="${safeN}" style="accent-color:#ff6b6b;"><span style="flex:1; word-break:break-all;"><i class="fa-solid fa-camera-retro" style="color:var(--SmartThemeQuoteColor); margin-right:4px;"></i>${name}</span></label>`;
            });
            listHtml += "</div>";

            const $ddlg = $(
              `<div style="padding:6px; min-width:280px; text-align:left;"><h3 style="margin-top:0; color:#ff6b6b;"><i class="fa-solid fa-trash-can"></i> 批量删除角色快照</h3><div style="display:flex; gap:8px; margin-bottom:10px;"><button id="lulu-qscsdel-all" class="menu_button btn-success" style="margin:0; padding:6px 12px; font-size:12px; border:none; flex:1; white-space:nowrap; display:flex; justify-content:center; align-items:center;">全选</button><button id="lulu-qscsdel-none" class="menu_button btn-secondary" style="margin:0; padding:6px 12px; font-size:12px; flex:1; white-space:nowrap; display:flex; justify-content:center; align-items:center;">全不选</button><button id="lulu-qscsdel-invert" class="menu_button btn-info" style="margin:0; padding:6px 12px; font-size:12px; flex:1; white-space:nowrap; display:flex; justify-content:center; align-items:center;" title="勾选的取消、没勾的勾上">反选</button></div>${listHtml}</div>`,
            );
            $ddlg
              .attr("id", "lulu-qscsdel-dialog")
              .prepend(
                `<style>${window.buildPopupThemeCSS("dialog:has(#lulu-qscsdel-dialog)")}</style>`,
              );
            // ✨ 补上：全选 / 全不选 / 反选 按钮的点击事件
            $ddlg
              .find("#lulu-qscsdel-all")
              .on("click", () =>
                $ddlg.find(".lulu-qscsdel-chk").prop("checked", true),
              );
            $ddlg
              .find("#lulu-qscsdel-none")
              .on("click", () =>
                $ddlg.find(".lulu-qscsdel-chk").prop("checked", false),
              );
            $ddlg
              .find("#lulu-qscsdel-invert")
              .on("click", () =>
                $ddlg
                  .find(".lulu-qscsdel-chk")
                  .each(function () {
                    $(this).prop("checked", !$(this).is(":checked"));
                  }),
              );
            const r = await SillyTavern.callGenericPopup(
              $ddlg,
              SillyTavern.POPUP_TYPE.CONFIRM,
              "",
              { okButton: "删除选中", cancelButton: "取消" },
            );
            if (r !== SillyTavern.POPUP_RESULT.AFFIRMATIVE) return;

            const del = [];
            $ddlg.find(".lulu-qscsdel-chk:checked").each(function () {
              del.push(decodeURIComponent($(this).attr("data-name")));
            });
            if (del.length === 0) return toastr.info("没勾选任何快照~");

            luluUpdateGlobalVars(
              (v) => {
                if (typeof v.wb_char_snapshots === "string") {
                  try {
                    v.wb_char_snapshots = JSON.parse(v.wb_char_snapshots);
                  } catch (e) {
                    v.wb_char_snapshots = {};
                  }
                }
                if (v.wb_char_snapshots && v.wb_char_snapshots[charName]) {
                  del.forEach((n) => delete v.wb_char_snapshots[charName][n]);
                }
                return v;
              },
              { type: "global" },
            );
            // ✨ 被删的如果包含本聊天绑定的快照 → 顺带解绑
            const qsBdAfterDel =
              typeof luluGetChatSnapBinding === "function"
                ? luluGetChatSnapBinding()
                : null;
            if (
              qsBdAfterDel &&
              qsBdAfterDel.charName === charName &&
              del.includes(qsBdAfterDel.snapName)
            ) {
              try {
                await luluSetChatSnapBinding(charName, null);
              } catch (e) {}
            }
            toastr.success(`已删除 ${del.length} 个角色快照~`);
            await renderCharSnapList();
          });

        // ========== 标签切换 ==========
        $dlg.find("#lulu-qs-tab-global").on("click", function () {
          $dlg.find(".lulu-qs-tab").removeClass("lulu-qs-tab-active");
          $(this).addClass("lulu-qs-tab-active");
          $dlg.find("#lulu-qs-global-section").show();
          $dlg.find("#lulu-qs-char-section").hide();
        });
        $dlg.find("#lulu-qs-tab-char").on("click", function () {
          $dlg.find(".lulu-qs-tab").removeClass("lulu-qs-tab-active");
          $(this).addClass("lulu-qs-tab-active");
          $dlg.find("#lulu-qs-global-section").hide();
          $dlg.find("#lulu-qs-char-section").show();
          renderCharSnapList();
        });
        // ========== 当前角色快照逻辑结束 ==========
        // ✨ 极速面板 → 全局主面板 一键互切
        $dlg.find("#lulu-qs-open-main").on("click", () => {
          $dlg
            .closest("dialog")
            .find(".popup-button-ok")
            .first()
            .trigger("click");
          $("#option_lulu_wb_manager").click();
        });
        // ✨ 全局快照：点"共涉及 N 本书"展开/收起书单
        $dlg.on("click", ".lulu-qs-wbs-toggle", function (e) {
          e.stopPropagation();
          $(this).next(".lulu-qs-wbs-list").slideToggle(120);
          $(this)
            .find(".lulu-qs-wbs-arrow")
            .toggleClass("fa-chevron-right fa-chevron-down");
        });
        $dlg.find("#lulu-qs-search").on("input", function () {
          const kw = $(this).val().toLowerCase();
          $dlg.find("#lulu-qs-global-section .lulu-qs-item").each(function () {
            const name = decodeURIComponent(
              $(this).find(".lulu-qs-apply-btn").attr("data-rawname"),
            ).toLowerCase();
            $(this).toggle(name.includes(kw));
          });
        });
        // 🆕 角色快照搜索
        $dlg.find("#lulu-qs-char-search").on("input", function () {
          const kw = $(this).val().toLowerCase();
          $dlg.find("#lulu-qs-char-list .lulu-qs-item").each(function () {
            const snapName = decodeURIComponent(
              $(this).attr("data-snapname") || "",
            ).toLowerCase();
            $(this).toggle(!kw || snapName.includes(kw));
          });
        });
        const checkActiveSnapshot = async () => {
          $dlg
            .find("#lulu-qs-status-text")
            .html('<i class="fa-solid fa-spinner fa-spin"></i> 侦测中...');
          $dlg.find(".lulu-qs-badge").hide();
          $dlg.find(".lulu-qs-item").removeClass("lulu-qs-active");
          $dlg
            .find(".lulu-qs-apply-btn")
            .removeClass("btn-secondary")
            .addClass("btn-primary")
            .html('运行 <i class="fa-solid fa-play"></i>')
            .css("opacity", "1");
          const currentGlobals =
            typeof getGlobalWorldbookNames === "function"
              ? getGlobalWorldbookNames()
              : [];
          // ✨ 同一次检测里同一本书只读一次（复合快照往往涉及同一批书）
          const qsWbReadCache = new Map();
          const cachedWbRead = (wb) => {
            if (!qsWbReadCache.has(wb))
              qsWbReadCache.set(
                wb,
                getWorldbook(wb).catch(() => null),
              );
            return qsWbReadCache.get(wb);
          };
          for (const [name, snapData] of Object.entries(snapshots)) {
            const safeName = btoa(unescape(encodeURIComponent(name))).replace(
              /[^a-zA-Z0-9]/g,
              "",
            );
            const isDetailed =
              !Array.isArray(snapData) && snapData.type === "detailed";
            let isActive = false;
            if (!isDetailed) {
              const wbs = Array.isArray(snapData) ? snapData : snapData.wbs;
              if (currentGlobals.length === (wbs?.length || 0)) {
                let a = [...currentGlobals].sort();
                let b = [...(wbs || [])].sort();
                isActive = a.every((val, index) => val === b[index]);
              }
            } else {
              const targetWbNames = Object.keys(snapData.data);
              if (currentGlobals.length === targetWbNames.length) {
                let a = [...currentGlobals].sort();
                let b = [...targetWbNames].sort();
                if (a.every((val, index) => val === b[index])) {
                  let deepMatch = true;
                  // ✨ 并行读取所有目标书（原来是逐本串行 await）
                  const results = await Promise.all(
                    targetWbNames.map((wbName) => cachedWbRead(wbName)),
                  );
                  for (let i = 0; i < targetWbNames.length; i++) {
                    const wbEntries = results[i];
                    if (!wbEntries) {
                      deepMatch = false;
                      break;
                    }
                    let enabledUIDsInWb = wbEntries
                      .filter((e) => e.enabled)
                      .map((e) => e.uid)
                      .sort();
                    let targetUIDs = [
                      ...snapData.data[targetWbNames[i]],
                    ].sort();
                    if (
                      enabledUIDsInWb.length !== targetUIDs.length ||
                      !enabledUIDsInWb.every(
                        (val, idx) => val === targetUIDs[idx],
                      )
                    ) {
                      deepMatch = false;
                      break;
                    }
                  }
                  isActive = deepMatch;
                }
              }
            }
            if (isActive) {
              $dlg
                .find(`.lulu-qs-badge[data-badgename="${safeName}"]`)
                .fadeIn("fast");
              $dlg
                .find(`.lulu-qs-item[data-itemname="${safeName}"]`)
                .addClass("lulu-qs-active");
              $dlg
                .find(`.lulu-qs-apply-btn[data-btnname="${safeName}"]`)
                .removeClass("btn-primary")
                .addClass("btn-secondary")
                .html('生效中 <i class="fa-solid fa-check"></i>')
                .css("opacity", "0.7");
            }
          }
          $dlg
            .find("#lulu-qs-status-text")
            .html('<i class="fa-solid fa-eye"></i> 状态已同步');
        };
        // 极速面板：批量删除快照
        $dlg.find("#lulu-qs-batch-del").on("click", async () => {
          const names = Object.keys(snapshots);
          if (names.length === 0) return toastr.info("没有快照可删~");
          const sorted = sortSnapshotNames(names);
          let listHtml =
            '<div style="max-height:50vh; overflow-y:auto; display:flex; flex-direction:column; gap:6px;">';
          sorted.forEach((name) => {
            const safeN = encodeURIComponent(name);
            listHtml += `<label style="display:flex; align-items:center; gap:8px; padding:8px 10px; background:var(--SmartThemeBotMesColor); border:1px solid var(--SmartThemeBorderColor); border-radius:6px; cursor:pointer;"><input type="checkbox" class="lulu-qsdel-chk" data-name="${safeN}" style="accent-color:#ff6b6b;"><span style="flex:1; word-break:break-all;">${name}</span></label>`;
          });
          listHtml += "</div>";
          const $ddlg = $(
            `<div style="padding:6px; min-width:280px; text-align:left;"><h3 style="margin-top:0; color:#ff6b6b;"><i class="fa-solid fa-trash-can"></i> 批量删除快照</h3><div style="display:flex; gap:8px; margin-bottom:10px;"><button id="lulu-qsdel-all" class="menu_button btn-success" style="margin:0; padding:6px 12px; font-size:12px; border:none; flex:1; white-space:nowrap; display:flex; justify-content:center; align-items:center;">全选</button><button id="lulu-qsdel-none" class="menu_button btn-secondary" style="margin:0; padding:6px 12px; font-size:12px; flex:1; white-space:nowrap; display:flex; justify-content:center; align-items:center;">全不选</button><button id="lulu-qsdel-invert" class="menu_button btn-info" style="margin:0; padding:6px 12px; font-size:12px; flex:1; white-space:nowrap; display:flex; justify-content:center; align-items:center;" title="勾选的取消、没勾的勾上">反选</button></div>${listHtml}</div>`,
          );
          $ddlg
            .attr("id", "lulu-qsdel-dialog")
            .prepend(
              `<style>${window.buildPopupThemeCSS("dialog:has(#lulu-qsdel-dialog)")}</style>`,
            );
          $ddlg
            .find("#lulu-qsdel-all")
            .on("click", () =>
              $ddlg.find(".lulu-qsdel-chk").prop("checked", true),
            );
          $ddlg
            .find("#lulu-qsdel-none")
            .on("click", () =>
              $ddlg.find(".lulu-qsdel-chk").prop("checked", false),
            );
          $ddlg
            .find("#lulu-qsdel-invert")
            .on("click", () =>
              $ddlg
                .find(".lulu-qsdel-chk")
                .each(function () {
                  $(this).prop("checked", !$(this).is(":checked"));
                }),
            );
          const r = await SillyTavern.callGenericPopup(
            $ddlg,
            SillyTavern.POPUP_TYPE.CONFIRM,
            "",
            { okButton: "删除选中", cancelButton: "取消" },
          );
          if (r !== SillyTavern.POPUP_RESULT.AFFIRMATIVE) return;
          const del = [];
          $ddlg.find(".lulu-qsdel-chk:checked").each(function () {
            del.push(decodeURIComponent($(this).attr("data-name")));
          });
          if (del.length === 0) return toastr.info("没勾选任何快照~");
          luluUpdateGlobalVars(
            (v) => {
              if (typeof v.wb_snapshots === "string") {
                try {
                  v.wb_snapshots = JSON.parse(v.wb_snapshots);
                } catch (e) {
                  v.wb_snapshots = {};
                }
              }
              if (v.wb_snapshots) del.forEach((n) => delete v.wb_snapshots[n]);
              return v;
            },
            { type: "global" },
          );
          del.forEach((n) => delete snapshots[n]);
          toastr.success(`已删除 ${del.length} 个快照~`);
          // 刷新极速面板：把对应卡片移除
          del.forEach((n) => {
            const safe = btoa(unescape(encodeURIComponent(n))).replace(
              /[^a-zA-Z0-9]/g,
              "",
            );
            $dlg.find(`.lulu-qs-item[data-itemname="${safe}"]`).remove();
          });
        });
        checkActiveSnapshot();
        $dlg.find("#lulu-qs-clear-all").on("click", async () => {
          toastr.info("收到！清扫世界书占用的空间...");
          try {
            await rebindGlobalWorldbooks([]);
            toastr.success("✨ 所有的全局世界书都关掉啦~");
            checkActiveSnapshot();
          } catch (e) {
            toastr.error("卸载失败...");
          }
        });
        // 极速面板排序（功能8）——改的是同一个 wb_snapshot_order，自动和主面板同步
        const reorderQuickSnapshot = (rawName, dir) => {
          const sName = decodeURIComponent(rawName);
          let order = getSnapshotOrder();
          // 确保所有当前快照都在 order 里
          Object.keys(snapshots).forEach((n) => {
            if (!order.includes(n)) order.push(n);
          });
          const idx = order.indexOf(sName);
          const swapWith = idx + dir;
          if (swapWith < 0 || swapWith >= order.length) return;
          [order[idx], order[swapWith]] = [order[swapWith], order[idx]];
          setSnapshotOrder(order);
          // 重新排列 DOM 里的卡片顺序（不重建整个弹窗，体验更顺滑）
          const $items = $dlg.find(".lulu-qs-item").get();
          $items.sort((a, b) => {
            const na = decodeURIComponent(
              $(a).find(".lulu-qs-apply-btn").attr("data-rawname"),
            );
            const nb = decodeURIComponent(
              $(b).find(".lulu-qs-apply-btn").attr("data-rawname"),
            );
            let ia = order.indexOf(na);
            let ib = order.indexOf(nb);
            if (ia === -1) ia = 9999;
            if (ib === -1) ib = 9999;
            return ia - ib;
          });
          const $container = $dlg.find(".lulu-qs-item").first().parent();
          $items.forEach((el) => $container.append(el));
        };
        $dlg.find(".lulu-qs-move-up").on("click", function (e) {
          e.stopPropagation();
          reorderQuickSnapshot($(this).attr("data-rawname"), -1);
        });
        $dlg.find(".lulu-qs-move-down").on("click", function (e) {
          e.stopPropagation();
          reorderQuickSnapshot($(this).attr("data-rawname"), 1);
        });
        $dlg.find(".lulu-qs-apply-btn").on("click", async function () {
          if ($(this).hasClass("btn-secondary")) {
            toastr.info("正在卸载当前全局世界书...");
            $dlg.find(".lulu-qs-apply-btn").css("pointer-events", "none");
            try {
              await rebindGlobalWorldbooks([]);
              toastr.success("✨ 已卸载当前全局世界书~");
              await checkActiveSnapshot();
            } catch (e) {
              toastr.error(`出现了小意外：${e.message}`);
            } finally {
              $dlg.find(".lulu-qs-apply-btn").css("pointer-events", "auto");
            }
            return;
          }
          const sName = decodeURIComponent($(this).attr("data-rawname"));
          const sData = snapshots[sName];
          const isDetailed = !Array.isArray(sData) && sData.type === "detailed";
          toastr.info(`正在为您布置场景 [${sName}] ...请稍后`);
          $dlg.find(".lulu-qs-apply-btn").css("pointer-events", "none");
          try {
            if (isDetailed) {
              const dataFields = sData.data;
              const allWbNames = getWorldbookNames(),
                targetWbNames = Object.keys(dataFields);
              // 只处理快照里明确包含的世界书；快照没提到的书一律不动
              for (const wbName of targetWbNames) {
                if (!allWbNames.includes(wbName)) continue; // 快照里的书已被删除/改名，跳过
                let wbEntries = await getWorldbook(wbName),
                  changed = false;
                const enabledUIDs = dataFields[wbName];
                wbEntries.forEach((entry) => {
                  const shouldBeEnabled = enabledUIDs.includes(entry.uid);
                  if (entry.enabled !== shouldBeEnabled) {
                    entry.enabled = shouldBeEnabled;
                    changed = true;
                  }
                });
                if (changed) await replaceWorldbook(wbName, wbEntries);
              }
              await rebindGlobalWorldbooks(targetWbNames);
            } else {
              const wbs = Array.isArray(sData) ? sData : sData.wbs;
              await rebindGlobalWorldbooks(wbs);
            }
            toastr.success(`✨ 快照 [${sName}] 切换大成功！`);
            await checkActiveSnapshot();
          } catch (e) {
            toastr.error(`出现了小意外：${e.message}`);
          } finally {
            $dlg.find(".lulu-qs-apply-btn").css("pointer-events", "auto");
          }
        });
      },
    },
  );
  await popup.show();
};

