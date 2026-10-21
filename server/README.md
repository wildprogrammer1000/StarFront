# StarFront Server

Nakama 기반 게임 서버.

## 시작

```bash
npm install
npm run build
npm run docker:up
```

- API / Realtime: `http://127.0.0.1:7350`
- Console: `http://127.0.0.1:7351` (admin / password)
- Server key: `defaultkey`

모듈 변경 후:

```bash
npm run build
docker compose restart nakama
```

## 구조

- `src/sim` — 서버 권위 규칙 엔진
- `src/match` — Nakama Realtime match 핸들러
- `src/protocol` — 클라와 공유하는 계약
- `modules/index.js` — 빌드 산출물 (Docker 마운트)
