import xlsx from 'xlsx';

const wb = xlsx.readFile('data/Work_Order_Tracker Data.xlsx');
const sheet = wb.Sheets['work order tracker'];
const records = xlsx.utils.sheet_to_json(sheet, { defval: null });
console.log("Total records:", records.length);
if (records.length > 0) {
  console.log("Record 0 Keys:");
  console.log(Object.keys(records[0]));
  console.log("\nRecord 0 sample values:");
  console.log(records[0]);
}
