import Link from "next/link";
export default function NotFound() {
  return (
    <main className="empty-state">
      <h1>This path isn’t here.</h1>
      <p>Return to the studio to start a new conversation.</p>
      <Link className="button button-primary" href="/">
        Back to the studio
      </Link>
    </main>
  );
}
