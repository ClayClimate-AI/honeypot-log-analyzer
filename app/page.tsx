import styles from "./page.module.css";

// Placeholder page for ticket 00. The real dashboard (D2) replaces this later.
export default function Home() {
  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <h1>Cowrie Log Summarizer</h1>
        <p>
          Defensive learning project: a local SSH honeypot plus an AI that
          summarizes attacker behavior for defenders.
        </p>
        <p>Placeholder page. The dashboard is not built yet.</p>
      </main>
    </div>
  );
}
