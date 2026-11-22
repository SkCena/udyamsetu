// UdyamSetu — invoice templates (pure logic). Look only — every template
// prints the same numbers from the shared core. Mirrors site/invoice.js
// INVOICE_TEMPLATES.
package `in`.udyamsetu.app.logic

/** Classic (default) | Modern | Minimal | Thermal 80mm. */
val INVOICE_TEMPLATES = listOf("classic", "modern", "minimal", "thermal")

fun isInvoiceTemplate(name: String): Boolean = name in INVOICE_TEMPLATES
