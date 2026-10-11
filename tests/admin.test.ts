import { it, expect, vi, beforeEach } from "vitest";
import { HttpError } from "@/lib/http";
const mocked = vi.hoisted(() => ({
  admin: vi.fn(),
  client: vi.fn(),
  range: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ requireAdmin: mocked.admin }));
vi.mock("@/lib/supabase/server", () => ({ adminClient: mocked.client }));
import { GET } from "@/app/api/admin/profiles/route";
beforeEach(() => {
  vi.clearAllMocks();
});
it("admin API rejects non-admin before privileged query", async () => {
  mocked.admin.mockRejectedValue(new HttpError(403, "Forbidden"));
  expect((await GET()).status).toBe(403);
  expect(mocked.client).not.toHaveBeenCalled();
});
it("admin API selects only profile fields", async () => {
  mocked.admin.mockResolvedValue({});
  const order = vi.fn(() => ({ range: mocked.range }));
  const select = vi.fn(() => ({ order }));
  mocked.client.mockReturnValue({ from: () => ({ select }) });
  mocked.range.mockResolvedValue({
    data: [{ name: "Student", strand: "education", ignite_year: 1 }],
    error: null,
  });
  expect((await GET()).status).toBe(200);
  expect(select).toHaveBeenCalledWith("name,strand,ignite_year");
});
