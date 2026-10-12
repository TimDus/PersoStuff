// Everything the app asks of Supabase, behind one object so a test can swap it out [tests set window.HIRA_TEST_BACKEND].
(function () {
  const { supabaseUrl, supabaseKey } = window.HIRA_CONFIG || {};

  function supabaseBackend() {
    if (!supabaseUrl || !supabaseKey || !window.supabase) return null;
    const sb = window.supabase.createClient(supabaseUrl, supabaseKey, { auth: { flowType: "pkce" } });
    const bucket = () => sb.storage.from("content");
    const must = ({ data, error }) => {
      if (error) throw error;
      return data;
    };
    return {
      async session() {
        const { data } = await sb.auth.getSession();
        const user = data.session?.user;
        return user ? { id: user.id, email: user.email } : null;
      },
      signIn() {
        return sb.auth.signInWithOAuth({ provider: "google", options: { redirectTo: location.origin + location.pathname } });
      },
      signOut: () => sb.auth.signOut(),
      isAllowed: async () => must(await sb.rpc("is_allowed")) === true,
      async content() {
        return JSON.parse(await must(await bucket().download("worksheets.json")).text());
      },
      // Signed links for many files in one request [135 clips and 92 drawings, valid 12 hours].
      async signedUrls(paths) {
        const rows = must(await bucket().createSignedUrls(paths, 12 * 3600));
        return new Map(rows.filter((r) => r.signedUrl).map((r) => [r.path, r.signedUrl]));
      },
      async loadProgress() {
        return must(await sb.from("progress").select("data").maybeSingle())?.data || null;
      },
      async saveProgress(userId, data) {
        must(await sb.from("progress").upsert({ user_id: userId, data, updated_at: new Date().toISOString() }));
      },
      // The vocabulary deck has its own column, so neither save overwrites the other [an upsert sets only the columns it names].
      async loadStudy() {
        return must(await sb.from("progress").select("study").maybeSingle())?.study || null;
      },
      async saveStudy(userId, study) {
        must(await sb.from("progress").upsert({ user_id: userId, study, updated_at: new Date().toISOString() }));
      },
    };
  }

  window.HIRA_BACKEND = window.HIRA_TEST_BACKEND || supabaseBackend();
})();
