import { staffPage,pageFilters } from "@/lib/analytics/pages";
import { loadAttempts } from "@/lib/analytics/data";
import { aggregate } from "@/lib/analytics/aggregate";
import { StaffShell } from "@/components/staff/shell";
import { OverviewContent } from "@/components/staff/overview";
export const dynamic="force-dynamic";
export default async function Dashboard({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 await staffPage();const filters=pageFilters(await searchParams),data=aggregate(await loadAttempts(),filters);
 return <StaffShell><OverviewContent data={data}/></StaffShell>;
}
