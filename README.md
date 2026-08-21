# Keyword Search Kreya

## Local development

Start the backend in one terminal:

```powershell
cd server
npm install
npm start
```

Start the frontend in another terminal:

```powershell
npm install
npm run dev
```

## Deployment

The frontend deploys to GitHub Pages through `.github/workflows/deploy-pages.yml`.
In the GitHub repository settings, set **Pages > Build and deployment > Source** to **GitHub Actions**.

Deploy the `server` directory as a Railway service. Set its root directory to `/server`, then add the generated Railway public URL as the GitHub repository variable `VITE_API_URL`.

For persistent uploads and documents on Railway, configure the optional MySQL variables from `server/.env.example` or attach a persistent volume. Without either, Railway's local filesystem is temporary.

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and Oxlint's TypeScript related rules in your project.
