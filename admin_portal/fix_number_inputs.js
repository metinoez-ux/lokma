const fs = require('fs');
const path = 'src/app/[locale]/admin/plans/page.tsx';
let content = fs.readFileSync(path, 'utf8');

// Fix monthlyFee
content = content.replace(
  /value=\{formData\.monthlyFee \?\? 0\}/g,
  "value={formData.monthlyFee === '' ? '' : (formData.monthlyFee ?? 0)}"
);
content = content.replace(
  /onChange=\{\(e\) => setFormData\(\{ \.\.\.formData, monthlyFee: parseFloat\(e\.target\.value\) \|\| 0 \}\)\}/g,
  "onChange={(e) => setFormData({ ...formData, monthlyFee: e.target.value === '' ? '' : parseFloat(e.target.value) } as any)}"
);

// Fix yearlyFee
content = content.replace(
  /value=\{formData\.yearlyFee \|\| ''\}/g,
  "value={formData.yearlyFee === '' || formData.yearlyFee === null ? '' : formData.yearlyFee}"
);
content = content.replace(
  /onChange=\{e => setFormData\(\{ \.\.\.formData, yearlyFee: parseFloat\(e\.target\.value\) \}\)\}/g,
  "onChange={e => setFormData({ ...formData, yearlyFee: e.target.value === '' ? '' : parseFloat(e.target.value) } as any)}"
);

// Fix personnelOverageFee
content = content.replace(
  /value=\{formData\.personnelOverageFee \?\? 0\}/g,
  "value={formData.personnelOverageFee === '' ? '' : (formData.personnelOverageFee ?? 0)}"
);
content = content.replace(
  /onChange=\{e => setFormData\(\{ \.\.\.formData, personnelOverageFee: parseFloat\(e\.target\.value\) \|\| 0 \}\)\}/g,
  "onChange={e => setFormData({ ...formData, personnelOverageFee: e.target.value === '' ? '' : parseFloat(e.target.value) } as any)}"
);

// Fix tableReservationFee
content = content.replace(
  /value=\{formData\.tableReservationFee \?\? 0\}/g,
  "value={formData.tableReservationFee === '' ? '' : (formData.tableReservationFee ?? 0)}"
);
content = content.replace(
  /onChange=\{e => setFormData\(\{ \.\.\.formData, tableReservationFee: parseFloat\(e\.target\.value\) \|\| 0 \} as any\)\}/g,
  "onChange={e => setFormData({ ...formData, tableReservationFee: e.target.value === '' ? '' : parseFloat(e.target.value) } as any)}"
);

// Fix tableReservationOverageFee
content = content.replace(
  /value=\{formData\.tableReservationOverageFee \?\? 0\}/g,
  "value={formData.tableReservationOverageFee === '' ? '' : (formData.tableReservationOverageFee ?? 0)}"
);
content = content.replace(
  /onChange=\{e => setFormData\(\{ \.\.\.formData, tableReservationOverageFee: parseFloat\(e\.target\.value\) \|\| 0 \} as any\)\}/g,
  "onChange={e => setFormData({ ...formData, tableReservationOverageFee: e.target.value === '' ? '' : parseFloat(e.target.value) } as any)}"
);


// Fix sponsoredFeePerConversion
content = content.replace(
  /value=\{formData\.sponsoredFeePerConversion \?\? 0\}/g,
  "value={formData.sponsoredFeePerConversion === '' ? '' : (formData.sponsoredFeePerConversion ?? 0)}"
);
content = content.replace(
  /onChange=\{e => setFormData\(\{ \.\.\.formData, sponsoredFeePerConversion: parseFloat\(e\.target\.value\) \|\| 0 \} as any\)\}/g,
  "onChange={e => setFormData({ ...formData, sponsoredFeePerConversion: e.target.value === '' ? '' : parseFloat(e.target.value) } as any)}"
);

// Fix freeOrderCount
content = content.replace(
  /value=\{formData\.freeOrderCount \?\? 0\}/g,
  "value={formData.freeOrderCount === '' ? '' : (formData.freeOrderCount ?? 0)}"
);
content = content.replace(
  /onChange=\{e => setFormData\(\{ \.\.\.formData, freeOrderCount: parseInt\(e\.target\.value\) \|\| 0 \} as any\)\}/g,
  "onChange={e => setFormData({ ...formData, freeOrderCount: e.target.value === '' ? '' : parseInt(e.target.value) } as any)}"
);

// Fix perOrderFeeAmount
content = content.replace(
  /value=\{formData\.perOrderFeeAmount \?\? 0\}/g,
  "value={formData.perOrderFeeAmount === '' ? '' : (formData.perOrderFeeAmount ?? 0)}"
);
content = content.replace(
  /onChange=\{e => setFormData\(\{ \.\.\.formData, perOrderFeeAmount: parseFloat\(e\.target\.value\) \|\| 0 \} as any\)\}/g,
  "onChange={e => setFormData({ ...formData, perOrderFeeAmount: e.target.value === '' ? '' : parseFloat(e.target.value) } as any)}"
);


// Fix eslPurchasePrice
content = content.replace(
  /value=\{formData\.eslPurchasePrice \?\? 0\}/g,
  "value={formData.eslPurchasePrice === '' ? '' : (formData.eslPurchasePrice ?? 0)}"
);
content = content.replace(
  /onChange=\{e => setFormData\(\{ \.\.\.formData, eslPurchasePrice: parseFloat\(e\.target\.value\) \|\| 0 \} as any\)\}/g,
  "onChange={e => setFormData({ ...formData, eslPurchasePrice: e.target.value === '' ? '' : parseFloat(e.target.value) } as any)}"
);

// Fix eslRentalPrice
content = content.replace(
  /value=\{formData\.eslRentalPrice \?\? 0\}/g,
  "value={formData.eslRentalPrice === '' ? '' : (formData.eslRentalPrice ?? 0)}"
);
content = content.replace(
  /onChange=\{e => setFormData\(\{ \.\.\.formData, eslRentalPrice: parseFloat\(e\.target\.value\) \|\| 0 \} as any\)\}/g,
  "onChange={e => setFormData({ ...formData, eslRentalPrice: e.target.value === '' ? '' : parseFloat(e.target.value) } as any)}"
);

// Fix eslSystemMonthlyFee
content = content.replace(
  /value=\{formData\.eslSystemMonthlyFee \?\? 0\}/g,
  "value={formData.eslSystemMonthlyFee === '' ? '' : (formData.eslSystemMonthlyFee ?? 0)}"
);
content = content.replace(
  /onChange=\{e => setFormData\(\{ \.\.\.formData, eslSystemMonthlyFee: parseFloat\(e\.target\.value\) \|\| 0 \} as any\)\}/g,
  "onChange={e => setFormData({ ...formData, eslSystemMonthlyFee: e.target.value === '' ? '' : parseFloat(e.target.value) } as any)}"
);

fs.writeFileSync(path, content, 'utf8');
console.log('done');
