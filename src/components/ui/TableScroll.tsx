import type { ReactNode } from "react";
type TableScrollProps = {
  children: ReactNode;
};

export default function TableScroll({ children }: TableScrollProps) {
  return (
    <div
      style={{
        width: "100%",
        overflowX: "auto",
        WebkitOverflowScrolling: "touch",
      }}
    >
      {children}
    </div>
  );
}
