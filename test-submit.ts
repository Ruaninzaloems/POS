import { getPlatinumToken } from "./server/platinum-auth";

async function main() {
  const token = await getPlatinumToken();
  const url = process.env.PLATINUM_API_URL || "https://georgeplatinumuatapi.azurewebsites.net";
  
  const payload = {
    id: 0,
    cashFloat: 0,
    officeId: 1,
    isActive: true,
    user_Id: 4697,
    UserDetail: {
      userId: 4697,
      userName: "V2FrancoisF9522",
      password: "test",
      firstName: "Francois",
      lastName: "Francois",
      enabled: true,
      superUser: false,
      dateCaptured: "2026-02-14T10:45:36.12",
      capturerID: 777,
      passwordNeverExpire: true,
      passwordLastChangedDate: "2026-02-14T10:45:36.123",
      cashFloat: 0
    }
  };
  
  console.log("Sending PascalCase UserDetail...");
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
  console.log("Response:", text.substring(0, 500));
}
main().catch(e => console.error(e));
