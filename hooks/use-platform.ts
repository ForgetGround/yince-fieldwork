"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Session, PlatformState } from "../lib/platform";
export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
export function usePlatform() {
  const [session, setSession] = useState<Session | null>(null),
    [state, setState] = useState<PlatformState | null>(null),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const identity = useRef<Session | null>(null),
    active = useRef(""),
    writeLock = useRef(false);
  const request = useCallback(
    async <T>(path: string, data?: unknown): Promise<T> => {
      const response = await fetch("/api" + path, {
        method: data === undefined ? "GET" : "POST",
        credentials: "same-origin",
        headers:
          data === undefined
            ? {}
            : {
                "Content-Type": "application/json",
                "X-CSRF-Token": identity.current?.csrf || "",
              },
        body: data === undefined ? undefined : JSON.stringify(data),
      });
      const value = (await response.json().catch(() => ({ error: "服务响应异常" }))) as T & { error?: string };
      if (!response.ok) {
        if (response.status === 401) {
          identity.current = null;
          setSession(null);
          setState(null);
          active.current = "";
        }
        throw new ApiError(response.status, value.error || "请求失败");
      }
      return value;
    },
    [],
  );
  const choose = useCallback(
    async (id: string) => {
      active.current = id;
      setState(null);
      setLoading(true);
      setError("");
      try {
        const next = await request<PlatformState>(`/workspaces/${id}/state`);
        if (active.current === id) {
          setState(next);
          try {
            localStorage.setItem("yince-active-workspace", id);
          } catch {}
        }
      } catch (e) {
        setError((e as Error).message);
      } finally {
        if (active.current === id) setLoading(false);
      }
    },
    [request],
  );
  const refreshSession = useCallback(
    async (preferred?: string) => {
      const next = await request<Session | null>("/session");
      identity.current = next;
      setSession(next);
      if (next?.workspaces.length) {
        let saved = "";
        try {
          saved = localStorage.getItem("yince-active-workspace") || "";
        } catch {}
        const target =
          next.workspaces.find(
            (w) => w.id === (preferred || active.current || saved),
          ) || next.workspaces[0];
        await choose(target.id);
      } else {
        active.current = "";
        setState(null);
        setLoading(false);
      }
      return next;
    },
    [request, choose],
  );
  useEffect(() => {
    refreshSession().catch((e) => {
      setError(e.message);
      setLoading(false);
    });
  }, [refreshSession]);
  const refresh = useCallback(async () => {
    const id = active.current;
    if (!id) return;
    try {
      const next = await request<PlatformState>(`/workspaces/${id}/state`);
      if (active.current === id)
        setState((old) =>
          !old || next.workspace.revision >= old.workspace.revision
            ? next
            : old,
        );
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }, [request]);
  useEffect(() => {
    if (!state?.workspace.id) return;
    const timer = setInterval(() => {
      if (!writeLock.current && document.visibilityState === "visible")
        void refresh();
    }, 30_000);
    return () => clearInterval(timer);
  }, [state?.workspace.id, refresh]);
  const command = useCallback(
    async <T>(data: unknown): Promise<T> => {
      if (writeLock.current) throw new Error("上一项操作正在保存，请稍候");
      const id = active.current;
      if (!id) throw new Error("请先选择工作空间");
      writeLock.current = true;
      setBusy(true);
      try {
        const answer = await request<{ state: PlatformState; result: T }>(
          `/workspaces/${id}/commands`,
          data,
        );
        if (active.current === id) setState(answer.state);
        return answer.result;
      } finally {
        writeLock.current = false;
        setBusy(false);
      }
    },
    [request],
  );
  async function authenticate(path: string, data: unknown) {
    setLoading(true);
    setError("");
    try {
      await request(path, data);
      await refreshSession();
    } catch (e) {
      setLoading(false);
      throw e;
    }
  }
  async function logout() {
    await request("/auth/logout", {});
    identity.current = null;
    active.current = "";
    setState(null);
    setSession(null);
  }
  async function switchIdentity(userId: string) {
    if (busy) return;
    await request("/demo/identity", { userId });
    await refreshSession();
  }
  return {
    session,
    state,
    loading,
    busy,
    error,
    request,
    command,
    choose,
    refresh,
    refreshSession,
    authenticate,
    logout,
    switchIdentity,
  };
}
