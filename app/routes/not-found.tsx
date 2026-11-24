import { data, Link } from "react-router";

export function loader() {
  return data(null, { status: 404 });
}

export default function NotFound() {
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="content-container flex-1 py-12"
    >
      <h1 className="typo-display">Page not found</h1>
      <Link to="/account" className="mt-4 inline-block underline">
        Go to your account
      </Link>
    </main>
  );
}
