# Cuento Frontend

A frontend for Cuento, a role-playing forum. Built with Angular.

This project is tested with BrowserStack.

## Running locally

Requires [Node.js](https://nodejs.org/) v18+.

This project needs [cuento-backend](https://github.com/katemakarova/cuento-backend) running locally to work.

The app expects the backend at `http://localhost:8080` by default. If yours is on a different port, update `src/environments/environment.ts`.

```sh
npm install
npm start
```

Then open `http://localhost:4200/`.

## Other scripts

- `npm run build` — production build to `dist/`
- `npm run test` — run tests

## License

Apache 2.0 — see `LICENSE`.
