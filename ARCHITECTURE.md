# ARCHITECTURE — תעלומה בשכונה (STEM: הבהובי רעיונות)

## מבנה פרויקט

```
learning-demo/
├── PROJECT_BRIEF.md
├── ARCHITECTURE.md
├── index.html
├── index_dev.html
├── styles.css
├── script.js
├── _design-reference/          ← לא נשלח ללומד; מקור אמת לבנייה בלבד
│   ├── production-script.txt   ← חילוץ טקסט מלא מ-53 השקפים (ממוין לפי top)
│   └── mockups/image1.png…29   ← מוקאפים ויזואליים שטוחים (הפניה בלבד, ר' אזהרה ב-PROJECT_BRIEF)
└── assets/
    ├── fonts/    ← Assistant family (קיים, לא שונה)
    ├── images/   ← ייצוא רקעים/איורים/אייקונים (יתמלא כשיימסרו assets אמיתיים)
    ├── videos/   ← .mp4 (יתמלא כשיימסרו קישורי וידאו)
    ├── app/      ← 2 קונטיינרי iframe לישומונים (נורה מתחממת, חיבור רופף)
    └── audio/    ← לא בשימוש כרגע
```

## מצב Assets נוכחי — ⚠️ Placeholder בכל מקום

נכון לבנייה הראשונית, **אין** רקעים/וידאו/ישומונים אמיתיים. כל מסך בנוי עם:
- טקסט לומד מלא כ-Live HTML (מקור: `_design-reference/production-script.txt`).
- רקע placeholder ניטרלי (גרדיאנט CSS + תווית `data-pending-asset`).
- `<video>`/`<iframe>` עם `data-pending-asset` במקום `src` אמיתי, ותווית
  חזותית "ממתין ל-asset" כדי שלא ייראה כשגיאה שקטה.

כאשר המשתמש ימסור תמונות/וידאו/קישורי iframe — יש לחפש `data-pending-asset`
בכל הפרויקט (HTML+JS) ולהחליף בזה אחר זה, מסך אחר מסך.

## קנבס ורספונסיביות

זהה למוסכמת `figma-lomda-builder`: קנבס 1920×1080, `#app` בטרנספורם
`scale(N)` מחושב ע"י `scaleApp()` בכל `resize`. RTL גלובלי
(`html, body { direction: rtl; font-family: 'Assistant', sans-serif; overflow: hidden; }`).

## מנוע גלובלי (`script.js`)

- `<div id="app">` יחיד, מכיל את כל 28 המסכים (`TOTAL_SCREENS = 28`).
- `<section class="screen" data-screen="N">`; מסך 1 מקבל `class="screen active"`.
- `goTo(n)` — עוצר וידאו פעיל, סוגר popups/hint-overlays, מחליף `.active`,
  קורא `resetScreenState(n)`.
- מנעול Resume-State: כל מסך-שאלה משתמש בדגל `screenNDone`.
- ניווט מקלדת (←/→), `postMessage` ל-`index_dev.html`.
- אין `requestFullscreen()` אוטומטי.
- **ניקוד**: `window.lomdaState.score` מצטבר לאורך כל מסכי השאלה (ר' טבלת
  ניקוד ב-PROJECT_BRIEF); לא מוצג ללומד; מוצג/נשלח רק במסך 28.

## רכיבים גלובליים משותפים

- **Feedback popup** — משותף לכל סוגי השאלות; ניתן לגרירה; ללא כפתור סגירה ידני.
- **Hint overlay** — רק במסכים עם תוכן עזרה מאושר (אין הנחיית hint מפורשת
  בתסריט מלבד "תזכורת/הצלחת סימולציה" — לבדוק פר-מסך).
