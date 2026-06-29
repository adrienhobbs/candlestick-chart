// Magic numbers shared across ChartComponent and its chart-hooks. Extracted
// verbatim from the original inline literals — values are load-bearing.

/** Share of the chart height given to the volume pane (price action dominates). */
export const VOLUME_PANE_FRACTION = 0.14;
/** Floor for the volume pane height in px, so it never collapses on short charts. */
export const MIN_VOLUME_PANE_HEIGHT = 48;
/** Pointer travel (px) past which a press is treated as a drag, not a click. */
export const DRAG_THRESHOLD_PX = 5;
/** Tolerance (s) for matching a click's time coordinate to a bar's timestamp. */
export const BAR_CLICK_TIME_TOLERANCE_SEC = 300;
/** Bars of padding on each side when framing a focused trade. */
export const TRADE_FOCUS_PAD = 15;
/** Delay (ms) for the focus re-frame retry, after setData's auto-scroll settles. */
export const TRADE_FOCUS_RETRY_MS = 90;
/** Minimum spotlight width (px) so a single selected bar stays visible. */
export const MIN_SPOTLIGHT_WIDTH = 8;
/** Right offset (px) reserved for a price line's on-axis value box. */
export const LINE_LABEL_RIGHT_OFFSET = 68;
