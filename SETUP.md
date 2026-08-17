# 🔧 HisabKitab — Complete Setup Guide (Sirf ek baar, bilkul free)

Do hisse hain:

1. **GitHub par live karna** (5 minute)
2. **Google Client ID banana** (5 minute) — iske baghair Google login nahi ho sakta, ye har web app ke liye zaroori hai

---

## Part 1 — GitHub Pages par live

### Option A (Sab se aasan — bina kisi software ke)
1. GitHub par **naya repository** banayein (koi bhi naam, e.g. `hisabkitab`). Public rakhein (free).
2. **Add file → Upload files** → is project ki **saari files/folders** select karke upload karein
   (zip file use kar rahe hain to pehle unzip karein — zip ke **andar ka content** upload karna hai, zip ka folder nahi).
3. **Commit changes** (main branch par).
4. Repository → **Settings** (tab) → **Pages** (left menu, "Code and automation" mein)
5. **Source**: `Deploy from a branch` → **Branch**: `main` → **Folder**: `/docs` → **Save**
6. 1–2 minute intezar → aapki app live:
   `https://YOUR_USERNAME.github.io/YOUR_REPO_NAME/`

### Option B (Git se push)
```bash
git init
git add .
git commit -m "HisabKitab"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
```
Phir wohi **Settings → Pages → /docs** steps.

### Option C (Auto-build via GitHub Actions)
`.github/workflows/deploy.yml` pehle se include hai. Agar aap **Settings → Pages → Source: GitHub Actions** select karein
to har push par app khud build ho kar deploy hogi (Actions free hai public repos ke liye).
Phir `/docs` wala step nahi karna.

> **Custom domain** chahte hain? Settings → Pages → Custom domain — bas.

---

## Part 2 — Google OAuth Client ID (One-time setup)

Google login + Google Drive storage ke liye Google ko ye batana hota hai ke "ye app meri hai".
Ye **free** hai aur sirf 5 minute lagte hain. Har device/browser par **ek baar** paste karna hota hai
(app ke "One-time Setup" page se, ya neeche diya .env wala tareeqa).

### Step-by-step
1. **Google Cloud Console** kholen: https://console.cloud.google.com/
2. Upar **project select** karein → **New Project** → Name: `hisabkitab` → **Create**
3. Project select karke **APIs & Services → Library** par jayein
4. Search karein: **Google Drive API** → us par click → **Enable**
5. **APIs & Services → OAuth consent screen**
   - User Type: **External** → Create
   - App name: `HisabKitab`
   - User support email: apna email
   - (baqi fields optional chhor dein) → **Save and Continue**
   - Scopes screen par **Add or remove scopes** → filter: `drive.file` → select karein → Update → Save and Continue
   - **Test users → Add users** → **apna Google account** (aur jis kisi ko bhi app use karwani hai) → Save
   - Summary → **Back to dashboard**
6. **APIs & Services → Credentials** → **+ Create Credentials** → **OAuth client ID**
   - Application type: **Web application**
   - Name: `hisabkitab-web`
   - **Authorized JavaScript origins**: `+ Add URI` → apni site ka poora URL, example:
     - `https://YOUR_USERNAME.github.io`  ← (base domain)
     - `https://YOUR_USERNAME.github.io/YOUR_REPO_NAME`  ← (repo path — zaroori)
   - (Authorized redirect URIs khali chhor dein — ye app sirf JS origin use karta hai)
   - **Create**
7. Ek popup aayega → **Client ID** copy karein (kuch aisa: `1234567890-abc.apps.googleusercontent.com`)
8. Apni HisabKitab site kholen → **One-time Setup** page → Client ID paste → **Save Client ID** → **Test connection** → **Login** 🎉

### Baqi devices/browsers
Client ID localStorage mein save hoti hai — naye browser/device par **dubara paste** karein (Step 8).

### Alternative: Client ID ko code mein rakhna (sab devices ke liye automatic)
`src/config` ke bajaye `.env.example` dekhein:
1. `.env` file banayein project root mein:
   ```
   VITE_GCLIENT_ID=apna-client-id
   ```
2. `npm run build` — phir `docs/` dobara copy karein aur push karein.
   Ab har device par bina paste kiye login chalega.

> **Testing vs Production:** Jab tak consent screen **Testing** mode mein hai, sirf Test users login kar sakte hain
> (apne liye kafi hai). Baqi logon ke liye ya app **Publish** karein (OAuth consent screen → Publish App — free, sirf
> verification form barna hota hai), ya unhe **Test users** mein add karte rahein.

---

## ❓ Aam sawal

**Kya data paid hai?**
Nahi. Har user ka data uske **apne Google Drive** (15GB free) ke `HisabKitab` folder mein jata hai.
Google Drive API aur Google login dono free hain. Koi subscription nahi.

**Kya doosra user mera data dekh sakta hai?**
Nahi. App sirf `drive.file` scope use karta hai — har user ko sirf apne files nazar aate hain.
Ye kisi Firestore rule se bhi sakht hai — data hi alag Drive mein hota hai.

**Agar main GitHub Pages par root domain use karun?**
`Authorized JavaScript origins` mein wohi URL add karein jo site par dikhta hai. `base: './'` ki wajah se
app kisi bhi path par chalti hai.

**Photos/voice kahan save hote hain?**
Drive ke `HisabKitab/photos/` aur `HisabKitab/voice/` folders mein. Browser mein bhi cache rehta hai (offline viewing).

**Internet band ho jaye?**
App offline bhi chalti hai — changes save hote hain, internet wapas aate hi khud sync. Status badge batata hai:
`Synced / Syncing / Offline / Sync Failed`.

**Email reminders kaise jaate hain?**
Free hone ki wajah se reminders aapke email/WhatsApp/SMS app khol kar bhejte hain (mailto / wa.me / sms links).
Isliye koi fake "sent" nahi dikhata — log mein `Prepared / Sent` status hota hai.

---

## 🧪 Test karein (spec ke test cases)
1. Google Account A → customer banao → udhaar → payment → photo → voice → logout
2. Doosre device/browser par same Account A → **sara data wapas** ✅
3. Account B → Account A ka data nahi dikhega ✅
4. 10,000 udhaar − 2,000 payment = **8,000 balance** ✅
5. Due date par shopkeeper ko notification ✅
6. Due date guzarne par OVERDUE ✅
7. Payment clear → reminders stop ✅
8. Offline transaction → internet aane par sync ✅
9. Double-click save → sirf **1** transaction (idempotency key) ✅
10. Transaction edit → audit mein old value ✅

**Zaroorat padhe to setup ke baad mujhse dobara rabta karein — main madad karunga.**
