import { getPlatinumToken } from "./server/platinum-auth";

async function main() {
  const token = await getPlatinumToken();
  const url = process.env.PLATINUM_API_URL || "https://georgeplatinumuatapi.azurewebsites.net";
  
  // Get cashier details - the response might include the full POSCashier with UserDetail
  console.log("=== Checking cashier-detailsById ===");
  let res = await fetch(url + "/api/ReceiptPrepaid/cashier-detailsById?cashierId=4697", {
    headers: { Authorization: "Bearer " + token, Accept: "application/json" }
  });
  console.log("Status:", res.status);
  const cashierData = await res.json();
  console.log("Keys:", Object.keys(cashierData));
  console.log("Full response:", JSON.stringify(cashierData, null, 2).substring(0, 1500));
  
  // If we got full data with UserDetail, try resubmitting it with modifications
  if (cashierData && cashierData.id !== undefined) {
    console.log("\n=== Attempting submit with cashier record as base ===");
    const submitPayload = {
      ...cashierData,
      officeId: 1,
      isActive: true,
      cashFloat: 0,
      user_Id: 4697,
    };
    
    res = await fetch(url + "/api/ReceiptPrepaid/submit-cashier-setup", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + token,
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      body: JSON.stringify(submitPayload)
    });
    console.log("Submit Status:", res.status);
    console.log("Submit Response:", (await res.text()).substring(0, 500));
  }
}
main().catch(e => console.error(e));
