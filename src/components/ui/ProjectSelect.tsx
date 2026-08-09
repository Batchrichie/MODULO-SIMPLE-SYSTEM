import type { CSSProperties } from "react";
import { RULE, FONT_BODY } from "../../theme/tokens";
import { inputStyle } from "./styles";
import { GENERAL_PROJECT } from "../../constants/defaults";
type ProjectSelectProps = {
  value: string;
  onChange: (value: string) => void;
  projects: Array<{ id: string; name: string }>;
  style?: CSSProperties;
};

export default function ProjectSelect({ value, onChange, projects, style }: ProjectSelectProps) {
  return (
    <select
      style={style || inputStyle}
      value={value || "GEN"}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="GEN">{GENERAL_PROJECT.name}</option>
      {projects.map((p) => (
        <option key={p.id} value={p.id}>
          {p.name}
        </option>
      ))}
    </select>
  );
}

