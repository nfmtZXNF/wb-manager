
// ✨ 全局一次性委托：快照控制台等地方的条目预览，点击即展开完整内容，再点收起
$(document).on("click", ".dsnap-entry-preview", function (e) {
  e.stopPropagation();
  $(this).toggleClass("lulu-expanded");
});

if ($("#lulu-drag-line-style").length === 0) {  $("head").append(`
        <style id="lulu-drag-line-style">
            .lulu-drag-over-top {
                box-shadow: 0 -3px 0 0 #51cf66 !important;
                margin-top: 25px !important;
                transition: margin 0.15s ease-out, box-shadow 0.1s !important;
            }
            .lulu-drag-over-bottom {
                box-shadow: 0 3px 0 0 #51cf66 !important;
                margin-bottom: 25px !important;
                transition: margin 0.15s ease-out, box-shadow 0.1s !important;
            }
            .lulu-drag-ghost {
                opacity: 0.4 !important;
                transform: scale(0.98) !important;
                border: 1px dashed #51cf66 !important;
            }
            .lulu-folded-hide {
                position: absolute !important;
                opacity: 0 !important;
                pointer-events: none !important;
                z-index: -9999 !important;
                max-height: 0 !important;
                margin: 0 !important;
                overflow: hidden !important;
                border: none !important;
                transform: scale(0) !important;
            }
        </style>
    `);
}

const getSharedGroupOrder = () =>
  JSON.parse(localStorage.getItem("lulu_wb_native_group_order") || "[]");
const setSharedGroupOrder = (arr) =>
  localStorage.setItem("lulu_wb_native_group_order", JSON.stringify(arr));

export { getSharedGroupOrder, setSharedGroupOrder };
