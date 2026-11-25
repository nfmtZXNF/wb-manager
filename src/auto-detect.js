import { createWorldbook, getCharWorldbookNames, getCurrentCharacterName, getWorldbook, getWorldbookNames, replaceWorldbook } from "./compat.js";
import { luluAutoApplyBoundChatSnapshot, luluRebindCharWorldbooksSafe } from "./char-snapshot.js";
import { luluWbCleanupRegistry } from "./cleanup.js";

// ========== 【自动拦截】导入/点进角色卡时，检测内嵌世界书污染 开始 ==========
(function luluAutoDetectEmbeddedPollution() {
  if (window.lulu_auto_detect_inited) return;
  window.lulu_auto_detect_inited = true;

  // ✨ 永久记忆：处理过（或选了忽略）的角色，永远不再打扰
  // 存在浏览器本地，重启酒馆也记得
  const LULU_DONE_KEY = "lulu_wb_pollution_handled_chars";
  const getHandledChars = () => {
    try {
      return JSON.parse(localStorage.getItem(LULU_DONE_KEY) || "[]");
    } catch (e) {
      return [];
    }
  };
  const markCharHandled = (avatar) => {
    if (!avatar) return;
    const list = getHandledChars();
    if (!list.includes(avatar)) {
      list.push(avatar);
      localStorage.setItem(LULU_DONE_KEY, JSON.stringify(list));
    }
  };
  const isCharHandled = (avatar) => getHandledChars().includes(avatar);

  // 读取指定角色卡内嵌的世界书原始数据
  const luluAutoReadEmbeddedBook = async (avatar) => {
    try {
      const raw = await $.ajax({
        url: "/api/characters/get",
        type: "POST",
        contentType: "application/json",
        data: JSON.stringify({ avatar_url: avatar }),
      });
      const d = raw.data || raw;
      const book = d.character_book;
      if (!book || typeof book === "string") return null;
      const rawEntries = Array.isArray(book.entries)
        ? book.entries
        : Object.values(book.entries || {});
      if (rawEntries.length === 0) return null;
      return { name: book.name || "", entries: rawEntries };
    } catch (e) {
      console.error("Lulu 自动检测：读取内嵌世界书失败", e);
      return null;
    }
  };

  // 把卡内嵌的条目，转换成脚本内部用的条目格式
  const luluAutoConvertEmbedded = (rawEntries) =>
    rawEntries.map((e, i) => {
      const ext = e.extensions || {};
      const keys = Array.isArray(e.keys)
        ? e.keys
        : Array.isArray(e.key)
          ? e.key
          : [];
      const enabled = e.enabled !== false && e.disable !== true;
      const isConstant = e.constant === true || keys.length === 0;
      const order = e.insertion_order ?? e.order ?? 100;
      let posNum = typeof ext.position === "number" ? ext.position : null;
      if (posNum === null) {
        posNum =
          e.position === "before_char"
            ? 0
            : e.position === "after_char"
              ? 1
              : 4;
      }
      const typeMap = {
        0: "before_character_definition",
        1: "after_character_definition",
        2: "before_example_messages",
        3: "after_example_messages",
        5: "before_author_note",
        6: "after_author_note",
      };
      const role =
        ext.role === 1 ? "user" : ext.role === 2 ? "assistant" : "system";
      const position = typeMap[posNum]
        ? { type: typeMap[posNum], order }
        : { type: "at_depth", role, depth: ext.depth ?? 4, order };
      const name = e.comment || e.name || `条目${i + 1}`;
      const uid = e.id ?? Date.now() + i;
      const preventIn = !!ext.exclude_recursion;
      const preventOut = !!ext.prevent_recursion;
      return {
        uid,
        id: uid,
        name,
        comment: name,
        title: name,
        enabled,
        disable: !enabled,
        disabled: !enabled,
        content: e.content || "",
        key: keys,
        keys,
        constant: isConstant,
        selective: !isConstant,
        strategy: { type: isConstant ? "constant" : "selective", keys },
        position,
        depth: position.depth,
        order,
        insertion_order: order,
        probability: ext.probability ?? 100,
        recursion: {
          prevent_incoming: preventIn,
          prevent_outgoing: preventOut,
          delay_until: ext.delay_until_recursion ?? null,
        },
        exclude_recursion: preventIn,
        prevent_recursion: preventOut,
        sticky: ext.sticky ?? null,
        cooldown: ext.cooldown ?? null,
        delay: ext.delay ?? null,
        extensions: ext,
      };
    });

  // 内容签名：判断两本书内容一不一样
  const luluAutoBookSig = (entries) =>
    entries
      .map(
        (e) => `${e.comment || e.name || ""}\u0001${(e.content || "").trim()}`,
      )
      .sort()
      .join("\u0002");

  // 给当前角色卡改绑世界书（把旧名换成新名）
  const luluAutoRebindCharBook = async (oldName, newName) => {
    try {
      const cb =
        typeof getCharWorldbookNames === "function"
          ? getCharWorldbookNames("current") || {
              primary: null,
              additional: [],
            }
          : { primary: null, additional: [] };
      const swap = (v) => (v === oldName ? newName : v);
      await luluRebindCharWorldbooksSafe("current", {
        primary: swap(cb.primary),
        additional: (cb.additional || []).map(swap),
      });
    } catch (e) {
      console.error("Lulu 自动检测：改绑失败", e);
    }
  };

  const luluWithToast = async (fn, msg) => {
    let t = null;
    if (typeof toastr !== "undefined") {
      t = toastr.info(msg, "", { timeOut: 0, extendedTimeOut: 0 });
    }
    try {
      await fn();
    } finally {
      if (t && typeof toastr !== "undefined") toastr.clear(t);
    }
  };

  // ✨ 会话级缓存：本次会话已经查过的卡不再重复下载角色卡（切聊天/翻页不再反复请求）
  const luluAutoCheckedAvatars = new Set();

  // —— 核心：检测当前打开的这张角色卡 ——
  const luluAutoCheckCurrentChar = async () => {
    try {
      // 默认关闭，只有用户在面板里勾选开启才生效
      if (localStorage.getItem("lulu_wb_auto_detect_enabled") !== "true")
        return;
      const ctx =
        typeof SillyTavern !== "undefined" ? SillyTavern.getContext() : {};
      const avatar =
        ctx.characters && ctx.characterId != null
          ? ctx.characters[ctx.characterId]?.avatar
          : null;
      const charName =
        typeof getCurrentCharacterName === "function"
          ? getCurrentCharacterName()
          : ctx.name2;

      if (!avatar) return;

      // ✨ 这张卡已经处理/忽略过 → 永久跳过，不再打扰
      if (isCharHandled(avatar)) return;
      // ✨ 本次会话已经查过这张卡 → 跳过（下载整张角色卡很贵，不重复来）
      if (luluAutoCheckedAvatars.has(avatar)) return;

      const embedded = await luluAutoReadEmbeddedBook(avatar);
      if (!embedded) {
        luluAutoCheckedAvatars.add(avatar);
        return;
      }

      const bookName = embedded.name;
      if (!bookName) {
        luluAutoCheckedAvatars.add(avatar);
        return;
      }

      // 🚫 如果这本书被标记了“跳过全库对照”，自动检测也不再打扰
      try {
        const luluAutoScanSkipList = JSON.parse(
          localStorage.getItem("lulu_wb_scan_skip_list") || "[]",
        );
        if (
          Array.isArray(luluAutoScanSkipList) &&
          luluAutoScanSkipList.includes(bookName)
        ) {
          luluAutoCheckedAvatars.add(avatar);
          return;
        }
      } catch (e) {}

      // 本地没有同名书 → 不算污染。本次会话内不再重复下载这张卡；
      // 不做永久标记，下次启动会话还会再查，万一以后创建了同名书还能提醒
      if (
        typeof getWorldbookNames !== "function" ||
        !getWorldbookNames().includes(bookName)
      ) {
        luluAutoCheckedAvatars.add(avatar);
        return;
      }

      const converted = luluAutoConvertEmbedded(embedded.entries);

      let localEntries;
      try {
        localEntries = await getWorldbook(bookName);
      } catch (e) {
        return;
      }

      // 内容一致 → 没被污染 → ✨ 永久标记，以后你自己改也不会再来烦你
      if (luluAutoBookSig(localEntries) === luluAutoBookSig(converted)) {
        luluAutoCheckedAvatars.add(avatar);
        markCharHandled(avatar);
        return;
      }

      // ✨ 内容不一致 → 疑似污染，弹窗提醒
      // 关键修复：不管用户选什么（包括忽略），都先永久标记这张卡为“已处理”，绝不再打扰
      markCharHandled(avatar);

      // ========== 自包含差异面板（与主动“体检/救援”同款） ==========
      const luluAutoEscHtml = (s) =>
        String(s)
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;");

      const luluAutoDiffText = (oldStr, newStr) => {
        const oldLines = String(oldStr || "").split("\n");
        const newLines = String(newStr || "").split("\n");
        const oldSet = new Set(oldLines.map((l) => l.trim()));
        const newSet = new Set(newLines.map((l) => l.trim()));
        let oldHtml = "";
        let newHtml = "";
        oldLines.forEach((l) => {
          const removed = !newSet.has(l.trim()) && l.trim() !== "";
          oldHtml += `<div style="padding:1px 4px; ${removed ? "background:rgba(255,107,107,0.25); border-radius:2px;" : ""}">${luluAutoEscHtml(l) || " "}</div>`;
        });
        newLines.forEach((l) => {
          const added = !oldSet.has(l.trim()) && l.trim() !== "";
          newHtml += `<div style="padding:1px 4px; ${added ? "background:rgba(81,207,102,0.25); border-radius:2px;" : ""}">${luluAutoEscHtml(l) || " "}</div>`;
        });
        return { oldHtml, newHtml };
      };

      const luluAutoBuildDiffHtml = (
        convertedEntries,
        localEntriesArr,
        uniquePrefix,
      ) => {
        const embMap = new Map();
        convertedEntries.forEach((e) => {
          embMap.set((e.name || e.comment || "(无名)").trim(), e);
        });
        const locMap = new Map();
        localEntriesArr.forEach((e) => {
          locMap.set((e.name || e.comment || "(无名)").trim(), e);
        });
        const onlyInLocal = [],
          onlyInEmb = [],
          changed = [],
          same = [];
        locMap.forEach((locE, name) => {
          if (embMap.has(name)) {
            const embE = embMap.get(name);
            if ((locE.content || "").trim() !== (embE.content || "").trim())
              changed.push({ name, locE, embE });
            else same.push(name);
          } else onlyInLocal.push({ name, locE });
        });
        embMap.forEach((embE, name) => {
          if (!locMap.has(name)) onlyInEmb.push({ name, embE });
        });

        let html = `<div style="font-size:12px;">`;
        html += `<div style="display:flex; gap:6px; flex-wrap:wrap; margin-bottom:10px; padding-bottom:8px; border-bottom:1px dashed var(--SmartThemeBorderColor);">`;
        html += `<span style="background:rgba(81,207,102,0.15); color:#51cf66; border:1px solid #51cf66; padding:2px 8px; border-radius:4px;">本地新增 ${onlyInLocal.length}</span>`;
        html += `<span style="background:rgba(255,107,107,0.15); color:#ff6b6b; border:1px solid #ff6b6b; padding:2px 8px; border-radius:4px;">本地缺失 ${onlyInEmb.length}</span>`;
        html += `<span style="background:rgba(252,196,25,0.15); color:#fcc419; border:1px solid #fcc419; padding:2px 8px; border-radius:4px;">内容改动 ${changed.length}</span>`;
        html += `<span style="background:rgba(150,150,150,0.15); color:gray; border:1px solid gray; padding:2px 8px; border-radius:4px;">未变 ${same.length}</span>`;
        html += `</div>`;

        if (changed.length > 0) {
          html += `<div style="font-weight:bold; color:#fcc419; margin-bottom:6px;"><i class="fa-solid fa-pen"></i> 内容被改动的条目：</div>`;
          changed.forEach((c, idx) => {
            const diff = luluAutoDiffText(c.embE.content, c.locE.content);
            html += `
              <div style="margin-bottom:8px; border:1px solid var(--SmartThemeBorderColor); border-radius:6px; overflow:hidden;">
                <div class="lulu-diff-toggle" data-prefix="${uniquePrefix}" data-cidx="${idx}" style="padding:6px 10px; background:rgba(252,196,25,0.1); cursor:pointer; font-weight:bold; display:flex; justify-content:space-between; align-items:center;">
                  <span style="word-break:break-all;">📝 ${luluAutoEscHtml(c.name)}</span>
                  <i class="fa-solid fa-chevron-down" style="font-size:11px;"></i>
                </div>
                <div class="lulu-diff-body" data-prefix="${uniquePrefix}" data-cidx="${idx}" style="display:none; padding:8px;">
                  <div style="display:flex; gap:8px; font-size:11px; line-height:1.5;">
                    <div style="flex:1; min-width:0;">
                      <div style="font-weight:bold; color:#51cf66; margin-bottom:4px;">📗 卡内原版</div>
                      <div style="max-height:200px; overflow:auto; background:rgba(0,0,0,0.15); border-radius:4px; padding:4px; white-space:pre-wrap; word-break:break-word;">${diff.oldHtml || "(空)"}</div>
                    </div>
                    <div style="flex:1; min-width:0;">
                      <div style="font-weight:bold; color:#ff6b6b; margin-bottom:4px;">📕 本地当前</div>
                      <div style="max-height:200px; overflow:auto; background:rgba(0,0,0,0.15); border-radius:4px; padding:4px; white-space:pre-wrap; word-break:break-word;">${diff.newHtml || "(空)"}</div>
                    </div>
                  </div>
                  <div style="font-size:11px; color:gray; margin-top:4px;"><span style="background:rgba(255,107,107,0.25); padding:0 4px;">红底</span>=卡内有本地删了　<span style="background:rgba(81,207,102,0.25); padding:0 4px;">绿底</span>=本地新加的</div>
                </div>
              </div>`;
          });
        }

        if (onlyInLocal.length > 0) {
          html += `<div style="font-weight:bold; color:#51cf66; margin:8px 0 4px 0;"><i class="fa-solid fa-plus"></i> 本地多出来的条目（原本没有）：</div>`;
          html += `<div style="background:rgba(81,207,102,0.06); border:1px solid rgba(81,207,102,0.3); border-radius:4px; padding:6px; max-height:120px; overflow-y:auto;">`;
          onlyInLocal.forEach((o) => {
            html += `<div style="padding:1px 0;">• ${luluAutoEscHtml(o.name)}</div>`;
          });
          html += `</div>`;
        }

        if (onlyInEmb.length > 0) {
          html += `<div style="font-weight:bold; color:#ff6b6b; margin:8px 0 4px 0;"><i class="fa-solid fa-minus"></i> 本地缺失的条目（原本有）：</div>`;
          html += `<div style="background:rgba(255,107,107,0.06); border:1px solid rgba(255,107,107,0.3); border-radius:4px; padding:6px; max-height:120px; overflow-y:auto;">`;
          onlyInEmb.forEach((o) => {
            html += `<div style="padding:1px 0;">• ${luluAutoEscHtml(o.name)}</div>`;
          });
          html += `</div>`;
        }

        if (
          changed.length === 0 &&
          onlyInLocal.length === 0 &&
          onlyInEmb.length === 0
        ) {
          html += `<div style="text-align:center; color:gray; padding:10px;">条目名和正文都一致，差异可能在触发关键字/参数上~</div>`;
        }
        html += `</div>`;
        return html;
      };

      const luluAutoBindDiffToggle = ($scope) => {
        $scope
          .find(".lulu-diff-toggle")
          .off("click")
          .on("click", function () {
            const cidx = $(this).attr("data-cidx");
            const prefix = $(this).attr("data-prefix");
            const $body = $scope.find(
              `.lulu-diff-body[data-prefix="${prefix}"][data-cidx="${cidx}"]`,
            );
            const $icon = $(this).find("i.fa-chevron-down, i.fa-chevron-up");
            if ($body.is(":visible")) {
              $body.slideUp(120);
              $icon.removeClass("fa-chevron-up").addClass("fa-chevron-down");
            } else {
              $body.slideDown(120);
              $icon.removeClass("fa-chevron-down").addClass("fa-chevron-up");
            }
          });
      };

      const diffHtml = luluAutoBuildDiffHtml(converted, localEntries, "auto");

      const $rescueDlg =
        $(`<div id="lulu-rescue-dialog" style="text-align:left; line-height:1.6; padding:2px; max-width:520px;">
         <div style="font-size:15px; font-weight:bold; color:var(--SmartThemeQuoteColor); margin-bottom:12px;">
           <i class="fa-solid fa-clock-rotate-left"></i> 卡内原版 · 对照还原
         </div>
         <div style="background:var(--SmartThemeBotMesColor); border:1px solid var(--SmartThemeBorderColor); border-radius:8px; padding:12px; margin-bottom:12px;">
           <div style="font-size:13px; margin-bottom:8px;"><i class="fa-solid fa-robot" style="color:var(--SmartThemeQuoteColor); width:18px;"></i> 角色：<strong>${charName || "当前角色"}</strong></div>
           <div style="font-size:13px;"><i class="fa-solid fa-book" style="color:var(--SmartThemeQuoteColor); width:18px;"></i> 世界书：<strong>${bookName}</strong></div>
         </div>
         <div style="font-size:12px; color:var(--SmartThemeBodyColor); line-height:1.7; margin-bottom:12px;">
           这张卡自带的世界书原版，和本地同名的这本<strong style="color:var(--SmartThemeQuoteColor);">内容不一样</strong>了。<br>
           <span style="color:gray;">可能是导入时被本地旧书接管，也可能是你改过本地这本、现在想还原成卡里的原版~</span>
         </div>
         <div id="lulu-single-diff-toggle" style="cursor:pointer; padding:8px 12px; background:rgba(125,125,125,0.12); border:1px solid var(--SmartThemeBorderColor); border-radius:6px; font-weight:bold; color:var(--SmartThemeQuoteColor); display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; font-size:13px;">
           <span><i class="fa-solid fa-magnifying-glass-chart"></i> 查看详细差异</span>
           <i class="fa-solid fa-chevron-down" style="font-size:11px;"></i>
         </div>
         <div id="lulu-single-diff-panel" style="display:none; max-height:45vh; overflow-y:auto; padding:4px;">${diffHtml}</div>
       </div>`);

      $rescueDlg.prepend(
        `<style>
          ${buildPopupThemeCSS("dialog:has(#lulu-rescue-dialog)")}
          @media (max-width: 768px) {
            dialog:has(#lulu-rescue-dialog) #lulu-rescue-dialog { font-size: 12px !important; }
            dialog:has(#lulu-rescue-dialog) #lulu-single-diff-toggle { font-size: 12px !important; padding: 7px 10px !important; }
          }
        </style>`,
      );

      $rescueDlg.find("#lulu-single-diff-toggle").on("click", function () {
        const $panel = $rescueDlg.find("#lulu-single-diff-panel");
        const $icon = $(this).find("i.fa-chevron-down, i.fa-chevron-up");
        if ($panel.is(":visible")) {
          $panel.slideUp(150);
          $icon.removeClass("fa-chevron-up").addClass("fa-chevron-down");
        } else {
          $panel.slideDown(150);
          $icon.removeClass("fa-chevron-down").addClass("fa-chevron-up");
        }
      });

      luluAutoBindDiffToggle($rescueDlg);

      const btnRes = await SillyTavern.callGenericPopup(
        $rescueDlg,
        SillyTavern.POPUP_TYPE.TEXT,
        "",
        {
          okButton: "暂不处理",
          customButtons: [
            { text: "另建原版并绑定", result: 888, classes: ["btn-success"] },
            { text: "覆盖本地此书", result: 999, classes: ["btn-danger"] },
          ],
        },
      );
      // ========== 自包含差异面板结束 ==========
      // ✨ 严格判断：只有明确等于 888 或 999 才动手，其它一律什么都不做
      if (btnRes === 888) {
        let newName = `${bookName}_卡内原版`;
        let n = 2;
        while (getWorldbookNames().includes(newName))
          newName = `${bookName}_卡内原版${n++}`;
        await luluWithToast(async () => {
          await createWorldbook(newName, converted);
          await luluAutoRebindCharBook(bookName, newName);
        }, "正在提取卡内原版并重新绑定...");
        if (typeof toastr !== "undefined")
          toastr.success(
            `✨ 已创建 [${newName}] 并绑给 [${charName || "当前角色"}]，本地旧书原样保留~`,
          );
      } else if (btnRes === 999) {
        const confirm2 = await SillyTavern.callGenericPopup(
          `再确认一次哦：覆盖 [${bookName}] 会影响<strong style="color:#ff6b6b;">所有</strong>绑定了这本书的其他角色卡！<br>确定要用卡内原版覆盖本地旧书吗？`,
          SillyTavern.POPUP_TYPE.CONFIRM,
        );
        if (confirm2 === SillyTavern.POPUP_RESULT.AFFIRMATIVE) {
          await luluWithToast(async () => {
            await replaceWorldbook(bookName, converted);
          }, "正在用卡内原版覆盖本地旧书...");
          if (typeof toastr !== "undefined")
            toastr.success(`✅ [${bookName}] 已被卡内原版覆盖~`);
        }
      }
      // 其它情况（点了“先不管”/关闭弹窗）→ 什么都不做，已经标记过了
    } catch (e) {
      console.error("Lulu 自动检测：整体流程出错", e);
    }
  };

  const luluBindAutoDetectEvents = () => {
    try {
      const ctx =
        typeof SillyTavern !== "undefined" ? SillyTavern.getContext() : null;
      if (!ctx || !ctx.eventSource || !ctx.eventTypes) {
        setTimeout(luluBindAutoDetectEvents, 1000);
        return;
      }
      const es = ctx.eventSource;
      const et = ctx.eventTypes;
      // 防抖：连续事件只保留最后一次，避免多个检测排队下载角色卡
      let autoCheckTimer = null;
      const delayedCheck = () => {
        clearTimeout(autoCheckTimer);
        autoCheckTimer = setTimeout(luluAutoCheckCurrentChar, 800);
      };
      // ✨ 角色快照绑定聊天：进入聊天时自动应用绑定的快照（独立防抖，互不影响）
      let snapApplyTimer = null;
      const delayedSnapApply = () => {
        clearTimeout(snapApplyTimer);
        snapApplyTimer = setTimeout(luluAutoApplyBoundChatSnapshot, 800);
      };
      if (et.CHAT_CHANGED) es.on(et.CHAT_CHANGED, delayedSnapApply);

      if (et.CHAT_CHANGED) es.on(et.CHAT_CHANGED, delayedCheck);
      if (et.CHARACTER_PAGE_LOADED)
        es.on(et.CHARACTER_PAGE_LOADED, delayedCheck);
      const charEditedHandler = () => {
        // 这张卡被编辑过 → 清掉它的会话缓存，允许重新检测一次
        try {
          const c2 =
            typeof SillyTavern !== "undefined"
              ? SillyTavern.getContext()
              : null;
          const av =
            c2 && c2.characters && c2.characterId != null
              ? c2.characters[c2.characterId]?.avatar
              : null;
          if (av) luluAutoCheckedAvatars.delete(av);
        } catch (e) {}
        delayedCheck();
      };
      if (et.CHARACTER_EDITED) es.on(et.CHARACTER_EDITED, charEditedHandler);
      // ✨ 登记解绑函数：脚本被禁用/卸载时，把这些监听从酒馆事件总线上摘下来
      luluWbCleanupRegistry.eventCleanups.push(() => {
        try {
          clearTimeout(autoCheckTimer);
          clearTimeout(snapApplyTimer);
        } catch (e) {}
        try {
          if (et.CHAT_CHANGED) es.off(et.CHAT_CHANGED, delayedSnapApply);
          if (et.CHAT_CHANGED) es.off(et.CHAT_CHANGED, delayedCheck);
          if (et.CHARACTER_PAGE_LOADED)
            es.off(et.CHARACTER_PAGE_LOADED, delayedCheck);
          if (et.CHARACTER_EDITED) es.off(et.CHARACTER_EDITED, charEditedHandler);
        } catch (e) {}
      });

      console.log("Lù-chan: 世界书污染自动检测已挂载~（永久记忆版）");
    } catch (e) {
      console.error("Lulu 自动检测：挂载事件失败", e);
    }
  };

  luluBindAutoDetectEvents();
  $("head").append(`
<style id="lulu-wb-tail-style">
    /* 修复手机端弹窗内容被右侧边框遮挡的问题 */
    dialog.wb-manager-dialog *,
    dialog:has(#lulu-quick-snap-modal) *,
    dialog:has(#lulu-scan-dialog) *,
    dialog:has(#lulu-rescue-dialog) *,
    dialog:has(#lulu-scan-char-select-dialog) * {
        box-sizing: border-box !important;
        max-width: 100% !important;
    }

    /* ✨ 全局细滚动条：面板与各弹窗统一，替换又粗又灰的默认滚动条 */
    dialog,
    .wb-manager-dialog,
    #lulu-sticky-note-window {
        scrollbar-width: thin;
        scrollbar-color: var(--SmartThemeBorderColor, rgba(125,125,125,0.5)) transparent;
    }
    dialog ::-webkit-scrollbar,
    .wb-manager-dialog ::-webkit-scrollbar,
    #lulu-sticky-note-window ::-webkit-scrollbar {
        width: 8px;
        height: 8px;
    }
    dialog ::-webkit-scrollbar-thumb,
    .wb-manager-dialog ::-webkit-scrollbar-thumb,
    #lulu-sticky-note-window ::-webkit-scrollbar-thumb {
        background: var(--SmartThemeBorderColor, rgba(125,125,125,0.5));
        border-radius: 4px;
    }
    dialog ::-webkit-scrollbar-track,
    .wb-manager-dialog ::-webkit-scrollbar-track,
    #lulu-sticky-note-window ::-webkit-scrollbar-track {
        background: transparent;
    }

    /* 极速快照控制台：加一点右侧安全间距 */
    #lulu-quick-snap-modal {
        overflow-x: hidden !important;
        padding-right: 6px !important;
    }
    #lulu-quick-snap-modal .lulu-qs-item {
        overflow: hidden !important;
    }

    /* 全库对照面板：同样防止右侧溢出 */
    #lulu-scan-dialog-inner {
        overflow-x: hidden !important;
        padding-right: 6px !important;
    }

    /* 弹窗里的下拉框和按钮：只保留触摸优化，不再强制统一高度（避免按钮被拉得很长） */
    dialog select,
    dialog button {
        touch-action: manipulation;
    }
</style>
`);
})();
