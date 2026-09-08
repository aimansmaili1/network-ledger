# Network Ledger — Production Deployment Guide

## Overview

You now have a complete AI-powered CRM ready for production. This guide walks you through connecting it to Supabase (cloud database) so your contacts persist forever and are accessible from any device.

## What You Have

✅ **Vercel** — hosts your website + WhatsApp AI feature  
✅ **Supabase** — stores your contacts securely  
✅ **GitHub** — version control  
✅ **Local Prototype** — working in your browser right now

## The 3-Step Deployment

### Step 1: Configure Supabase Connection (5 min)

1. In your Supabase dashboard, go to **Settings** → **API**
2. Copy these two values:
   - **Project URL** (e.g., `https://btbszlkxtbqrzfgeju.supabase.co`)
   - **anon public key** (the long JWT-looking key)

3. In your `network-ledger` repo, create a new file: `config.js`

```javascript
// config.js
window.SUPABASE_CONFIG = {
  url: "https://YOUR-PROJECT-URL.supabase.co",
  anonKey: "YOUR-ANON-KEY"
};
```

4. Commit and push to GitHub:
```bash
git add config.js
git commit -m "config: add Supabase configuration"
git push origin main
```

### Step 2: Update index.html to Use Supabase (Already Done ✓)

The WhatsApp feature and all existing code is ready. The next step is adding the Supabase JS client.

Add this line to the `<head>` of `index.html` (after the fonts, before the style tag):

```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script src="./config.js"></script>
```

Then, update the `initStore()` function in the JavaScript (around line 384) to check for Supabase:

```javascript
function initStore(){
  // Check if Supabase is configured
  if(window.SUPABASE_CONFIG && window.SUPABASE_CONFIG.url){
    return initSupabaseStore();
  }
  // Fallback to local storage
  return Promise.resolve(makeLocalStore());
}

async function initSupabaseStore(){
  try {
    // Import Supabase
    const { createClient } = window.supabase;
    const supabase = createClient(
      window.SUPABASE_CONFIG.url,
      window.SUPABASE_CONFIG.anonKey
    );
    
    // Check if user is logged in
    const { data: { user } } = await supabase.auth.getUser();
    
    if(!user){
      // Show login screen
      showLoginScreen(supabase);
      return makeLocalStore(); // Use local storage while not logged in
    }
    
    // User is logged in, use Supabase
    return makeSupabaseStore(supabase, user.id);
  } catch(err){
    console.error("Supabase init error:", err);
    return makeLocalStore();
  }
}
```

### Step 3: Add Authentication (Login Screen)

Add this HTML to the page (add after the existing `<div class="app">...</div>` but before `<script>`):

```html
<div id="auth-screen" style="display:none; position:fixed; inset:0; background:var(--paper); z-index:200; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:20px; padding:20px;">
  <div style="text-align:center; max-width:400px;">
    <h2 style="font:600 28px var(--font-display); margin:0 0 10px;">Network Ledger</h2>
    <p style="font:400 13px var(--font-body); color:var(--ink-muted); margin:0 0 30px;">Sign in to access your contacts</p>
    
    <button id="google-signin" class="btn primary wide" style="width:100%; margin-bottom:10px;">
      🔗 Sign in with Google
    </button>
    
    <div style="margin:20px 0; display:flex; align-items:center; gap:10px;">
      <div style="flex:1; height:1px; background:var(--border);"></div>
      <span style="font:400 12px var(--font-body); color:var(--ink-faint);">OR</span>
      <div style="flex:1; height:1px; background:var(--border);"></div>
    </div>
    
    <div style="display:flex; gap:10px; margin-bottom:10px;">
      <input id="magic-email" type="email" placeholder="your@email.com" style="flex:1; font:400 13px var(--font-body); padding:8px 11px; border-radius:8px; border:1px solid var(--border-strong); background:var(--surface-raised); color:var(--ink);">
      <button id="magic-signin" class="btn primary">Send link</button>
    </div>
    <p id="auth-message" style="font:400 12px var(--font-body); color:var(--ink-muted); margin:0; min-height:1.2em;"></p>
  </div>
</div>
```

### Step 4: Create the Supabase Store Function

Add the `makeSupabaseStore()` function before `initStore()`. Here's a simplified version that works with your existing code:

