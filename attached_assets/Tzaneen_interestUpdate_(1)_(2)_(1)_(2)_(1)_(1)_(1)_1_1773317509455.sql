
--select * from billing_period where financialyear='2022/2023'
declare @currentperiodid int =85


update Billing_BillingCycleProcess set DueDate=Getdate() where BillPeriodID=@currentperiodid-1
update Cons_Account  set DueDate=getdate()
update  billing_run set DueDate=getdate() where BillPeriodID=@currentperiodid-1
update Billing_CyclePeriod set DueDate=getdate() where BillPeriodID=@currentperiodid-1
update Billing_CyclePeriod_Staging set DueDate=getdate() where BillPeriodID=@currentperiodid-1