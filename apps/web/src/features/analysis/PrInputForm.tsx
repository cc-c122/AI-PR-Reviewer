import { Search } from "lucide-react";
import { FormEvent, useState } from "react";

const demoPullRequestUrl = "https://github.com/org/repo/pull/123";

type PrInputFormProps = {
  disabled?: boolean;
  onSubmit: (pullRequestUrl: string) => void;
};

export function PrInputForm({ disabled = false, onSubmit }: PrInputFormProps) {
  const [pullRequestUrl, setPullRequestUrl] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit(pullRequestUrl.trim());
  }

  function handleUseDemoPullRequest() {
    setPullRequestUrl(demoPullRequestUrl);
    onSubmit(demoPullRequestUrl);
  }

  return (
    <form className="pr-form" onSubmit={handleSubmit}>
      <label htmlFor="pull-request-url">GitHub PR URL</label>
      <div className="input-row">
        <input
          id="pull-request-url"
          name="pullRequestUrl"
          type="url"
          value={pullRequestUrl}
          onChange={(event) => setPullRequestUrl(event.target.value)}
          placeholder="https://github.com/org/repo/pull/123"
          disabled={disabled}
          required
        />
        <button type="submit" disabled={disabled}>
          <Search aria-hidden="true" />
          <span>{disabled ? "分析中" : "开始分析"}</span>
        </button>
        <button className="demo-button" type="button" disabled={disabled} onClick={handleUseDemoPullRequest}>
          使用 Demo PR
        </button>
      </div>
    </form>
  );
}