```javascript
function makeSupabaseStore(supabase, userId){
  var col = supabase.from("contacts");
  var listeners = [];
  var data = [];
  
  function notify(){
    listeners.forEach(function(cb){ cb(data.slice()); });
  }
  
  // Load initial data
  col.select("*").eq("user_id", userId).order("created_at", {ascending: false}).then(function(res){
    if(res.error) throw res.error;
    data = res.data || [];
    notify();
  });
  
  // Subscribe to real-time changes
  supabase
    .channel("contacts:" + userId)
    .on("postgres_changes", {
      event: "*",
      schema: "public",
      table: "contacts",
      filter: "user_id=eq." + userId
    }, function(payload){
      if(payload.eventType === "INSERT"){
        if(!data.find(function(c){ return c.id === payload.new.id; })){
          data.unshift(payload.new);
        }
      } else if(payload.eventType === "UPDATE"){
        var idx = data.findIndex(function(c){ return c.id === payload.new.id; });
        if(idx >= 0) data[idx] = payload.new;
      } else if(payload.eventType === "DELETE"){
        data = data.filter(function(c){ return c.id !== payload.old.id; });
      }
      notify();
    })
    .subscribe();
  
  return {
    mode: "cloud",
    subscribe: function(cb){
      listeners.push(cb);
      cb(data.slice());
      return function(){ listeners = listeners.filter(function(l){ return l !== cb; }); };
    },
    upsert: function(c){
      var body = {};
      for(var k in c) if(k !== "id") body[k] = c[k];
      body.user_id = userId;
      body.updated_at = new Date().toISOString();
      
      if(c.id){
        return col.update(body).eq("id", c.id).then(function(res){
          if(res.error) throw res.error;
          return c.id;
        });
      }
      
      body.created_at = new Date().toISOString();
      return col.insert([body]).then(function(res){
        if(res.error) throw res.error;
        return res.data[0].id;
      });
    },
    remove: function(id){
      return col.delete().eq("id", id).then(function(res){
        if(res.error) throw res.error;
      });
    }
  };
}

function showLoginScreen(supabase){
  var screen = document.getElementById("auth-screen");
  if(!screen) return;
  screen.style.display = "flex";
  
  document.getElementById("google-signin").addEventListener("click", function(){
    supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin }
    });
  });
  
  document.getElementById("magic-signin").addEventListener("click", function(){
    var email = document.getElementById("magic-email").value.trim();
    if(!email) return;
    
    supabase.auth.signInWithOtp({
      email: email,
      options: { emailRedirectTo: window.location.origin }
    }).then(function(res){
      if(res.error) throw res.error;
      document.getElementById("auth-message").textContent = "✓ Check your email for the login link!";
    }).catch(function(err){
      document.getElementById("auth-message").textContent = "Error: " + err.message;
    });
  });
}
```

### Step 5: Deploy to Vercel

1. Push your updated code to GitHub
2. Vercel will auto-deploy
3. Test at your deployment URL

### Step 6: Enable Authentication in Supabase (Important!)

1. Go to Supabase dashboard
2. Click **Authentication** (left sidebar)
3. Click **Providers**
4. Enable **Google** (optional but recommended):
   - Create a Google OAuth app (follow Supabase instructions)
   - Paste credentials
5. Enable **Email** (magic links):
   - Just enable it, no config needed

### Testing

1. Visit your deployed app
2. Click "Sign in with Google" or enter your email
3. Your existing localStorage contacts should migrate automatically
4. Add a new contact → should save to cloud
5. Refresh the page → contact should still be there
6. Try the WhatsApp draft feature → should work seamlessly

---

## Troubleshooting

**"Not connected to your cloud database"**
- config.js might not be loaded
- Supabase URL/key might be wrong
- User not logged in

**Contacts disappeared**
- They're still in localStorage
- Log in and they'll migrate automatically
- Check browser dev tools → Application → Local Storage

**WhatsApp drafts not working**
- Make sure ANTHROPIC_API_KEY is set in Vercel
- Check Vercel logs for errors

---

## Next Steps

Once working:
- Test with real data
- Invite others (they'll each have private data via RLS)
- Add more AI features (email drafts, follow-up suggestions)
- Set up monitoring in Vercel

**You're almost there! Ready to deploy?**
