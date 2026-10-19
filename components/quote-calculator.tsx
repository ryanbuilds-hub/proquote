"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createQuote, type ActionResult } from "@/app/actions";
import {
  buildQuoteText,
  calculateQuote,
  formatEuro,
  type QuoteCalculation,
  type QuoteInput,
} from "@/lib/quotes";

type Business = {
  name: string;
  phone: string;
  email: string;
  address: string;
  vat_number: string;
};
type Client = { id: string; name: string };
type MaterialRow = { name: string; cost: string };

export function QuoteCalculator({
  business,
  clients,
}: {
  business: Business;
  clients: Client[];
}) {
  const router = useRouter();
  const [description, setDescription] = useState("");
  const [clientId, setClientId] = useState("");
  const [hours, setHours] = useState("4");
  const [hourlyRate, setHourlyRate] = useState("55");
  const [callOutFee, setCallOutFee] = useState("0");
  const [vatRate, setVatRate] = useState("13.5");
  const [materialsMarkup, setMaterialsMarkup] = useState("15");
  const [materials, setMaterials] = useState<MaterialRow[]>([{ name: "", cost: "" }]);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [copyMessage, setCopyMessage] = useState("");

  const input = useMemo<QuoteInput>(
    () => ({
      description,
      hours: Number(hours) || 0,
      hourlyRate: Number(hourlyRate) || 0,
      callOutFee: Number(callOutFee) || 0,
      vatRate: Number(vatRate) || 0,
      materialsMarkup: Number(materialsMarkup) || 0,
      materials: materials.map((item) => ({
        name: item.name.trim(),
        cost: Number(item.cost) || 0,
      })),
    }),
    [description, hours, hourlyRate, callOutFee, vatRate, materialsMarkup, materials],
  );
  const calculation = useMemo<QuoteCalculation | null>(() => {
    try {
      return calculateQuote(input);
    } catch {
      return null;
    }
  }, [input]);
  const selectedClient = clients.find((client) => client.id === clientId);
  const quoteText = calculation
    ? buildQuoteText(business, input, calculation, selectedClient?.name)
    : "";

  function changeMaterial(index: number, field: keyof MaterialRow, value: string) {
    setMaterials((current) =>
      current.map((material, position) =>
        position === index ? { ...material, [field]: value } : material,
      ),
    );
    setResult(null);
  }

  function removeMaterial(index: number) {
    setMaterials((current) => {
      const updated = current.filter((_, position) => position !== index);
      return updated.length ? updated : [{ name: "", cost: "" }];
    });
    setResult(null);
  }

  function addMaterial() {
    setMaterials((current) => [...current, { name: "", cost: "" }]);
    setResult(null);
  }

  async function copyQuote() {
    try {
      await navigator.clipboard.writeText(quoteText);
      setCopyMessage("Quote copied. Paste it into a text or email.");
    } catch {
      setCopyMessage("Copy failed. Use the WhatsApp button instead.");
    }
  }

  async function saveQuote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setResult(null);
    const formData = new FormData(event.currentTarget);
    formData.set("materials", JSON.stringify(input.materials));
    const response = await createQuote(formData);
    setResult(response);
    if (response.ok) router.refresh();
  }

  return (
    <form className="quote-layout" onSubmit={saveQuote}>
      <div className="quote-controls">
        <section className="panel">
          <div className="section-heading"><div><h2>Job details</h2><p className="muted">Describe the work and set your rates.</p></div></div>
          <label>Job description
            <input name="description" value={description} onChange={(event) => { setDescription(event.target.value); setResult(null); }} maxLength={500} placeholder="e.g. Replace kitchen tap" />
          </label>
          <div className="form-row">
            <label>Client
              <select name="client_id" value={clientId} onChange={(event) => setClientId(event.target.value)}>
                <option value="">No client selected</option>
                {clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
              </select>
            </label>
            <label>Hours<input name="hours" type="number" min="0" step="0.5" inputMode="decimal" value={hours} onChange={(event) => { setHours(event.target.value); setResult(null); }} /></label>
          </div>
          <div className="form-row">
            <label>Hourly rate (€)<input name="hourly_rate" type="number" min="0" step="0.01" inputMode="decimal" value={hourlyRate} onChange={(event) => { setHourlyRate(event.target.value); setResult(null); }} /></label>
            <label>Call-out fee (€)<input name="call_out_fee" type="number" min="0" step="0.01" inputMode="decimal" value={callOutFee} onChange={(event) => { setCallOutFee(event.target.value); setResult(null); }} /></label>
          </div>
          <label>VAT
            <select name="vat_rate" value={vatRate} onChange={(event) => { setVatRate(event.target.value); setResult(null); }}>
              <option value="13.5">13.5%</option><option value="23">23%</option><option value="0">None</option>
            </select>
          </label>
        </section>

        <section className="panel">
          <div className="section-heading"><div><h2>Materials</h2><p className="muted">Add costs before your materials markup.</p></div></div>
          <div className="material-list">
            {materials.map((material, index) => (
              <div className="material-row" key={index}>
                <label className="visually-hidden" htmlFor={`material-name-${index}`}>Material name</label>
                <input
                  id={`material-name-${index}`}
                  aria-label="Material name"
                  value={material.name}
                  maxLength={160}
                  placeholder="Item"
                  onChange={(event) => changeMaterial(index, "name", event.target.value)}
                />
                <label className="visually-hidden" htmlFor={`material-cost-${index}`}>Material cost</label>
                <input
                  id={`material-cost-${index}`}
                  aria-label="Material cost"
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  value={material.cost}
                  placeholder="€ cost"
                  onChange={(event) => changeMaterial(index, "cost", event.target.value)}
                />
                <button className="icon-button" type="button" onClick={() => removeMaterial(index)} aria-label="Remove material">×</button>
              </div>
            ))}
          </div>
          <button className="button button-outline button-full" type="button" onClick={addMaterial}>＋ Add material</button>
          <label className="top-space">Markup on materials (%)
            <input name="materials_markup" type="number" min="0" step="0.1" inputMode="decimal" value={materialsMarkup} onChange={(event) => { setMaterialsMarkup(event.target.value); setResult(null); }} />
          </label>
        </section>
      </div>

      <aside className="quote-summary">
        <section className="panel">
          <div className="section-heading"><div><p className="eyebrow">Estimate</p><h2>Quote summary</h2></div></div>
          {calculation ? (
            <>
              <div className="quote-lines">
                {calculation.rows.map((row, index) => (
                  <div className="quote-line" key={`${row.label}-${index}`}><span>{row.label}</span><strong>{formatEuro(row.amount)}</strong></div>
                ))}
              </div>
              <div className="quote-total"><span>Total</span><strong>{formatEuro(calculation.total)}</strong></div>
            </>
          ) : (
            <p className="form-message error-text">Enter non-negative amounts to calculate this quote.</p>
          )}
          <p className="note">Check the VAT rate that applies to your work with Revenue.</p>
          <div className="button-row">
            <button className="button button-secondary" type="button" disabled={!calculation} onClick={copyQuote}>Copy quote</button>
            <a
              className={`button button-secondary${!calculation ? " disabled-link" : ""}`}
              href={calculation ? `https://wa.me/?text=${encodeURIComponent(quoteText)}` : undefined}
              target="_blank"
              rel="noopener noreferrer"
              aria-disabled={!calculation}
            >
              WhatsApp
            </a>
          </div>
          {copyMessage && <p className="form-message muted" role="status">{copyMessage}</p>}
          <button className="button button-primary button-full top-space" disabled={!calculation}>Save quote</button>
          {result?.ok === false && <p className="form-message error-text" role="alert">{result.error}</p>}
          {result?.ok === true && <p className="form-message success-text" role="status">{result.message}</p>}
        </section>
      </aside>
    </form>
  );
}
