"use client";
import { useEffect, useState } from "react";
import { THEME_KEY } from "@/lib/storage";
import { emptySchedule } from "@/lib/schedule/types";
import {
  backupPayload,
  loadSchedule,
  SCHEDULE_KEY,
} from "@/lib/schedule/persistence";
export function useSchedule() {
  const [schedule, setSchedule] = useState(emptySchedule);
  const [ready, setReady] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [storageError, setStorageError] = useState("");
  const [writable, setWritable] = useState(false);
  useEffect(() => {
    try {
      setSchedule(loadSchedule(localStorage));
      setWritable(true);
    } catch {
      setStorageError(
        "Saved shifts could not be read or migrated. Existing storage is preserved; changes will not be saved. Export a JSON backup before recovery.",
      );
    }
    try {
      const saved = localStorage.getItem(THEME_KEY);
      setTheme(
        saved === "light" || saved === "dark"
          ? saved
          : matchMedia("(prefers-color-scheme: light)").matches
            ? "light"
            : "dark",
      );
    } catch {}
    const changed = (event: StorageEvent) => {
      if (event.key === SCHEDULE_KEY) {
        setWritable(false);
        setStorageError(
          "The schedule changed in another tab. Export a backup and reload before editing.",
        );
      }
    };
    window.addEventListener("storage", changed);
    setReady(true);
    return () => window.removeEventListener("storage", changed);
  }, []);
  useEffect(() => {
    if (ready && writable)
      try {
        localStorage.setItem(SCHEDULE_KEY, JSON.stringify(schedule));
        setStorageError("");
      } catch {
        setStorageError(
          "Changes are only in memory: local storage is unavailable or full. Export a JSON backup now.",
        );
      }
  }, [ready, writable, schedule]);
  useEffect(() => {
    if (ready)
      try {
        localStorage.setItem(THEME_KEY, theme);
      } catch {}
  }, [ready, theme]);
  function exportBackup() {
    try {
      const payload = JSON.parse(backupPayload(localStorage));
      payload.inMemorySchedule = schedule;
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(payload, null, 2)], {
          type: "application/json",
        }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = `shiftsync-backup-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setStorageError(
        "The backup could not be exported. Browser storage or downloads are unavailable.",
      );
    }
  }
  return {
    schedule,
    setSchedule,
    ready,
    theme,
    setTheme,
    storageError,
    exportBackup,
  };
}
