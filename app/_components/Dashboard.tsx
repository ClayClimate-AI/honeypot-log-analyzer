"use client";

import { useState, type DragEvent } from "react";
import {
  checkExcerptBasics,
  MAX_UPLOAD_BYTES,
  uploadTooLargeMessage,
} from "../../lib/inputGuard";
import sampleLogs from "../../fixtures/sample-session.jsonl";
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

// Per-call costs are fractions of a cent, so show six decimal places.
function formatUsd(amount: number): string {
  return `$${amount.toFixed(6)}`;
}

const PLACEHOLDER =
  '{"eventid":"cowrie.login.failed","username":"root","src_ip":"203.0.113.42",...}';

export function Dashboard() {
  const [excerpt, setExcerpt] = useState("");
  // null is the idle state; a result is the success state.
  const [result, setResult] = useState<SummaryResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  // Input-guard message from the browser check or the server's 400 (D6).
  const [inputError, setInputError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  async function handleSummarize() {
    // Fast feedback only; the server checks again either way.
    const check = checkExcerptBasics(excerpt);
    if (!check.ok) {
      setInputError(check.error);
      return;
    }
    setInputError(null);
    setIsLoading(true);
    try {
      const response = await fetch("/api/summarize", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ excerpt }),
      });
      if (response.ok) {
        setResult(await response.json());
      } else if (response.status === 400) {
        setInputError((await response.json()).error);
      }
      // Other failure states arrive in #10; until then a failed call keeps
      // the previous result on screen.
    } catch {
      // Same as above: a network error leaves the page as it was.
    } finally {
      setIsLoading(false);
    }
  }

  // An accepted file fills the text box and then takes the paste path (D6).
  async function loadFile(file: File) {
    // Checked before the file is read.
    if (file.size > MAX_UPLOAD_BYTES) {
      setInputError(uploadTooLargeMessage(file.size));
      return;
    }
    setExcerpt(await file.text());
    // A new input replaces the box, so an older summary would look like its own.
    setResult(null);
    setInputError(null);
  }

  // The sample is bundled into this page, so it fills the text box like a
  // paste and then takes the same POST, input guard and rate limit (D3).
  function handleLoadSample() {
    setExcerpt(sampleLogs);
    setResult(null);
    setInputError(null);
  }

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setIsDragOver(false);
    const file = event.dataTransfer.files[0];
    if (file) {
      void loadFile(file);
    }
  }

  function handleClear() {
    setExcerpt("");
    setResult(null);
    setInputError(null);
  }

  return (
    <div className={styles.grid}>
      <section className={styles.card} aria-labelledby="input-heading">
        <div>
          <h2 id="input-heading">Log input</h2>
          <p className={styles.hint}>
            Paste a Cowrie JSON excerpt, one event per line, or upload a .json / .log file.
          </p>
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

        <div>
          <label className={styles.fieldLabel} htmlFor="log-file">
            Or upload a file
          </label>
          <label
            className={`${styles.dropzone} ${isDragOver ? styles.dropzoneActive : ""}`}
            htmlFor="log-file"
            onDragOver={(event) => {
              event.preventDefault();
              setIsDragOver(true);
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDrop}
          >
            <input
              type="file"
              id="log-file"
              className={styles.fileInput}
              accept=".json,.jsonl,.log,.txt,application/json,text/plain"
              onChange={(event) => {
                const file = event.target.files?.[0];
                // Reset so choosing the same file again still fires onChange.
                event.target.value = "";
                if (file) {
                  void loadFile(file);
                }
              }}
            />
            <div className={styles.dropzoneTitle}>Drop cowrie.json here, or click to browse</div>
            <div className={styles.dropzoneSub}>JSON or plain text · up to 50 KB</div>
          </label>
        </div>

        {inputError && (
          <div className={`${styles.alert} ${styles.alertFail}`} role="alert">
            {inputError}
          </div>
        )}

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
            onClick={handleLoadSample}
            disabled={isLoading}
          >
            Load sample logs
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

        {/* Before a call: the cap and the cost range, from Joseph's measured
            short runs up to the D4 near-cap estimate (D13). */}
        <div className={styles.metaBar}>
          <span>
            Cap: <strong>4,000</strong> characters · about <strong>$0.0001–$0.0003</strong> per
            call (Claude Haiku 5.5) · measured cost shown after each call
          </span>
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
            {/* After a call: measured usage and the cost the server computed (D13). */}
            <div className={styles.metaBar}>
              <span>
                Tokens in: <strong>{result.usage.inputTokens.toLocaleString("en-US")}</strong>
              </span>
              <span>
                Tokens out: <strong>{result.usage.outputTokens.toLocaleString("en-US")}</strong>
              </span>
              <span>
                Cost this call: <strong>{formatUsd(result.costUsd)}</strong>
              </span>
            </div>
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
