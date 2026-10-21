import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import type { Client, Session } from "@heroiclabs/nakama-js";
import { listRooms } from "../net/roomsApi";
import {
  ensureAccountDisplayName,
  NICKNAME_MAX_LEN,
  updateAccountDisplayName,
} from "../player/profile";
import type { RaceId } from "../protocol";
import type { RoomRecord } from "../protocol/rooms";
import { Banner, Button, TextField } from "../ui/controls";
import {
  IconNavBattle,
  IconNavForce,
  IconNavRecord,
  IconNavSettings,
  IconPlus,
} from "../ui/icons";
import { RACE_ORDER, RACES } from "../ui/races";
import { RacePlate, ScreenFill } from "../ui/widgets";

type LobbyTab = "battle" | "force" | "record" | "settings";

const DEFAULT_ROOM_NAME = "나의 전선";
const ROOM_NAME_MAX = 32;

const TABS: {
  id: LobbyTab;
  label: string;
  Icon: (props: { size?: number }) => ReactNode;
}[] = [
  { id: "battle", label: "전선", Icon: IconNavBattle },
  { id: "force", label: "병력", Icon: IconNavForce },
  { id: "record", label: "전적", Icon: IconNavRecord },
  { id: "settings", label: "설정", Icon: IconNavSettings },
];

interface Props {
  client: Client;
  session: Session;
  race: RaceId;
  onRace: (race: RaceId) => void;
  onQuickMatch: () => void;
  onCreateRoom: (name: string) => void;
  onEnterMatch: (matchId: string, room: RoomRecord) => Promise<void>;
  externalError?: string | null;
}

