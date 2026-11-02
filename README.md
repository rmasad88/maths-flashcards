# maths-flashcards

A small web app for quizzing yourself on Computational Maths, with spaced repetition and a stats page. It runs entirely in the browser and keeps your cards in `localStorage`.

## Run it

You need Node.js and npm.

```sh
npm install
npm run dev
```

Then open the URL Vite prints, usually <http://localhost:5173>.

On first run, or whenever you have no cards, the app adds a starter deck of about 20 cards. Card text can include LaTeX in `$...$` or `$$...$$`.

## Other commands

- `npm test` runs the tests.
- `npm run build` makes a production build in `dist/`, and `npm run preview` serves it.
- `npm run check` runs the tests and the production build.
