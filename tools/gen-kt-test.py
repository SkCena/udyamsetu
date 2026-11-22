#!/usr/bin/env python3
"""Regenerate core/GstTest.kt from core/gst-test-vectors.json (single source of truth).
Run from repo root: python3 tools/gen-kt-test.py
Notes: package segment `in` is a Kotlin keyword -> backticked. Rates are emitted
as Doubles (18 -> 18.0)."""
import json, re

def kt_bool(b):
    return 'true' if b else 'false'

def rate(r):
    return f'{float(r):.1f}' if float(r) == int(float(r)) else str(r)

v = json.load(open('core/gst-test-vectors.json'))
out = []
out.append('// AUTO-GENERATED from core/gst-test-vectors.json — do not edit by hand.')
out.append('// Regenerate: python3 tools/gen-kt-test.py')
out.append('package `in`.udyamsetu.app.core')
out.append('')
out.append('private var passCount = 0')
out.append('private var failCount = 0')
out.append('private val failures = mutableListOf<String>()')
out.append('')
out.append('private fun eq(name: String, actual: Any?, expected: Any?) {')
out.append('    if (actual == expected) passCount++ else { failCount++; failures += "$name: expected=$expected actual=$actual" }')
out.append('}')
out.append('')
out.append('private fun line(input: InvoiceLineInput, exp: LineCalc, name: String) {')
out.append('    val got = calcLine(input)')
for k in ['grossPaise','discountPaise','taxablePaise','taxPaise','cgstPaise','sgstPaise','igstPaise']:
    out.append(f'    eq("$name.{k}", got.{k}, exp.{k})')
out.append('}')
out.append('')
out.append('fun main() {')
by_id = {}
for lv in v['lineVectors']:
    by_id[lv['id']] = lv
    e = lv['expected']
    out.append(f'    line(InvoiceLineInput(qty={lv["qty"]}, unitPricePaise={lv["unitPricePaise"]}L, discountPct={lv["discountPct"]}, taxRatePct={rate(lv["taxRatePct"])}, intraState={kt_bool(lv["intraState"])}), LineCalc({e["grossPaise"]}L, {e["discountPaise"]}L, {e["taxablePaise"]}L, {e["taxPaise"]}L, {e["cgstPaise"]}L, {e["sgstPaise"]}L, {e["igstPaise"]}L), "{lv["id"]}")')
for iv in v['invoiceVectors']:
    lines = []
    for l in iv['lines']:
        x = by_id[l] if isinstance(l, str) else l
        lines.append(f'InvoiceLineInput(qty={x["qty"]}, unitPricePaise={x["unitPricePaise"]}L, discountPct={x["discountPct"]}, taxRatePct={rate(x["taxRatePct"])}, intraState={kt_bool(x["intraState"])})')
    e = iv['expected']
    checks = '; '.join(f'eq("{iv["id"]}.{k}", got.{k}, {e[k]}L)' for k in ['taxablePaise','cgstPaise','sgstPaise','igstPaise','totalPaise','roundedTotalPaise','roundOffPaise'])
    out.append(f'    run {{ val got = calcInvoice(listOf({", ".join(lines)})); {checks} }}')
for gv in v['gstinVectors']:
    out.append(f'    eq("gstin {gv["gstin"] or "(empty)"}", isValidGSTIN("{gv["gstin"]}"), {kt_bool(gv["valid"])})')
for hv in v['hsnVectors']:
    out.append(f'    eq("hsn {hv["hsn"]}", isValidHSN("{hv["hsn"]}"), {kt_bool(hv["valid"])})')
for nv in v['invoiceNumberVectors']:
    out.append(f'    eq("invNo {nv["expected"]}", invoiceNumber("{nv["prefix"]}", "{nv["fy"]}", {nv["seq"]}), "{nv["expected"]}")')
out.append('    eq("formatINR 23600", formatINR(23600L), "₹236.00")')
out.append('    eq("formatINR 0", formatINR(0L), "₹0.00")')
out.append('    eq("formatINR -550", formatINR(-550L), "-₹5.50")')
out.append('    eq("formatINR 100800", formatINR(100800L), "₹1008.00")')
out.append('    for ((name, fn) in listOf("bad rate 25" to { calcLine(InvoiceLineInput(1, 100L, 0, 25.0, true)) }, "qty 0" to { calcLine(InvoiceLineInput(0, 100L, 0, 18.0, true)) }, "discount 101" to { calcLine(InvoiceLineInput(1, 100L, 101, 18.0, true)) }, "empty invoice" to { calcInvoice(emptyList()) }, "bad prefix" to { invoiceNumber("inv", "2026-27", 1) })) {')
out.append('        try { fn(); failCount++; failures += "$name: expected throw, got a value" } catch (e: IllegalArgumentException) { passCount++ }')
out.append('    }')
out.append('    println("GST Kotlin tests: $passCount passed, $failCount failed")')
out.append('    if (failures.isNotEmpty()) { println("\\nFAILURES:\\n" + failures.joinToString("\\n")); kotlin.system.exitProcess(1) }')
out.append('}')
open('core/GstTest.kt','w').write('\n'.join(out)+'\n')
print("GstTest.kt written")