export function LobbyScreen({
  client,
  session,
  race,
  onRace,
  onQuickMatch,
  onCreateRoom,
  onEnterMatch,
  externalError,
}: Props) {
  const userId = session.user_id ?? "";
  const createTitleId = useId();
  const roomNameInputRef = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState<LobbyTab>("battle");
  const [rooms, setRooms] = useState<RoomRecord[]>([]);
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [nickname, setNicknameState] = useState("");
  const [nicknameBusy, setNicknameBusy] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [roomNameDraft, setRoomNameDraft] = useState(DEFAULT_ROOM_NAME);

  useEffect(() => {
    let cancelled = false;
    setNicknameBusy(true);
    void ensureAccountDisplayName(client, session)
      .then((name) => {
        if (!cancelled) setNicknameState(name);
      })
      .catch((e) => {
        if (!cancelled) {
          setLocalError(e instanceof Error ? e.message : String(e));
        }
      })
      .finally(() => {
        if (!cancelled) setNicknameBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [client, session, userId]);

  const saveNickname = async () => {
    setNicknameBusy(true);
    setLocalError(null);
    try {
      const next = await updateAccountDisplayName(client, session, nickname);
      setNicknameState(next);
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : String(e));
    } finally {
      setNicknameBusy(false);
    }
  };

  useEffect(() => {
    if (!createOpen) return;
    const id = window.setTimeout(() => {
      roomNameInputRef.current?.focus();
      roomNameInputRef.current?.select();
    }, 0);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setCreateOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener("keydown", onKey);
    };
  }, [createOpen]);

  const openCreate = () => {
    setRoomNameDraft(DEFAULT_ROOM_NAME);
    setCreateOpen(true);
  };

  const submitCreate = (e?: FormEvent) => {
    e?.preventDefault();
    const name = roomNameDraft.trim().slice(0, ROOM_NAME_MAX) || DEFAULT_ROOM_NAME;
    setCreateOpen(false);
    onCreateRoom(name);
  };

  const refresh = useCallback(async () => {
    try {
      const list = await listRooms(client, session);
      setRooms(list);
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : String(e));
    }
  }, [client, session]);

  useEffect(() => {
    void refresh();
    const id = window.setInterval(() => void refresh(), 5000);
    return () => window.clearInterval(id);
  }, [refresh]);

  const run = async (task: () => Promise<void>) => {
    setBusy(true);
    setLocalError(null);
    try {
      await task();
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const error = localError ?? externalError;
  const profile = RACES[race];

  return (
    <ScreenFill>
      <div className="lobby-body">
        {tab === "battle" && (
          <div className="battle-tab">
            <section className="bnet-list" aria-label="방 목록">
              <div className="bnet-head">
                <span>방</span>
                <span>코드</span>
                <span>인원</span>
              </div>
              <div className="bnet-rows">
                {rooms.length === 0 ? (
                  <p className="bnet-empty">열린 방이 없습니다</p>
                ) : (
                  rooms.map((room) => {
                    const closed =
                      room.status !== "waiting" ||
                      room.playerCount >= room.maxPlayers;
                    return (
                      <button
                        key={room.roomId}
                        type="button"
                        className="room-row"
                        disabled={busy || closed}
                        onClick={() =>
                          void run(() => onEnterMatch(room.matchId, room))
                        }
                      >
                        <span className="room-name">{room.name}</span>
                        <span className="room-code">{room.inviteCode}</span>
                        <span className="room-meta">
                          {room.playerCount}/{room.maxPlayers}
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            </section>
            <div className="battle-actions">
              <Button
                variant="primary"
                className="battle-quick"
                disabled={busy}
                onClick={onQuickMatch}
              >
                빠른 시작
              </Button>
              <button
                type="button"
                className="battle-create"
                aria-label="방만들기"
                disabled={busy}
                onClick={openCreate}
              >
                <IconPlus size={22} />
              </button>
            </div>
            {error && <Banner>{error}</Banner>}
          </div>
        )}
        {tab === "force" && (
          <section className="lobby-panel" aria-label="병력">
            <h2 className="lobby-panel-title">{profile.name}</h2>
            <p className="lobby-panel-copy">{profile.pitch}</p>
            <ul className="force-roster">
              <li>
                <span>사령부</span>
                <strong>{profile.hq}</strong>
              </li>
              <li>
                <span>일꾼</span>
                <strong>{profile.worker}</strong>
              </li>
              <li>
                <span>생산</span>
                <strong>{profile.building}</strong>
              </li>
              <li>
                <span>전투</span>
                <strong>{profile.unit}</strong>
              </li>
            </ul>
            <div className="race-row" role="group" aria-label="종족">
              {RACE_ORDER.map((id) => (
                <RacePlate
                  key={id}
                  race={RACES[id]}
                  selected={race === id}
                  onSelect={onRace}
                />
              ))}
            </div>
          </section>
        )}
        {tab === "record" && (
          <section className="lobby-panel is-empty" aria-label="전적">
            <h2 className="lobby-panel-title">전적</h2>
            <p className="lobby-panel-copy">승패 기록은 준비 중입니다.</p>
          </section>
        )}
        {tab === "settings" && (
          <section className="lobby-panel" aria-label="설정">
            <h2 className="lobby-panel-title">설정</h2>
            <div className="settings-player" aria-label="플레이어 정보">
              <p className="settings-section-label">플레이어</p>
              <TextField
                id="settings-nickname"
                label="닉네임"
                value={nickname}
                maxLength={NICKNAME_MAX_LEN}
                autoComplete="off"
                disabled={nicknameBusy}
                onChange={(e) => setNicknameState(e.target.value)}
                onBlur={() => void saveNickname()}
              />
              <ul className="force-roster">
                <li>
                  <span>유저 ID</span>
                  <strong className="settings-user-id" title={userId}>
                    {userId || "—"}
                  </strong>
                </li>
              </ul>
            </div>
            <p className="lobby-panel-copy">음향 설정은 준비 중입니다.</p>
          </section>
        )}
      </div>
      <nav className="lobby-nav" aria-label="로비 메뉴">
        {TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            className={tab === id ? "lobby-nav-item is-on" : "lobby-nav-item"}
            aria-label={label}
            aria-current={tab === id ? "page" : undefined}
            onClick={() => setTab(id)}
          >
            <Icon size={20} />
            <span>{label}</span>
          </button>
        ))}
      </nav>
      {createOpen && (
        <div
          className="lobby-modal-overlay"
          role="presentation"
          onClick={() => setCreateOpen(false)}
        >
          <form
            className="lobby-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby={createTitleId}
            onClick={(e) => e.stopPropagation()}
            onSubmit={submitCreate}
          >
            <h2 id={createTitleId} className="lobby-modal-title">
              방 만들기
            </h2>
            <TextField
              ref={roomNameInputRef}
              id="create-room-name"
              label="방 제목"
              value={roomNameDraft}
              maxLength={ROOM_NAME_MAX}
              autoComplete="off"
              placeholder={DEFAULT_ROOM_NAME}
              onChange={(e) => setRoomNameDraft(e.target.value)}
            />
            <div className="lobby-modal-actions">
              <Button
                type="button"
                variant="ghost"
                block
                disabled={busy}
                onClick={() => setCreateOpen(false)}
              >
                취소
              </Button>
              <Button type="submit" variant="primary" block disabled={busy}>
                생성
              </Button>
            </div>
          </form>
        </div>
      )}
    </ScreenFill>
  );
}
