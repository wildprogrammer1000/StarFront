# StarFront Client

React HUD + PlayCanvas(XZ 탑뷰) + `@heroiclabs/nakama-js`.

## 시작

```bash
# 먼저 ../server 에서 Nakama 기동
npm install
cp .env.example .env   # 최초 1회
npm run dev
```

브라우저: `http://127.0.0.1:5173`

## 환경 변수

| 변수 | 기본 |
|------|------|
| `VITE_NAKAMA_HOST` | `127.0.0.1` |
| `VITE_NAKAMA_PORT` | `7350` |
| `VITE_NAKAMA_USE_SSL` | `false` |
| `VITE_NAKAMA_SERVER_KEY` | `defaultkey` |

MVP 인증: `authenticateCustom` 게스트 (`customId` → localStorage).
