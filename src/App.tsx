import { useCallback, useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import {
  supabase,
  command,
  createStandaloneCalendarEvent,
  createTaskCalendarEvent,
  getGoogleCalendarCredentialStatus,
  storeGoogleCalendarCredentials,
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
import { createGuestWorkspace } from "./guestPreview";

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
  const [approved, setApproved] = useState(false);
  const [approvalChecked, setApprovalChecked] = useState(false);
  const [error, setError] = useState("");
  const [calendarCredentialAvailable, setCalendarCredentialAvailable] =
    useState(false);
  const startGoogleSignIn = useCallback(async () => {
    if (!supabase) {
      setError("正式登入服務尚未設定；你仍可使用 Guest Preview。");
      return;
    }
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin + import.meta.env.BASE_URL,
        scopes: googleCalendarScopes,
        queryParams: { access_type: "offline", prompt: "consent" },
      },
    });
    if (error) setError(error.message);
  }, []);
  const guest = useMemo(
    () => createGuestWorkspace(undefined, startGoogleSignIn),
    [startGoogleSignIn],
  );
  const checkApproval = useCallback(async (next: Session | null) => {
    setSession(next);
    if (!next || !supabase) {
      setApproved(false);
      setApprovalChecked(true);
      setReady(true);
      return;
    }
    setApprovalChecked(false);
    const { data, error } = await supabase.rpc("is_allowed");
    setError(error?.message ?? "");
    setApproved(!error && data === true);
    setApprovalChecked(true);
    setReady(true);
  }, []);
  useEffect(() => {
    if (!approved || !session?.provider_token) return;
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
  }, [approved, session?.provider_token]);
  useEffect(() => {
    if (!supabase) {
      setReady(true);
      setApprovalChecked(true);
      return;
    }
    const client = supabase;
    client.auth
      .getSession()
      .then(({ data, error }) => {
        setError(error?.message ?? "");
        return checkApproval(data.session);
      })
      .catch((e) => {
        setError(String(e));
        setReady(true);
        setApprovalChecked(true);
      });
    const { data } = client.auth.onAuthStateChange((_event, next) => {
      void checkApproval(next);
    });
    return () => data.subscription.unsubscribe();
  }, [checkApproval]);
  useEffect(() => {
    if (!approved || !session || !supabase) return;
    const verify = () => void checkApproval(session);
    window.addEventListener("focus", verify);
    return () => window.removeEventListener("focus", verify);
  }, [approved, checkApproval, session]);
  useEffect(() => {
    if (!approved || !session) {
      setCalendarCredentialAvailable(false);
      return;
    }
    let cancelled = false;
    const credentials =
      session.provider_token || session.provider_refresh_token;
    const status = credentials
      ? storeGoogleCalendarCredentials(
          session.provider_token,
          session.provider_refresh_token,
        )
      : getGoogleCalendarCredentialStatus();
    status
      .then((value) => {
        if (!cancelled)
          setCalendarCredentialAvailable(
            value.available && !value.needs_reconnect,
          );
      })
      .catch(() => {
        if (!cancelled) setCalendarCredentialAvailable(false);
      });
    return () => {
      cancelled = true;
    };
  }, [
    approved,
    session?.user.id,
    session?.provider_token,
    session?.provider_refresh_token,
  ]);
  async function withCalendarCredential<T>(operation: () => Promise<T>) {
    try {
      return await operation();
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : String(reason);
      if (message.includes("重新連結") || message.includes("無法靜默續期"))
        setCalendarCredentialAvailable(false);
      throw reason;
    }
  }
  if (!ready || (session && !approvalChecked))
    return (
      <main className="gate" aria-busy="true">
        正在確認帳號核准狀態…
      </main>
    );
  if (!session || !supabase)
    return (
      <Board
        execute={guest.execute}
        calendar={guest.calendar}
        summaries={guest.summaries}
        search={guest.search}
        workflows={guest.workflows}
        exchangeRates={guest.exchangeRates}
        accessMode="guest"
        onSignIn={startGoogleSignIn}
        accessMessage={error}
      />
    );
  if (!approved)
    return (
      <main className="gate">
        <p className="eyebrow">ACCESS REVIEW</p>
        <h1>此帳號尚未獲准</h1>
        <p>
          {session.user.email ?? "目前的 Google 帳號"} 不在管理員維護的
          allowed_users。私人資料未載入。
        </p>
        {error && <p role="alert">{error}</p>}
        <button
          onClick={async () => {
            const { error } = await supabase!.auth.signOut();
            if (error) setError(error.message);
          }}
        >
          登出並返回 Guest Preview
        </button>
      </main>
    );
  return (
    <Board
      key={session.user.id}
      execute={command}
      calendar={{
        tokenAvailable: calendarCredentialAvailable,
        connect: async () => {
          const { error } = await supabase!.auth.signInWithOAuth({
            provider: "google",
            options: {
              redirectTo: window.location.origin + import.meta.env.BASE_URL,
              scopes: googleCalendarScopes,
              queryParams: { access_type: "offline", prompt: "consent" },
            },
          });
          if (error) throw error;
        },
        sync: () => withCalendarCredential(() => syncGoogleCalendar()),
        create: (task, calendarId) =>
          withCalendarCredential(() =>
            createTaskCalendarEvent(task, calendarId),
          ),
        createStandalone: (input) =>
          withCalendarCredential(() => createStandaloneCalendarEvent(input)),
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
              queryParams: { access_type: "offline", prompt: "consent" },
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
      accessMode="approved"
      accessMessage={session.user.email ?? "核准使用者"}
      onSignOut={async () => {
        const { error } = await supabase!.auth.signOut();
        if (error) throw error;
      }}
    />
  );
}
