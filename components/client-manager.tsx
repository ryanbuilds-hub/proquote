"use client";

import { FormEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { archiveClient, createClientRecord } from "@/app/actions";

type Client = {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  notes: string;
  created_at: string;
};

export function ClientManager({ clients }: { clients: Client[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function addClient(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    const form = event.currentTarget;
    const result = await createClientRecord(new FormData(form));
    if (!result.ok) {
      setError(result.error);
      return;
    }
    form.reset();
    setMessage(result.message ?? "Client saved.");
    router.refresh();
  }

  function onArchive(id: string) {
    setError("");
    setMessage("");
    startTransition(async () => {
      const result = await archiveClient(id);
      if (!result.ok) setError(result.error);
      else {
        setMessage(result.message ?? "Client archived.");
        router.refresh();
      }
    });
  }

  return (
    <div className="split-layout">
      <section className="panel">
        <div className="section-heading">
          <div><h2>Add a client</h2><p className="muted">Their details stay in your business account.</p></div>
        </div>
        <form className="form-stack" onSubmit={addClient}>
          <label>Name<input name="name" required maxLength={160} autoComplete="name" /></label>
          <div className="form-row">
            <label>Email<input name="email" type="email" maxLength={254} autoComplete="email" /></label>
            <label>Phone<input name="phone" type="tel" maxLength={60} autoComplete="tel" /></label>
          </div>
          <label>Address<input name="address" maxLength={500} autoComplete="street-address" /></label>
          <label>Notes<textarea name="notes" maxLength={2000} rows={3} placeholder="Useful details about the customer or property" /></label>
          {error && <p className="form-message error-text" role="alert">{error}</p>}
          {message && <p className="form-message success-text" role="status">{message}</p>}
          <button className="button button-primary" disabled={isPending}>Save client</button>
        </form>
      </section>
      <section className="panel">
        <div className="section-heading">
          <div><h2>Client directory</h2><p className="muted">{clients.length} active {clients.length === 1 ? "client" : "clients"}</p></div>
        </div>
        {clients.length === 0 ? (
          <p className="empty-inline">Your saved clients will appear here.</p>
        ) : (
          <div className="client-list">
            {clients.map((client) => (
              <article className="client-card" key={client.id}>
                <div>
                  <h3>{client.name}</h3>
                  {client.email && <p>{client.email}</p>}
                  {client.phone && <p>{client.phone}</p>}
                  {client.address && <p>{client.address}</p>}
                  {client.notes && <p className="client-notes">{client.notes}</p>}
                </div>
                <button
                  className="text-button danger-button"
                  type="button"
                  disabled={isPending}
                  onClick={() => onArchive(client.id)}
                  aria-label={`Archive ${client.name}`}
                >
                  Archive
                </button>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
