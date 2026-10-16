import test from 'node:test';
import assert from 'node:assert/strict';
import { buildClaimDocument, validateClaimDocumentInput, sanitizeClaimDocumentHtml, CLAIM_DOC_TEMPLATE } from './claimDocLogic.js';

const base = {
  projectId: 'c1-p1',
  claim: { Code: 'CLM-1', ExtensionDays: 10, Status: 'submitted', Entitlement: 'ماده ۵۰', Causation: 'تأخیر پرداخت' },
  delayEvents: [{ Id: 'd1', ClaimCode: 'CLM-1', Code: 'DL-1', TitleFa: 'تأخیر پرداخت', Category: 'employer', StartDate: '2026-01-01', FinishDate: '2026-01-05', ActivityCode: 'A-1', EvidenceRef: 'DOC-1' }],
  calculations: [{ Id: 'c1', DelayEventId: 'd1', Engine: 'circular5090', RuleVersion: 'r1', Status: 'approved', RawValueDays: 2.5, FinalValueDays: 2.5, ApprovedBy: 'expert', Result: { formula: 'τ = 0.697 × θ × (A/t) × (T/P)' } }],
  generatedAt: '2026-10-16T00:00:00.000Z',
};

test('ClaimDocument: missing approved calculation blocks a final claim document', () => {
  const issues = validateClaimDocumentInput({ ...base, calculations: [{ ...base.calculations[0], Status: 'calculated', FinalValueDays: null }] });
  assert.ok(issues.some(text => text.includes('تأییدشده')));
});

test('ClaimDocument: Word output contains only linked events and approved final days', () => {
  const out = buildClaimDocument({ ...base, format: 'word' });
  assert.equal(out.issues.length, 0);
  assert.match(out.filename, /EOT-CLM-1\.doc/);
  assert.match(out.body, /DL-1/);
  assert.match(out.body, /2\.5/);
  assert.match(out.body, /تمدید محاسبه و تأییدشده|Approved calculated EOT/);
});

test('ClaimDocument: standard template has 17 chapters and 51 tables with B Nazanin and timeline image', () => {
  assert.equal(CLAIM_DOC_TEMPLATE.chapters.length, 17);
  assert.equal(CLAIM_DOC_TEMPLATE.tables.length, 51);
  const out = buildClaimDocument({ ...base, format: 'word', costItems: [{ DelayEventId: 'd1', CostType: 'overhead', TitleFa: 'سربار کارگاه', Amount: 700, Currency: 'IRR', DocumentRefs: ['DOC-9@R1'] }] });
  assert.equal(out.issues.length, 0);
  assert.match(out.body, /فصل 17/);
  assert.match(out.body, /جدول 51/);
  assert.match(out.body, /B Nazanin/);
  assert.match(out.body, /data:image\/svg\+xml;base64,/);
  assert.match(out.body, /سربار کارگاه/);
  assert.match(out.body, /700/);
  assert.doesNotMatch(out.body, /راهنمای داخلی|الزامی\]|اختیاری\]/);
});

test('ClaimDocument: sanitizer strips internal guide pages, required/optional labels and yellow highlights', () => {
  const dirty = '<div class="internal-guide">راهنمای داخلی</div><p>[الزامی] متن</p><p style="background:#FFFF00">هایلایت</p><mark>مهم</mark><span class="hl">x</span>';
  const clean = sanitizeClaimDocumentHtml(dirty);
  assert.doesNotMatch(clean, /راهنمای داخلی|الزامی|#FFFF00|<mark|class="hl"/);
  assert.match(clean, /متن/);
});

test('ClaimDocument: Circular 1300 allowed-payment days are not presented as EOT', () => {
  const out = buildClaimDocument({ ...base, format: 'pdf', calculations: [{ ...base.calculations[0], Engine: 'circular1300', RawValueDays: 40, FinalValueDays: 40 }] });
  assert.ok(out.issues.some(text => text.includes('۱۳۰۰')));
  assert.match(out.body, /0 روز/);
  assert.doesNotMatch(out.body, /<td[^>]*>circular1300<\/td>/);
});
