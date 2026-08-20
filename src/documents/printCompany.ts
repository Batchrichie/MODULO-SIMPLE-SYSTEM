export function normalizePrintCompany(company: any, companyName?: string): any {
  return {
    name: company?.name?.trim() || companyName?.trim() || 'Modulo Development Ltd',
    addressLine: company?.addressLine?.trim() || '',
    cityLine: company?.cityLine?.trim() || '',
    poBox: company?.poBox?.trim() || '',
    phone: company?.phone?.trim() || '',
    telephone: company?.telephone?.trim() || '',
    email: company?.email?.trim() || '',
    website: company?.website?.trim() || '',
  };
}

export function printCompanyName(company: any, companyName?: string): string {
  return normalizePrintCompany(company, companyName).name;
}

export function printCompanyContact(company: any): string[] {
  const normalized = normalizePrintCompany(company);
  return [
    [normalized.addressLine, normalized.cityLine, normalized.poBox].filter(Boolean).join(' · '),
    [normalized.phone && `Phone: ${normalized.phone}`, normalized.telephone && `Telephone: ${normalized.telephone}`, normalized.email].filter(Boolean).join(' · '),
  ].filter(Boolean);
}
