# StudyLeem Blog – setup (5 steps)

## 1. Firestore rules (important)
Add this block inside `match /databases/{database}/documents { ... }` in your Firebase console → Firestore → Rules
(use your own admin check; the UID below is the one already used by the site):

```
match /blogPosts/{id} {
  allow read:  if resource.data.status == 'published'
               || request.auth.uid == 'FtNUvUpPIxfMMO1ag5SARCMqDqE3';
  allow write: if request.auth.uid == 'FtNUvUpPIxfMMO1ag5SARCMqDqE3';
}
```
The Apps Script uses the service account, which bypasses rules, so it can always write.
(If your rules are currently fully open for reads, the blog also works, but the block above is safer.)

## 2. Apps Script
1. Open your Auto-Publisher project -> **+ Files -> Script** -> name it `Blog` -> paste `apps-script/Blog.gs`.
2. Run `blogSetupCheck()` -> all lines should say OK.
3. Run `createBlogTrigger()` -> one new article is **published automatically** every Monday ~8:00. There is no approval step.
4. Optional: run `generateBlogNow()` to publish the first article immediately.

Other helpers: `blogDiagnose()` (list posts), `removeBlogTrigger()`.
You can still edit, unpublish or delete any post later in **Admin -> Blog**.

## 3. Deploy the website
Deploy to Vercel as usual. New URLs: `/blog`, `/blog/<slug>`, `/sitemap-blog.xml`.

## 4. Search Console
Submit `https://studyleem.vercel.app/sitemap.xml` (it lists pages + materials + blog posts).

## 5. Admin → Blog
List, search, edit (Markdown), publish/unpublish, delete, and write your own posts.
