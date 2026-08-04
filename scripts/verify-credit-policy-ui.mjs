import fs from "node:fs";

const required = [
  ["electron/main.ts", "creditPoliciesList"],
  ["electron/main.ts", "creditPolicySave"],
  ["electron/preload.ts", "creditPoliciesList"],
  ["src/assets/types/global.d.ts", "creditPolicySave"],
  ["src/pages/index.ts", "CreditPoliciesPage"],
  ["src/App.tsx", 'tab === "creditos"'],
  ["src/app/config/navigation.ts", "creditos"],
  ["src/pages/CreditPoliciesPage.tsx", "Políticas de crédito"],
];

let failed = false;
for (const [file, token] of required) {
  const ok = fs.existsSync(file) && fs.readFileSync(file, "utf8").includes(token);
  console.log(`${ok ? "OK" : "ERROR"} - ${file}: ${token}`);
  if (!ok) failed = true;
}
if (failed) process.exit(1);
console.log("Credit Policy UI Pack verificado.");
