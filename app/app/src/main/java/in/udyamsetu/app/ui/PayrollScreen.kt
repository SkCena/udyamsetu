// UdyamSetu — Payroll-lite. Employees, attendance, pro-rata payslip.
// PF/ESI/PT/TDS are user + CA confirmed (default 0) — the app assumes no
// statutory rate. Deductions can never exceed gross pay.
package `in`.udyamsetu.app.ui

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Card
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.navigation.NavHostController
import `in`.udyamsetu.app.R
import `in`.udyamsetu.app.data.EmployeeEntity
import `in`.udyamsetu.app.logic.EmployeeRow
import `in`.udyamsetu.app.logic.calcPayslip
import `in`.udyamsetu.app.logic.payslipText
import java.util.UUID

@Composable
fun PayrollScreen(vm: AppViewModel, nav: NavHostController) {
    val employees by vm.repo.observeEmployees().collectAsState(initial = emptyList())
    var name by remember { mutableStateOf("") }
    var salary by remember { mutableStateOf("") }
    var month by remember { mutableStateOf("") }
    var present by remember { mutableStateOf("26") }
    var totalDays by remember { mutableStateOf("30") }
    var selected by remember { mutableStateOf<EmployeeEntity?>(null) }

    LazyColumn(modifier = Modifier.padding(16.dp)) {
        item {
            SectionTitle(stringResource(R.string.payroll_title))
            HintText(stringResource(R.string.hint_payroll))
            LabeledField("Employee name", name, { name = it })
            LabeledField("Monthly salary ₹", salary, { salary = it })
            BigButton("+ Add employee") {
                if (name.isNotBlank()) {
                    vm.saveEmployee(
                        EmployeeEntity(
                            id = UUID.randomUUID().toString(), name = name.trim(),
                            monthlySalaryPaise = ((salary.toDoubleOrNull() ?: 0.0) * 100).toLong(),
                        ),
                    )
                    name = ""; salary = ""
                }
            }
            LabeledField("Month (YYYY-MM)", month, { month = it })
            LabeledField("Present days", present, { present = it })
            LabeledField("Total days", totalDays, { totalDays = it })
        }
        items(employees) { emp ->
            val payslip = runCatching {
                calcPayslip(
                    EmployeeRow(emp.id, emp.name, emp.monthlySalaryPaise, emp.pfPct, emp.esiPct, emp.ptPaise, emp.tdsPaise),
                    present.toIntOrNull() ?: 0, totalDays.toIntOrNull() ?: 30,
                    month.ifBlank { "—" },
                )
            }.getOrNull()
            Card(modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp)) {
                Column(modifier = Modifier.padding(12.dp)) {
                    Text(emp.name, fontWeight = FontWeight.Bold)
                    Text("Salary: ${formatRupees(emp.monthlySalaryPaise)} / month")
                    if (payslip != null && month.isNotBlank()) {
                        Text(payslipText(payslip, emp.name))
                    }
                }
            }
        }
    }
}
