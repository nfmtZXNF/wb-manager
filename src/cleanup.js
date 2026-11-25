import { replaceScriptButtons } from "./compat.js";

// ========== 【卸载清理】脚本被禁用/更新/重载时，所在 iframe 会触发 pagehide：趁机把注入页面的痕迹全部清掉 ==========
// 登记处：定时器 id、事件解绑函数在各资源创建时登记进来；DOM 选择器静态列举（移除不存在的元素无害）
const luluWbCleanupRegistry = {
  intervals: [], // setInterval 的 id
  eventCleanups: [], // 事件解绑函数
};
// 注入到页面的元素（含样式表），卸载时统一移除
const LULU_WB_INJECTED_SELECTORS = [
  "#option_lulu_wb_manager", // 左下角菜单按钮
  "#lulu-wb-floating-btn", // 悬浮球
  "#lulu-wb-floating-style", // 悬浮球样式
  "#lulu-drag-line-style", // 原生分组拖拽样式
  "#lulu-sticky-note-window", // 便签小窗
  "#lulu-theme-override-style", // 面板主题覆盖样式
  "#lulu-sticky-theme-style", // 便签主题样式
  "#lulu-sticky-structure-style", // 便签结构样式
  "#lulu-wb-tail-style", // 文件末尾追加的全局样式
];
// 挂在 window 上的全局函数/标志，卸载时一并摘掉，防止残留引用指向已销毁的 iframe
const LULU_WB_WINDOW_PROPS = [
  "luluGetExtractedMap",
  "luluMarkExtracted",
  "luluGetExtractedName",
  "buildPopupThemeCSS",
  "luluOpenQuickSnapshotView",
  "luluWbInitTabType",
  "luluStartNativeWbSync",
  "luluNativeSyncAutostartTimer",
  "lulu_native_sync_interval",
  "lulu_native_cleaned",
  "lulu_auto_detect_inited",
  "__luluFloatRedock",
  "__luluFloatResizeBound",
];
const luluWbCleanup = () => {
  if (window.__luluWbCleaned) return;
  window.__luluWbCleaned = true;
  // 1) 停掉所有还在跑的定时器（原生分组轮询、自动启动轮询等）
  try {
    if (window.lulu_native_sync_interval)
      clearInterval(window.lulu_native_sync_interval);
    if (window.luluNativeSyncAutostartTimer)
      clearInterval(window.luluNativeSyncAutostartTimer);
    luluWbCleanupRegistry.intervals.forEach((id) => clearInterval(id));
  } catch (e) {}
  // 2) 解绑挂在酒馆事件总线上的监听（聊天切换自动检测等）
  luluWbCleanupRegistry.eventCleanups.forEach((fn) => {
    try {
      fn();
    } catch (e) {}
  });
  // 3) 移除注入的所有界面元素（菜单按钮、悬浮球、便签窗、样式表）
  try {
    LULU_WB_INJECTED_SELECTORS.forEach((sel) => $(sel).remove());
  } catch (e) {}
  // 4) 还开着的弹窗（主面板/极速快照/救援/扫描等）一并关掉
  try {
    $(
      "dialog.wb-manager-dialog, dialog.lulu-qs-dialog, dialog:has(#lulu-rescue-dialog), dialog:has(#lulu-scan-dialog-inner), dialog:has(#lulu-scan-char-select-dialog)",
    ).each(function () {
      try {
        this.close();
      } catch (e) {}
      $(this).remove();
    });
  } catch (e) {}
  // 4.5) 脚本按钮也清掉（部分助手版本禁用时会自己收，这里兜底）
  try {
    replaceScriptButtons([]);
  } catch (e) {}
  // 5) 原生世界书列表恢复原样：移除分组表头、还原条目顺序与样式
  try {
    $(".lulu-native-group-header").remove();
    const $entries = $(".world_entry[uid]");
    if ($entries.length) {
      $entries.first().parent().css({ display: "", "flex-direction": "" });
      $entries
        .css({ order: "", display: "", margin: "" })
        .removeClass("lulu-folded-hide");
    }
  } catch (e) {}
  // 6) 摘掉挂在 window 上的全局函数与标志，避免残留引用报错
  LULU_WB_WINDOW_PROPS.forEach((k) => {
    try {
      delete window[k];
    } catch (e) {
      window[k] = undefined;
    }
  });
  try {
    console.log(
      "Lù-chan: 脚本已关闭，注入的界面元素已清理干净，不用再刷新页面啦~",
    );
  } catch (e) {}
};
window.__luluWbCleaned = false;
$(window).on("pagehide beforeunload unload", luluWbCleanup);

export { luluWbCleanupRegistry, LULU_WB_INJECTED_SELECTORS, LULU_WB_WINDOW_PROPS, luluWbCleanup };
