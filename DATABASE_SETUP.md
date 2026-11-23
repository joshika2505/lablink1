# LabLink – Supabase Database Setup Guide

## Step 1: Create a Supabase Project

1. Go to https://supabase.com and sign in
2. Click **"New Project"**
3. Choose your organization, give it a name (e.g., `lablink`), set a secure database password, and pick a region close to you
4. Wait ~1 minute for the project to be provisioned

---

## Step 2: Run the Database Schema

1. In your Supabase dashboard, go to **SQL Editor** (left sidebar)
2. Click **"New Query"**
3. Open the file `supabase/schema.sql` from this project
4. Copy the **entire contents** and paste it into the SQL Editor
5. Click **"Run"** (or press `Ctrl+Enter`)

You should see: `Success. No rows returned.`

---

## Step 3: (Optional) Seed Demo Data

To populate the database with sample departments, labs, and equipment:

1. In the SQL Editor, open a new query
2. Open `supabase/seed.sql`, copy all contents, paste and run

---

## Step 4: Get Your API Keys

1. In your Supabase project, go to **Settings → API**
2. Copy these values (you'll need them for Vercel):

| Key | Where to find it |
|-----|------------------|
| `SUPABASE_URL` | "Project URL" |
| `VITE_SUPABASE_URL` | Same as above |
| `SUPABASE_SERVICE_ROLE_KEY` | "service_role" (secret — keep this private!) |
| `VITE_SUPABASE_ANON_KEY` | "anon public" |

---

## Step 5: Set Up Admin Access

After running the schema, you need to add your email to the `authorized_admins` table so you can log in as admin.

Run this SQL in the SQL Editor (replace with your actual email):

```sql
INSERT INTO public.authorized_admins (email, name, granted_by)
VALUES ('your-email@example.com', 'Your Name', 'Initial Setup')
ON CONFLICT (email) DO NOTHING;
```

Then register on the app using that same email and you'll have admin access.

---

## Step 6: Configure Vercel Environment Variables

In Vercel Dashboard → Your Project → Settings → Environment Variables, add:

| Variable | Value |
|----------|-------|
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Your service role key |
| `VITE_SUPABASE_URL` | Your Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Your anon public key |
| `SESSION_SECRET` | Any random 32+ char string (e.g. run: `openssl rand -hex 32`) |
| `GEMINI_API_KEY` | From https://aistudio.google.com/app/apikey |

> **Important**: Make sure to set these for all environments (Production, Preview, Development).

---

## Step 7: Trigger a Redeploy

After adding environment variables, go to **Vercel → Deployments → Redeploy** (top-right of latest deployment) to apply them.
