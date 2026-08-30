# ARCHITECTURE — תעלומה בשכונה (STEM: הבהובי רעיונות)

## מבנה פרויקט

```
learning-demo/
├── PROJECT_BRIEF.md
├── ARCHITECTURE.md
├── README.md
├── index.html
├── index_dev.html            ← נמחק ושוחזר בהיסטוריה; כלי dev-only (ר' למטה)
├── styles.css
├── script.js
├── report.md / report.html   ← דוח בקרת נגישות (WCAG 2.1 AA + ת"י 5568), מתעדכן
├── translation-export/       ← ייצוא לוקליזציה (XLIFF) — ר' הערה בסוף הקובץ
├── .git/                     ← branch main, היסטוריית קומיטים משמעותית
├── _design-reference/          ← לא נשלח ללומד; מקור אמת היסטורי לבנייה בלבד
│   ├── production-script.txt   ← חילוץ טקסט מלא מ-53 השקפים (ממוין לפי top)
│   └── mockups/image1.png…29   ← מוקאפים ויזואליים שטוחים (הפניה בלבד, ר' אזהרה ב-PROJECT_BRIEF)
└── assets/
    ├── fonts/    ← Assistant family, 7 משקלים (.ttf), טעונים מקומית דרך @font-face
    ├── images/   ← ~50 קבצי רקע/איורים/אייקונים אמיתיים (Background1.jpg, teacher.png, bubble-talk.png וכו')
    ├── videos/   ← 7 קבצי .mp4 אמיתיים (p-3-4, p-18, p22, p32, video_page_8/15/45)
    ├── app/      ← 2 ישומוני iframe אמיתיים: LIGHT_BOLB.html, LOOSE_CONNECTION.html
    └── audio/    ← teacher1.m4a — קריינות-מורה במסך 12 (`s12ToggleAudio()`)
```

## מצב Assets נוכחי — ✅ אמיתיים, לא Placeholder

בשונה מהבנייה הראשונית, **כל ה-assets הוחלפו בקבצים אמיתיים**: רקעים/איורים/אייקונים
ב-`assets/images/`, וידאו ב-`assets/videos/`, ושני הישומונים (`LIGHT_BOLB.html`,
`LOOSE_CONNECTION.html`) ב-`assets/app/`. אין יותר `data-pending-asset` מוצג בפועל
ב-`index.html` (0 מופעים).

