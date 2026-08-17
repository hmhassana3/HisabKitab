# 📒 HisabKitab — حساب کتاب

**Udhaar / Jama / Customer Ledger / Payment Reminder / Evidence** — Pakistani dukandaron ke liye.

- ✅ **100% Free** — koi paid plan nahi, koi server nahi, koi Firebase billing nahi
- ✅ **Data aapke apne Google Drive par** — har user ka apna private `HisabKitab` folder (koi doosra user use nahi dekh sakta)
- ✅ **Google Login** — ek hi Google account se har device par pura hisab
- ✅ **GitHub Pages par live** — sirf upload karein, kaam ho gaya
- ✅ **Urdu + English** — app ke andar se language change karein
- ✅ **Offline bhi chalta hai** — internet band ho to bhi kaam karein, wapas aate hi sync
- ✅ JetBrains Mono font style (Urdu + English)

---

## 🚀 3 Steps — Live karne ke liye

### Step 1: GitHub par upload
1. Ye project (zip ya folder) apne GitHub account par **naya repository** bana kar upload karein.
2. Repository → **Settings → Pages** → Source: **Deploy from a branch** → Branch: `main` → Folder: **`/docs`** → **Save**.
3. 1–2 minute wait karein. Aapki site live ho jayegi:
   `https://YOUR_USERNAME.github.io/YOUR_REPO_NAME/`

> Optional: `Actions` se bhi auto-deploy hota hai — `.github/workflows/deploy.yml` pehle se ready hai.

### Step 2: Google Client ID (sirf ek baar, ~5 minute, bilkul free)
App chalane ke liye sirf ek baar Google ka Client ID chahiye:

1. [console.cloud.google.com](https://console.cloud.google.com/) → **Create Project** (naam: `hisabkitab`)
2. **APIs & Services → Library** → "Google Drive API" search karke **Enable**
3. **APIs & Services → OAuth consent screen** → External → App name `HisabKitab` → apna email → Save
   → **Test users** mein apna Google account add karein (aur jis kisi ko bhi use karwana ho)
4. **APIs & Services → Credentials → Create Credentials → OAuth client ID**
   → Application type: **Web application**
   → **Authorized JavaScript origins**: apni site ka URL (jaise `https://YOUR_USERNAME.github.io/YOUR_REPO_NAME/`)
   → **Create** → Client ID copy karein (`xxxx.apps.googleusercontent.com`)
5. Apni site kholen → **One-time Setup** page → Client ID paste karein → **Save** → **Login** 🎉

Full detail: **[SETUP.md](./SETUP.md)**

### Step 3: Use karein
- **Continue with Google** → apna account → **HisabKitab** khud apne Google Drive mein bana lega.
- Naya customer, udhaar, payment, photo, voice, receipt, report — sab kuch.
- Doosre phone/laptop par same Google account se login → **poora hisab wapas** ✅

---

## ✨ Features (100-point spec)

| Area | Kya hai |
|---|---|
| Login | Google login, per-user shop auto-create, cross-device sync |
| Storage | Google Drive (user ka apna), `drive.file` scope = sirf app ke files |
| Customers | Search (name/phone/gmail/ID), photo, archive, filters, sorting |
| Transactions | Multiple items, quantity, original price, fixed/% discount, final price |
| Money | **Integer paisa** storage — no float bugs (`Rs. 1,234.50` = `123450`) |
| Ledger | Auto running balance, filters (search/date/type), accounting-safe |
| Payments | Partial payments, methods (Cash/Bank/Easypaisa/JazzCash/Other), receipt photo |
| Due/Promise | Due date, promise date/amount/note, remaining-days calc |
| Reminders | Due-today, overdue (2/4/7 days configurable), weekly — in-app + Email/WhatsApp/SMS |
| Evidence | Customer/item/receipt photos (camera), customer + shopkeeper voice, gallery, zoom |
| Receipts | Professional receipt, **PDF** (Urdu-safe), print, share |
| Reports | Daily, monthly, charts (SVG), top customers |
| IDs | `HK-20260812-0001`, `PAY-...`, audit log, void (reason required), archive |
| Offline | IndexedDB cache + write queue → auto sync on reconnect, status badge |
| Calculator | Floating, 2-sec auto-hide, keyboard + touch |
| UI | Mobile-first, bottom nav, desktop sidebar, dark mode, Urdu RTL |
| Export | CSV (Excel-compatible, Urdu-safe), JSON backup/restore, print |

## 🛠️ Developer

```bash
npm install
npm run dev        # local dev
npm run build      # production build → dist/
npm run zip        # hisabkitab.zip (bina kisi folder ke, GitHub upload ready)
node scripts/run-smoke.mjs   # logic tests (30)
```

**Architecture**: `src/drive/` = Google Drive client + sync engine · `src/state/` = app state/actions · `src/lib/` = money/ledger/reminders/pdf/csv · `src/i18n/` = English + Urdu.

**Free hone ki guarantee**: Firebase ya koi paid API **nahi**. Sirf Google Identity Services + Google Drive API (free quota). Data upload/download har user ki apni Drive mein hota hai.

## 🔒 Security

- `drive.file` scope → app sirf wohi files dekhta hai jo usne banayi hain
- Har user ka data uske **apne** Google Drive mein — server-side isolation automatic
- No passwords, no frontend secrets, no API keys (Client ID secret nahi hai — public hota hai)
- Financial records delete nahi hote — **void** (reason required) + audit log

## ⚠️ Honest note
- Email/WhatsApp/SMS reminders aapke phone/email app khol kar bhejte hain (free, no backend) — ye `mailto:`, `wa.me`, `sms:` links hain.
- Scheduled backend reminders (browser band hone par) ke liye paid server chahiye hota hai — is liye reminders app kholte hi check ho kar notification banate hain. (Spec #62 ki isliye free version mein ye approach use hui.)

---
*Powered by Google Drive — 100% free. Made for Pakistani dukandaron 🇵🇰*
