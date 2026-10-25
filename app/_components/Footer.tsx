import styles from "../page.module.css";

// D13 footer text, word for word.
export function Footer() {
  return (
    <footer className={styles.footer}>
      Defensive learning project: a local SSH honeypot plus an AI that summarizes
      attacker behavior for defenders. The honeypot is never exposed; this site
      uses sanitized sample logs.
    </footer>
  );
}
