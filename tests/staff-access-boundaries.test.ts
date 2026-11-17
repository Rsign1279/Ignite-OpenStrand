import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const teacherEmail = "mtrump@bentonvillek12.org";
const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  adminClient: vi.fn(),
  loadAttempts: vi.fn(),
  profiles: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  serverClient: async () => ({ auth: { getUser: mocks.getUser } }),
  adminClient: mocks.adminClient,
}));
vi.mock("@/lib/analytics/data", () => ({
  loadAttempts: mocks.loadAttempts,
}));
vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw new Error(`REDIRECT:${path}`);
  },
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("@/components/staff/chart-loader", () => ({
  ProgramCharts: () => null,
  StudentCharts: () => null,
}));

import { isAdmin, requireAdmin } from "@/lib/auth";
import { GET as analytics } from "@/app/api/staff/analytics/route";
import { GET as csv } from "@/app/api/staff/export-csv/route";
import { GET as profiles } from "@/app/api/admin/profiles/route";
import Dashboard from "@/app/staff/dashboard/page";
import Attempts from "@/app/staff/page";
import Student from "@/app/staff/student/[id]/page";
import Registrations from "@/app/admin/page";

const staff = {
  id: "11111111-1111-4111-8111-111111111111",
  email: teacherEmail,
  is_anonymous: false,
};
const profileRows = [
  { name: "Synthetic learner A", strand: "education", ignite_year: 1 },
  { name: "Synthetic learner B", strand: "technology", ignite_year: 2 },
];

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("ADMIN_EMAILS", ` other-advisor@example.org, ${teacherEmail} `);
  mocks.getUser.mockResolvedValue({ data: { user: staff }, error: null });
  mocks.loadAttempts.mockResolvedValue([]);
  mocks.profiles.mockResolvedValue({ data: profileRows, error: null });
  mocks.adminClient.mockReturnValue({
    from: () => ({
      select: () => ({ order: () => ({ range: mocks.profiles }) }),
    }),
  });
});

afterEach(() => vi.unstubAllEnvs());

const endpoints = [
  [
    "analytics",
    () => analytics(new Request("https://studio.example/api/staff/analytics")),
  ],
  [
    "CSV",
    () =>
      csv(
        new Request("https://studio.example/api/staff/export-csv?id=invalid"),
      ),
  ],
  ["profiles", profiles],
] as const;

const rejectedIdentities = [
  ["missing session", null, null, 401],
  [
    "failed verification even with matching email",
    staff,
    new Error("AUTH_FAILED"),
    401,
  ],
  [
    "anonymous identity carrying the allowlisted email",
    { ...staff, is_anonymous: true },
    null,
    403,
  ],
  [
    "ordinary anonymous student",
    { id: staff.id, is_anonymous: true },
    null,
    403,
  ],
  [
    "permanent nonstaff identity",
    { ...staff, email: "student@example.org" },
    null,
    403,
  ],
  [
    "spoofed staff user metadata",
    {
      ...staff,
      email: "student@example.org",
      user_metadata: { role: "admin", email: teacherEmail },
    },
    null,
    403,
  ],
] as const;

describe("staff access uses verified provider identity before private reads", () => {
  it.each(rejectedIdentities)(
    "rejects %s across every staff data API",
    async (_name, user, error, status) => {
      mocks.getUser.mockResolvedValue({ data: { user }, error });
      for (const [name, endpoint] of endpoints) {
        const response = await endpoint();
        expect(response.status, name).toBe(status);
        expect(response.headers.get("cache-control"), name).toBe("no-store");
        expect(await response.text(), name).not.toContain("Synthetic learner");
      }
      expect(mocks.loadAttempts).not.toHaveBeenCalled();
      expect(mocks.adminClient).not.toHaveBeenCalled();
      expect(mocks.profiles).not.toHaveBeenCalled();
    },
  );

  it("allows the verified teacher across program analytics, all profiles, and CSV", async () => {
    const auth = await requireAdmin();
    expect(auth.user.email).toBe(teacherEmail);
    const overview = await analytics(
      new Request("https://studio.example/api/staff/analytics"),
    );
    expect(overview.status).toBe(200);
    expect(overview.headers.get("cache-control")).toBe("no-store");
    expect(await overview.json()).toHaveProperty("kpis.activeStudents", 0);
    const allProfiles = await profiles();
    expect(allProfiles.status).toBe(200);
    expect(await allProfiles.json()).toEqual(profileRows);
    const exportResponse = await csv(
      new Request("https://studio.example/api/staff/export-csv"),
    );
    expect(exportResponse.status).toBe(200);
    expect(exportResponse.headers.get("content-disposition")).toContain(
      "attachment",
    );
    expect(exportResponse.headers.get("cache-control")).toBe("no-store");
  });

  it.each(rejectedIdentities)(
    "redirects %s before any staff page reads data",
    async (_name, user, error) => {
      mocks.getUser.mockResolvedValue({ data: { user }, error });
      const searchParams = Promise.resolve({});
      await expect(Dashboard({ searchParams })).rejects.toThrow(
        "REDIRECT:/staff/login",
      );
      await expect(Attempts({ searchParams })).rejects.toThrow(
        "REDIRECT:/staff/login",
      );
      await expect(Registrations()).rejects.toThrow("REDIRECT:/staff/login");
      await expect(
        Student({ params: Promise.resolve({ id: staff.id }), searchParams }),
      ).rejects.toThrow("REDIRECT:/staff/login");
      expect(mocks.loadAttempts).not.toHaveBeenCalled();
      expect(mocks.adminClient).not.toHaveBeenCalled();
    },
  );

  it("accepts teacher page access without restricting the dashboard to a single strand", async () => {
    const searchParams = Promise.resolve({});
    await expect(Dashboard({ searchParams })).resolves.toBeTruthy();
    await expect(Attempts({ searchParams })).resolves.toBeTruthy();
    await expect(
      Student({ params: Promise.resolve({ id: staff.id }), searchParams }),
    ).resolves.toBeTruthy();
    expect(mocks.loadAttempts).toHaveBeenCalledWith();
    expect(mocks.loadAttempts).toHaveBeenCalledWith(undefined, true);
    expect(mocks.loadAttempts).toHaveBeenCalledWith(staff.id, true);
    mocks.profiles.mockResolvedValue({
      data: profileRows.map((row, index) => ({
        ...row,
        user_id:
          index === 0 ? staff.id : "22222222-2222-4222-8222-222222222222",
      })),
      error: null,
    });
    await expect(Registrations()).resolves.toBeTruthy();
  });

  it("uses exact, case-insensitive allowlist entries rather than domains or editable metadata", () => {
    expect(
      isAdmin({ email: teacherEmail.toUpperCase(), is_anonymous: false }),
    ).toBe(true);
    expect(
      isAdmin({ email: `prefix-${teacherEmail}`, is_anonymous: false }),
    ).toBe(false);
    expect(
      isAdmin({ email: "another@bentonvillek12.org", is_anonymous: false }),
    ).toBe(false);
    expect(isAdmin(staff, "")).toBe(false);
    expect(isAdmin({ ...staff, is_anonymous: true })).toBe(false);
  });
});
