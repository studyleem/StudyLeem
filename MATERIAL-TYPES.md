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
