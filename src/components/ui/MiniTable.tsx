import { INK, MUTED, RULE, FONT_BODY, FONT_MONO } from "../../theme/tokens";
import TableScroll from "./TableScroll";
import Th from "./Th";
import Td from "./Td";
import { fmt } from "../../utils/format";
export default function MiniTable({ rows, label }) {
  const total = rows.reduce((s, r) => s + r.amount, 0);
  return (
    <TableScroll>
      <table
        className="table-card"
        style={{ width: "100%", borderCollapse: "collapse", marginBottom: 14 }}
      >
        <thead>
          <tr>
            <Th>{label}</Th>
            <Th right>Amount (GHS)</Th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td style={{ color: MUTED, padding: 10 }}>No activity.</td>
              <td></td>
            </tr>
          )}
          {rows.map((r) => (
            <tr key={r.code} className="row-hover">
              <Td label={label}>{r.name}</Td>
              <Td right mono label="Amount (GHS)">
                {fmt(r.amount)}
              </Td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <Td bold label="Total">
              Total {label}
            </Td>
            <Td right mono bold label="Amount (GHS)">
              {fmt(total)}
            </Td>
          </tr>
        </tfoot>
      </table>
    </TableScroll>
  );
}

