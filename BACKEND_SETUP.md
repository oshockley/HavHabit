# 🚀 HavHabit Backend Setup Guide

## What You Have

A complete Next.js backend with:
- ✅ PostgreSQL database (via Prisma)
- ✅ User authentication (JWT)
- ✅ API endpoints for habits, analytics, gamification
- ✅ Ready for Supabase or Railway deployment

---

## Quick Setup (5 minutes)

### 1. Create Supabase Account (Free Database)

1. Go to: https://supabase.com
2. Click "Start your project"
3. Create new organization
4. Create new project:
   - **Name:** havhabit-db
   - **Database Password:** (save this!)
   - **Region:** Choose closest to you
5. Wait 2 minutes for setup

### 2. Get Database URL

1. In Supabase dashboard → **Settings** → **Database**
2. Find "Connection string" → **URI**
3. Copy it (looks like: `postgresql://postgres.[PROJECT-REF]...`)
4. Replace `[YOUR-PASSWORD]` with your database password

### 3. Configure Environment

Open `havhabit-backend/.env.local` and update:

```env
DATABASE_URL="postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres"
JWT_SECRET="your-random-secret-key-min-32-characters-long"
NEXT_PUBLIC_API_URL="http://localhost:3000"
```

Generate JWT_SECRET:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 4. Initialize Database

```bash
cd havhabit-backend
npx prisma generate
npx prisma db push
```

### 5. Start Backend

```bash
npm run dev
```

Backend running at: **http://localhost:3000** 🎉

---

## API Endpoints Available

- POST /api/auth/signup
- POST /api/auth/login
- GET /api/habits
- POST /api/habits

---

**Full guide in BACKEND_GUIDE.md**
