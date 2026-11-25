// 按依赖顺序装配各模块（顺序不可随意调整）
import "./cleanup.js";
import "./state.js";
import "./utils.js";
import "./theme.js";
import "./group-map.js";
import "./dom-shared.js";
import "./import-times.js";
import "./snapshot-order.js";
import "./char-snapshot.js";
import "./persona.js";
import "./quick-snapshot.js";
import "./floating.js";
import "./native-sync.js";
import "./binding-cache.js";
import { bindMainPanel } from "./main-panel.js";
import { initMenuEntry } from "./menu-entry.js";
import "./auto-detect.js";

try {
  replaceScriptButtons([]);
} catch (e) {}
$("#option_lulu_wb_manager").remove();

const $menuBtn = $("<a>", {
  id: "option_lulu_wb_manager",
  class: "interactable",
  tabindex: 0,
})
  .append(
    $("<i>", {
      class: "fa-lg fa-solid fa-book-atlas",
      css: { paddingRight: "12px" },
    }),
  )
  .append($("<span>").text("全局世界书管理"));

let $insertTarget = $("#option_delete_mes");

if ($insertTarget.length === 0) {
  $insertTarget = $(".options-content").find("hr").last();
}

if ($insertTarget.length > 0) {
  $menuBtn.insertBefore($insertTarget);
} else {
  const $container = $(".options-content").length
    ? $(".options-content")
    : $("#options");
  $container.append($menuBtn);
}


bindMainPanel($menuBtn);
initMenuEntry();
