import { Button } from "../ui/controls";
import { ScreenFill } from "../ui/widgets";

export function BootScreen() {
  return (
    <ScreenFill center>
      <div className="stack">
        <h1 className="wordmark">
          STAR<span>FRONT</span>
        </h1>
        <div className="radar" aria-hidden="true" />
      </div>
    </ScreenFill>
  );
}

export function ErrorScreen({
  message,
  onRetry,
  onAiMatch,
}: {
  message: string;
  onRetry: () => void;
  onAiMatch?: () => void;
}) {
  return (
    <ScreenFill center>
      <div className="stack">
        <p className="frame-copy">{message}</p>
        <Button variant="primary" block onClick={onRetry}>
          다시 접속
        </Button>
        {onAiMatch ? (
          <Button block onClick={onAiMatch}>
            AI 대전
          </Button>
        ) : null}
      </div>
    </ScreenFill>
  );
}