- **Image zoom modal** — נדרש במסכי שאלה 3 (גרף טמפרטורה, אייקון זכוכית מגדלת).
- **RevealTilesGroup** — רכיב וריאנט מקומי משותף למסכים 4 ו-20 (ר' PROJECT_BRIEF).
- **Simulation reopen button** — מסכי שאלה 3 (12-15) ו-4 (18-19) כוללים כפתור
  "סימולציה" שפותח מחדש את הישומון הרלוונטי (מסך 11 / מסך 17) כ-modal מעל השאלה.

## Screen Registry

| # | סוג | תבנית | שאלה | סטטוס | הערת מימוש |
|---|-----|-------|------|-------|-----------|
| 1 | פתיחה | custom | — | ✅ | כפתור "מתחילים" בלבד; רקע placeholder `ph-1`. |
| 2 | וידאו | narration-and-video | — | ✅ | וידאו יחיד (מכסה שקפים 3-5); בועת טקסט = שקף 3; דיאלוג הילדים (שקפים 4-5) מוטמע בווידאו עצמו, לא כבועות נפרדות — ראו הערת אי-ודאות בדוח. `<video>` עם `data-pending-asset`; play-overlay נעלם ב-play; חץ מהבהב ב-`ended` (או timeout ב-placeholder). |
| 3 | הסבר | narration-and-video (ללא וידאו) | — | ✅ | טקסט שקף 6 בלבד; חץ מהבהב מייד (`resetExplainScreen`). |
| 4 | אינטראקטיבי | RevealTilesGroup (מצב `grayscale-once`) | — | ✅ | 7 אריחי-דמות עגולים (אבי/עומר/אלה/רון/שירה/יאיר/רות); לוח משותף חושף ציטוט; אריח שנצפה → אפור + וי; חץ משתחרר ב-`Set.size===7`. |
| 5 | וידאו | narration-and-video | — | ✅ | טקסט שקף 15. |
| 6 | שאלה | טבלת TwoOptionSelection זעיר ×7 (וריאנט מקומי) | Q1 (10 נק') | ✅ | 7 קבוצות "מדעי/לא מדעי" עצמאיות בטבלה אחת; נעילה/ניקוד כשאלה אחת; 2 ניסיונות; משוב משותף retry/correct/wrong2 מהתסריט (שקף 17). |
| 7 | וידאו | narration-and-video | — | ✅ | טקסט שקף 18. |
| 8 | הסבר | narration-and-video (ללא וידאו) | — | ✅ | טקסט שקף 19 (חלוקה ל-3 קבוצות). |
| 9 | שאלה | SingleChoiceQuestion | Q2 (10 נק') | ✅ | קונטקסט קבוצה א' (שקף 20) + שאלה; correct='2'; משוב משותף משקף 21. |
| 10 | וידאו | narration-and-video | — | ✅ | דיאלוג קבוצה ב' (שקף 22) מוצג כשתי שורות ממוספרות בבועה. |
| 11 | אפליקציה | embedded-apps (iframe placeholder) | — | ✅ | `sim-wrap` עם `data-pending-asset` (Light_Bolb iframe src); `simLaunch()`; חץ משתחרר 15 שנ' אחרי הפעלה (setTimeout), תואם "החץ יופיע 15 שנ' לאחר הפעלת הישומון". |
| 12–15 | שאלה | SingleChoiceQuestion ×4 (נפרד לפי מסך) | Q3 א-ד (5 נק' כ"א, סה"כ 20) | ✅ | כל מסך: כפתור "סימולציה" פותח מודל מחדש למסך 11; מסכים 12-14 כוללים `.q-imgframe` + `img-zoom-btn` (גרף טמפרטורה) עם alt-text מדויק מהתסריט; מסך 15 ללא גרף (לפי שקפים 30-31). |
| 16 | וידאו | narration-and-video | — | ✅ | דיאלוג חשמלאית (שקף 32) מוצג כשורות ממוספרות + שורת אזהרה. |
| 17 | אפליקציה | embedded-apps (iframe placeholder) | — | ✅ | `data-pending-asset` (loose_connection iframe src); אותה לוגיקת 15 שנ'. |
| 18 | שאלה | MultipleChoiceQuestion | Q4 א (5 נק') | ✅ | Set-based; correctSet=['2','4']; כפתור סימולציה → מודל מסך 17. |
| 19 | שאלה | SingleChoiceQuestion | Q4 ב (5 נק') | ✅ | correct='1'; כפתור סימולציה → מודל מסך 17. |
| 20 | אינטראקטיבי | RevealTilesGroup (מצב `tabs-repeatable`) | — | ✅ | 3 כרטיסיות-קבוצה מלבניות; לחיצה מחליפה תוכן (לא אפורה, ניתן לצפות שוב); חץ משתחרר לאחר צפייה בשלוש. |
| 21 | שאלה | MultipleChoiceQuestion | Q5 (10 נק') | ✅ | correctSet=['1','3','5']; קונטקסט "מצוין, עכשיו אנחנו יודעים..." משקף 40 מוצג כ-`q-context`. |
| 22 | שאלה | SingleChoiceQuestion | Q6 (10 נק') | ✅ | **אין מוקאפ** — נבנה זהה למבנה Q2/Q9 (single-choice + q-context); טקסט מהתסריט בלבד (שקפים 42-43). |
| 23 | הסבר | narration-and-video (ללא וידאו) | — | ✅ | טקסט שקף 44 (דיווח לחברת החשמל). |
| 24 | וידאו | narration-and-video | — | ✅ | **אין מוקאפ ייעודי** — עיצוב זהה לשאר מסכי וידאו (שקף 45, המורה מסכמת). |
| 25 | שאלה | MultipleChoiceQuestion | Q7 (10 נק') | ✅ | correctSet=['1','3']; דמות המורה (`#s25-teacher`, placeholder) מופיעה רק לאחר שהמשוב נפתח (עטיפת `qCheck`); חץ משתחרר אז. |
| 26 | שאלה | DragAndDropQuestion, Classic (טבלה), `maxAttempts:2` | Q8 (10 נק') | ✅ | 6 יעדים בטבלת שלבים + מגש 6 שבבי מספרים (1-6, HTML5 drag). `correctMap` נגזר ישירות ממפתח התשובות בשקף 49 — לפי סדר השורות בטבלה (מבצעים בדיקה/בודקים/בוחנים/מעלים/בוחרים/מסננים) המספרים הנכונים הם 5,2,4,1,6,3 בהתאמה (ר' script.js `DDQ.correctMap`). ניסיון שני שגוי → View My Answer Toggle (`ddqApplyView`/`ddqToggleView`) במקום reveal חד-פעמי; אין timeout אוטומטי (הוחלט נגד "5 שניות" — יושם toggle במקום). |
| 27 | שאלה | SingleChoiceQuestion | Q9 (10 נק') | ✅ | **אין מוקאפ** — זהה למבנה Q2/Q6; correct='3'; קונטקסט משקף 50. |
| 28 | סיום | scoring-and-completion | — | ✅ | `computeFinalGrade()` מחשב סכום `questionScores` (עד 100, ר' `recordScore()`); `finishLomda()` שולח `postMessage` + מציג ציון; כפתור "סיימתי". |

כל 28 המסכים מומשו במלואם (מבנה, טקסט, לוגיקת גייטינג וניקוד). Placeholder-ים חזותיים (רקעים/וידאו/iframe) עדיין ממתינים לאסטים אמיתיים — ר' `data-pending-asset` בכל קובץ.

## Subject Theming

נושא: מדעים (כימיה-פיזיקה). צבעים דרך `var(--subject-*)` לפי
`720-design-guidelines/colors-and-gradients.md`, ערכת Science.
