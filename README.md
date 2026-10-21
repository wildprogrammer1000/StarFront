# StarFront

세로형 웹 실시간 전략 게임.

```
StarFront/
  client/   # React + PlayCanvas + nakama-js
  server/   # Nakama + 규칙 심
  shared/   # 클라·서버 공용 데이터 (economy, roster, layers)
  docs/     # 기획서
```

## 로컬 실행

```bash
# 서버
cd server
npm install && npm run build && npm run docker:up

# 클라이언트
cd client
npm install
cp .env.example .env   # 최초 1회
npm run dev
```

- 클라: http://127.0.0.1:5173
- Nakama API: http://127.0.0.1:7350
- Nakama Console: http://127.0.0.1:7351 (admin / password)

1v1 매칭은 브라우저 시크릿 창 등으로 게스트 두 명이 필요합니다.

공유 수치·카탈로그는 `shared/` 만 수정하면 클라·서버 빌드에 함께 반영됩니다.

상세: [docs/StarFront_GDD.md](docs/StarFront_GDD.md)
