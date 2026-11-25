import { getWorldbook, getWorldbookNames } from "./compat.js";
import { luluWbCleanupRegistry } from "./cleanup.js";
import { LULU_MAP_ENTRY_TAG, readGroupMapFromEntries } from "./group-map.js";
import { getEntryUiGroup } from "./state.js";

// ============================================================
// 【新增】原生世界书分组同步：不打开管理面板也自动运行
// 粘贴这段后，原来的代码一行都不用删！
// 原理：面板里原来那份和这份会互相顶替，永远不会双开
// ============================================================
window.luluStartNativeWbSync = function () {
  if (window.lulu_native_sync_interval)
    clearInterval(window.lulu_native_sync_interval);

  // ✨ 判断某个分组当前是"全开""全关"还是"混合"状态
  const luluGetGroupState = (grpName) => {
    const $switches = $(`.world_entry[data-lulu-grp="${grpName}"]`).find(
      ".killSwitch",
    );
    if ($switches.length === 0) return "empty";
    let onCount = 0;
    $switches.each(function () {
      if ($(this).hasClass("fa-toggle-on")) onCount++;
    });
    if (onCount === 0) return "off"; // 全关
    if (onCount === $switches.length) return "on"; // 全开
    return "mixed"; // 混合
  };

  // ✨ 一键开关某个原生分组内所有条目
  const luluToggleGroupEntries = (grpName, enable) => {
    const $switches = $(`.world_entry[data-lulu-grp="${grpName}"]`).find(
      ".killSwitch",
    );
    if ($switches.length === 0) {
      if (typeof toastr !== "undefined")
        toastr.info("这个分组里好像没有可操作的条目呢~");
      return;
    }
    let count = 0;
    $switches.each(function () {
      const isOn = $(this).hasClass("fa-toggle-on");
      // 只有当前状态和目标状态不一致时，才点击切换
      if (isOn !== enable) {
        this.click();
        count++;
      }
    });
    if (typeof toastr !== "undefined") {
      toastr.success(
        enable
          ? `已开启分组「${grpName}」内 ${count} 个条目！`
          : `已关闭分组「${grpName}」内 ${count} 个条目！`,
      );
    }
    // 点完后刷新一下按钮图标显示
    luluUpdateGroupSwitchIcon(grpName);
  };

  // ✨ 根据分组状态，更新表头那个一键开关图标的样子
  const luluUpdateGroupSwitchIcon = (grpName) => {
    const $btn = $(
      `.lulu-native-group-header[data-groupname="${grpName}"] .lulu-grp-toggle`,
    );
    if (!$btn.length) return;
    const state = luluGetGroupState(grpName);
    if (state === "on") {
      // 全开 → 显示"开"图标，绿色，点击会全关
      $btn
        .removeClass("fa-toggle-off")
        .addClass("fa-toggle-on")
        .css("color", "#51cf66")
        .attr("data-next", "off")
        .attr("title", "本组已全开，点击一键全关");
    } else {
      // 全关或混合 → 显示"关"图标，灰色，点击会全开
      $btn
        .removeClass("fa-toggle-on")
        .addClass("fa-toggle-off")
        .css("color", "gray")
        .attr("data-next", "on")
        .attr(
          "title",
          state === "mixed"
            ? "本组部分开启，点击一键全开"
            : "本组已全关，点击一键全开",
        );
    }
  };
  let groupFoldState = JSON.parse(
    localStorage.getItem("lulu_wb_native_fold_state") || "{}",
  );
  const saveFoldState = () =>
    localStorage.setItem(
      "lulu_wb_native_fold_state",
      JSON.stringify(groupFoldState),
    );
  let currentActiveWbName = null;
  let cachedWbEntries = [];
  let isFetching = false;
  let isRendering = false;
  let luluLastSyncFingerprint = "";
  // ✨ 抽成命名函数：除了 2 秒轮询自己调，用户拖拽/点箭头排序后也可以立刻强制调用，不用干等下一轮
  const luluNativeSyncTick = async (force = false) => {
    if (isRendering && !force) return;
    if (document.hidden) return;
    // ✨【性能】管理面板打开期间，原生页面被模态弹窗完全遮挡，
    //    此刻做分组同步纯属白干（用户看不见），面板关掉后指纹比对自然会补一次同步
    if (!force && $("dialog.wb-manager-dialog[open]").length > 0) return;
    const isNativeMagicEnabled =
      localStorage.getItem("lulu_wb_native_magic_enabled") !== "false";

    // 【性能优化】原生分类已关闭且已清理完时，直接休息，连选择器都不跑
    if (!isNativeMagicEnabled && window.lulu_native_cleaned) return;

    // ✨ 只选真实条目（带 uid 属性的）：排除酒馆页面底部常驻的隐藏条目模板，不然计数永远多 1
    const $entries = $(".world_entry[uid]");
    if ($entries.length === 0) return;
    const $container = $entries.first().parent();
    if (!$container.length) return;
    if (!$container.is(":visible")) return;
    // ✨ 内容指纹：状态没变就直接跳过（注意：指纹要等画完了才记录，不能在这里就记）
    let luluCurrentFp = null;
    if (isNativeMagicEnabled) {
      const _wbName =
        $(".move_entry_button").first().attr("data-current-world") || "";
      const _order = localStorage.getItem("lulu_wb_native_group_order") || "";
      const _fold = localStorage.getItem("lulu_wb_native_fold_state") || "";
      const _headerCount = $container.children(
        ".lulu-native-group-header",
      ).length;
      luluCurrentFp = `${_wbName}|${$entries.length}|${_order}|${_fold}|${_headerCount}`;
      // ✨ 强制调用（点了箭头/拖拽）跳过指纹判断，必须立即重排
      if (!force && luluCurrentFp === luluLastSyncFingerprint) return;
    }
    if (!isNativeMagicEnabled) {
      // ✨【性能优化】只清理一次，不再每轮反复检查样式
      if ($container.css("display") === "flex") {
        $container.css({ display: "", "flex-direction": "" });
        $(".lulu-native-group-header").remove();
        $entries.css({ order: "", display: "", margin: "" });
      }
      window.lulu_native_cleaned = true;
      return;
    }

    // ✨ 原生分组开启时，重置清理标记（这样以后关闭时还能再清理一次）
    window.lulu_native_cleaned = false;
    // ✨ 强制调用（点了箭头/拖拽）不被 fetch 挡住；书名不一致时下面自然还会返回
    if (isFetching && !force) return;
    if (
      $container.css("display") !== "flex" ||
      $container.css("flex-direction") !== "column"
    ) {
      $container.css({ display: "flex", "flex-direction": "column" });
    }
    const $moveBtn = $(".move_entry_button").first();
    let visibleWbName = $moveBtn.attr("data-current-world");
    if (!visibleWbName) {
      visibleWbName =
        $("#world_info_select").val() ||
        $(".world_info_select").first().val() ||
        "";
    }
    if (!visibleWbName) return;

    if (currentActiveWbName !== visibleWbName) {
      isFetching = true;
      try {
        const rawData = await getWorldbook(visibleWbName);
        if (Array.isArray(rawData)) {
          cachedWbEntries = rawData;
          currentActiveWbName = visibleWbName;
        } else if (rawData && typeof rawData === "object") {
          // 兼容某些版本返回 { entries: [...] } 或 { entries: { ... } }
          const maybeEntries = rawData.entries || rawData.data?.entries;
          const arr = Array.isArray(maybeEntries)
            ? maybeEntries
            : maybeEntries
              ? Object.values(maybeEntries)
              : [];
          if (arr.length > 0) {
            cachedWbEntries = arr;
            currentActiveWbName = visibleWbName;
          }
        }
      } catch (err) {
        console.warn("Lulu 原生同步：读取世界书失败", err);
      } finally {
        isFetching = false;
      }
    }
    if (!cachedWbEntries || cachedWbEntries.length === 0) return;
    if (currentActiveWbName !== visibleWbName) return;

    const entryByName = new Map();
    const entryByUid = new Map();
    for (const e of cachedWbEntries) {
      const title = e.name || e.comment || "";
      if (title && !entryByName.has(title)) entryByName.set(title, e);
      const uid = e.uid !== undefined && e.uid !== null ? e.uid : e.id;
      if (uid !== undefined && uid !== null) {
        entryByUid.set(String(uid), e);
        const uidNum = Number(uid);
        if (!Number.isNaN(uidNum)) entryByUid.set(String(uidNum), e);
      }
    }

    const luluPrefixMap = readGroupMapFromEntries(cachedWbEntries);

    const groupCounts = {};
    $entries.each(function (index) {
      const $entry = $(this);

      let entryTitle =
        $entry.find('textarea[name="comment"]').val()?.trim() || "";
      if (!entryTitle) {
        entryTitle = $entry.find('input[name="comment"]').val()?.trim() || "";
      }
      if (!entryTitle) {
        entryTitle =
          $entry.find('textarea, input[type="text"]').first().val()?.trim() ||
          "";
      }
      if (!entryTitle) {
        entryTitle = (
          $entry.attr("data-comment") ||
          $entry.attr("title") ||
          ""
        ).trim();
      }

      // 对照表条目直接隐藏
      if (entryTitle.indexOf(LULU_MAP_ENTRY_TAG) === 0) {
        $entry.css("display", "none");
        $entry.attr("data-lulu-grp", "__LULU_MAP__");
        return true;
      }

      let myGroup = "📁 未分类条目";

      let domUid = null;
      const rawUidAttr =
        $entry.attr("uid") ||
        $entry.attr("data-uid") ||
        $entry.attr("data-entry-uid") ||
        $entry.data("uid") ||
        $entry.data("id");
      if (
        rawUidAttr !== undefined &&
        rawUidAttr !== null &&
        rawUidAttr !== ""
      ) {
        const parsed = parseInt(rawUidAttr, 10);
        if (!isNaN(parsed)) domUid = parsed;
      }
      if (domUid === null) {
        const attrs = $entry[0].attributes;
        for (const attr of attrs) {
          if (/uid/i.test(attr.name)) {
            const parsed = parseInt(attr.value, 10);
            if (!isNaN(parsed)) {
              domUid = parsed;
              break;
            }
          }
        }
      }

      let foundEntry = null;
      if (domUid !== null) {
        foundEntry = entryByUid.get(String(domUid)) || entryByUid.get(domUid);
      }
      if (!foundEntry && entryTitle) {
        foundEntry = entryByName.get(entryTitle);
      }

      if (foundEntry) {
        // 1) 先读全局分组缓存 / extensions.lulu_group
        let uiGrpName = getEntryUiGroup(
          currentActiveWbName,
          foundEntry.uid,
          foundEntry,
        );

        // 2) 如果没有，再像脚本面板一样，用【前缀】+ 世界书对照表解析
        if ((!uiGrpName || uiGrpName.trim() === "") && foundEntry.name) {
          const prefixMatch = (foundEntry.name || "").match(/^【(.*?)】/);
          if (prefixMatch && prefixMatch[1]) {
            const rawPrefix = prefixMatch[1].trim();
            if (luluPrefixMap && luluPrefixMap[rawPrefix]) {
              uiGrpName = luluPrefixMap[rawPrefix];
            }
          }
        }

        if (uiGrpName && uiGrpName.trim() !== "") myGroup = uiGrpName.trim();
      }

      if (!groupCounts[myGroup]) groupCounts[myGroup] = 0;
      groupCounts[myGroup]++;
      $entry.attr("data-lulu-grp", myGroup);
      $entry.attr("data-lulu-native-index", index);
    });

    let luluGroupOrder = JSON.parse(
      localStorage.getItem("lulu_wb_native_group_order") || "[]",
    );
    let currentGroups = Object.keys(groupCounts).filter(
      (g) => g !== "📁 未分类条目",
    );
    let orderChanged = false;
    currentGroups.forEach((g) => {
      if (!luluGroupOrder.includes(g)) {
        luluGroupOrder.push(g);
        orderChanged = true;
      }
    });
    if (orderChanged)
      localStorage.setItem(
        "lulu_wb_native_group_order",
        JSON.stringify(luluGroupOrder),
      );
    const sortedGroupNames = Object.keys(groupCounts).sort((a, b) => {
      if (a === "📁 未分类条目") return 1;
      if (b === "📁 未分类条目") return -1;
      let idxA = luluGroupOrder.indexOf(a);
      let idxB = luluGroupOrder.indexOf(b);
      if (idxA === -1) idxA = 9999;
      if (idxB === -1) idxB = 9999;
      return idxA - idxB;
    });
    sortedGroupNames.forEach((gName, gIndex) => {
      const baseOrder = (gIndex + 1) * 10000;
      let $header = $container.children(
        `.lulu-native-group-header[data-groupname="${gName}"]`,
      );
      const isFolded = groupFoldState[gName] === true;
      const isDraggable = gName !== "📁 未分类条目";
      if ($header.length === 0) {
        const dragIconHtml = isDraggable
          ? `<i class="fa-solid fa-hand-paper lulu-drag-handle" style="cursor:grab; font-size:13px; color:gray; padding-right:8px; display:inline-flex; align-items:center;" title="按住拖拽排序分类"></i>`
          : "";
        const sortButtonsHtml = !isDraggable
          ? ""
          : `<div style="display:flex; gap: 6px; margin-right: 15px;" class="lulu-sort-btns"><i class="fa-solid fa-arrow-up lulu-move-up" title="将此分类上移" style="padding:4px; font-size:13px; color:gray; transition:0.2s; cursor:pointer;"></i><i class="fa-solid fa-arrow-down lulu-move-down" title="将此分类下移" style="padding:4px; font-size:13px; color:gray; transition:0.2s; cursor:pointer;"></i></div>`;
        $header = $(
          `<div class="lulu-native-group-header" data-groupname="${gName}" draggable="${isDraggable ? "true" : "false"}" style="background: var(--SmartThemeBlurTintColor, rgba(0,0,0,0.15)); padding:10px 14px; margin: 10px 0 6px 0; border-radius:6px; font-weight:bold; color:var(--SmartThemeQuoteColor, #70a1ff); border:1px solid var(--SmartThemeBorderColor, gray); display:flex; justify-content:space-between; align-items:center; user-select:none; transition: 0.2s; flex-shrink: 0; align-content: center; gap: 6px; flex-wrap: wrap;"><span style="display:flex; align-items:center; min-width:0;">${dragIconHtml}<span class="lulu-click-fold" style="display:flex; align-items:center; cursor:pointer; min-width:0;"><i class="fa-solid ${isFolded ? "fa-chevron-right" : "fa-chevron-down"} lulu-fold-icon" style="margin-right:8px; width: 16px; text-align:center; flex-shrink:0;"></i><span style="font-size: 15px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" class="lulu-g-title">${gName}</span><span style="font-size: 11px; font-weight: normal; color: gray; margin-left: 6px; flex-shrink:0;" class="lulu-g-count">(${groupCounts[gName]}项)</span></span></span><span style="display:flex; align-items:center; gap:6px; flex-shrink:0;">${sortButtonsHtml}<i class="fa-solid fa-toggle-off lulu-grp-toggle" title="一键开关本组所有条目" data-next="on" style="padding:5px; font-size:15px; color:gray; cursor:pointer; transition:0.2s;"></i></span></div>`,
        );
        $header.hover(
          function () {
            $(this).css(
              "background",
              "var(--SmartThemeBotMesColor, rgba(125,125,125,0.3))",
            );
          },
          function () {
            $(this).css(
              "background",
              "var(--SmartThemeBlurTintColor, rgba(0,0,0,0.15))",
            );
          },
        );
        $header.find(".lulu-move-up, .lulu-move-down").hover(
          function () {
            $(this).css("color", "var(--SmartThemeQuoteColor)");
            $(this).css("transform", "scale(1.2)");
          },
          function () {
            $(this).css("color", "gray");
            $(this).css("transform", "scale(1)");
          },
        );
        $header
          .find(".lulu-click-fold")
          .off("click.luluFold")
          .on("click.luluFold", function (e) {
            e.stopPropagation();
            if ($(this).data("lulu-click-locked")) return;
            $(this).data("lulu-click-locked", true);
            setTimeout(() => $(this).data("lulu-click-locked", false), 250);
            const grp = $header.attr("data-groupname");
            const isNowFolded = !groupFoldState[grp];
            groupFoldState[grp] = isNowFolded;
            saveFoldState();
            const $icon = $(this).find(".lulu-fold-icon");
            if (isNowFolded)
              $icon.removeClass("fa-chevron-down").addClass("fa-chevron-right");
            else
              $icon.removeClass("fa-chevron-right").addClass("fa-chevron-down");
            $container
              .children(`.world_entry[data-lulu-grp="${grp}"]`)
              .each(function () {
                if (isNowFolded) {
                  $(this).addClass("lulu-folded-hide");
                } else {
                  $(this).removeClass("lulu-folded-hide");
                  $(this).css({ display: "", margin: "" });
                }
              });
          });
        if (isDraggable) {
          $header.off("dragstart").on("dragstart", function (e) {
            e.originalEvent.dataTransfer.setData("text/plain", gName);
            $(this).addClass("lulu-drag-ghost");
          });
          $header.on("dragend", function () {
            $(this).removeClass("lulu-drag-ghost");
            $(".lulu-drag-over-top, .lulu-drag-over-bottom").removeClass(
              "lulu-drag-over-top lulu-drag-over-bottom",
            );
          });
          $header.on("dragover", function (e) {
            e.preventDefault();
            const rect = this.getBoundingClientRect();
            const isBottomHalf =
              e.originalEvent.clientY > rect.top + rect.height / 2;
            if (isBottomHalf) {
              $(this)
                .removeClass("lulu-drag-over-top")
                .addClass("lulu-drag-over-bottom");
            } else {
              $(this)
                .removeClass("lulu-drag-over-bottom")
                .addClass("lulu-drag-over-top");
            }
          });
          $header.on("dragleave", function () {
            $(this).removeClass("lulu-drag-over-top lulu-drag-over-bottom");
          });
          $header.on("drop", function (e) {
            e.preventDefault();
            $(this).removeClass("lulu-drag-over-top lulu-drag-over-bottom");
            const draggedGrp =
              e.originalEvent.dataTransfer.getData("text/plain");
            const targetGrp = $(this).attr("data-groupname");
            if (
              draggedGrp &&
              draggedGrp !== targetGrp &&
              draggedGrp !== "📁 未分类条目" &&
              targetGrp !== "📁 未分类条目"
            ) {
              let order = JSON.parse(
                localStorage.getItem("lulu_wb_native_group_order") || "[]",
              );
              const fromIdx = order.indexOf(draggedGrp);
              if (fromIdx > -1) {
                const rect = this.getBoundingClientRect();
                const isBottomHalf =
                  e.originalEvent.clientY > rect.top + rect.height / 2;
                order.splice(fromIdx, 1);
                let newToIdx = order.indexOf(targetGrp);
                if (isBottomHalf) newToIdx++;
                order.splice(newToIdx, 0, draggedGrp);
                localStorage.setItem(
                  "lulu_wb_native_group_order",
                  JSON.stringify(order),
                );
                // ✨ 立刻重排，不用等下一轮 2 秒轮询
                luluNativeSyncTick(true);
              }
            }
          });
        }
        $header
          .find(".lulu-move-up")
          .off("click")
          .on("click", function (e) {
            e.stopPropagation();
            const idx = luluGroupOrder.indexOf(gName);
            if (idx > 0) {
              [luluGroupOrder[idx - 1], luluGroupOrder[idx]] = [
                luluGroupOrder[idx],
                luluGroupOrder[idx - 1],
              ];
              localStorage.setItem(
                "lulu_wb_native_group_order",
                JSON.stringify(luluGroupOrder),
              );
              // ✨ 立刻重排，不用等下一轮 2 秒轮询
              luluNativeSyncTick(true);
            }
          });
        $header
          .find(".lulu-move-down")
          .off("click")
          .on("click", function (e) {
            e.stopPropagation();
            const idx = luluGroupOrder.indexOf(gName);
            if (idx !== -1 && idx < luluGroupOrder.length - 1) {
              [luluGroupOrder[idx + 1], luluGroupOrder[idx]] = [
                luluGroupOrder[idx],
                luluGroupOrder[idx + 1],
              ];
              localStorage.setItem(
                "lulu_wb_native_group_order",
                JSON.stringify(luluGroupOrder),
              );
              // ✨ 立刻重排，不用等下一轮 2 秒轮询
              luluNativeSyncTick(true);
            }
          });

        // ✨ 单个一键开关：根据当前状态智能全开/全关
        $header
          .find(".lulu-grp-toggle")
          .off("click")
          .on("click", function (e) {
            e.stopPropagation();
            const grp = $header.attr("data-groupname");
            const next = $(this).attr("data-next"); // "on" 或 "off"
            luluToggleGroupEntries(grp, next === "on");
          });

        $container.append($header);
      } else {
        $header.find(".lulu-g-count").text(`(${groupCounts[gName]}项)`);
        const $icon = $header.find(".lulu-fold-icon");
        if (isFolded)
          $icon.removeClass("fa-chevron-down").addClass("fa-chevron-right");
        else $icon.removeClass("fa-chevron-right").addClass("fa-chevron-down");
      }
      // ✨ 每轮同步都更新一下这个分组的一键开关图标
      luluUpdateGroupSwitchIcon(gName);
      $header.css("order", baseOrder);
      // ✨ 关键修复：每次循环都实时读取最新折叠状态，而不是用创建表头时的旧变量
      const isFoldedNow = groupFoldState[gName] === true;
      // 顺便同步一下图标，保证图标和实际状态一致
      const $iconSync = $header.find(".lulu-fold-icon");
      if (isFoldedNow)
        $iconSync.removeClass("fa-chevron-down").addClass("fa-chevron-right");
      else
        $iconSync.removeClass("fa-chevron-right").addClass("fa-chevron-down");
      $container
        .children(`.world_entry[data-lulu-grp="${gName}"]`)
        .each(function () {
          const nativeIdx = parseInt(
            $(this).attr("data-lulu-native-index") || 0,
          );
          const targetOrder = baseOrder + 1 + nativeIdx;
          const $this = $(this);
          // ✨【性能优化】用 data 属性缓存 order，避免每次读取样式强制重排
          if (parseInt($this.attr("data-lulu-order") || "") !== targetOrder) {
            $this.attr("data-lulu-order", targetOrder);
            $this.css("order", targetOrder);
          }
          if (isFoldedNow) {
            if (!$this.hasClass("lulu-folded-hide"))
              $this.addClass("lulu-folded-hide");
          } else {
            if ($this.hasClass("lulu-folded-hide")) {
              $this.removeClass("lulu-folded-hide");
              $this.css({ display: "", margin: "" });
            }
          }
        });
    });

    $container.children(".lulu-native-group-header").each(function () {
      const gName = $(this).attr("data-groupname");
      if (!groupCounts[gName]) $(this).remove();
    });
    // ✨ 画完后用"当下最新"的状态记录指纹：等待 fetch 期间用户可能又改了顺序/折叠，记旧指纹会把改动吞掉
    if (isNativeMagicEnabled) {
      const _fpName =
        $(".move_entry_button").first().attr("data-current-world") || "";
      const _fpOrder = localStorage.getItem("lulu_wb_native_group_order") || "";
      const _fpFold = localStorage.getItem("lulu_wb_native_fold_state") || "";
      const _fpHeaders = $container.children(
        ".lulu-native-group-header",
      ).length;
      luluLastSyncFingerprint = `${_fpName}|${$entries.length}|${_fpOrder}|${_fpFold}|${_fpHeaders}`;
    }
    isRendering = true;
    setTimeout(() => {
      isRendering = false;
    }, 150);
  };
  window.lulu_native_sync_interval = setInterval(
    () => luluNativeSyncTick(),
    2000, // ✨ 2 秒轮询 + 点按立即重排：实测最流畅的组合（MutationObserver 版已弃用，刷屏时反而拖慢页面）
  );
  // 登记到卸载清理处：脚本被禁用时这个轮询要跟着停
  luluWbCleanupRegistry.intervals.push(window.lulu_native_sync_interval);
};

// 等酒馆的关键函数加载好之后，再自动启动（防止脚本跑太早报错）
window.luluNativeSyncAutostartTimer = setInterval(() => {
  if (
    typeof getWorldbook === "function" &&
    typeof getWorldbookNames === "function"
  ) {
    clearInterval(window.luluNativeSyncAutostartTimer);
    window.luluNativeSyncAutostartTimer = null;
    try {
      window.luluStartNativeWbSync();
      console.log("Lù-chan: 原生世界书同步已自动启动~（不用先开面板啦）");
    } catch (e) {
      console.error("Lulu 原生同步自动启动失败", e);
    }
  }
}, 1000);
luluWbCleanupRegistry.intervals.push(window.luluNativeSyncAutostartTimer);
// 60 秒兜底：如果酒馆函数一直没加载好，就停止检测，避免无意义空转
setTimeout(() => {
  if (window.luluNativeSyncAutostartTimer) {
    clearInterval(window.luluNativeSyncAutostartTimer);
    window.luluNativeSyncAutostartTimer = null;
  }
}, 60000);
