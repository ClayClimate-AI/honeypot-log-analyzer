import { Dashboard } from "./_components/Dashboard";
import { Footer } from "./_components/Footer";
import { Header } from "./_components/Header";
import styles from "./page.module.css";

// The dashboard (D2): a port of context/cowrie_summarizer_ui_sample.html.
export default function Home() {
  return (
    <div className={styles.shell}>
      <Header />
      <main>
        <Dashboard />
      </main>
      <Footer />
    </div>
  );
}
