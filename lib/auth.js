/**
 * Authentication Module for Network Ledger
 *
 * Handles:
 * - Magic link sign-in (email)
 * - Google OAuth
 * - Session management
 * - Auto-login on page load
 */

export function makeAuthManager(supabase) {
  let currentUser = null;
  let listeners = new Set();

  function notifyListeners() {
    listeners.forEach(fn => fn(currentUser));
  }

  return {
    async signInWithMagicLink(email) {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: window.location.origin
        }
      });

      if (error) throw error;
      return { success: true, message: "Check your email for the login link" };
    },

    async signInWithGoogle() {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: window.location.origin
        }
      });

      if (error) throw error;
    },

    async logout() {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      currentUser = null;
      notifyListeners();
    },

    async checkSession() {
      const { data: { user } } = await supabase.auth.getUser();
      currentUser = user;
      notifyListeners();
      return user;
    },

    getCurrentUser() {
      return currentUser;
    },

    listen(fn) {
      listeners.add(fn);
      // Call immediately with current state
      fn(currentUser);
      return () => listeners.delete(fn);
    },

    // Watch for auth changes (sign in, sign out)
    onAuthStateChange(callback) {
      const { data: { subscription } } = supabase.auth.onAuthStateChange(
        (event, session) => {
          currentUser = session?.user || null;
          callback(event, currentUser);
          notifyListeners();
        }
      );
      return subscription;
    }
  };
}
