import { strands } from "@/config/strands";
import type { Filters } from "@/lib/analytics/model";
export function AnalyticsFilters({
  filters,
  action = "/staff/dashboard",
}: {
  filters: Filters;
  action?: string;
}) {
  return (
    <form action={action} className="analytics-filters">
      <div>
        <label htmlFor="student-search">Student name</label>
        <input
          id="student-search"
          name="student"
          type="search"
          maxLength={80}
          placeholder="Find a student…"
          defaultValue={filters.student}
        />
      </div>
      <details className="strand-picker">
        <summary>
          Strands{" "}
          <span>
            {filters.strand.length
              ? `${filters.strand.length} selected`
              : "All 10"}
          </span>
        </summary>
        <fieldset>
          <legend className="sr-only">Filter by strand</legend>
          {strands.map((s) => (
            <label key={s.id}>
              <input
                type="checkbox"
                name="strand"
                value={s.id}
                defaultChecked={filters.strand.includes(s.id)}
              />
              {s.name}
            </label>
          ))}
        </fieldset>
      </details>
      <div>
        <label htmlFor="from">From (UTC)</label>
        <input
          id="from"
          type="date"
          name="from"
          defaultValue={filters.from}
          max={filters.to || undefined}
        />
      </div>
      <div>
        <label htmlFor="to">Through (UTC)</label>
        <input
          id="to"
          type="date"
          name="to"
          defaultValue={filters.to}
          min={filters.from || undefined}
        />
      </div>
      <div>
        <label htmlFor="minimum">Minimum attempts</label>
        <input
          id="minimum"
          type="number"
          name="minAttempts"
          min={1}
          max={10000}
          defaultValue={filters.minAttempts}
        />
      </div>
      <button className="button primary" type="submit">
        Apply filters
      </button>
      <a href={action}>Clear</a>
    </form>
  );
}
