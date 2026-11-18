# DoodleDash.io — Frontend (GitHub Pages)

Vanilla HTML5, CSS3, Three.js (CDN), HTML5 2D Canvas, and Socket.IO client (CDN).

## Configuration

Open `client.js` and update `BACKEND_URL` at line 4 before deploying to GitHub Pages:

```js
const BACKEND_URL = "https://your-render-service.onrender.com";
```

For local testing against the local Node.js backend, keep `http://localhost:3000`.

## Run Locally

Serve this folder with any static HTTP server:

```bash
npx serve .
# or
python -m http.server 8080
```
