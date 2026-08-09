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
// No hardcoded DEFAULT_PROJECTS — users create projects via the UI.
export const DEFAULT_PROJECTS: Array<{
  id: string;
  name: string;
  status: string;
  projectType: string;
  recognitionMethod: string;
  contractValue: number;
  estimatedCost: number;
}> = [];

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
  nextEntryNum: 1,
  nextInvoiceNum: 1,
  ssnitEmployeeRate: 0,
  ssnitEmployerRate: 0,
  brackets: [],
  nhilGetfundRate: 0,
  vatRate: 0,
  bills: [],
};
