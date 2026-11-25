import { luluHexToRgba } from "./utils.js";

window.luluWbInitTabType = "global";

// ✨ 内置矢量图标库（用户可从下拉框直接选）
const LULU_FLOAT_ICONS = {
  "fa-book-atlas": "📖 图集书（默认）",
  "fa-book-journal-whills": "📓 魔法书",
  "fa-book-open": "📖 打开的书",
  "fa-bolt": "⚡ 闪电",
  "fa-star": "⭐ 星星",
  "fa-wand-magic-sparkles": "🪄 魔法棒",
  "fa-dragon": "🐉 龙",
  "fa-cat": "🐱 猫咪",
  "fa-heart": "❤️ 爱心",
  "fa-gem": "💎 宝石",
  "fa-crown": "👑 皇冠",
  "fa-feather": "🪶 羽毛",
  "fa-moon": "🌙 月亮",
  "fa-fire": "🔥 火焰",
  "fa-ghost": "👻 幽灵",
  "fa-paw": "🐾 脚印",
  "fa-leaf": "🍃 叶子",
  "fa-compass": "🧭 罗盘",
};

// ✨ 读取悬浮球外观配置（含图标、颜色）
const getFloatAppearance = () => {
  return JSON.parse(
    localStorage.getItem("lulu_wb_floating_appearance") ||
      '{"iconType":"fa","iconValue":"fa-book-atlas","emoji":"📖","imgUrl":"","useThemeColor":true,"bgColor":"#2a2e33","bgAlpha":100,"iconColor":"#70a1ff","borderColor":"#70a1ff","borderAlpha":100}',
  );
};
const toggleFloatingButton = (show, forceUpdate = false) => {
  if (!show) {
    $("#lulu-wb-floating-btn").remove();
    $("#lulu-wb-floating-style").remove();
    return;
  }
  if ($("#lulu-wb-floating-btn").length > 0 && !forceUpdate) return;
  if (forceUpdate) {
    $("#lulu-wb-floating-style").remove();
    $("#lulu-wb-floating-btn").remove(); // 强制更新时把旧球也删掉重建，才能换图标
  }
  const flConf = JSON.parse(
    localStorage.getItem("lulu_wb_floating_config") ||
      '{"size": 48, "opacity": 0.8}',
  );
  const appear = getFloatAppearance();

  // 决定颜色：跟随主题 or 自定义（luluHexToRgba 用脚本顶部的共享版）
  const bgAlpha = appear.bgAlpha === undefined ? 100 : appear.bgAlpha;
  const bgCss = appear.useThemeColor
    ? "var(--SmartThemeBotMesColor, #2a2e33)"
    : luluHexToRgba(appear.bgColor, bgAlpha);
  const iconColorCss = appear.useThemeColor
    ? "var(--SmartThemeQuoteColor, #70a1ff)"
    : appear.iconColor;
  const borderAlpha =
    appear.borderAlpha === undefined ? 100 : appear.borderAlpha;
  const borderColorCss = appear.useThemeColor
    ? "var(--SmartThemeQuoteColor, #70a1ff)"
    : luluHexToRgba(appear.borderColor, borderAlpha);

  if ($("#lulu-wb-floating-style").length === 0) {
    const styleHtml = `<style id="lulu-wb-floating-style">
        #lulu-wb-floating-btn {
            position: fixed !important;
            top: 45vh !important;
            right: 15px !important;
            width: ${flConf.size}px !important;
            height: ${flConf.size}px !important;
            opacity: ${flConf.opacity} !important;
            background: ${bgCss} !important;
            color: ${iconColorCss} !important;
            border: 2px solid ${borderColorCss} !important;
            border-radius: 50% !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            font-size: ${flConf.size * 0.45}px !important;
            cursor: grab !important;
            box-shadow: none !important;
            z-index: 9990 !important;
            user-select: none !important;
            touch-action: none !important;
            -webkit-tap-highlight-color: transparent !important;
            transition: left 0.28s cubic-bezier(0.2, 0.8, 0.3, 1), top 0.28s cubic-bezier(0.2, 0.8, 0.3, 1), transform 0.28s cubic-bezier(0.2, 0.8, 0.3, 1), opacity 0.2s !important;
        }
        /* ✨ 贴边半隐：用 transform 平移实现（GPU 合成，不触发布局），left/top 保持不动 */
        #lulu-wb-floating-btn[data-docked-edge="left"] {
            transform: translateX(-70%) !important;
        }
        #lulu-wb-floating-btn[data-docked-edge="right"] {
            transform: translateX(70%) !important;
        }
        /* 菜单展开时整条滑出（触屏也生效） */
        #lulu-wb-floating-btn.lulu-awake {
            transform: translateX(0) !important;
        }
        /* 鼠标悬停整条滑出：只在有真悬停能力的设备上启用。
           触屏点按会留下"假 hover"状态，会让球永远被滑出规则顶住、缩不进屏幕侧边 */
        @media (hover: hover) {
            #lulu-wb-floating-btn[data-docked-edge]:hover {
                transform: translateX(0) !important;
            }
        }
        #lulu-wb-floating-btn img.lulu-float-img {
            width: 90% !important;
            height: 90% !important;
            object-fit: cover !important;
            border-radius: 50% !important;
            pointer-events: none !important;
            /* 防止图片导致的闪烁 */
            image-rendering: -webkit-optimize-contrast !important;
            backface-visibility: hidden !important;
        }
        #lulu-wb-floating-btn span.lulu-float-emoji {
            font-size: ${flConf.size * 0.5}px !important;
            line-height: 1 !important;
            pointer-events: none !important;
        }
        #lulu-wb-floating-btn span.lulu-float-svg {
            width: 65% !important;
            height: 65% !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            pointer-events: none !important;
        }
        #lulu-wb-floating-btn span.lulu-float-svg svg {
            width: 100% !important;
            height: 100% !important;
        }
        #lulu-wb-floating-btn > i {
            pointer-events: none !important;
        }
        #lulu-wb-floating-btn:active {
            cursor: grabbing !important;
        }
        #lulu-wb-floating-btn:hover {
            opacity: 1 !important;
        }
        .lulu-float-menu-opts {
            position: absolute;
            right: calc(100% + 10px);
            top: 50%;
            transform: translateY(-50%);
            display: flex;
            gap: 8px;
            background: var(--SmartThemeBlurTintColor);
            padding: 8px;
            border-radius: 8px;
            border: 1px solid var(--SmartThemeBorderColor);
            box-shadow: 0 4px 8px rgba(0,0,0,0.4);
            opacity: 0;
            pointer-events: none;
            transition: opacity 0.2s;
            white-space: nowrap;
        }
        .lulu-float-menu-opts.show {
            opacity: 1;
            pointer-events: auto;
        }
        .lulu-float-btn-opt {
            cursor: pointer;
            padding: 6px 12px;
            font-size: 13px;
            font-weight: bold;
            color: var(--SmartThemeBodyColor);
            background: var(--SmartThemeBotMesColor);
            border: 1px solid var(--SmartThemeBorderColor);
            border-radius: 6px;
        }
        .lulu-float-btn-opt:hover {
            background: var(--SmartThemeQuoteColor);
            color: #fff;
        }
    </style>`;
    $("head").append(styleHtml);
  }

  if (forceUpdate && $("#lulu-wb-floating-btn").length > 0) return;

  // 根据配置生成球里面的内容（图片链接 / SVG代码 / emoji / 矢量图标）
  let $iconContent;
  if (appear.iconType === "img" && appear.imgUrl) {
    const val = appear.imgUrl.trim();
    // 智能识别：如果内容是 SVG 代码，就直接插入；否则当成图片网址
    if (val.toLowerCase().startsWith("<svg")) {
      $iconContent = $("<span>", { class: "lulu-float-svg" }).html(val);
    } else {
      $iconContent = $("<img>", {
        class: "lulu-float-img",
        src: val,
        alt: "icon",
      });
    }
  } else if (appear.iconType === "emoji" && appear.emoji) {
    $iconContent = $("<span>", {
      class: "lulu-float-emoji",
      text: appear.emoji,
    });
  } else {
    $iconContent = $("<i>", {
      class: `fa-solid ${appear.iconValue || "fa-book-atlas"}`,
    });
  }

  const $floatBtn = $("<div>", { id: "lulu-wb-floating-btn" })
    .append($iconContent)
    .append(
      $("<div>", { class: "lulu-float-menu-opts" })
        .append(
          $("<button>", {
            class: "lulu-float-btn-opt",
            html: '<i class="fa-solid fa-bolt" style="color:#fcc419;"></i> 极速快照',
          }).on("click", (e) => {
            e.stopPropagation();
            clearTimeout(clickTimer);
            $floatBtn.find(".lulu-float-menu-opts").removeClass("show");
            btnNode.classList.remove("lulu-awake");
            window.luluOpenQuickSnapshotView();
          }),
        )
        .append(
          $("<button>", {
            class: "lulu-float-btn-opt",
            html: '<i class="fa-solid fa-earth-asia" style="color:#51cf66;"></i> 全局',
          }).on("click", (e) => {
            e.stopPropagation();
            $floatBtn.find(".lulu-float-menu-opts").removeClass("show");
            btnNode.classList.remove("lulu-awake");
            window.luluWbInitTabType = "global";
            $("#option_lulu_wb_manager").click();
          }),
        )
        .append(
          $("<button>", {
            class: "lulu-float-btn-opt",
            html: '<i class="fa-solid fa-user-astronaut" style="color:#339af0;"></i> 当前角色',
          }).on("click", (e) => {
            e.stopPropagation();
            $floatBtn.find(".lulu-float-menu-opts").removeClass("show");
            btnNode.classList.remove("lulu-awake");
            window.luluWbInitTabType = "char";
            $("#option_lulu_wb_manager").click();
          }),
        ),
    )
    .appendTo("#app_container, body");
  const btnNode = $floatBtn[0];
  // ✨ 贴边停靠（transform 半隐）& 位置记忆
  const getWinSize = () => {
    const realWin =
      window.parent && window.parent !== window ? window.parent : window;
    return {
      w: realWin.innerWidth || document.documentElement.clientWidth,
      h: realWin.innerHeight || document.documentElement.clientHeight,
    };
  };

  const LULU_FLOAT_POS_KEY = "lulu_wb_floating_pos";
  const saveFloatPos = (edge, top, left = null) => {
    const { w, h } = getWinSize();
    try {
      localStorage.setItem(
        LULU_FLOAT_POS_KEY,
        JSON.stringify({
          edge, // "left" / "right" / null(停在屏幕中间)
          topRatio: h > 0 ? top / h : 0.45,
          leftRatio: left !== null && w > 0 ? left / w : null,
        }),
      );
    } catch (e) {}
  };
  const loadFloatPos = () => {
    try {
      return JSON.parse(localStorage.getItem(LULU_FLOAT_POS_KEY) || "null");
    } catch (e) {
      return null;
    }
  };

  const EDGE_GAP = 8; // 贴边停靠时与屏幕边的间距（半隐由 transform 实现，露出一小条便于点按）

  // 把球停靠到指定边的指定高度。位置由 left/top 决定，半隐由 CSS 按 data-docked-edge 用 transform 实现
  const dockBall = (edge, top, animate = true) => {
    const { w, h } = getWinSize();
    const btnW = btnNode.offsetWidth || 48;
    const btnH = btnNode.offsetHeight || 48;
    const finalTop = Math.max(6, Math.min(top, h - btnH - 6));
    const finalLeft = edge === "left" ? EDGE_GAP : w - btnW - EDGE_GAP;
    if (animate) {
      btnNode.style.removeProperty("transition"); // 交还 CSS 默认缓动
    } else {
      btnNode.style.setProperty("transition", "none", "important");
    }
    btnNode.style.removeProperty("transform"); // 交还 CSS 的贴边半隐规则
    btnNode.dataset.dockedEdge = edge;
    btnNode.style.setProperty("left", finalLeft + "px", "important");
    btnNode.style.setProperty("top", finalTop + "px", "important");
    btnNode.style.setProperty("right", "auto", "important");
    if (!animate) {
      // 位置落定了再把过渡还给 CSS，之后的 hover 滑出才有动画
      requestAnimationFrame(() => btnNode.style.removeProperty("transition"));
    }
    return finalTop;
  };

  // 把球放在屏幕中间的任意位置（不贴边、不半隐）；会夹进屏幕内
  const placeBall = (left, top, animate = true) => {
    const { w, h } = getWinSize();
    const btnW = btnNode.offsetWidth || 48;
    const btnH = btnNode.offsetHeight || 48;
    const finalLeft = Math.max(0, Math.min(left, w - btnW));
    const finalTop = Math.max(6, Math.min(top, h - btnH - 6));
    if (animate) {
      btnNode.style.removeProperty("transition");
    } else {
      btnNode.style.setProperty("transition", "none", "important");
    }
    btnNode.style.removeProperty("transform");
    btnNode.removeAttribute("data-docked-edge"); // 不贴边，CSS 半隐规则不生效
    btnNode.style.setProperty("left", finalLeft + "px", "important");
    btnNode.style.setProperty("top", finalTop + "px", "important");
    btnNode.style.setProperty("right", "auto", "important");
    if (!animate) {
      requestAnimationFrame(() => btnNode.style.removeProperty("transition"));
    }
    return { left: finalLeft, top: finalTop };
  };

  // ✨ 常驻半透明（沿用用户配置的透明度），hover/拖动时恢复全亮——纯 CSS，无需定时器

  // ✨ 窗口大小变化时保持位置合理、不飞出屏幕（重绑函数挂在 window 上，重建球后自动指向新球）
  window.__luluFloatRedock = () => {
    const edge = btnNode.dataset.dockedEdge;
    const rect = btnNode.getBoundingClientRect();
    if (edge === "left" || edge === "right") {
      dockBall(edge, rect.top, false);
    } else {
      placeBall(rect.left, rect.top, false); // 停在中间的球只是夹回屏幕内
    }
  };
  if (!window.__luluFloatResizeBound) {
    window.__luluFloatResizeBound = true;
    let resizeT = null;
    window.addEventListener("resize", () => {
      clearTimeout(resizeT);
      resizeT = setTimeout(() => {
        if (typeof window.__luluFloatRedock === "function")
          window.__luluFloatRedock();
      }, 150);
    });
  }

  // ✨ 还原上次的位置：贴边的回贴边位，停中间的回中间位；没有记录就保持默认（右上角，完整显示）
  const savedPos = loadFloatPos();
  if (savedPos && (savedPos.edge === "left" || savedPos.edge === "right")) {
    const { h } = getWinSize();
    dockBall(savedPos.edge, (savedPos.topRatio || 0.45) * h, false);
  } else if (savedPos && typeof savedPos.leftRatio === "number") {
    const { w, h } = getWinSize();
    placeBall(savedPos.leftRatio * w, (savedPos.topRatio || 0.45) * h, false);
  }
  // 没有记录就保持 CSS 默认位置（右上角，完整显示）

  let isDragging = false;
  let startX, startY, initX, initY, clickTimer;
  btnNode.addEventListener("pointerdown", (e) => {
    if ($(e.target).closest(".lulu-float-menu-opts").length) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    try {
      btnNode.setPointerCapture(e.pointerId);
    } catch (err) {}
    isDragging = false;
    startX = e.clientX || 0;
    startY = e.clientY || 0;
    const rect = btnNode.getBoundingClientRect();
    initX = rect.left;
    initY = rect.top;
    // 球正半隐贴边时，水平方向要换算回"逻辑位置"（视觉位置被 transform 推出了屏幕）
    if (btnNode.dataset.dockedEdge) {
      const { w } = getWinSize();
      const bw = btnNode.offsetWidth || 48;
      initX =
        btnNode.dataset.dockedEdge === "left" ? EDGE_GAP : w - bw - EDGE_GAP;
    }
    let lastLeft = initX;
    let lastTop = initY;
    let rafPending = false; // ✨ 同一帧的多个移动事件只画一次

    const onPointerMove = (ev) => {
      const dx = (ev.clientX || 0) - startX;
      const dy = (ev.clientY || 0) - startY;
      if (!isDragging) {
        if (Math.abs(dx) <= 5 && Math.abs(dy) <= 5) return;
        isDragging = true;
        $floatBtn.find(".lulu-float-menu-opts").removeClass("show");
        btnNode.classList.remove("lulu-awake");
        // 只给 transform 留过渡：半隐的球从墙里滑出来跟手，left/top 保持零延迟
        btnNode.style.setProperty(
          "transition",
          "transform 0.28s cubic-bezier(0.2, 0.8, 0.3, 1)",
          "important",
        );
        btnNode.style.setProperty("transform", "translateX(0)", "important");
      }
      lastLeft = initX + dx;
      lastTop = initY + dy;
      if (rafPending) return;
      rafPending = true;
      requestAnimationFrame(() => {
        rafPending = false;
        const { w, h } = getWinSize();
        const btnW = btnNode.offsetWidth || 48;
        const btnH = btnNode.offsetHeight || 48;
        // 拖动中也夹在屏幕内，不会拖到外面去
        const cl = Math.max(0, Math.min(lastLeft, w - btnW));
        const ct = Math.max(0, Math.min(lastTop, h - btnH));
        btnNode.style.setProperty("left", cl + "px", "important");
        btnNode.style.setProperty("top", ct + "px", "important");
        btnNode.style.setProperty("right", "auto", "important");
      });
    };
    const onPointerUp = (ev) => {
      btnNode.removeEventListener("pointermove", onPointerMove);
      btnNode.removeEventListener("pointerup", onPointerUp);
      btnNode.removeEventListener("pointercancel", onPointerUp);
      try {
        btnNode.releasePointerCapture(ev.pointerId);
      } catch (err) {}

      // 没拖动就啥也不干，直接返回，保持原样
      if (!isDragging) {
        btnNode.style.removeProperty("transition"); // 交还 CSS 默认缓动
        return;
      }

      const { w: winW, h: winH } = getWinSize();
      const btnW = btnNode.offsetWidth || 48;
      let curLeft = Number(lastLeft);
      let curTop = Number(lastTop);
      if (!Number.isFinite(curLeft)) curLeft = winW - btnW - EDGE_GAP;
      if (!Number.isFinite(curTop)) curTop = winH * 0.45;

      // ✨ 吸附区判定：松手时离某条边 60px 以内才贴边半隐，否则就停在原地（拖到中间就停在中间）
      const SNAP_ZONE = 60;
      const distLeft = curLeft;
      const distRight = winW - (curLeft + btnW);
      const edge = distLeft <= distRight ? "left" : "right";
      if (Math.min(distLeft, distRight) <= SNAP_ZONE) {
        const finalTop = dockBall(edge, curTop, true);
        saveFloatPos(edge, finalTop);
      } else {
        const placed = placeBall(curLeft, curTop, true);
        saveFloatPos(null, placed.top, placed.left);
      }
    };

    btnNode.addEventListener("pointermove", onPointerMove);
    btnNode.addEventListener("pointerup", onPointerUp);
    btnNode.addEventListener("pointercancel", onPointerUp);
  });
  btnNode.addEventListener("click", (e) => {
    if ($(e.target).closest(".lulu-float-menu-opts").length) return;
    if (isDragging) {
      e.preventDefault();
      e.stopPropagation();
    } else {
      const $menu = $floatBtn.find(".lulu-float-menu-opts");

      // 看球现在在屏幕的左半区还是右半区，决定面板弹出方向
      const realWin =
        window.parent && window.parent !== window ? window.parent : window;
      const winW = realWin.innerWidth || document.documentElement.clientWidth;
      const rect = btnNode.getBoundingClientRect();
      const btnCenterX = rect.left + rect.width / 2; // 球的中心点横坐标

      if (btnCenterX < winW / 2) {
        // 球在左半区 → 面板朝右弹
        $menu.css({ right: "auto", left: "calc(100% + 10px)" });
      } else {
        // 球在右半区 → 面板朝左弹
        $menu.css({ left: "auto", right: "calc(100% + 10px)" });
      }

      $menu.toggleClass("show");
      btnNode.classList.toggle("lulu-awake", $menu.hasClass("show"));
      clearTimeout(clickTimer);
      if ($menu.hasClass("show")) {
        clickTimer = setTimeout(() => {
          $menu.removeClass("show");
          btnNode.classList.remove("lulu-awake");
        }, 4000);
      }
    }
  });
};
if (localStorage.getItem("lulu_wb_floating_enabled") !== "false")
  toggleFloatingButton(true);

export { LULU_FLOAT_ICONS, getFloatAppearance, toggleFloatingButton };
