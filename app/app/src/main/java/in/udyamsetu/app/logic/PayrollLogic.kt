// UdyamSetu — Payroll-lite pure logic. Mirrors site/payroll.js.
// PF/ESI/PT/TDS rates are user + CA confirmed — the app assumes NO statutory
// rate (default 0). Pro-rata: gross = monthlySalary * presentDays / totalDays
// (half-up paise). PF/ESI apply to the pro-rata gross. PT/TDS are taken as
// entered (not pro-rated). Deductions can never exceed gross.
package `in`.udyamsetu.app.logic

data class EmployeeRow(
    val id: String,
    val name: String,
    val monthlySalaryPaise: Long,
    val pfPct: Double = 0.0,
    val esiPct: Double = 0.0,
    val ptPaise: Long = 0L,
    val tdsPaise: Long = 0L,
)

data class Payslip(
    val employeeId: String,
    val month: String,
    val presentDays: Int,
    val totalDays: Int,
    val grossPaise: Long,
    val pfPaise: Long,
    val esiPaise: Long,
    val ptPaise: Long,
    val tdsPaise: Long,
    val advancePaise: Long,
    val netPaise: Long,
)

fun roundDivPay(n: Long, d: Long): Long {
    require(n >= 0) { "roundDivPay: negative input" }
    return (2 * n + d) / (2 * d)
}

fun pctOfPay(amountPaise: Long, pct: Double): Long {
    val bps = (pct * 100).toLong()
    return roundDivPay(amountPaise * bps, 10_000)
}

fun calcPayslip(
    employee: EmployeeRow,
    presentDays: Int,
    totalDays: Int,
    month: String,
    advancePaise: Long = 0L,
): Payslip {
    require(totalDays > 0) { "totalDays must be positive" }
    require(presentDays in 0..totalDays) { "presentDays must be 0..totalDays" }
    require(advancePaise >= 0) { "advance must be non-negative" }
    val gross = roundDivPay(employee.monthlySalaryPaise * presentDays, totalDays.toLong())
    val pf = pctOfPay(gross, employee.pfPct)
    val esi = pctOfPay(gross, employee.esiPct)
    val deductions = pf + esi + employee.ptPaise + employee.tdsPaise
    require(deductions <= gross) { "deductions exceed gross pay" }
    val net = gross - deductions - advancePaise
    require(net >= 0) { "advance exceeds net pay" }
    return Payslip(
        employeeId = employee.id, month = month,
        presentDays = presentDays, totalDays = totalDays,
        grossPaise = gross, pfPaise = pf, esiPaise = esi,
        ptPaise = employee.ptPaise, tdsPaise = employee.tdsPaise,
        advancePaise = advancePaise, netPaise = net,
    )
}

fun payslipText(p: Payslip, employeeName: String): String {
    fun r(paise: Long) = "${paise / 100}.${(paise % 100).toString().padStart(2, '0')}"
    return "Payslip ${p.month} — $employeeName\n" +
        "Present ${p.presentDays}/${p.totalDays} days\n" +
        "Gross ₹${r(p.grossPaise)} | PF ₹${r(p.pfPaise)} | ESI ₹${r(p.esiPaise)}\n" +
        "PT ₹${r(p.ptPaise)} | TDS ₹${r(p.tdsPaise)} | Advance ₹${r(p.advancePaise)}\n" +
        "Net Pay ₹${r(p.netPaise)}"
}
