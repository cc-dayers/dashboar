# dashboar

A super lightweight dashboard composition app built with SvelteKit and Vite.

## Local development

```sh
npm install
npm run dev
```

## Build

```sh
npm run build
npm run preview
```

## Deploy to GitHub Pages (free)

This repo includes a workflow at `.github/workflows/deploy.yml` that builds and deploys on pushes to `main`.

1. Push this repository to GitHub.
2. In GitHub, open `Settings > Pages`.
3. Under `Build and deployment`, select `Source: GitHub Actions`.
4. Push to `main` (or run the workflow manually).

The project automatically sets SvelteKit `paths.base` to `/<repo-name>` during the workflow so assets load correctly on GitHub Pages.
