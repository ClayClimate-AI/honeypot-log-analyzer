import { connection } from "next/server";
import { Suspense } from "react";
import { getAiMode } from "../../lib/aiMode";
import styles from "../page.module.css";

// Server component: reads AI_MODE at request time so the pill always matches
// what the route will do. The browser never sees the env var itself (D9).
async function ModePill() {
  await connection();
  const mode = getAiMode();
  return mode === "live" ? (
    <span className={`${styles.pill} ${styles.pillLive}`}>
      <span className={styles.dot} aria-hidden="true" /> Live AI
    </span>
  ) : (
    <span className={`${styles.pill} ${styles.pillMock}`}>
      <span className={styles.dot} aria-hidden="true" /> Mock AI
    </span>
  );
}

export function Header() {
  return (
    <header className={styles.header}>
      <div className={styles.brand}>
        <h1>Cowrie AI Summarizer</h1>
        <p>Honeypot log review for defenders · Week 6</p>
      </div>
      <div className={styles.badgeRow}>
        <Suspense fallback={<span className={styles.pill}>AI mode…</span>}>
          <ModePill />
        </Suspense>
        <span className={styles.pill}>Sample logs only</span>
        <span className={styles.pill}>Next.js on Netlify</span>
        <span className={styles.pill}>1 request / min</span>
      </div>
    </header>
  );
}
