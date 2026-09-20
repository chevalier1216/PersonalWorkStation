import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import {
  supabase,
  command,
  createTaskCalendarEvent,
  syncGoogleCalendar,
} from "./api";
import { Board } from "./Board";
export function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
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
                scopes: "openid email profile https://www.googleapis.com/auth/calendar",
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
              scopes: "openid email profile https://www.googleapis.com/auth/calendar",
              queryParams: { prompt: "consent" },
            },
          });
          if (error) throw error;
        },
        sync: (snapshot) => syncGoogleCalendar(session.provider_token!, snapshot),
        create: (task, calendarId) =>
          createTaskCalendarEvent(session.provider_token!, task, calendarId),
      }}
      onSignOut={async () => {
        const { error } = await supabase!.auth.signOut();
        if (error) throw error;
      }}
    />
  );
}
