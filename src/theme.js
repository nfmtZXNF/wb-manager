import { luluHexToRgba } from "./utils.js";

// ========== 【通用】读取面板主题色板：模式 + 自定义色 + 各模式色值（各弹窗统一从这里拿，别再手抄） ==========
const luluGetPanelThemePalette = () => {
  const mode = localStorage.getItem("lulu_wb_panel_theme") || "default";
  const custom = JSON.parse(
    localStorage.getItem("lulu_wb_panel_custom_colors") ||
      '{"bg":"#2a2e33", "text":"#ffffff", "accent":"#70a1ff", "alpha":95, "inputBg":"#1a1c1f"}',
  );
  let bg, botMes, body, quote, border, inputBg;
  if (mode === "dark") {
    bg = "rgba(22,24,28,1)";
    botMes = "rgba(32,35,40,1)";
    body = "#c0c2c8";
    quote = "#d1c5a1";
    border = "#3d414d";
    inputBg = "rgba(35,38,43,1)";
  } else if (mode === "light") {
    bg = "rgba(253,246,227,1)";
    botMes = "rgba(255,251,240,1)";
    body = "#4a3b32";
    quote = "#8b5d33";
    border = "#e0d0b8";
    inputBg = "rgba(255,255,255,0.7)";
  } else if (mode === "custom") {
    bg = luluHexToRgba(custom.bg, custom.alpha);
    botMes = custom.bg;
    body = custom.text;
    quote = custom.accent || "#70a1ff";
    border = custom.inputBg || custom.bg;
    inputBg = custom.inputBg || custom.bg;
  }
  return { mode, custom, bg, botMes, body, quote, border, inputBg };
};
// ========== 【通用】给弹窗生成跟随主题的 CSS（全局版）==========
window.buildPopupThemeCSS = (selector) => {
  const { mode, bg, botMes, body, quote, border, inputBg } =
    luluGetPanelThemePalette();

  if (mode !== "dark" && mode !== "light" && mode !== "custom") {
    // default 模式跟随酒馆，不强改，只统一输入框和按钮
    return `
      ${selector} input[type="text"],
      ${selector} input[type="number"],
      ${selector} select,
      ${selector} textarea {
        background: var(--SmartThemeBotMesColor) !important;
        color: var(--SmartThemeBodyColor) !important;
        border: 1px solid var(--SmartThemeBorderColor) !important;
      }
      ${selector} .menu_button:not(.btn-danger):not(.btn-success):not(.btn-warning):not(.btn-primary) {
        background: var(--SmartThemeBotMesColor) !important;
        color: var(--SmartThemeBodyColor) !important;
        border: 1px solid var(--SmartThemeBorderColor) !important;
      }
    `;
  }

  return `
    ${selector} {
      background: ${bg} !important;
      border: 1px solid ${quote} !important;
      --SmartThemeBlurTintColor: ${bg} !important;
      --SmartThemeBotMesColor: ${botMes} !important;
      --SmartThemeBodyColor: ${body} !important;
      --SmartThemeQuoteColor: ${quote} !important;
      --SmartThemeBorderColor: ${border} !important;
      color: ${body} !important;
    }
    ${selector} h3, ${selector} label, ${selector} span, ${selector} div {
      color: ${body};
    }
    ${selector} input[type="text"],
    ${selector} input[type="number"],
    ${selector} select,
    ${selector} textarea {
      background: ${inputBg} !important;
      color: ${body} !important;
      border: 1px solid ${border} !important;
    }
    ${selector} input::placeholder, ${selector} textarea::placeholder {
      color: gray !important;
    }
    ${selector} .menu_button:not(.btn-danger):not(.btn-success):not(.btn-warning):not(.btn-primary) {
      background: ${botMes} !important;
      color: ${body} !important;
      border: 1px solid ${border} !important;
    }
    ${selector} .btn-primary {
      color: ${quote} !important;
      border-color: ${quote} !important;
      background: rgba(125,125,125,0.08) !important;
    }
    ${selector} .btn-primary:hover {
      background: ${quote} !important;
      color: ${botMes} !important;
    }
    ${selector} .btn-success {
      color: #51cf66 !important;
      border-color: #51cf66 !important;
      background: rgba(81,207,102,0.08) !important;
    }
    ${selector} .btn-success:hover {
      background: #51cf66 !important;
      color: #fff !important;
    }
    ${selector} .btn-danger {
      color: #ff6b6b !important;
      border-color: #ff6b6b !important;
      background: rgba(255,107,107,0.08) !important;
    }
    ${selector} .btn-danger:hover {
      background: #ff6b6b !important;
      color: #fff !important;
    }
    ${selector} .btn-warning {
      color: ${quote} !important;
      border-color: ${quote} !important;
      background: rgba(125,125,125,0.08) !important;
    }
    ${selector} .btn-warning:hover {
      background: ${quote} !important;
      color: ${botMes} !important;
    }
    ${selector} .btn-secondary {
      color: gray !important;
      border-color: rgba(150,150,150,0.5) !important;
      background: rgba(150,150,150,0.15) !important;
    }
    ${selector} .btn-secondary:hover {
      background: gray !important;
      color: #fff !important;
    }
    ${selector} .popup-controls .menu_button,
    ${selector} .popup-button-ok {
      background: ${mode === "default" ? "var(--SmartThemeBotMesColor)" : botMes} !important;
      color: ${mode === "default" ? "var(--SmartThemeBodyColor)" : body} !important;
      border: 1px solid ${mode === "default" ? "var(--SmartThemeQuoteColor)" : quote} !important;
    }
  `;
};
// ========== 【通用】主题函数结束 ==========

export { luluGetPanelThemePalette };
