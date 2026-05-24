import { Document, Page, Text, View, StyleSheet, renderToStream } from "@react-pdf/renderer"
import React from "react"
import { Readable } from "stream"

export type PayslipPdfProps = {
  workspaceName: string
  employee: {
    name: string
    employeeNumber: string
    jobTitle: string | null
    tin?: string | null
    ssnitNumber?: string | null
    bankName?: string | null
    bankAccount?: string | null
    momoNumber?: string | null
  }
  period: { year: number; month: number }
  currency: string
  earnings: { name: string; amount: number }[]
  deductions: { name: string; amount: number }[]
  totals: { gross: number; totalDeductions: number; netPay: number }
  ytd: { gross: number; paye: number; ssnit: number }
}

const s = StyleSheet.create({
  page: { padding: 32, fontSize: 10, fontFamily: "Helvetica", color: "#111" },
  brand: { fontSize: 16, fontWeight: "bold", color: "#b45309" },
  sub: { fontSize: 9, color: "#666", marginTop: 2 },
  title: { fontSize: 13, fontWeight: "bold", marginTop: 12 },
  box: { borderWidth: 1, borderColor: "#ccc", padding: 8, marginTop: 8, borderRadius: 4 },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2 },
  rowBetween: { flexDirection: "row", justifyContent: "space-between" },
  cell: { flexDirection: "row", justifyContent: "space-between", marginVertical: 1 },
  sectionLabel: { fontSize: 9, fontWeight: "bold", color: "#444", marginBottom: 4 },
  bold: { fontWeight: "bold" },
  divider: { borderBottomWidth: 1, borderBottomColor: "#eee", marginVertical: 4 },
  netBox: { backgroundColor: "#fdf4e3", borderColor: "#b45309", borderWidth: 1, padding: 10, marginTop: 10, borderRadius: 4 },
  footer: { marginTop: 16, fontSize: 8, color: "#666", textAlign: "center" },
})

const monthName = (m: number) =>
  ["January","February","March","April","May","June","July","August","September","October","November","December"][m - 1] ?? "?"

const fmt = (n: number, c: string) =>
  `${c} ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export function PayslipDocument(props: PayslipPdfProps) {
  return (
    <Document title={`Payslip ${props.employee.employeeNumber} ${props.period.year}-${props.period.month}`}>
      <Page size="A4" style={s.page}>
        <View>
          <Text style={s.brand}>{props.workspaceName}</Text>
          <Text style={s.sub}>PAYSLIP — {monthName(props.period.month)} {props.period.year}</Text>
        </View>

        <View style={s.box}>
          <View style={s.cell}><Text style={s.bold}>Employee</Text><Text>{props.employee.name}</Text></View>
          <View style={s.cell}><Text>Employee #</Text><Text>{props.employee.employeeNumber}</Text></View>
          {props.employee.jobTitle && (
            <View style={s.cell}><Text>Position</Text><Text>{props.employee.jobTitle}</Text></View>
          )}
          {props.employee.tin && (
            <View style={s.cell}><Text>TIN</Text><Text>{props.employee.tin}</Text></View>
          )}
          {props.employee.ssnitNumber && (
            <View style={s.cell}><Text>SSNIT #</Text><Text>{props.employee.ssnitNumber}</Text></View>
          )}
        </View>

        <View style={s.box}>
          <Text style={s.sectionLabel}>EARNINGS</Text>
          {props.earnings.length === 0 && <Text style={s.sub}>—</Text>}
          {props.earnings.map((e, i) => (
            <View key={i} style={s.cell}>
              <Text>{e.name}</Text>
              <Text>{fmt(e.amount, props.currency)}</Text>
            </View>
          ))}
          <View style={s.divider} />
          <View style={s.cell}>
            <Text style={s.bold}>Gross</Text>
            <Text style={s.bold}>{fmt(props.totals.gross, props.currency)}</Text>
          </View>
        </View>

        <View style={s.box}>
          <Text style={s.sectionLabel}>DEDUCTIONS</Text>
          {props.deductions.map((d, i) => (
            <View key={i} style={s.cell}>
              <Text>{d.name}</Text>
              <Text>{fmt(d.amount, props.currency)}</Text>
            </View>
          ))}
          <View style={s.divider} />
          <View style={s.cell}>
            <Text style={s.bold}>Total Deductions</Text>
            <Text style={s.bold}>{fmt(props.totals.totalDeductions, props.currency)}</Text>
          </View>
        </View>

        <View style={s.netBox}>
          <View style={s.rowBetween}>
            <Text style={{ ...s.bold, fontSize: 12 }}>NET PAY</Text>
            <Text style={{ ...s.bold, fontSize: 12 }}>{fmt(props.totals.netPay, props.currency)}</Text>
          </View>
        </View>

        <View style={s.box}>
          <Text style={s.sectionLabel}>YEAR-TO-DATE</Text>
          <View style={s.cell}><Text>Gross</Text><Text>{fmt(props.ytd.gross, props.currency)}</Text></View>
          <View style={s.cell}><Text>PAYE</Text><Text>{fmt(props.ytd.paye, props.currency)}</Text></View>
          <View style={s.cell}><Text>SSNIT (Employee)</Text><Text>{fmt(props.ytd.ssnit, props.currency)}</Text></View>
        </View>

        <View style={s.box}>
          <Text style={s.sub}>
            Payment method:{" "}
            {props.employee.bankName
              ? `Bank · ${props.employee.bankName} · ****${(props.employee.bankAccount ?? "").slice(-4)}`
              : props.employee.momoNumber
                ? `MoMo · ${props.employee.momoNumber}`
                : "Cash"}
          </Text>
        </View>

        <Text style={s.footer}>Generated by Crontract</Text>
      </Page>
    </Document>
  )
}

export async function renderPayslipPdf(props: PayslipPdfProps): Promise<Buffer> {
  const stream = await renderToStream(<PayslipDocument {...props} />)
  const chunks: Buffer[] = []
  for await (const chunk of stream as unknown as Readable) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : Buffer.from(chunk))
  }
  return Buffer.concat(chunks)
}
