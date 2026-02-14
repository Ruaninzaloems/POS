import { getPlatinumToken } from "./server/platinum-auth";

async function main() {
  const token = await getPlatinumToken();
  const url = process.env.PLATINUM_API_URL || "https://georgeplatinumuatapi.azurewebsites.net";
  
  const userRes = await fetch(url + "/api/User/4697", {
    headers: { Authorization: "Bearer " + token, Accept: "application/json" }
  });
  const userData = await userRes.json();
  
  // Test: Full PascalCase everything
  const payload = {
    Id: 0,
    CashFloat: 0,
    OfficeId: 1,
    IsActive: true,
    User_Id: 4697,
    UserDetail: {
      UserId: userData.userId,
      UserName: userData.userName,
      Password: userData.password,
      Company: userData.company,
      TelNo: userData.telNo,
      EMail: userData.eMail,
      FirstName: userData.firstName,
      LastName: userData.lastName,
      EmpID: userData.empID,
      DepartmentID: userData.departmentID,
      Enabled: userData.enabled,
      TotalLogin: userData.totalLogin,
      LastLoginDate: userData.lastLoginDate,
      SendSMS: userData.sendSMS,
      SuperUser: userData.superUser,
      DateCaptured: userData.dateCaptured,
      CapturerID: userData.capturerID,
      PasswordNeverExpire: userData.passwordNeverExpire,
      PasswordLastChangedDate: userData.passwordLastChangedDate,
      ModifierID: userData.modifierID,
      DateModified: userData.dateModified,
      TemporaryPassword: userData.temporaryPassword,
      CashFloat: userData.cashFloat,
      StartDate: userData.startDate,
      EndDate: userData.endDate,
      HistoricUser: userData.historicUser,
      TransactionPassword: userData.transactionPassword,
    },
    Const_CashOffice: {
      CashOffice_ID: 1,
      CashOfficeDesc: "George - York Street",
      Enabled: true,
      CashOnHandLimit: 999999,
    }
  };
  
  console.log("Test: Full PascalCase...");
  const res = await fetch(url + "/api/ReceiptPrepaid/submit-cashier-setup", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + token,
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify(payload)
  });
  console.log("Status:", res.status);
  console.log("Response:", (await res.text()).substring(0, 500));
}
main().catch(e => console.error(e));
