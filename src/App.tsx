import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import {
  supabase,
  command,
  createTaskCalendarEvent,
  syncGoogleCalendar,
} from "./api";
import { Board } from "./Board";
import { summaryCommand } from "./summary";
import { historySearch } from "./search";
import {
  archiveAttachment,
  attachmentFolderUrl,
  attachmentCommand,
  backupIsDue,
  capacityIsDue,
  openAttachment,
  runDriveMaintenance,
  uploadAttachment,
} from "./attachments";
import { workflowCommand } from "./workflow";
import { loadExchangeRates, refreshExchangeRates } from "./exchangeRates";
import { createLocalExecutor } from "./localExecutor";

const googleCalendarScopes = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/calendar.calendarlist.readonly",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/drive.file",
].join(" ");

export function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!session?.provider_token) return;
    let cancelled = false;
    attachmentCommand("load")
      .then(async (state) => {
        if (cancelled) return;
        if (capacityIsDue(state))
          await runDriveMaintenance("measure", session.provider_token!);
        if (backupIsDue(state))
          await runDriveMaintenance("backup", session.provider_token!);
      })
      .catch(() => {
        // drive-maintenance records a visible workspace notification on failure.
      });
    return () => {
      cancelled = true;
    };
  }, [session?.provider_token]);
  useEffect(() => {
    if (!supabase) return;
    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        setSession(data.session);
        setError(error?.message ?? "");
        setReady(true);
      })
      .catch((e) => {
        setError(String(e));
        setReady(true);
      });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setReady(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);
  if (!supabase)
    return (
      <main className="gate">
        <p className="eyebrow">PERSONAL WORKSTATION</p>
        <h1>連接你的工作臺</h1>
        <p>尚未設定資料服務，任務功能暫時無法使用。</p>
        <p>請依專案 README 完成 Supabase 與 Google 登入設定後重新啟動。</p>
      </main>
    );
  if (!ready)
    return (
      <main className="gate" aria-busy="true">
        正在恢復登入狀態…
      </main>
    );
  if (!session)
    return (
      <main className="gate">
        <p className="eyebrow">PERSONAL WORKSTATION</p>
        <h1>把工作整理好，從這裡開始。</h1>
        <p>使用指定的 Google 帳號登入你的私人工作臺。</p>
        {error && <p role="alert">{error}</p>}
        <button
          onClick={async () => {
            const { error } = await supabase!.auth.signInWithOAuth({
              provider: "google",
              options: {
                redirectTo: window.location.origin + import.meta.env.BASE_URL,
                scopes: googleCalendarScopes,
                queryParams: { prompt: "consent" },
              },
            });
            if (error) setError(error.message);
          }}
        >
          使用 Google 登入
        </button>
      </main>
    );
  return (
    <Board
      key={session.user.id}
      execute={command}
      calendar={{
        tokenAvailable: Boolean(session.provider_token),
        connect: async () => {
          const { error } = await supabase!.auth.signInWithOAuth({
            provider: "google",
            options: {
              redirectTo: window.location.origin + import.meta.env.BASE_URL,
              scopes: googleCalendarScopes,
              queryParams: { prompt: "consent" },
            },
          });
          if (error) throw error;
        },
        sync: (snapshot) =>
          syncGoogleCalendar(session.provider_token!, snapshot),
        create: (task, calendarId) =>
          createTaskCalendarEvent(session.provider_token!, task, calendarId),
      }}
      summaries={{
        load: () => summaryCommand("load"),
        create: (taskId, draft) =>
          summaryCommand("create", { task_id: taskId, ...draft }),
      }}
      search={{ search: historySearch }}
      attachments={{
        reconnect: async () => {
          const { error } = await supabase!.auth.signInWithOAuth({
            provider: "google",
            options: {
              redirectTo: window.location.origin + import.meta.env.BASE_URL,
              scopes: googleCalendarScopes,
              queryParams: { prompt: "consent" },
            },
          });
          if (error) throw error;
        },
        load: () => attachmentCommand("load"),
        upload: uploadAttachment,
        open: openAttachment,
        archive: (id) => archiveAttachment(id, session.provider_token ?? ""),
        folder: (id) => attachmentFolderUrl(id, session.provider_token ?? ""),
        measure: () =>
          runDriveMaintenance("measure", session.provider_token ?? ""),
        backup: () =>
          runDriveMaintenance("backup", session.provider_token ?? ""),
      }}
      workflows={{ run: workflowCommand }}
      exchangeRates={{ load: loadExchangeRates, refresh: refreshExchangeRates }}
      localExecutor={createLocalExecutor({
        accessToken: session.access_token,
        supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
        publishableKey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        bridgeUrl: import.meta.env.VITE_LOCAL_EXECUTOR_URL,
      })}
      onSignOut={async () => {
        const { error } = await supabase!.auth.signOut();
        if (error) throw error;
      }}
    />
  );
}
