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
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <ScreenFill center>
      <div className="stack">
        <p className="frame-copy">{message}</p>
        <Button variant="primary" block onClick={onRetry}>
          다시 접속
        </Button>
      </div>
    </ScreenFill>
  );
}
