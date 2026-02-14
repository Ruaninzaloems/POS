import { getPlatinumToken } from "./server/platinum-auth";

async function main() {
  const token = await getPlatinumToken();
  const url = process.env.PLATINUM_API_URL || "https://georgeplatinumuatapi.azurewebsites.net";
  
  // Get the real user data first
  const userRes = await fetch(url + "/api/User/4697", {
    headers: { Authorization: "Bearer " + token, Accept: "application/json" }
  });
  const userData = await userRes.json();
  console.log("User data keys:", Object.keys(userData));
  
  // Try passing the entire user object as-is from the API response
  const payload = {
    id: 0,
    cashFloat: 0,
    officeId: 1,
    isActive: true,
    user_Id: 4697,
    userDetail: userData,
    const_CashOffice: {
      cashOffice_ID: 1,
      cashOfficeDesc: "George - York Street",
      enabled: true,
      cashOnHandLimit: 999999,
    }
  };
  
  console.log("Sending with raw userData as userDetail...");
  const res = await fetch(url + "/api/ReceiptPrepaid/submit-cashier-setup", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + token,
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify(payload)
  });
  
  const text = await res.text();
  console.log("Status:", res.status);
  console.log("Response:", text.substring(0, 800));
}
main().catch(e => console.error(e));
