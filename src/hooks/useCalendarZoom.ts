"use client";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import {
  clampHourHeight,
  decodeHourHeight,
  DEFAULT_HOUR_HEIGHT,
  isZoomWheel,
  ZOOM_KEY,
  ZOOM_STEP,
  zoomScrollTop,
} from "@/lib/calendarZoom";

export function useCalendarZoom(
  scope: RefObject<HTMLElement | null>,
  scroll: RefObject<HTMLDivElement | null>,
) {
  const [hourHeight, setHourHeight] = useState(DEFAULT_HOUR_HEIGHT);
  const [ready, setReady] = useState(false);
  const [sessionOnly, setSessionOnly] = useState(false);
  const requested = useRef(DEFAULT_HOUR_HEIGHT);
  const committed = useRef(DEFAULT_HOUR_HEIGHT);
  const pending = useRef<{
    scrollTop: number;
    from: number;
    offset: number;
  } | null>(null);

  useEffect(() => {
    try {
      const saved = decodeHourHeight(localStorage.getItem(ZOOM_KEY));
      requested.current = saved;
      setHourHeight(saved);
    } catch {
      setSessionOnly(true);
    }
    setReady(true);
  }, []);

  const setZoom = useCallback(
    (value: number, pointerY?: number) => {
      const next = clampHourHeight(value);
      const el = scroll.current;
      if (el && next !== requested.current) {
        const header =
          el.querySelector<HTMLElement>(".day-heading")?.offsetHeight ?? 0;
        const offset =
          pointerY === undefined
            ? 0
            : Math.max(
                0,
                Math.min(
                  pointerY - el.getBoundingClientRect().top - header,
                  Math.max(0, el.clientHeight - header),
                ),
              );
        pending.current = {
          scrollTop: el.scrollTop,
          from: committed.current,
          offset,
        };
      }
      requested.current = next;
      setHourHeight(next);
      try {
        localStorage.setItem(ZOOM_KEY, String(next));
        setSessionOnly(false);
      } catch {
        setSessionOnly(true);
      }
    },
    [scroll],
  );

  useLayoutEffect(() => {
    const el = scroll.current;
    const previous = pending.current;
    if (el && previous) {
      el.scrollTop = zoomScrollTop({
        ...previous,
        to: hourHeight,
        headerHeight:
          el.querySelector<HTMLElement>(".day-heading")?.offsetHeight ?? 0,
        viewportHeight: el.clientHeight,
      });
      pending.current = null;
    }
    committed.current = hourHeight;
  }, [hourHeight, scroll]);

  useEffect(() => {
    const el = scope.current;
    function wheel(event: WheelEvent) {
      if (event.defaultPrevented || !isZoomWheel(event, navigator.platform))
        return;
      event.preventDefault();
      // Fine trackpad movement changes one pixel; a mouse notch changes up to four.
      const step =
        event.deltaMode === 0
          ? Math.max(
              1,
              Math.min(ZOOM_STEP, Math.round(Math.abs(event.deltaY) / 10)),
            )
          : ZOOM_STEP;
      setZoom(
        requested.current + (event.deltaY < 0 ? step : -step),
        event.clientY,
      );
    }
    el?.addEventListener("wheel", wheel, { passive: false });
    return () => el?.removeEventListener("wheel", wheel);
  }, [scope, setZoom]);

  return { hourHeight, setZoom, ready, sessionOnly };
}
