// src/validation.ts

export function assertJournalEntry(data: {
  date: string;
  description: string;
  lines: Array<{ account: string; debit: string; credit: string }>;
}): string | null {
  if (!data.date) return 'Please select a date.';
  if (!data.description?.trim()) return 'Please enter a description.';
  const validLines = data.lines.filter(
    (l) => l.account && (parseFloat(l.debit) > 0 || parseFloat(l.credit) > 0)
  );
  if (validLines.length < 2)
    return 'A journal entry needs at least two valid lines.';
  const totalDebit = validLines.reduce(
    (s, l) => s + (parseFloat(l.debit) || 0),
    0
  );
  const totalCredit = validLines.reduce(
    (s, l) => s + (parseFloat(l.credit) || 0),
    0
  );
  if (Math.abs(totalDebit - totalCredit) > 0.01)
    return `Entry is not balanced. Debits: ${totalDebit.toFixed(
      2
    )}, Credits: ${totalCredit.toFixed(2)}`;
  return null;
}

export function assertInvoice(data: {
  billTo: string;
  items: Array<{
    description: string;
    lineType: string;
    qty: string;
    rate: string;
  }>;
  dueDate: string;
  date: string;
}): string | null {
  if (!data.billTo?.trim())
    return 'Please enter who the invoice is billed to.';
  const itemLines = data.items.filter(
    (i) => i.lineType === 'item' && i.description.trim()
  );
  if (itemLines.length === 0)
    return 'Please add at least one item line with a description.';
  for (let i = 0; i < itemLines.length; i++) {
    const it = itemLines[i];
    const qty = parseFloat(it.qty) || 0;
    const rate = parseFloat(it.rate) || 0;
    if (qty <= 0) return `Line ${i + 1}: Quantity must be greater than 0.`;
    if (rate < 0) return `Line ${i + 1}: Rate cannot be negative.`;
  }
  if (data.dueDate && data.date && data.dueDate < data.date)
    return 'Due date cannot be earlier than the invoice date.';
  return null;
}

export function assertAccount(
  data: { code: string; name: string; type: string },
  existingCodes: Set<string>
): string | null {
  if (!data.code?.trim()) return 'Account code is required.';
  if (!data.name?.trim()) return 'Account name is required.';
  if (!data.type) return 'Account type is required.';
  if (existingCodes.has(data.code.trim()))
    return `Account code "${data.code.trim()}" already exists.`;
  return null;
}

export function assertEmployee(data: {
  name: string;
  baseSalary: number;
}): string | null {
  if (!data.name?.trim()) return 'Employee name is required.';
  if (!Number.isFinite(data.baseSalary) || data.baseSalary < 0)
    return 'Base salary must be zero or greater.';
  return null;
}

export function assertProject(data: {
  name: string;
  contractValue: number;
  estimatedCost: number;
}): string | null {
  if (!data.name?.trim()) return 'Project name is required.';
  if (data.contractValue < 0) return 'Contract value cannot be negative.';
  if (data.estimatedCost < 0) return 'Estimated cost cannot be negative.';
  return null;
}

export function assertPayment(amount: number): string | null {
  if (!amount || amount <= 0)
    return 'Please enter a valid payment amount greater than 0.';
  return null;
}