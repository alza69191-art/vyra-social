# إعداد تسجيل الدخول الاجتماعي في VYRA

## عناوين إعادة التوجيه المطلوبة

- Google Authorized redirect URI:
  `https://vyra-api-9pxl.onrender.com/api/auth/oauth/google/callback`
- GitHub Authorization callback URL:
  `https://vyra-api-9pxl.onrender.com/api/auth/oauth/github/callback`

## Google OAuth

1. افتح Google Cloud Console واختر مشروعاً أو أنشئ مشروعاً.
2. جهّز OAuth consent screen، وأضف نطاق البريد والملف الشخصي (openid, email, profile).
3. أنشئ OAuth Client ID من نوع Web application.
4. أضف عنوان Google redirect أعلاه ضمن Authorized redirect URIs.
5. ضع القيمتين في Render للخدمة vyra-api:
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`

## GitHub OAuth

1. افتح GitHub Settings ثم Developer settings ثم OAuth Apps.
2. اختر New OAuth App.
3. Homepage URL: `https://vyra-web-rs1b.onrender.com`
4. Authorization callback URL: عنوان GitHub redirect أعلاه.
5. أنشئ Client Secret ثم أضف القيمتين في Render للخدمة vyra-api:
   - `GITHUB_CLIENT_ID`
   - `GITHUB_CLIENT_SECRET`

## إعدادات Render الأخرى

تُعرّف في `render.yaml`:
- `OAUTH_API_BASE_URL=https://vyra-api-9pxl.onrender.com`
- `OAUTH_FRONTEND_URL=https://vyra-web-rs1b.onrender.com`

بعد حفظ المتغيرات، أعد نشر خدمة `vyra-api`. لا تضع Client Secret في الواجهة الأمامية أو GitHub أو المحادثات.

## ربط الحسابات

- يشترط أن يعيد المزود بريداً إلكترونياً موثقاً.
- إذا كان البريد موجوداً في VYRA، يُربط تسجيل الدخول الاجتماعي بالحساب الحالي بدلاً من إنشاء حساب مكرر.
- تُخزّن هوية المزود ومعرّفه فقط؛ لا تُخزّن كلمات مرور Google أو GitHub أو رموز وصولهما.
