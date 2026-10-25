"use client";

import { useState } from "react";
import styles from "../page.module.css";

// Matches the summarize route's success body.
type SummaryResult = {
  summary: string;
  threatLabel: string;
  mode: "mock" | "live";
  usage: { inputTokens: number; outputTokens: number };
  costUsd: number;
};

const THREAT_CLASS: Record<string, string> = {
  low: styles.threatLow,
  medium: styles.threatMedium,
  high: styles.threatHigh,
};

const PLACEHOLDER =
  '{"eventid":"cowrie.login.failed","username":"root","src_ip":"203.0.113.42",...}';

export function Dashboard() {
  const [excerpt, setExcerpt] = useState("");
  // null is the idle state; a result is the success state.
  const [result, setResult] = useState<SummaryResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSummarize() {
    setIsLoading(true);
    try {
      const response = await fetch("/api/summarize", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ excerpt }),
      });
      // Failure states arrive in #10; until then a failed call keeps the
      // previous result on screen.
      if (response.ok) {
        setResult(await response.json());
      }
    } catch {
      // Same as above: a network error leaves the page as it was.
    } finally {
      setIsLoading(false);
    }
  }

  function handleClear() {
    setExcerpt("");
    setResult(null);
  }

  return (
    <div className={styles.grid}>
      <section className={styles.card} aria-labelledby="input-heading">
        <div>
          <h2 id="input-heading">Log input</h2>
          <p className={styles.hint}>Paste a Cowrie JSON excerpt, one event per line.</p>
        </div>

        <div>
          <label className={styles.fieldLabel} htmlFor="log-paste">
            Paste log excerpt
          </label>
          <textarea
            id="log-paste"
            className={styles.textarea}
            spellCheck={false}
            placeholder={PLACEHOLDER}
            value={excerpt}
            onChange={(event) => setExcerpt(event.target.value)}
          />
        </div>

        <div className={styles.actions}>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnPrimary}`}
            onClick={handleSummarize}
            disabled={isLoading}
          >
            {isLoading ? "Summarizing…" : "Summarize with AI"}
          </button>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnSecondary}`}
            onClick={handleClear}
            disabled={isLoading}
          >
            Clear
          </button>
        </div>
      </section>

      <section className={styles.card} aria-labelledby="result-heading">
        <div className={styles.resultHeader}>
          <div>
            <h2 id="result-heading">AI result</h2>
            <p className={styles.hint}>Shown as plain text only. Always labeled AI generated.</p>
          </div>
          {result && (
            <span className={`${styles.threat} ${THREAT_CLASS[result.threatLabel] ?? ""}`}>
              Threat: {result.threatLabel}
            </span>
          )}
        </div>

        {result ? (
          <div>
            <p className={styles.aiLabel}>AI generated · verify before acting</p>
            {/* Rendered as a React text child, never as HTML (D5). */}
            <div className={styles.summaryText}>{result.summary}</div>
          </div>
        ) : (
          <div>
            <div className={`${styles.alert} ${styles.alertOk}`} role="status">
              Ready. Paste a Cowrie excerpt, then press Summarize with AI.
            </div>
            <p className={styles.aiLabel}>Waiting for input</p>
            <div className={styles.summaryText}>
              The summary appears here as plain text, with a threat label.
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
