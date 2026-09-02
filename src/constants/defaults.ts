// Application defaults and templates
// MINIMAL FALLBACK ONLY - Real data must come from database.

export const COMPANY_TEMPLATE = {
  name: "",
  addressLine: "",
  poBox: "",
  cityLine: "",
  phone: "",
  telephone: "",
  email: "",
  website: "",
  preparedByName: "",
  preparedByTitle: "",
  authorisedByName: "",
  authorisedByTitle: "",
};

// Projects now come from the database exclusively.
// Fallback `DEFAULT_PROJECTS` is defined below and includes General / Office.
// Include a fallback General / Office project so the UI has a default
// This is still a minimal offline fallback; real data should come from DB.
export const DEFAULT_PROJECTS: Array<{
  id: string;
  name: string;
  status: string;
  projectType: string;
  recognitionMethod: string;
  contractValue: number;
  estimatedCost: number;
}> = [
  {
    id: "GEN",
    name: "General / Office",
    status: "Active",
    projectType: "General",
    recognitionMethod: "Accrual",
    contractValue: 0,
    estimatedCost: 0,
  },
];
export const GENERAL_PROJECT = { id: "GEN", name: "General / Office" };

export const DEFAULT_DATA = {
  companyName: "",
  company: COMPANY_TEMPLATE,
  accounts: [],
  journal: [],
  employees: [],
  payrollRuns: [],
  projects: DEFAULT_PROJECTS,
  invoices: [],
  bankReconciliations: [],
  accountingPeriods: [],
  nextEntryNum: 1,
  nextInvoiceNum: 1,
  ssnitEmployeeRate: 0.055,
  ssnitEmployerRate: 0.135,
  brackets: [],
  nhilGetfundRate: 0.05,
  vatRate: 0.15,
  bills: [],
};