**שרידי-פיתוח שנותרו (לא משפיעים על הלומד בפועל):**
- `script.js` (`playVideo()`, סביב שורה 544) עדיין בודק `data-pending-asset` על
  אלמנט `<video>` — לוגיקת-בטיחות legacy שהייתה נחוצה בזמן הבנייה (מדמה `ended`
  event אחרי 1.5 שנ' אם אין `src` אמיתי). כיוון שלכל הווידאו יש `src` אמיתי, קוד
  זה כבר לא נכנס לפעולה — אך לא הוסר.
- שורה נוספת ב-`script.js` (סביב 1095) מכילה טקסט תווית legacy "הסימולציה פועלת
  (ממתין לקובץ אמיתי)" למקרה ש-iframe יישומון יהיה ללא `src` — גם הוא כבר לא רלוונטי
  בפועל כי לשני הישומונים יש `src` אמיתי.

## קנבס ורספונסיביות

זהה למוסכמת `figma-lomda-builder`: קנבס 1920×1080, `#app` בטרנספורם
`scale(N)` מחושב ע"י `scaleApp()` בכל `resize`. RTL גלובלי
(`html, body { direction: rtl; font-family: 'Assistant', sans-serif; overflow: hidden; }`).

## גופנים

`Assistant` נטען מקומית דרך 7 כללי `@font-face` (`assets/fonts/Assistant-*.ttf`,
משקלים 200–800, `font-display: swap`), לא מ-Google Fonts. `font-family` הגלובלי:
`'Assistant', 'Open Sans', sans-serif` (Open Sans כ-fallback בלבד, אינו נטען מקומית).

## מנוע גלובלי (`script.js`)

- `<div id="app">` יחיד, מכיל את כל 29 המסכים (`TOTAL_SCREENS = 29`).
- `<section class="screen" data-screen="N">`; מסך 1 מקבל `class="screen active"`.
- `goTo(n)` — עוצר וידאו פעיל, סוגר popups/hint-overlays, מחליף `.active`,
  קורא `resetScreenState(n)`.
- מנעול Resume-State: כל מסך-שאלה משתמש בדגל `screenNDone`.
- ניווט מקלדת (←/→), `postMessage` ל-`index_dev.html`.
- הבנייה כוללת חוסן נגד כניסה ישירה למסך (deep-link/dev-navigation) — מסכי
  RevealTilesGroup ומסכי-שאלה מטפלים גם בכניסה שלא עברה דרך `goTo()`.
- אין `requestFullscreen()` אוטומטי.
- **ניקוד**: `window.lomdaState.score`/`questionScores` מצטבר לאורך כל מסכי
  השאלה (ר' טבלת ניקוד ב-PROJECT_BRIEF, סה"כ 100); לא מוצג ללומד; מוצג/נשלח
  רק במסך 29 (`computeFinalGrade()`, `finishLomda()`).
- **בר-בקרת-וידאו מותאם (`.vctrls`)** — play/pause, seek, שעון, CC (כתוביות
  משובצות; `aria-pressed` מסונכרן), השתקה (`aria-pressed` מסונכרן), ווליום,
  מסך-מלא (`aria-pressed` מסונכרן גם דרך `fullscreenchange` הגלובלי, לא רק
  לחיצה על הכפתור). חיווי-הפוקוס של כל 4 הכפתורים תלוי במשתנה הגלובלי
  `--focus` שמוגדר ב-`:root` (`styles.css`). מוקשח לטעינה אמינה גם בתוך hosts
  מוטמעים ל-QA (ר' קומיטים "Add custom video controls bar…" / "Harden video
  controls bar and page-load reliability…").
- **Preloading** — preload סטטי (`<link rel="preload">`) לאסטים קריטיים
  (Background1.jpg, teacher.png, textbox2.png, panel-ים משותפים למסכי-שאלה
  וכו') + preload אוטומטי של תמונות המסכים השכנים (הקודם/הבא) כדי למנוע
  "thundering herd" של 29 בקשות-רשת בטעינה הראשונית ("Preload adjacent-screen
  images automatically…"). וידאו כבד קודד מחדש כדי להקטין גודל קובץ.

## רכיבים גלובליים משותפים

- **Feedback popup** — משותף לכל סוגי השאלות; ניתן לגרירה; ללא כפתור סגירה ידני.
- **Hint overlay** — רק במסכים עם תוכן עזרה מאושר.
- **Image zoom modal** — נדרש במסכי שאלה 3 (גרף טמפרטורה, אייקון זכוכית מגדלת).
- **RevealTilesGroup** — רכיב וריאנט מקומי משותף למסכים 4 ו-21 (ר' PROJECT_BRIEF),
  עם 3 מצבים: `grayscale-once` (מסך 4), `tabs-repeatable` (לא בשימוש בפועל כרגע —
  ר' הערה), `card-flip` (מסך 21).
- **"התנסות"/"סימולציה" — כפתור פתיחה חוזרת** — הטרמינולוגיה **אינה אחידה
  בכוונה**: מסכי שאלה 3 (13–16, סביב ישומון הנורה המתחממת, מסך 12) שונו
  ל-"התנסות" (קומיט "Rename 'simulation' to 'experience' (התנסות) across Q3
  series screens and their feedback text") — גם התווית על הכפתור וגם טקסט
  ה-retry/correct/wrong2. מסכי שאלה 4 (19–20, סביב ישומון החיבור הרופף, מסך
  18) **נותרו "סימולציה"** בכפתור ובכל טקסט המשוב — לא עברו את השינוי הזה.
  יש לשמור על ההבחנה הזו בעדכונים עתידיים ולא "לתקן" אותה לאחידות בטעות.
- **"תזכורת" (`toggleReminderPopup`)** — מסך 10 (שאלה 2) משתמש בכפתור-פתיחה
  נפרד בשם "תזכורת" (לא "התנסות"/"סימולציה") שמציג מחדש את נתוני-הראיות של
  מסך 9 (אין ישומון קשור לשאלה זו).

## Screen Registry

| # | סוג | תבנית | שאלה | הערת מימוש |
|---|-----|-------|------|-----------|
| 1 | פתיחה | custom | — | כפתור "מתחילים"; רקע אמיתי (`screen1-bg`, `white_logo.png`). |
| 2 | וידאו | narration-and-video | — | `p-3-4.mp4`; בועת טקסט (שקף 3); דיאלוג הילדים משוקע בווידאו עצמו; בר-בקרת-וידאו מלא + play-overlay. |
| 3 | הסבר | narration-and-video (ללא וידאו) | — | טקסט שקף 6; רקע אמיתי `Background3.jpg`. |
| 4 | אינטראקטיבי | RevealTilesGroup (`grayscale-once`) | — | 7 אריחי-דמות עגולים (אבי/רון/רות/אלה/עומר/יאיר/שירה); לוח משותף חושף ציטוט; אריח שנצפה → אפור + וי; חץ משתחרר כשכל 7 נצפו. |
| 5 | וידאו | narration-and-video | — | `video_page_15.mp4`, טקסט שקף 15. |
| 6 | שאלה | טבלת TwoOptionSelection זעיר ×7 (וריאנט מקומי) | Q1 (10 נק') | 7 שורות "מדעי/לא מדעי" בטבלה אחת; מפתח-תשובות קבוע בקוד: a=sci, b=sci, c=not, d=sci, e=not, f=not, g=sci; נעילה/ניקוד כשאלה אחת; משוב משותף retry/correct מהתסריט. |
| 7 | וידאו | narration-and-video | — | `p-18.mp4`, טקסט שקף 18. |
| 8 | הסבר | narration-and-video (עם וידאו-רקע) | — | `video_page_8.mp4` כרקע `autoplay muted loop`; טקסט שקף 19 (חלוקה ל-3 קבוצות). |
| 9 | נתונים (ללא שאלה) | narration-and-video | — | נתוני מזג-אוויר של קבוצה א' (שקף 20) בלבד; השאלה עצמה עברה למסך 10. תוצר של פיצול המסך הישן ("Split Q2 into screens 9-10, redesign screen 9…"). |
| 10 | שאלה | SingleChoiceQuestion | Q2 (10 נק') | `correct='2'`; כפתור "תזכורת" (`toggleReminderPopup`) מציג מחדש את תוכן מסך 9. |
| 11 | וידאו | narration-and-video | — | `p22.mp4`, דיאלוג קבוצה ב' (שקף 22). |
| 12 | אפליקציה | embedded-apps (iframe אמיתי) | — | `assets/app/LIGHT_BOLB.html`; כפתור-קריינות `s12ToggleAudio()` מנגן `assets/audio/teacher1.m4a`. |
| 13–16 | שאלה | SingleChoiceQuestion ×4 (נפרד לפי מסך) | Q3 א-ד (5 נק' כ"א, סה"כ 20) | `correct`: 13='1', 14='3', 15='1', 16='2'. כל מסך: כפתור "**התנסות**" (`toggleSimPopup(this,12)`) פותח מחדש מודל למסך 12; מסכים 13-16 כוללים `.q-imgframe` + `img-zoom-btn` (גרף טמפרטורה, alt-text מדויק). |
| 17 | וידאו | narration-and-video | — | `p32.mp4`, דיאלוג חשמלאית (שקף 32). |
| 18 | אפליקציה | embedded-apps (iframe אמיתי) | — | `assets/app/LOOSE_CONNECTION.html`. |
| 19 | שאלה | MultipleChoiceQuestion | Q4 א (5 נק') | `correctSet=['2','4']`; כפתור "**סימולציה**" (`toggleSimPopup(this,18)`) → מודל מסך 18 — לא עבר את שינוי-הטרמינולוגיה. |
| 20 | שאלה | SingleChoiceQuestion | Q4 ב (5 נק') | `correct='1'`; כפתור "סימולציה" → מודל מסך 18. |
| 21 | אינטראקטיבי | RevealTilesGroup (`card-flip`) | — | 3 כרטיסי-קבוצה (א/ב/ג) עם הפיכה (front/back); לחיצה חושפת ממצא+מסקנה; ניתן לצפות שוב; חץ משתחרר לאחר צפייה בשלושה. |
| 22 | שאלה | MultipleChoiceQuestion | Q5 (10 נק') | `correctSet=['1','3','5']`; קונטקסט מורה ("מצוין, עכשיו אנחנו יודעים...") כ-`qt-bubble`. |
| 23 | שאלה | SingleChoiceQuestion | Q6 (10 נק') | `correct='2'`; **אין מוקאפ ייעודי** — מבנה זהה ל-Q2 עם `qt-bubble`. |
| 24 | הסבר | narration-and-video (ללא וידאו) | — | טקסט שקף 44 (דיווח לחברת החשמל). |
| 25 | וידאו | narration-and-video | — | `video_page_45.mp4`, **אין מוקאפ ייעודי** (המורה מסכמת). |
| 26 | שאלה | MultipleChoiceQuestion | Q7 (10 נק') | `correctSet=['1','3']`; דמות המורה (`#s26-teacher`, `display:none` כברירת מחדל) מופיעה רק לאחר שהמשוב נפתח (בעטיפת `qCheck`). |
| 27 | שאלה | DragAndDropQuestion, Classic (טבלה), `maxAttempts:2` | Q8 (10 נק') | 6 יעדים בטבלת שלבים + מגש 6 שבבי מספרים (HTML5 drag + חלופת-מקלדת pick/drop). `DDQ.correctMap`: `target-row1..6 → '5','2','4','1','6','3'`. ניסיון שני שגוי → תשובה נכונה מוצגת (`locked`), אין timeout אוטומטי. תוקן/נכתב-מחדש מנגנון-הגרירה בקומיט "Fix screen 26 layout: teacher-column display bug, reflow-free reveal…" (מספור-מסך ישן; זה כיום מסך 27). |
| 28 | שאלה | SingleChoiceQuestion | Q9 (10 נק') | `correct='3'`; **אין מוקאפ ייעודי** — זהה למבנה Q2/Q6 עם `qt-bubble`. |
| 29 | סיום | scoring-and-completion | — | `computeFinalGrade()` מחשב סכום `questionScores` (עד 100); `finishLomda()` שולח `postMessage` + מציג ציון; כפתור "סיימתי". |

כל 29 המסכים מומשו במלואם (מבנה, טקסט, לוגיקת גייטינג וניקוד), עם assets
אמיתיים בכל מקום. הפרויקט נמצא כיום בשלב תחזוקה/בקרת-נגישות ולא בבנייה
ראשונית — ר' סעיף הנגישות למטה.

## מצב נגישות (נכון ל-2026-08-30, ר' `report.md`)

דוח בקרת נגישות (WCAG 2.1 AA + ת"י 5568) מתעדכן בבדיקות חוזרות; לפי העדכון
האחרון בקובץ (2026-08-30), הסטטוס הנוכחי הוא **🔴 5 חוסמים · 🟠 4 אזהרות ·
🔵 1 ליטוש**, על פני כל 29 המסכים — **כולם דורשים כיום שינוי-נראות (למשל
ניגודיות, אייקוני ✓/✗ נראים במקום צבע בלבד), החלטת-תוכן (הצהרת-נגישות, עצירת
וידאו-רקע במסך 8), או החלטת-ארכיטקטורה (קנבס קבוע/reflow) — אין יותר
תיקוני-קוד "שקטים" ממתינים.**

מ-2026-08-24 עד 2026-08-30 תוקנו בקוד (ללא כל שינוי במראה החזותי הרגיל):
כותרות סמנטיות (`h1`/`h2`), `role="main"`, הפיכת כל 56 אפשרויות-התשובה
(`.q-opt`) ואריחי-`RevealTilesGroup` לנגישי-מקלדת מלאים (role/tabindex/
`aria-checked`+ מאזין `keydown` משותף), חלופת-מקלדת מלאה לתרגיל-הגרירה (מסך
27, `ddqKeyPick`/`ddqKeyDrop`), ניתוב-פוקוס בין מסכים ולתוך/מחוץ למודלים
(`role="alertdialog"`/`"dialog"` + לכידת-Tab), סנכרון `aria-pressed` לכל
כפתורי ה-toggle (כתוביות, השתקה, קריינות, מסך-מלא), ותיקון משתנה-CSS
`--focus` שהיה לא-מוגדר ומבטל בפועל את חיווי-הפוקוס על 24 כפתורי בר-הווידאו
(`:root { --focus: 2px solid #fff }`, מוצג רק ב-`:focus-visible`). קריינות-
האודיו במסך 12 (`teacher1.m4a`) אומתה מול המפתח/ת כזהה לטקסט הגלוי — אינה
הפרת-נגישות. **הדוח עצמו מציין** שהוא לא כלל בדיקת-דפדפן חיה (axe-core/
Tab-walk/ניגודיות-מחושבת) — יש להריץ סבב אימות דינמי לפני אישור-נגישות סופי.

## ייצוא לוקליזציה

קיים `translation-export/` עם קובץ XLIFF (`flickering-lights.xlf`), דוח-ייצוא
(`translation-export-report.md`) ומניפסט-מסכים (CSV) — ייצוא מלא של טקסטי
הלומדה (527 יחידות-תרגום, 30 "מסכים" כולל FL-00 לצ'ראם) לצורך תרגום/לוקליזציה
עתידית. אינו חלק מהרצת הלומדה בפועל.

## Subject Theming

נושא: מדעים (כימיה-פיזיקה). צבעים דרך `var(--subject-*)` לפי
`720-design-guidelines/colors-and-gradients.md`, ערכת Science.
