import { getPlatinumToken } from "./server/platinum-auth";

async function main() {
  const token = await getPlatinumToken();
  const url = process.env.PLATINUM_API_URL || "https://georgeplatinumuatapi.azurewebsites.net";
  
  const userRes = await fetch(url + "/api/User/4697", {
    headers: { Authorization: "Bearer " + token, Accept: "application/json" }
  });
  const userData = await userRes.json();
  
  // Test 1: PascalCase UserDetail with raw userData
  const payload1 = {
    id: 0,
    cashFloat: 0,
    officeId: 1,
    isActive: true,
    user_Id: 4697,
    UserDetail: userData,
    const_CashOffice: {
      cashOffice_ID: 1,
      cashOfficeDesc: "George - York Street",
      enabled: true,
    }
  };
  
  console.log("Test 1: PascalCase UserDetail with raw userData...");
  let res = await fetch(url + "/api/ReceiptPrepaid/submit-cashier-setup", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + token,
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify(payload1)
  });
  console.log("Status:", res.status, "Response:", (await res.text()).substring(0, 300));
  
  // Test 2: Try with Newtonsoft-style casing by wrapping in User_Detail
  const payload2 = {
    id: 0,
    cashFloat: 0,
    officeId: 1,
    isActive: true,
    user_Id: 4697,
    User_Detail: userData,
    const_CashOffice: {
      cashOffice_ID: 1,
      cashOfficeDesc: "George - York Street",
      enabled: true,
    }
  };
  
  console.log("\nTest 2: User_Detail (underscore)...");
  res = await fetch(url + "/api/ReceiptPrepaid/submit-cashier-setup", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + token,
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify(payload2)
  });
  console.log("Status:", res.status, "Response:", (await res.text()).substring(0, 300));
  
  // Test 3: Try userDetails (plural)
  const payload3 = {
    id: 0,
    cashFloat: 0,
    officeId: 1,
    isActive: true,
    user_Id: 4697,
    userDetails: userData,
    const_CashOffice: {
      cashOffice_ID: 1,
      cashOfficeDesc: "George - York Street",
      enabled: true,
    }
  };
  
  console.log("\nTest 3: userDetails (plural)...");
  res = await fetch(url + "/api/ReceiptPrepaid/submit-cashier-setup", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + token,
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify(payload3)
  });
  console.log("Status:", res.status, "Response:", (await res.text()).substring(0, 300));
}
main().catch(e => console.error(e));
