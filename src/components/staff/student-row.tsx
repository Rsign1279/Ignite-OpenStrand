"use client";
import { useRouter } from "next/navigation";
export function StudentGrowthRow({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  return (
    <tr
      className="student-growth-row"
      onClick={(event) => {
        if (
          event.button !== 0 ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey ||
          window.getSelection()?.toString()
        )
          return;
        if (
          event.target instanceof Element &&
          event.target.closest("a,button,input,summary")
        )
          return;
        router.push(href);
      }}
    >
      {children}
    </tr>
  );
}
