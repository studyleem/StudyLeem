# Material types – how it works

## Website / admin
* A material's **type** is now text, not a choice of two. Old types `notes` and `books` are unchanged and all old documents keep working
  (old chapter notes, old exercises/review exercises inside Notes, old single textbooks).
* **Admin -> Upload**: write what you are uploading (Notes, Book, Main Exercise, Review Exercise, MCQs Explanation, Past Paper, or any new name).
  Chapter number, exercise number and item name are optional. A brand-new type automatically gets:
  a section on the homepage, `/fbise/<type>`, `/fbise/<type>/<class>`, subject pages, viewer pages, sitemap entries and a card on `/fbise`.
* Known words are merged (Note = Notes, Main Exercise = Exercises, MCQ = MCQs Explanation ...). Type names must use English letters/numbers.

## Apps Script – PDF file names
`Class-<9-12>-<Subject>-<chapter / item words>-<TYPE>.pdf` – the TYPE is the LAST part.

| Type word at the end | Example |
|---|---|
| Notes / Note | Class-10-Physics-Ch3-Electrostatics-Notes.pdf |
| Book / Textbook | Class-12-Physics-Book.pdf  ·  Class12-Physics-Ch2-Mechanics-Book.pdf |
| Main-Exercise / Exercise | Class-12-Mathematics-Ex-2.1-Main-Exercise.pdf |
| Review-Exercise | Class-12-Mathematics-Review-Ex-1-Review-Exercise.pdf |
| MCQs-Explanation / MCQs | Class-9-Biology-Ch4-Cell-MCQs-Explanation.pdf |
| Past-Papers | Class-10-Chemistry-Model-Paper-2025-Past-Papers.pdf |
| **any other type -> [brackets]** | Class-10-Physics-Ch2-Kinematics [Short Questions].pdf |
| Urdu words | کلاس-10-اردو-باب-3-نظم-نوٹس.pdf |

Add `-REPLACE` at the very end to update an item that is already on the site.
Old names without a type (Class-10-Physics-Ch3-Title.pdf, Class-12-Mathematics-Ex-2.1.pdf, Class-12-Mathematics-Review-Ex-1.pdf) still work as before (they become Notes).
A name that cannot be understood goes to "Needs attention" and you get an e-mail telling you why.

Test a name any time: Apps Script -> run `testName('your-file-name.pdf')` and read the log. `previewNames()` checks every PDF in the upload folder.

## Publishing
Materials (Apps Script) and blog posts (Blog.gs) are saved straight to Firebase – no admin approval. 

## Page layout and URLs (v3)
| URL | Page |
|---|---|
| `/fbise/12` | Class 12 – all subjects (every material type) |
| `/fbise/12/english` | **Subject page**: every uploaded material for Class 12 English as grid or list (Notes, Books, Exercises, MCQs…), then description of the subject / book / material, how to study, LeemAI links, FAQ and disclaimer |
| `/fbise/12/english/notes/chapter-1` | **Material page**: site header + footer, PDF embedded in the page, Download button, chapter tabs + Prev/Next, description, details, related material, FAQ, disclaimer |
| `/fbise/12/english/books/book-<id>` | Old single textbooks (same rule) |
| `/fbise/notes`, `/fbise/notes/12` | Still exist: browse one type across classes / subjects of one class |
| `/pdf-preview?...` | Now also has the site header/footer (noindex utility page) |

Old links (`/fbise/notes/12/english`, `/fbise/notes/12/english/chapter-1`) redirect permanently (308) to the new URLs, and the pages also understand the old order if the redirect is ever missing.
The PDF engine (`pdf-embed.js` / `StudyPDF`) was not changed. The download countdown is `DOWNLOAD_WAIT` (15 s) at the top of `material.js`.
