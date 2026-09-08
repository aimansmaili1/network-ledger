/**
 * Supabase Storage Adapter for Network Ledger
 *
 * Implements the same interface as makeLocalStore but uses Supabase as backend.
 * Handles:
 * - Real-time sync with row-level security
 * - Offline queue for pending writes
 * - Auto-migration from localStorage
 */

export function makeSupabaseStore(supabase, userId) {
  let contacts = [];
  let pendingWrites = [];
  let syncInProgress = false;
  let isConnected = true;
  let listeners = new Set();

  // Notify all listeners of state changes
  function notifyListeners() {
    listeners.forEach(fn => fn({ contacts, isConnected, syncInProgress }));
  }

  // Load contacts from cloud on startup
  async function loadFromCloud() {
    try {
      const { data, error } = await supabase
        .from("contacts")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Load error:", error);
        isConnected = false;
        notifyListeners();
        return;
      }

      contacts = data || [];
      isConnected = true;
      notifyListeners();
    } catch (err) {
      console.error("Load exception:", err);
      isConnected = false;
      notifyListeners();
    }
  }

  // Process pending writes after reconnect
  async function flushPendingWrites() {
    if (pendingWrites.length === 0 || syncInProgress) return;

    syncInProgress = true;
    notifyListeners();

    for (const write of pendingWrites) {
      try {
        if (write.op === "insert") {
          const { error } = await supabase
            .from("contacts")
            .insert([{ ...write.data, user_id: userId }]);
          if (error) throw error;
        } else if (write.op === "update") {
          const { error } = await supabase
            .from("contacts")
            .update(write.data)
            .eq("id", write.id);
          if (error) throw error;
        } else if (write.op === "delete") {
          const { error } = await supabase
            .from("contacts")
            .delete()
            .eq("id", write.id);
          if (error) throw error;
        }
      } catch (err) {
        console.error("Flush error:", err);
        syncInProgress = false;
        notifyListeners();
        return;
      }
    }

    pendingWrites = [];
    syncInProgress = false;
    await loadFromCloud();
  }

  // Set up real-time subscription
  const subscription = supabase
    .channel(`contacts:${userId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "contacts",
        filter: `user_id=eq.${userId}`
      },
      (payload) => {
        if (payload.eventType === "INSERT") {
          const newContact = payload.new;
          if (!contacts.find(c => c.id === newContact.id)) {
            contacts.push(newContact);
          }
        } else if (payload.eventType === "UPDATE") {
          const idx = contacts.findIndex(c => c.id === payload.new.id);
          if (idx >= 0) {
            contacts[idx] = payload.new;
          }
        } else if (payload.eventType === "DELETE") {
          contacts = contacts.filter(c => c.id !== payload.old.id);
        }
        notifyListeners();
      }
    )
    .subscribe();

  return {
    async list() {
      if (!isConnected) return contacts;
      await loadFromCloud();
      return contacts;
    },

    async get(id) {
      return contacts.find(c => c.id === id);
    },

    async set(id, contact) {
      try {
        const { error } = await supabase
          .from("contacts")
          .upsert({ ...contact, id, user_id: userId });

        if (error) {
          // Queue for retry if offline
          pendingWrites.push({ op: "update", id, data: contact });
          isConnected = false;
          notifyListeners();
          return;
        }

        // Update local state
        const idx = contacts.findIndex(c => c.id === id);
        if (idx >= 0) {
          contacts[idx] = { ...contact, id, user_id: userId };
        } else {
          contacts.unshift({ ...contact, id, user_id: userId });
        }

        isConnected = true;
        notifyListeners();
      } catch (err) {
        console.error("Set error:", err);
        pendingWrites.push({ op: "update", id, data: contact });
        isConnected = false;
        notifyListeners();
      }
    },

    async delete(id) {
      try {
        const { error } = await supabase
          .from("contacts")
          .delete()
          .eq("id", id);

        if (error) {
          pendingWrites.push({ op: "delete", id });
          isConnected = false;
          notifyListeners();
          return;
        }

        contacts = contacts.filter(c => c.id !== id);
        isConnected = true;
        notifyListeners();
      } catch (err) {
        console.error("Delete error:", err);
        pendingWrites.push({ op: "delete", id });
        isConnected = false;
        notifyListeners();
      }
    },

    async deleteAll() {
      try {
        const { error } = await supabase
          .rpc("delete_my_contacts");

        if (error) throw error;

        contacts = [];
        isConnected = true;
        notifyListeners();
      } catch (err) {
        console.error("Delete all error:", err);
        isConnected = false;
        notifyListeners();
      }
    },

    listen(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },

    async init() {
      await loadFromCloud();
      // Try to flush any pending writes
      await flushPendingWrites();
      return this;
    },

    async migrateFromLocalStorage(localContacts) {
      // Move contacts from localStorage to Supabase
      for (const contact of localContacts) {
        try {
          await this.set(contact.id, contact);
        } catch (err) {
          console.error("Migration error for contact:", contact.id, err);
        }
      }
    },

    cleanup() {
      subscription.unsubscribe();
    }
  };
}
